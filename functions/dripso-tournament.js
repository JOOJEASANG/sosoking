'use strict';

const crypto = require('node:crypto');
const { randomUUID } = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const GAME_VERSION = 3;
const MAX_ENTRIES = 64;
const MAX_ENTRY_LENGTH = 180;
const MODES = new Set(['blank', 'naming', 'comeback', 'wrong', 'headline', 'excuse', 'manual']);
const ENTRY_MINUTES = new Set([30, 180, 360, 720, 1440]);
const PRELIM_MINUTES = new Set([60, 180, 360, 720]);
const FINALS_MINUTES = new Set([30, 60, 180]);
const BLOCKED_WORDS = /(시발|씨발|병신|개새끼|죽어|자살|전화번호|주민등록번호|실명 공개)/i;
const MAX_TOPIC_IMAGE_BYTES = 750 * 1024;
const MAX_TOPIC_IMAGE_DATA_LENGTH = 1100000;
const MAX_TOPIC_IMAGE_EDGE = 4096;

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocId(value) {
  const id = cleanText(value, 100);
  return /^[A-Za-z0-9_-]{2,100}$/.test(id) ? id : '';
}

function assertSafeText(text, label) {
  const safety = inspectContent(text);
  if (!safety.safe || BLOCKED_WORDS.test(text)) {
    throw new HttpsError('failed-precondition', `${label}에 공개하기 어려운 표현이 포함되어 있습니다.`);
  }
}

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function entryIdFor(topicId, uid) {
  return crypto.createHash('sha256').update(`${topicId}\u0000${uid}`).digest('hex').slice(0, 32);
}

function pairHash(leftId, rightId) {
  return crypto.createHash('sha256')
    .update([leftId, rightId].sort().join('\u0000'))
    .digest('hex')
    .slice(0, 40);
}

function deterministicIndex(seed, length) {
  if (length <= 1) return 0;
  return crypto.createHash('sha256').update(seed).digest().readUInt32BE(0) % length;
}

function phaseFor(topic, now = Date.now()) {
  const entry = timestampMs(topic.entryDeadline);
  const prelim = timestampMs(topic.prelimDeadline);
  if (!entry || !prelim) return 'legacy';
  if (now < entry) return 'recruiting';
  if (now < prelim) return 'prelim';
  if (topic.tournamentRound === 'closed') return 'closed';
  if (topic.tournamentRound === 'final') return now < timestampMs(topic.finalDeadline) ? 'final' : 'transition';
  if (topic.tournamentRound === 'semifinal') return now < timestampMs(topic.semifinalDeadline) ? 'semifinal' : 'transition';
  return 'transition';
}

function jpegDimensions(buffer) {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function decodeTopicImageDataUrl(value) {
  const dataUrl = String(value || '');
  if (!dataUrl) return null;
  if (dataUrl.length > MAX_TOPIC_IMAGE_DATA_LENGTH) throw new HttpsError('invalid-argument', '첨부 사진 용량이 너무 큽니다.');
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new HttpsError('invalid-argument', '첨부 사진 형식이 올바르지 않습니다.');
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > MAX_TOPIC_IMAGE_BYTES) throw new HttpsError('invalid-argument', '첨부 사진은 압축 후 750KB 이하여야 합니다.');
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) {
    throw new HttpsError('invalid-argument', '정상적인 JPG 사진만 첨부할 수 있습니다.');
  }
  const dimensions = jpegDimensions(buffer);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1
    || dimensions.width > MAX_TOPIC_IMAGE_EDGE || dimensions.height > MAX_TOPIC_IMAGE_EDGE) {
    throw new HttpsError('invalid-argument', '첨부 사진의 크기 정보를 확인할 수 없습니다.');
  }
  return { buffer, ...dimensions };
}

