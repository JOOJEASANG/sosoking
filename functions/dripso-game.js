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
const GAME_VERSION = 2;
const MAX_ENTRIES = 64;
const MAX_ENTRY_LENGTH = 180;
const MODES = new Set(['blank', 'naming', 'comeback', 'wrong', 'headline', 'excuse', 'manual']);
const ENTRY_MINUTES = new Set([30, 180, 360, 720, 1440]);
const VOTING_MINUTES = new Set([60, 180, 360, 720]);
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
  return /^[A-Za-z0-9_-]{8,100}$/.test(id) ? id : '';
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

function phaseFor(topic, now = Date.now()) {
  const entryDeadlineMs = timestampMs(topic.entryDeadline);
  const votingDeadlineMs = timestampMs(topic.votingDeadline);
  if (!entryDeadlineMs || !votingDeadlineMs || votingDeadlineMs <= entryDeadlineMs) {
    return 'legacy';
  }
  if (now < entryDeadlineMs) return 'recruiting';
  if (now < votingDeadlineMs) return 'voting';
  return 'closed';
}

function entryIdFor(topicId, uid) {
  return crypto
    .createHash('sha256')
    .update(`${topicId}\u0000${uid}`)
    .digest('hex')
    .slice(0, 32);
}

function orderedPair(leftId, rightId) {
  return [leftId, rightId].sort();
}

function pairHash(leftId, rightId) {
  const [first, second] = orderedPair(leftId, rightId);
  return crypto.createHash('sha256').update(`${first}\u0000${second}`).digest('hex').slice(0, 40);
}

function deterministicIndex(seed, length) {
  if (length <= 1) return 0;
  const digest = crypto.createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) % length;
}

function jpegDimensions(buffer) {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isStartOfFrame) {
      if (length < 7) return null;
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  return null;
}