async function storeTopicImage(topicId, image) {
  if (!image) return null;
  const bucket = getStorage().bucket();
  const imagePath = `dripso/topics/${topicId}.jpg`;
  const token = randomUUID();
  const file = bucket.file(imagePath);
  await file.save(image.buffer, {
    resumable: false,
    validation: 'md5',
    metadata: {
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: { firebaseStorageDownloadTokens: token, service: 'dripso-final-four-image' }
    }
  });
  return {
    file,
    imagePath,
    imageUrl: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(imagePath)}?alt=media&token=${encodeURIComponent(token)}`,
    imageWidth: image.width,
    imageHeight: image.height,
    imageByteSize: image.buffer.length
  };
}

async function loadNickname(uid) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists ? cleanText(snap.data().nickname, 20) || '익명 드리퍼' : '익명 드리퍼';
}

async function requireTopic(topicId) {
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const snap = await topicRef.get();
  if (!snap.exists || snap.data()?.status !== 'visible') throw new HttpsError('not-found', '드립 배틀을 찾을 수 없습니다.');
  const topic = snap.data();
  if (Number(topic.gameVersion) !== GAME_VERSION || !MODES.has(topic.mode)) {
    throw new HttpsError('failed-precondition', '파이널 토너먼트가 적용된 배틀이 아닙니다.');
  }
  return { topicRef, topic };
}

async function loadEntries(topicRef) {
  const snap = await topicRef.collection('comments').where('status', '==', 'visible').limit(MAX_ENTRIES).get();
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

function rankedEntries(entries) {
  return [...entries].sort((a, b) =>
    Math.max(0, Number(b.prelimScore) || 0) - Math.max(0, Number(a.prelimScore) || 0)
    || Math.max(0, Number(b.prelimDuels) || 0) - Math.max(0, Number(a.prelimDuels) || 0)
    || timestampMs(a.createdAt) - timestampMs(b.createdAt)
    || a.id.localeCompare(b.id)
  );
}

function publicEntry(entry, includeNickname = true) {
  const value = {
    id: entry.id,
    text: cleanText(entry.text, MAX_ENTRY_LENGTH),
    prelimScore: Math.max(0, Number(entry.prelimScore) || 0),
    prelimDuels: Math.max(0, Number(entry.prelimDuels) || 0),
    createdAtMs: timestampMs(entry.createdAt)
  };
  if (includeNickname) value.nickname = cleanText(entry.nickname, 20) || '익명 드리퍼';
  return value;
}

function matchRef(topicId, matchId) {
  return db.doc(`dripso_tournament_matches/${topicId}/items/${matchId}`);
}

function winnerFromMatch(match) {
  const leftVotes = Math.max(0, Number(match.leftVotes) || 0);
  const rightVotes = Math.max(0, Number(match.rightVotes) || 0);
  if (leftVotes > rightVotes) return match.leftEntryId;
  if (rightVotes > leftVotes) return match.rightEntryId;
  return Number(match.leftSeed) <= Number(match.rightSeed) ? match.leftEntryId : match.rightEntryId;
}

async function initializeTournament(topicRef, topic) {
  const entries = rankedEntries(await loadEntries(topicRef));
  const seedIds = entries.slice(0, 4).map(entry => entry.id);
  const refs = { topicRef };
  if (seedIds.length >= 4) {
    refs.semi1 = matchRef(topicRef.id, 'semi1');
    refs.semi2 = matchRef(topicRef.id, 'semi2');
  } else if (seedIds.length === 3) {
    refs.semi2 = matchRef(topicRef.id, 'semi2');
  } else if (seedIds.length === 2) {
    refs.final = matchRef(topicRef.id, 'final');
  }

  await db.runTransaction(async tx => {
    const fresh = await tx.get(topicRef);
    if (!fresh.exists || fresh.data()?.tournamentInitializedAt) return;
    const now = FieldValue.serverTimestamp();
    if (!seedIds.length) {
      tx.set(topicRef, { tournamentRound: 'closed', tournamentSeedIds: [], finalizedAt: now, updatedAt: now }, { merge: true });
      return;
    }
    if (seedIds.length === 1) {
      const champion = entries[0];
      tx.set(topicRef, {
        tournamentRound: 'closed', tournamentSeedIds: seedIds,
        championEntryId: champion.id, winnerEntryId: champion.id,
        winnerText: cleanText(champion.text, MAX_ENTRY_LENGTH),
        winnerNickname: cleanText(champion.nickname, 20) || '익명 드리퍼',
        tournamentInitializedAt: now, finalizedAt: now, updatedAt: now
      }, { merge: true });
      return;
    }
    const baseMatch = { topicId: topicRef.id, status: 'active', leftVotes: 0, rightVotes: 0, createdAt: now, updatedAt: now };
    if (seedIds.length === 2) {
      tx.set(refs.final, { ...baseMatch, round: 'final', leftEntryId: seedIds[0], rightEntryId: seedIds[1], leftSeed: 1, rightSeed: 2 });
      tx.set(topicRef, {
        tournamentRound: 'final', tournamentSeedIds: seedIds,
        semifinalDeadline: fresh.data().prelimDeadline,
        finalDeadline: Timestamp.fromMillis(timestampMs(fresh.data().prelimDeadline) + Number(fresh.data().finalsMinutes || 60) * 60000),
        tournamentInitializedAt: now, updatedAt: now
      }, { merge: true });
      return;
    }
    if (seedIds.length === 3) {
      tx.set(refs.semi2, { ...baseMatch, round: 'semifinal', leftEntryId: seedIds[1], rightEntryId: seedIds[2], leftSeed: 2, rightSeed: 3 });
      tx.set(topicRef, {
        tournamentRound: 'semifinal', tournamentSeedIds: seedIds, semifinalByeEntryId: seedIds[0],
        tournamentInitializedAt: now, updatedAt: now
      }, { merge: true });
      return;
    }
    tx.set(refs.semi1, { ...baseMatch, round: 'semifinal', leftEntryId: seedIds[0], rightEntryId: seedIds[3], leftSeed: 1, rightSeed: 4 });
    tx.set(refs.semi2, { ...baseMatch, round: 'semifinal', leftEntryId: seedIds[1], rightEntryId: seedIds[2], leftSeed: 2, rightSeed: 3 });
    tx.set(topicRef, { tournamentRound: 'semifinal', tournamentSeedIds: seedIds, tournamentInitializedAt: now, updatedAt: now }, { merge: true });
  });
}

async function finalizeSemifinals(topicRef, topic) {
  const [semi1, semi2] = await Promise.all([matchRef(topicRef.id, 'semi1').get(), matchRef(topicRef.id, 'semi2').get()]);
  const firstWinner = semi1.exists ? winnerFromMatch(semi1.data()) : cleanDocId(topic.semifinalByeEntryId);
  const secondWinner = semi2.exists ? winnerFromMatch(semi2.data()) : '';
  if (!firstWinner || !secondWinner) {
    await topicRef.set({ tournamentRound: 'closed', finalizedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
  const seedIds = Array.isArray(topic.tournamentSeedIds) ? topic.tournamentSeedIds : [];
  const seedOf = id => Math.max(1, seedIds.indexOf(id) + 1 || 99);
  const semiLosers = [];
  if (semi1.exists) semiLosers.push(firstWinner === semi1.data().leftEntryId ? semi1.data().rightEntryId : semi1.data().leftEntryId);
  if (semi2.exists) semiLosers.push(secondWinner === semi2.data().leftEntryId ? semi2.data().rightEntryId : semi2.data().leftEntryId);
  const finalRef = matchRef(topicRef.id, 'final');
  await db.runTransaction(async tx => {
    const fresh = await tx.get(topicRef);
    if (!fresh.exists || fresh.data()?.tournamentRound !== 'semifinal') return;
    const now = FieldValue.serverTimestamp();
    if (semi1.exists) tx.set(semi1.ref, { status: 'closed', winnerEntryId: firstWinner, updatedAt: now }, { merge: true });
    if (semi2.exists) tx.set(semi2.ref, { status: 'closed', winnerEntryId: secondWinner, updatedAt: now }, { merge: true });
    tx.set(finalRef, {
      topicId: topicRef.id, round: 'final', status: 'active',
      leftEntryId: firstWinner, rightEntryId: secondWinner,
      leftSeed: seedOf(firstWinner), rightSeed: seedOf(secondWinner),
      leftVotes: 0, rightVotes: 0, createdAt: now, updatedAt: now
    });
    tx.set(topicRef, {
      tournamentRound: 'final', semifinalWinnerIds: [firstWinner, secondWinner], semifinalLoserIds: semiLosers,
      updatedAt: now
    }, { merge: true });
  });
}

async function finalizeFinal(topicRef, topic) {
  const finalSnap = await matchRef(topicRef.id, 'final').get();
  if (!finalSnap.exists) {
    await topicRef.set({ tournamentRound: 'closed', finalizedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
  const final = finalSnap.data();
  const championId = winnerFromMatch(final);
  const runnerUpId = championId === final.leftEntryId ? final.rightEntryId : final.leftEntryId;
  const championSnap = await topicRef.collection('comments').doc(championId).get();
  const champion = championSnap.exists ? championSnap.data() : {};
  await db.runTransaction(async tx => {
    const fresh = await tx.get(topicRef);
    if (!fresh.exists || fresh.data()?.tournamentRound !== 'final') return;
    const now = FieldValue.serverTimestamp();
    tx.set(finalSnap.ref, { status: 'closed', winnerEntryId: championId, updatedAt: now }, { merge: true });
    tx.set(topicRef, {
      tournamentRound: 'closed', championEntryId: championId, runnerUpEntryId: runnerUpId,
      winnerEntryId: championId, winnerText: cleanText(champion.text, MAX_ENTRY_LENGTH),
      winnerNickname: cleanText(champion.nickname, 20) || '익명 드리퍼',
      winnerScore: championId === final.leftEntryId ? Math.max(0, Number(final.leftVotes) || 0) : Math.max(0, Number(final.rightVotes) || 0),
      finalizedAt: now, updatedAt: now
    }, { merge: true });
  });
}

async function syncTournament(topicRef, topic) {
  let current = topic;
  if (Date.now() < timestampMs(current.prelimDeadline)) return current;
  if (!current.tournamentInitializedAt) {
    await initializeTournament(topicRef, current);
    current = (await topicRef.get()).data();
  }
  if (current.tournamentRound === 'semifinal' && Date.now() >= timestampMs(current.semifinalDeadline)) {
    await finalizeSemifinals(topicRef, current);
    current = (await topicRef.get()).data();
  }
  if (current.tournamentRound === 'final' && Date.now() >= timestampMs(current.finalDeadline)) {
    await finalizeFinal(topicRef, current);
    current = (await topicRef.get()).data();
  }
  return current;
}

async function publicMatches(topicRef, includeVotes) {
  const snap = await db.collection(`dripso_tournament_matches/${topicRef.id}/items`).get();
  const entries = await loadEntries(topicRef);
  const map = new Map(entries.map(entry => [entry.id, entry]));
  const order = { semi1: 1, semi2: 2, final: 3 };
  return snap.docs
    .sort((a, b) => (order[a.id] || 99) - (order[b.id] || 99))
    .map(item => {
      const data = item.data();
      const result = {
        id: item.id, round: data.round, status: data.status,
        leftSeed: Number(data.leftSeed) || 0, rightSeed: Number(data.rightSeed) || 0,
        left: publicEntry({ id: data.leftEntryId, ...(map.get(data.leftEntryId) || {}) }, false),
        right: publicEntry({ id: data.rightEntryId, ...(map.get(data.rightEntryId) || {}) }, false),
        winnerEntryId: cleanDocId(data.winnerEntryId)
      };
      if (includeVotes || data.status === 'closed') {
        result.leftVotes = Math.max(0, Number(data.leftVotes) || 0);
        result.rightVotes = Math.max(0, Number(data.rightVotes) || 0);
      }
      return result;
    });
}

exports.createDripsoTournamentBattle = onCall({ region: REGION, timeoutSeconds: 60, memory: '512MiB' }, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const mode = cleanText(request.data?.mode, 20);
  const title = cleanText(request.data?.title, 60);
  const prompt = cleanText(request.data?.prompt, 260);
  const entryMinutes = Number(request.data?.entryMinutes) || 180;
  const prelimMinutes = Number(request.data?.prelimMinutes) || 180;
  const finalsMinutes = Number(request.data?.finalsMinutes) || 60;
  const image = decodeTopicImageDataUrl(request.data?.imageDataUrl);
  if (!MODES.has(mode)) throw new HttpsError('invalid-argument', '지원하지 않는 배틀 방식입니다.');
  if (!ENTRY_MINUTES.has(entryMinutes) || !PRELIM_MINUTES.has(prelimMinutes) || !FINALS_MINUTES.has(finalsMinutes)) {
    throw new HttpsError('invalid-argument', '경기 시간이 올바르지 않습니다.');
  }
  if (title.length < 2 || prompt.length < 4) throw new HttpsError('invalid-argument', '배틀 제목과 문제를 조금 더 입력해 주세요.');
  assertSafeText(`${title}\n${prompt}`, '배틀');
  await enforceActionRateLimit(uid, 'dripso-tournament-create', { cooldownSeconds: 30, dailyLimit: 10 });
  const nickname = await loadNickname(uid);
  const topicRef = db.collection('dripso_topics').doc();
  const authorRef = db.doc(`dripso_topic_authors/${topicRef.id}`);
  const now = Date.now();
  const entryDeadlineMs = now + entryMinutes * 60000;
  const prelimDeadlineMs = entryDeadlineMs + prelimMinutes * 60000;
  const semifinalDeadlineMs = prelimDeadlineMs + finalsMinutes * 60000;
  const finalDeadlineMs = semifinalDeadlineMs + finalsMinutes * 60000;
  let storedImage = null;
  try {
    storedImage = await storeTopicImage(topicRef.id, image);
    const data = {
      type: mode === 'naming' ? 'naming' : 'situation', mode, gameVersion: GAME_VERSION, tournamentVersion: 1,
      title, prompt: `[[dripso-mode:${mode}]] ${prompt}`, nickname, status: 'visible',
      commentCount: 0, prelimVoteCount: 0, tournamentVoteCount: 0, pairVoteCount: 0,
      maxEntries: MAX_ENTRIES, entryMinutes, prelimMinutes, finalsMinutes,
      entryDeadline: Timestamp.fromMillis(entryDeadlineMs), prelimDeadline: Timestamp.fromMillis(prelimDeadlineMs),
      semifinalDeadline: Timestamp.fromMillis(semifinalDeadlineMs), finalDeadline: Timestamp.fromMillis(finalDeadlineMs),
      votingDeadline: Timestamp.fromMillis(finalDeadlineMs), tournamentRound: 'prelim',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    };
    if (storedImage) Object.assign(data, {
      imageUrl: storedImage.imageUrl, imagePath: storedImage.imagePath, imageWidth: storedImage.imageWidth,
      imageHeight: storedImage.imageHeight, imageByteSize: storedImage.imageByteSize, imageContentType: 'image/jpeg'
    });
    const batch = db.batch();
    batch.set(topicRef, data);
    batch.set(authorRef, { uid, topicId: topicRef.id, createdAt: FieldValue.serverTimestamp() });
    await batch.commit();
  } catch (error) {
    if (storedImage?.file) await storedImage.file.delete({ ignoreNotFound: true }).catch(() => {});
    if (error instanceof HttpsError) throw error;
    console.error('Tournament battle creation failed:', error);
    throw new HttpsError('internal', '토너먼트 배틀을 저장하지 못했습니다.');
  }
  return { success: true, topicId: topicRef.id, entryDeadlineMs, prelimDeadlineMs, semifinalDeadlineMs, finalDeadlineMs };
});

exports.submitDripsoTournamentEntry = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const text = cleanText(request.data?.text, MAX_ENTRY_LENGTH);
  if (!topicId || text.length < 2) throw new HttpsError('invalid-argument', '출전작을 2자 이상 입력해 주세요.');
  assertSafeText(text, '출전작');
  await enforceActionRateLimit(uid, 'dripso-tournament-entry', { cooldownSeconds: 5, dailyLimit: 60 });
  const nickname = await loadNickname(uid);
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const entryId = entryIdFor(topicId, uid);
  const entryRef = topicRef.collection('comments').doc(entryId);
  const authorRef = db.doc(`dripso_comment_authors/${topicId}/items/${entryId}`);
  let updated = false;
  await db.runTransaction(async tx => {
    const [topicSnap, entrySnap] = await Promise.all([tx.get(topicRef), tx.get(entryRef)]);
    if (!topicSnap.exists || topicSnap.data()?.status !== 'visible' || Number(topicSnap.data()?.gameVersion) !== GAME_VERSION) {
      throw new HttpsError('not-found', '토너먼트 배틀을 찾을 수 없습니다.');
    }
    if (phaseFor(topicSnap.data()) !== 'recruiting') throw new HttpsError('failed-precondition', '출전 시간이 마감됐습니다.');
    if (!entrySnap.exists && Number(topicSnap.data().commentCount || 0) >= MAX_ENTRIES) throw new HttpsError('resource-exhausted', '출전 정원이 마감됐습니다.');
    updated = entrySnap.exists;
    const previous = entrySnap.exists ? entrySnap.data() : {};
    tx.set(entryRef, {
      nickname, text, status: 'visible', gameVersion: GAME_VERSION,
      prelimScore: Number(previous.prelimScore || 0), prelimDuels: Number(previous.prelimDuels || 0),
      createdAt: entrySnap.exists ? previous.createdAt : FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(authorRef, { uid, topicId, commentId: entryId, createdAt: previous.createdAt || FieldValue.serverTimestamp() }, { merge: true });
    tx.set(topicRef, {
      commentCount: entrySnap.exists ? Number(topicSnap.data().commentCount || 0) : FieldValue.increment(1),
      lastCommentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { success: true, entryId, updated };
});

exports.getDripsoTournamentView = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const topicId = cleanDocId(request.data?.topicId);
  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');
  const { topicRef, topic: original } = await requireTopic(topicId);
  const topic = await syncTournament(topicRef, original);
  const phase = phaseFor(topic);
  const uid = cleanText(request.auth?.uid, 128);
  let ownEntry = null;
  if (uid) {
    const snap = await topicRef.collection('comments').doc(entryIdFor(topicId, uid)).get();
    if (snap.exists && snap.data()?.status === 'visible') ownEntry = publicEntry({ id: snap.id, ...snap.data() });
  }
  const matches = await publicMatches(topicRef, phase === 'closed');
  let entries = [];
  let winner = null;
  if (phase === 'closed') {
    const preliminary = rankedEntries(await loadEntries(topicRef));
    const priority = [topic.championEntryId, topic.runnerUpEntryId, ...(Array.isArray(topic.semifinalLoserIds) ? topic.semifinalLoserIds : [])].filter(Boolean);
    entries = [...preliminary].sort((a, b) => {
      const ai = priority.indexOf(a.id); const bi = priority.indexOf(b.id);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return preliminary.indexOf(a) - preliminary.indexOf(b);
    });
    if (entries.length) winner = publicEntry(entries[0]);
  }
  return {
    success: true, topicId, phase, mode: topic.mode,
    entryCount: Number(topic.commentCount || 0), prelimVoteCount: Number(topic.prelimVoteCount || 0),
    tournamentVoteCount: Number(topic.tournamentVoteCount || 0),
    entryDeadlineMs: timestampMs(topic.entryDeadline), prelimDeadlineMs: timestampMs(topic.prelimDeadline),
    semifinalDeadlineMs: timestampMs(topic.semifinalDeadline), finalDeadlineMs: timestampMs(topic.finalDeadline),
    ownEntry, matches, winner, entries: entries.map(entry => publicEntry(entry))
  };
});

exports.getDripsoTournamentMatchup = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');
  const { topicRef, topic: original } = await requireTopic(topicId);
  const topic = await syncTournament(topicRef, original);
  const phase = phaseFor(topic);
  const ownEntryId = entryIdFor(topicId, uid);
  if (phase === 'prelim') {
    const entries = (await loadEntries(topicRef)).filter(entry => entry.id !== ownEntryId);
    if (entries.length < 2) return { success: true, completed: true, reason: '비교할 작품이 부족합니다.' };
    const votesRef = db.collection(`dripso_tournament_prelim_voters/${topicId}/users/${uid}/votes`);
    const seen = new Set((await votesRef.limit(500).get()).docs.map(item => item.id));
    const candidates = [];
    for (let i = 0; i < entries.length; i += 1) for (let j = i + 1; j < entries.length; j += 1) {
      const key = pairHash(entries[i].id, entries[j].id);
      if (!seen.has(key)) candidates.push({ key, left: entries[i], right: entries[j] });
    }
    if (!candidates.length) return { success: true, completed: true, reason: '가능한 익명 예선을 모두 평가했습니다.' };
    const selected = candidates[deterministicIndex(`${uid}\u0000${topicId}\u0000${seen.size}`, candidates.length)];
    const swap = deterministicIndex(`${uid}\u0000${selected.key}`, 2) === 1;
    return {
      success: true, completed: false, stage: 'prelim', roundLabel: '익명 예선', matchId: '',
      left: publicEntry(swap ? selected.right : selected.left, false),
      right: publicEntry(swap ? selected.left : selected.right, false), remaining: candidates.length
    };
  }
  if (!['semifinal', 'final'].includes(phase)) return { success: true, completed: true, reason: '현재 투표 가능한 라운드가 아닙니다.' };
  const snap = await db.collection(`dripso_tournament_matches/${topicId}/items`).where('round', '==', phase).get();
  for (const matchDoc of snap.docs.sort((a, b) => a.id.localeCompare(b.id))) {
    const match = matchDoc.data();
    if (match.status !== 'active' || [match.leftEntryId, match.rightEntryId].includes(ownEntryId)) continue;
    const voteRef = db.doc(`dripso_tournament_voters/${topicId}/rounds/${phase}/matches/${matchDoc.id}/users/${uid}`);
    if ((await voteRef.get()).exists) continue;
    const [left, right] = await Promise.all([
      topicRef.collection('comments').doc(match.leftEntryId).get(),
      topicRef.collection('comments').doc(match.rightEntryId).get()
    ]);
    if (!left.exists || !right.exists) continue;
    return {
      success: true, completed: false, stage: phase, roundLabel: phase === 'semifinal' ? '파이널4 준결승' : '최종 결승',
      matchId: matchDoc.id, left: publicEntry({ id: left.id, ...left.data() }, false),
      right: publicEntry({ id: right.id, ...right.data() }, false), remaining: 1
    };
  }
  return { success: true, completed: true, reason: phase === 'semifinal' ? '투표 가능한 준결승을 모두 심사했습니다.' : '결승 투표를 완료했습니다.' };
});

exports.voteDripsoTournamentMatchup = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const leftEntryId = cleanDocId(request.data?.leftEntryId);
  const rightEntryId = cleanDocId(request.data?.rightEntryId);
  const selectedEntryId = cleanDocId(request.data?.selectedEntryId);
  const matchId = cleanText(request.data?.matchId, 20);
  if (!topicId || !leftEntryId || !rightEntryId || !selectedEntryId || leftEntryId === rightEntryId || ![leftEntryId, rightEntryId].includes(selectedEntryId)) {
    throw new HttpsError('invalid-argument', '투표 대상이 올바르지 않습니다.');
  }
  await enforceActionRateLimit(uid, 'dripso-tournament-vote', { cooldownSeconds: 1, dailyLimit: 500 });
  const { topicRef, topic: original } = await requireTopic(topicId);
  const topic = await syncTournament(topicRef, original);
  const phase = phaseFor(topic);
  const ownEntryId = entryIdFor(topicId, uid);
  if ([leftEntryId, rightEntryId].includes(ownEntryId)) throw new HttpsError('permission-denied', '본인 작품이 포함된 대결에는 투표할 수 없습니다.');
  if (phase === 'prelim') {
    const voteRef = db.doc(`dripso_tournament_prelim_voters/${topicId}/users/${uid}/votes/${pairHash(leftEntryId, rightEntryId)}`);
    const leftRef = topicRef.collection('comments').doc(leftEntryId);
    const rightRef = topicRef.collection('comments').doc(rightEntryId);
    await db.runTransaction(async tx => {
      const [fresh, left, right, vote] = await Promise.all([tx.get(topicRef), tx.get(leftRef), tx.get(rightRef), tx.get(voteRef)]);
      if (!fresh.exists || phaseFor(fresh.data()) !== 'prelim') throw new HttpsError('failed-precondition', '익명 예선이 종료됐습니다.');
      if (!left.exists || !right.exists) throw new HttpsError('not-found', '출전작을 찾을 수 없습니다.');
      if (vote.exists) throw new HttpsError('already-exists', '이미 평가한 조합입니다.');
      const selectedRef = selectedEntryId === leftEntryId ? leftRef : rightRef;
      const otherRef = selectedEntryId === leftEntryId ? rightRef : leftRef;
      const selected = selectedEntryId === leftEntryId ? left.data() : right.data();
      const other = selectedEntryId === leftEntryId ? right.data() : left.data();
      tx.set(voteRef, { topicId, voterUid: uid, leftEntryId, rightEntryId, selectedEntryId, createdAt: FieldValue.serverTimestamp() });
      tx.set(selectedRef, { prelimScore: Number(selected.prelimScore || 0) + 1, prelimDuels: Number(selected.prelimDuels || 0) + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(otherRef, { prelimDuels: Number(other.prelimDuels || 0) + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(topicRef, { prelimVoteCount: FieldValue.increment(1), pairVoteCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return { success: true, stage: 'prelim' };
  }
  if (!['semifinal', 'final'].includes(phase) || !['semi1', 'semi2', 'final'].includes(matchId)) {
    throw new HttpsError('failed-precondition', '현재 토너먼트 투표 시간이 아닙니다.');
  }
  const currentMatchRef = matchRef(topicId, matchId);
  const voteRef = db.doc(`dripso_tournament_voters/${topicId}/rounds/${phase}/matches/${matchId}/users/${uid}`);
  await db.runTransaction(async tx => {
    const [fresh, matchSnap, voteSnap] = await Promise.all([tx.get(topicRef), tx.get(currentMatchRef), tx.get(voteRef)]);
    if (!fresh.exists || phaseFor(fresh.data()) !== phase) throw new HttpsError('failed-precondition', '해당 라운드가 종료됐습니다.');
    if (!matchSnap.exists || matchSnap.data()?.status !== 'active') throw new HttpsError('not-found', '대진을 찾을 수 없습니다.');
    const match = matchSnap.data();
    if (match.leftEntryId !== leftEntryId || match.rightEntryId !== rightEntryId || voteSnap.exists) {
      throw new HttpsError('already-exists', '이미 심사했거나 대진 정보가 변경됐습니다.');
    }
    tx.set(voteRef, { topicId, round: phase, matchId, voterUid: uid, selectedEntryId, createdAt: FieldValue.serverTimestamp() });
    tx.set(currentMatchRef, {
      leftVotes: selectedEntryId === leftEntryId ? FieldValue.increment(1) : Number(match.leftVotes || 0),
      rightVotes: selectedEntryId === rightEntryId ? FieldValue.increment(1) : Number(match.rightVotes || 0),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(topicRef, { tournamentVoteCount: FieldValue.increment(1), pairVoteCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true, stage: phase, matchId };
});