function decodeTopicImageDataUrl(value) {
  const dataUrl = String(value || '');
  if (!dataUrl) return null;
  if (dataUrl.length > MAX_TOPIC_IMAGE_DATA_LENGTH) {
    throw new HttpsError('invalid-argument', '첨부 사진 용량이 너무 큽니다.');
  }
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new HttpsError('invalid-argument', '첨부 사진 형식이 올바르지 않습니다.');
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > MAX_TOPIC_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', '첨부 사진은 압축 후 750KB 이하여야 합니다.');
  }
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
      metadata: {
        firebaseStorageDownloadTokens: token,
        service: 'dripso-battle-image'
      }
    }
  });
  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(imagePath)}?alt=media&token=${encodeURIComponent(token)}`;
  return {
    file,
    imagePath,
    imageUrl,
    imageWidth: image.width,
    imageHeight: image.height,
    imageByteSize: image.buffer.length
  };
}

async function loadNickname(uid) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists
    ? cleanText(snap.data().nickname, 20) || '익명 드리퍼'
    : '익명 드리퍼';
}

async function requireGameTopic(topicId) {
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const snapshot = await topicRef.get();
  if (!snapshot.exists || snapshot.data()?.status !== 'visible') {
    throw new HttpsError('not-found', '드립 배틀을 찾을 수 없습니다.');
  }
  const topic = snapshot.data();
  if (Number(topic.gameVersion) !== GAME_VERSION || !MODES.has(topic.mode)) {
    throw new HttpsError('failed-precondition', '새 게임 방식이 적용된 배틀이 아닙니다.');
  }
  return { topicRef, topic };
}

async function requireLegacyTopic(topicId) {
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const snapshot = await topicRef.get();
  if (!snapshot.exists || snapshot.data()?.status !== 'visible') {
    throw new HttpsError('not-found', '드립 주제를 찾을 수 없습니다.');
  }
  if (Number(snapshot.data()?.gameVersion) === GAME_VERSION) {
    throw new HttpsError('failed-precondition', '새 배틀은 전용 출전·비교투표 기능으로 참여해 주세요.');
  }
  return { topicRef, topic: snapshot.data() };
}

async function loadVisibleEntries(topicRef) {
  const snapshot = await topicRef.collection('comments')
    .where('status', '==', 'visible')
    .limit(MAX_ENTRIES)
    .get();
  return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
}

function rankedEntries(entries) {
  return [...entries].sort((left, right) =>
    Math.max(0, Number(right.battleScore) || 0) - Math.max(0, Number(left.battleScore) || 0)
    || Math.max(0, Number(right.duelCount) || 0) - Math.max(0, Number(left.duelCount) || 0)
    || timestampMs(left.createdAt) - timestampMs(right.createdAt)
    || left.id.localeCompare(right.id)
  );
}

function publicEntry(entry, includeNickname = true) {
  const result = {
    id: entry.id,
    text: cleanText(entry.text, MAX_ENTRY_LENGTH),
    battleScore: Math.max(0, Number(entry.battleScore) || 0),
    duelCount: Math.max(0, Number(entry.duelCount) || 0),
    createdAtMs: timestampMs(entry.createdAt)
  };
  if (includeNickname) result.nickname = cleanText(entry.nickname, 20) || '익명 드리퍼';
  return result;
}

exports.createDripsoBattle = onCall({
  region: REGION,
  timeoutSeconds: 60,
  memory: '512MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const mode = cleanText(request.data?.mode, 20);
  const title = cleanText(request.data?.title, 60);
  const prompt = cleanText(request.data?.prompt, 260);
  const entryMinutes = Number(request.data?.entryMinutes) || 180;
  const votingMinutes = Number(request.data?.votingMinutes) || 180;
  const image = decodeTopicImageDataUrl(request.data?.imageDataUrl);

  if (!MODES.has(mode)) throw new HttpsError('invalid-argument', '지원하지 않는 배틀 방식입니다.');
  if (!ENTRY_MINUTES.has(entryMinutes)) throw new HttpsError('invalid-argument', '출전 시간이 올바르지 않습니다.');
  if (!VOTING_MINUTES.has(votingMinutes)) throw new HttpsError('invalid-argument', '심사 시간이 올바르지 않습니다.');
  if (title.length < 2) throw new HttpsError('invalid-argument', '배틀 제목을 2자 이상 입력해 주세요.');
  if (prompt.length < 4) throw new HttpsError('invalid-argument', '바로 답할 수 있는 문제를 4자 이상 입력해 주세요.');
  assertSafeText(`${title}\n${prompt}`, '배틀');

  await enforceActionRateLimit(uid, 'dripso-battle-create', {
    cooldownSeconds: 30,
    dailyLimit: 10
  });

  const nickname = await loadNickname(uid);
  const topicRef = db.collection('dripso_topics').doc();
  const authorRef = db.doc(`dripso_topic_authors/${topicRef.id}`);
  const now = Date.now();
  const entryDeadlineMs = now + entryMinutes * 60 * 1000;
  const votingDeadlineMs = entryDeadlineMs + votingMinutes * 60 * 1000;
  let storedImage = null;

  try {
    storedImage = await storeTopicImage(topicRef.id, image);
    const topicData = {
      type: mode === 'naming' ? 'naming' : 'situation',
      mode,
      gameVersion: GAME_VERSION,
      title,
      prompt: `[[dripso-mode:${mode}]] ${prompt}`,
      nickname,
      status: 'visible',
      commentCount: 0,
      topLikeCount: 0,
      topBattleScore: 0,
      pairVoteCount: 0,
      maxEntries: MAX_ENTRIES,
      entryMinutes,
      votingMinutes,
      entryDeadline: Timestamp.fromMillis(entryDeadlineMs),
      votingDeadline: Timestamp.fromMillis(votingDeadlineMs),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    if (storedImage) {
      Object.assign(topicData, {
        imageUrl: storedImage.imageUrl,
        imagePath: storedImage.imagePath,
        imageWidth: storedImage.imageWidth,
        imageHeight: storedImage.imageHeight,
        imageByteSize: storedImage.imageByteSize,
        imageContentType: 'image/jpeg'
      });
    }

    const batch = db.batch();
    batch.set(topicRef, topicData);
    batch.set(authorRef, {
      uid,
      topicId: topicRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    if (storedImage?.file) await storedImage.file.delete({ ignoreNotFound: true }).catch(() => {});
    if (error instanceof HttpsError) throw error;
    console.error('Dripso battle creation failed:', error);
    throw new HttpsError('internal', '배틀 또는 사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return {
    success: true,
    topicId: topicRef.id,
    entryDeadlineMs,
    votingDeadlineMs,
    hasImage: Boolean(storedImage)
  };
});

exports.submitDripsoBattleEntry = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const rawText = cleanText(request.data?.text, MAX_ENTRY_LENGTH);
  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');
  if (rawText.length < 2) throw new HttpsError('invalid-argument', '출전작을 2자 이상 입력해 주세요.');
  assertSafeText(rawText, '출전작');

  await enforceActionRateLimit(uid, 'dripso-battle-entry', {
    cooldownSeconds: 5,
    dailyLimit: 60
  });

  const nickname = await loadNickname(uid);
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const entryId = entryIdFor(topicId, uid);
  const entryRef = topicRef.collection('comments').doc(entryId);
  const authorRef = db.doc(`dripso_comment_authors/${topicId}/items/${entryId}`);
  let updated = false;

  await db.runTransaction(async tx => {
    const [topicSnap, entrySnap] = await Promise.all([tx.get(topicRef), tx.get(entryRef)]);
    if (!topicSnap.exists || topicSnap.data()?.status !== 'visible') {
      throw new HttpsError('not-found', '드립 배틀을 찾을 수 없습니다.');
    }
    const topic = topicSnap.data();
    if (Number(topic.gameVersion) !== GAME_VERSION) {
      throw new HttpsError('failed-precondition', '새 배틀 방식이 적용된 경기가 아닙니다.');
    }
    if (phaseFor(topic) !== 'recruiting') {
      throw new HttpsError('failed-precondition', '출전 시간이 마감됐습니다. 현재는 작품을 등록하거나 수정할 수 없습니다.');
    }
    if (!entrySnap.exists && Math.max(0, Number(topic.commentCount) || 0) >= MAX_ENTRIES) {
      throw new HttpsError('resource-exhausted', `이 배틀은 최대 ${MAX_ENTRIES}명까지 출전할 수 있습니다.`);
    }

    updated = entrySnap.exists;
    const previous = entrySnap.exists ? entrySnap.data() : {};
    tx.set(entryRef, {
      nickname,
      text: rawText,
      status: 'visible',
      gameVersion: GAME_VERSION,
      likeCount: 0,
      battleScore: Math.max(0, Number(previous.battleScore) || 0),
      duelCount: Math.max(0, Number(previous.duelCount) || 0),
      createdAt: entrySnap.exists ? previous.createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(authorRef, {
      uid,
      topicId,
      commentId: entryId,
      createdAt: entrySnap.exists ? (previous.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(topicRef, {
      commentCount: entrySnap.exists ? Math.max(0, Number(topic.commentCount) || 0) : FieldValue.increment(1),
      lastCommentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { success: true, entryId, updated };
});

exports.getDripsoBattleView = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  const topicId = cleanDocId(request.data?.topicId);
  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');
  const { topicRef, topic } = await requireGameTopic(topicId);
  const phase = phaseFor(topic);
  const uid = cleanText(request.auth?.uid, 128);
  const ownEntryId = uid ? entryIdFor(topicId, uid) : '';
  let ownEntry = null;

  if (ownEntryId) {
    const ownSnapshot = await topicRef.collection('comments').doc(ownEntryId).get();
    if (ownSnapshot.exists && ownSnapshot.data()?.status === 'visible') {
      ownEntry = publicEntry({ id: ownSnapshot.id, ...ownSnapshot.data() });
    }
  }

  let entries = [];
  let winner = null;
  if (phase === 'closed') {
    entries = rankedEntries(await loadVisibleEntries(topicRef));
    if (entries.length) winner = publicEntry(entries[0]);
    const winnerUpdate = winner
      ? {
          winnerEntryId: winner.id,
          winnerText: winner.text,
          winnerNickname: winner.nickname,
          winnerScore: winner.battleScore,
          topBattleScore: winner.battleScore,
          finalizedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }
      : {
          winnerEntryId: FieldValue.delete(),
          winnerText: FieldValue.delete(),
          winnerNickname: FieldValue.delete(),
          winnerScore: 0,
          topBattleScore: 0,
          finalizedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
    await topicRef.set(winnerUpdate, { merge: true });
  }

  return {
    success: true,
    topicId,
    phase,
    mode: topic.mode,
    entryCount: Math.max(0, Number(topic.commentCount) || 0),
    pairVoteCount: Math.max(0, Number(topic.pairVoteCount) || 0),
    entryDeadlineMs: timestampMs(topic.entryDeadline),
    votingDeadlineMs: timestampMs(topic.votingDeadline),
    ownEntry,
    winner,
    entries: phase === 'closed' ? entries.map(entry => publicEntry(entry)) : []
  };
});

exports.getDripsoBattleMatchup = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');
  const { topicRef, topic } = await requireGameTopic(topicId);
  if (phaseFor(topic) !== 'voting') {
    throw new HttpsError('failed-precondition', '현재 비교투표 시간이 아닙니다.');
  }

  const ownEntryId = entryIdFor(topicId, uid);
  const entries = (await loadVisibleEntries(topicRef)).filter(entry => entry.id !== ownEntryId);
  if (entries.length < 2) {
    return {
      success: true,
      completed: true,
      reason: entries.length ? '본인 작품을 제외하면 비교할 작품이 부족합니다.' : '비교할 출전작이 부족합니다.'
    };
  }

  const votesRef = db.collection(`dripso_battle_voters/${topicId}/users/${uid}/votes`);
  const votesSnapshot = await votesRef.limit(500).get();
  const seen = new Set(votesSnapshot.docs.map(document => document.id));
  const candidates = [];
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex];
      const right = entries[rightIndex];
      const key = pairHash(left.id, right.id);
      if (!seen.has(key)) candidates.push({ key, left, right });
    }
  }

  if (!candidates.length) {
    return { success: true, completed: true, reason: '현재 볼 수 있는 모든 1대1 비교를 완료했습니다.' };
  }

  const selectedIndex = deterministicIndex(`${uid}\u0000${topicId}\u0000${seen.size}`, candidates.length);
  const matchup = candidates[selectedIndex];
  const swap = deterministicIndex(`${uid}\u0000${matchup.key}`, 2) === 1;
  const left = swap ? matchup.right : matchup.left;
  const right = swap ? matchup.left : matchup.right;

  return {
    success: true,
    completed: false,
    pairKey: matchup.key,
    left: publicEntry(left, false),
    right: publicEntry(right, false),
    remaining: candidates.length
  };
});

exports.voteDripsoBattleMatchup = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const leftEntryId = cleanDocId(request.data?.leftEntryId);
  const rightEntryId = cleanDocId(request.data?.rightEntryId);
  const selectedEntryId = cleanDocId(request.data?.selectedEntryId);
  if (!topicId || !leftEntryId || !rightEntryId || !selectedEntryId
    || leftEntryId === rightEntryId
    || ![leftEntryId, rightEntryId].includes(selectedEntryId)) {
    throw new HttpsError('invalid-argument', '비교투표 대상이 올바르지 않습니다.');
  }

  await enforceActionRateLimit(uid, 'dripso-battle-vote', {
    cooldownSeconds: 1,
    dailyLimit: 500
  });

  const ownEntryId = entryIdFor(topicId, uid);
  if ([leftEntryId, rightEntryId].includes(ownEntryId)) {
    throw new HttpsError('permission-denied', '본인이 출전한 작품이 포함된 대결에는 투표할 수 없습니다.');
  }

  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const leftRef = topicRef.collection('comments').doc(leftEntryId);
  const rightRef = topicRef.collection('comments').doc(rightEntryId);
  const selectedRef = selectedEntryId === leftEntryId ? leftRef : rightRef;
  const otherRef = selectedEntryId === leftEntryId ? rightRef : leftRef;
  const pairId = pairHash(leftEntryId, rightEntryId);
  const voteRef = db.doc(`dripso_battle_voters/${topicId}/users/${uid}/votes/${pairId}`);
  let selectedScore = 0;

  await db.runTransaction(async tx => {
    const [topicSnap, leftSnap, rightSnap, voteSnap] = await Promise.all([
      tx.get(topicRef),
      tx.get(leftRef),
      tx.get(rightRef),
      tx.get(voteRef)
    ]);
    if (!topicSnap.exists || topicSnap.data()?.status !== 'visible') {
      throw new HttpsError('not-found', '드립 배틀을 찾을 수 없습니다.');
    }
    const topic = topicSnap.data();
    if (Number(topic.gameVersion) !== GAME_VERSION || phaseFor(topic) !== 'voting') {
      throw new HttpsError('failed-precondition', '비교투표 시간이 종료됐거나 아직 시작되지 않았습니다.');
    }
    if (!leftSnap.exists || !rightSnap.exists
      || leftSnap.data()?.status !== 'visible' || rightSnap.data()?.status !== 'visible') {
      throw new HttpsError('not-found', '비교할 출전작을 찾을 수 없습니다.');
    }
    if (voteSnap.exists) throw new HttpsError('already-exists', '이미 평가한 두 작품입니다.');

    const selectedSnap = selectedEntryId === leftEntryId ? leftSnap : rightSnap;
    const otherSnap = selectedEntryId === leftEntryId ? rightSnap : leftSnap;
    const selectedData = selectedSnap.data();
    const otherData = otherSnap.data();
    selectedScore = Math.max(0, Number(selectedData.battleScore) || 0) + 1;
    const selectedDuels = Math.max(0, Number(selectedData.duelCount) || 0) + 1;
    const otherDuels = Math.max(0, Number(otherData.duelCount) || 0) + 1;

    tx.set(voteRef, {
      topicId,
      voterUid: uid,
      leftEntryId,
      rightEntryId,
      selectedEntryId,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(selectedRef, {
      battleScore: selectedScore,
      duelCount: selectedDuels,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(otherRef, {
      duelCount: otherDuels,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const topicUpdate = {
      pairVoteCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    };
    const currentTop = Math.max(0, Number(topic.topBattleScore) || 0);
    if (selectedScore > currentTop || !topic.leaderEntryId) {
      Object.assign(topicUpdate, {
        topBattleScore: selectedScore,
        leaderEntryId: selectedEntryId,
        leaderText: cleanText(selectedData.text, MAX_ENTRY_LENGTH),
        leaderNickname: cleanText(selectedData.nickname, 20) || '익명 드리퍼'
      });
    }
    tx.set(topicRef, topicUpdate, { merge: true });
  });

  return { success: true, selectedEntryId, selectedScore };
});

// 기존 자유형 게시물은 이전 댓글·반응 방식을 유지하되 게임 버전 2에는 우회 접근을 차단한다.
exports.addDripsoComment = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const text = cleanText(request.data?.text, 300);
  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');
  if (text.length < 2) throw new HttpsError('invalid-argument', '드립을 2자 이상 입력해 주세요.');
  assertSafeText(text, '댓글');

  const { topicRef } = await requireLegacyTopic(topicId);
  await enforceActionRateLimit(uid, 'dripso-comment', {
    cooldownSeconds: 8,
    dailyLimit: 60
  });

  const nickname = await loadNickname(uid);
  const commentRef = topicRef.collection('comments').doc();
  const authorRef = db.doc(`dripso_comment_authors/${topicId}/items/${commentRef.id}`);
  const batch = db.batch();
  batch.set(commentRef, {
    nickname,
    text,
    status: 'visible',
    likeCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(authorRef, {
    uid,
    topicId,
    commentId: commentRef.id,
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(topicRef, {
    commentCount: FieldValue.increment(1),
    lastCommentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();
  return { success: true, commentId: commentRef.id };
});

exports.toggleDripsoCommentLike = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const commentId = cleanDocId(request.data?.commentId);
  if (!topicId || !commentId) throw new HttpsError('invalid-argument', '좋아요 대상이 올바르지 않습니다.');

  const { topicRef } = await requireLegacyTopic(topicId);
  await enforceActionRateLimit(uid, 'dripso-like', {
    cooldownSeconds: 1,
    dailyLimit: 500
  });

  const commentRef = topicRef.collection('comments').doc(commentId);
  const likeRef = commentRef.collection('likes').doc(uid);
  let result = { liked: false, likeCount: 0 };

  await db.runTransaction(async tx => {
    const [commentSnap, likeSnap, topicSnap] = await Promise.all([
      tx.get(commentRef),
      tx.get(likeRef),
      tx.get(topicRef)
    ]);
    if (!commentSnap.exists || commentSnap.data()?.status !== 'visible') {
      throw new HttpsError('not-found', '드립 댓글을 찾을 수 없습니다.');
    }
    if (!topicSnap.exists || topicSnap.data()?.status !== 'visible'
      || Number(topicSnap.data()?.gameVersion) === GAME_VERSION) {
      throw new HttpsError('failed-precondition', '새 배틀은 하트 대신 1대1 비교투표로 평가합니다.');
    }

    const currentCount = Math.max(0, Number(commentSnap.data().likeCount) || 0);
    const liked = !likeSnap.exists;
    const nextCount = Math.max(0, currentCount + (liked ? 1 : -1));
    const currentTop = Math.max(0, Number(topicSnap.data().topLikeCount) || 0);
    if (liked) {
      tx.set(likeRef, { uid, createdAt: FieldValue.serverTimestamp() });
    } else {
      tx.delete(likeRef);
    }
    tx.set(commentRef, {
      likeCount: nextCount,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(topicRef, {
      updatedAt: FieldValue.serverTimestamp(),
      topLikeCount: liked ? Math.max(currentTop, nextCount) : currentTop
    }, { merge: true });
    result = { liked, likeCount: nextCount };
  });

  if (!result.liked) {
    const best = await topicRef.collection('comments')
      .where('status', '==', 'visible')
      .orderBy('likeCount', 'desc')
      .limit(1)
      .get();
    const topLikeCount = best.empty ? 0 : Math.max(0, Number(best.docs[0].data().likeCount) || 0);
    await topicRef.set({ topLikeCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return { success: true, ...result };
});
