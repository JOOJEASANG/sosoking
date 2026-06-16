'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

const PARTIES = Object.freeze([
  { id: 'national', name: '국민질서당', emoji: '🛡️', color: '#263B66', ideology: '보수파', leaderName: '강도윤', slogan: '흔들림 없는 안보, 질서 있는 개혁' },
  { id: 'youth', name: '시민개혁당', emoji: '🕯️', color: '#B8323B', ideology: '진보파', leaderName: '한서윤', slogan: '시민이 만든 권력, 시민에게 돌아가는 개혁' },
  { id: 'center', name: '국민통합당', emoji: '⚖️', color: '#2F7D6E', ideology: '중도파', leaderName: '윤태건', slogan: '갈라진 광장을 하나로 묶는 실용 정치' },
]);

const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);
const CAMPAIGN_DAILY_LIMIT = 3;

function requireUid(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function assertPartyId(value) {
  const id = String(value || '').trim();
  if (!PARTY_BY_ID[id]) throw new HttpsError('invalid-argument', '존재하지 않는 정당입니다.');
  return id;
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get().catch(() => null);
  return !!snap?.exists;
}

async function assertPartyLeaderOrAdmin(uid, partyId) {
  if (await isAdmin(uid)) return;

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  if (user.partyId !== partyId) {
    throw new HttpsError('permission-denied', '해당 정당 소속만 수정할 수 있습니다.');
  }

  const top = await partyRef(partyId).collection('members')
    .orderBy('power', 'desc')
    .limit(1)
    .get();
  if (top.empty || top.docs[0].id !== uid) {
    throw new HttpsError('permission-denied', '당대표 또는 관리자만 수정할 수 있습니다.');
  }
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function weekPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const o = {}; parts.forEach(p => { o[p.type] = p.value; });
  const wmap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const off = (wmap[o.weekday] + 6) % 7;
  const base = Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day));
  const monMs = base - off * 86400000;
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  return { key: iso(monMs), endKey: iso(monMs + 7 * 86400000), prevKey: iso(monMs - 7 * 86400000) };
}

function partyRef(id) { return db.doc(`parties/${id}`); }
function memberRef(partyId, uid) { return db.doc(`parties/${partyId}/members/${uid}`); }

async function ensureParties() {
  const batch = db.batch();
  let dirty = false;
  const snaps = await db.getAll(...PARTY_IDS.map(partyRef));
  PARTIES.forEach((p, i) => {
    const data = snaps[i].exists ? snaps[i].data() || {} : {};
    if (!snaps[i].exists || data.name !== p.name || data.leaderName !== p.leaderName || data.slogan !== p.slogan) {
      batch.set(partyRef(p.id), {
        id: p.id, name: p.name, emoji: p.emoji, color: p.color, ideology: p.ideology,
        leaderName: p.leaderName, slogan: p.slogan, updatedAt: FieldValue.serverTimestamp(),
        ...(snaps[i].exists ? {} : { memberCount: 0, totalPower: 0, createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
      dirty = true;
    }
  });
  if (dirty) await batch.commit();
}

async function topMemberOf(partyId) {
  try {
    const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get();
    if (q.empty) return null;
    const d = q.docs[0];
    const m = d.data() || {};
    return { uid: d.id, nickname: m.nickname || PARTY_BY_ID[partyId].leaderName, icon: m.icon || null, power: Number(m.power || 0), isNpc: !!m.isNpc };
  } catch { return null; }
}

async function buildCandidates() {
  await ensureParties();
  const snaps = await db.getAll(...PARTY_IDS.map(partyRef));
  const leaders = await Promise.all(PARTY_IDS.map(topMemberOf));
  return PARTIES.map((p, i) => {
    const data = snaps[i].exists ? snaps[i].data() || {} : {};
    const leader = leaders[i];
    const isHuman = leader && leader.uid && !leader.isNpc;
    return {
      partyId: p.id, partyName: p.name, emoji: p.emoji, color: p.color, ideology: p.ideology,
      candidateName: leader ? leader.nickname : p.leaderName,
      candidateUid: isHuman ? leader.uid : null,
      isAI: !isHuman,
      power: Number(data.totalPower || leader?.power || 0),
      slogan: p.slogan,
    };
  }).sort((a, b) => b.power - a.power || PARTY_IDS.indexOf(a.partyId) - PARTY_IDS.indexOf(b.partyId));
}

function seedAiVotes(candidates) {
  const votes = {};
  let total = 0;
  candidates.forEach((c, i) => {
    const v = Math.max(3, Math.round((Number(c.power || 0) / Math.max(1, candidates.reduce((s, x) => s + Number(x.power || 0), 0))) * 30) || (8 - i));
    votes[c.partyId] = v;
    total += v;
  });
  return { votes, total };
}

async function finalizeElection(periodId) {
  const ref = db.doc(`elections/${periodId}`);
  let winner = null;
  await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().status === 'closed') return;
    const d = s.data() || {};
    const votes = d.votes || {};
    const candidates = d.candidates || [];
    let best = -1;
    candidates.forEach(c => {
      const v = Number(votes[c.partyId] || 0);
      if (v > best) { best = v; winner = c; }
    });
    tx.update(ref, { status: 'closed', winnerPartyId: winner?.partyId || null, winner: winner || null, closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
}

async function ensureElection() {
  const { key, endKey, prevKey } = weekPeriod();
  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const candidates = await buildCandidates();
    const { votes, total } = seedAiVotes(candidates);
    await ref.set({ periodId: key, status: 'open', startKey: key, endKey, candidates, votes, totalVotes: total, aiSeeded: true, politicalSystem: 'new-republic', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const prevRef = db.doc(`elections/${prevKey}`);
    const prevSnap = await prevRef.get();
    if (prevSnap.exists) await finalizeElection(prevKey);
    else {
      const winner = candidates[0] || null;
      await prevRef.set({ periodId: prevKey, status: 'closed', startKey: prevKey, endKey: key, candidates, votes: {}, totalVotes: 0, seeded: true, politicalSystem: 'new-republic', winnerPartyId: winner?.partyId || null, winner, decree: winner ? `${winner.emoji} ${winner.partyName}의 ${winner.candidateName} 정부가 새공화국의 첫 주를 열었습니다.` : null, createdAt: FieldValue.serverTimestamp(), closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  return key;
}

async function currentPresident(uid = null) {
  const { prevKey } = weekPeriod();
  const snap = await db.doc(`elections/${prevKey}`).get();
  if (!snap.exists || snap.data().status !== 'closed' || !snap.data().winner) return null;
  const d = snap.data();
  let myDecreeRating = null;
  if (uid && d.decree) {
    const r = await db.doc(`elections/${prevKey}/decree_ratings/${uid}`).get().catch(() => null);
    if (r?.exists) myDecreeRating = r.data().approve;
  }
  return { ...d.winner, decree: d.decree || null, periodId: prevKey, decreeApprove: Number(d.decreeApprove || 0), decreeDisapprove: Number(d.decreeDisapprove || 0), myDecreeRating, presidentRemoved: !!d.presidentRemoved, earlyElectionRequired: !!d.earlyElectionRequired };
}

function publicMember(uid, userData) {
  return {
    uid,
    nickname: String(userData.nickname || userData.displayName || '시민').slice(0, 20),
    icon: (userData.nicknameIcon && typeof userData.nicknameIcon === 'object') ? userData.nicknameIcon : null,
    power: Math.max(0, Number(userData.totalPoints || userData.points || 0)),
  };
}

exports.getElection = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const key = await ensureElection();
  const uid = request.auth?.uid || null;
  const snap = await db.doc(`elections/${key}`).get();
  const d = snap.data() || {};
  const votes = d.votes || {};
  const pledges = d.pledges || {};
  const candidates = (d.candidates || []).map(c => ({ ...c, votes: Number(votes[c.partyId] || 0), pledge: pledges[c.partyId] || null }));
  let myVote = null;
  if (uid) {
    const b = await db.doc(`elections/${key}/ballots/${uid}`).get().catch(() => null);
    if (b?.exists) myVote = b.data().partyId || null;
  }
  return { ok: true, election: { periodId: key, endKey: d.endKey, totalVotes: Number(d.totalVotes || 0), candidates, myVote, status: d.status || 'open' }, president: await currentPresident(uid) };
});

exports.voteForPresident = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data?.partyId);
  const key = await ensureElection();
  const ref = db.doc(`elections/${key}`);
  let points = 5;
  await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().status !== 'open') throw new HttpsError('failed-precondition', '선거가 준비되지 않았거나 종료됐습니다.');
    if (!(s.data().candidates || []).some(c => c.partyId === partyId)) throw new HttpsError('invalid-argument', '후보 정당이 아닙니다.');
    const ballotRef = ref.collection('ballots').doc(uid);
    const b = await tx.get(ballotRef);
    if (b.exists) throw new HttpsError('failed-precondition', '이미 투표했습니다.');
    tx.set(ballotRef, { partyId, createdAt: FieldValue.serverTimestamp() });
    tx.update(ref, { [`votes.${partyId}`]: FieldValue.increment(1), totalVotes: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`point_awards/${uid}_election_vote_${key}`), { uid, action: 'election_vote', points, weekKey: key, createdAt: FieldValue.serverTimestamp() }, { merge: false });
    tx.set(db.doc(`users/${uid}`), { points: FieldValue.increment(points), totalPoints: FieldValue.increment(points), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true, partyId, points };
});

exports.getPresident = onCall({ region: REGION, timeoutSeconds: 20 }, async request => ({ ok: true, president: await currentPresident(request.auth?.uid || null) }));

exports.getMyStatus = onCall({ region: REGION, timeoutSeconds: 15 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) return { loggedIn: false };
  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  const { key, endKey } = weekPeriod();
  const [ballotSnap, campaignSnap] = await Promise.all([
    db.doc(`elections/${key}/ballots/${uid}`).get().catch(() => null),
    db.doc(`campaign_records/${uid}_${kstToday()}`).get().catch(() => null),
  ]);
  return { loggedIn: true, partyId, partyName: partyId ? PARTY_BY_ID[partyId].name : null, power: Number(user.totalPoints || user.points || 0), votedElection: !!ballotSnap?.exists, electionEndKey: endKey, campaignsToday: campaignSnap?.exists ? Number(campaignSnap.data().count || 0) : 0, campaignDailyLimit: CAMPAIGN_DAILY_LIMIT };
});

exports.setCampaignPledge = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data?.partyId);
  await assertPartyLeaderOrAdmin(uid, partyId);
  const pledge = String(request.data?.pledge || '').trim().slice(0, 120);
  if (pledge.length < 3) throw new HttpsError('invalid-argument', '공약이 너무 짧습니다.');
  const key = await ensureElection();
  await db.doc(`elections/${key}`).set({ [`pledges.${partyId}`]: { pledge, uid, updatedAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, partyId, pledge };
});

exports.setPresidentialDecree = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const decree = String(request.data?.decree || '').trim().slice(0, 200);
  if (decree.length < 3) throw new HttpsError('invalid-argument', '포고령이 너무 짧습니다.');
  const { prevKey } = weekPeriod();
  const ref = db.doc(`elections/${prevKey}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().winner?.candidateUid !== uid) throw new HttpsError('permission-denied', '현직 대통령만 포고령을 발표할 수 있습니다.');
  await ref.set({ decree, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, decree };
});

exports.ratePresidentDecree = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const approve = !!request.data?.approve;
  const { prevKey } = weekPeriod();
  const ref = db.doc(`elections/${prevKey}`);
  const ratingRef = ref.collection('decree_ratings').doc(uid);
  await db.runTransaction(async tx => {
    const old = await tx.get(ratingRef);
    if (old.exists) throw new HttpsError('failed-precondition', '이미 평가했습니다.');
    tx.set(ratingRef, { approve, createdAt: FieldValue.serverTimestamp() });
    tx.update(ref, { [approve ? 'decreeApprove' : 'decreeDisapprove']: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, approve };
});

exports.getRankings = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const snap = await db.collection('users').orderBy('totalPoints', 'desc').limit(50).get().catch(() => null);
  const users = snap ? snap.docs.map((d, i) => ({ rank: i + 1, uid: d.id, nickname: d.data().nickname || d.data().displayName || '시민', partyId: d.data().partyId || null, power: Number(d.data().totalPoints || d.data().points || 0) })) : [];
  return { ok: true, users, parties: PARTIES };
});

exports.getPartyActivities = onCall({ region: REGION, timeoutSeconds: 20 }, async () => ({ ok: true, activities: [], parties: PARTIES }));

exports.syncPartyMemberPower = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  if (!partyId) return { ok: true, partyId: null };
  const power = Number(user.totalPoints || user.points || 0);
  await memberRef(partyId, uid).set({ uid, nickname: user.nickname || user.displayName || '시민', icon: user.nicknameIcon || null, power, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, partyId, power };
});

exports.getUserPoliticsStats = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.data?.uid || request.auth?.uid;
  if (!uid) return { ok: false };
  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  return { ok: true, uid, partyId: user.partyId || null, power: Number(user.totalPoints || user.points || 0) };
});

exports.getPartyManifesto = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const partyId = assertPartyId(request.data?.partyId);
  const snap = await partyRef(partyId).get();
  return { ok: true, partyId, party: PARTY_BY_ID[partyId], manifesto: snap.exists ? (snap.data().manifesto || '') : '' };
});

exports.setPartyManifesto = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data?.partyId);
  await assertPartyLeaderOrAdmin(uid, partyId);
  const manifesto = String(request.data?.manifesto || '').trim().slice(0, 500);
  await partyRef(partyId).set({ manifesto, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, partyId, manifesto };
});

exports.getElectionHistory = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const snap = await db.collection('elections').orderBy('periodId', 'desc').limit(20).get().catch(() => null);
  return { ok: true, history: snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [] };
});

exports.getDailyNews = onCall({ region: REGION, timeoutSeconds: 20 }, async () => ({
  ok: true,
  columns: [
    { id: 'new_republic', title: '새공화국 브리핑', summary: '오늘의 정당 대항전과 역사 이슈를 중심으로 시민 여론이 움직이고 있습니다.', tags: ['새공화국', '역사정치', '시민광장'] },
  ],
}));

exports.generateNewsColumn = onCall({ region: REGION, timeoutSeconds: 30 }, async () => ({ ok: true, column: { title: '새공화국 브리핑', summary: '역사 이슈와 정당 대항전이 오늘의 주요 의제입니다.' } }));

exports.addElectionEndorsement = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data?.partyId);
  const text = String(request.data?.text || '').trim().slice(0, 200);
  const { key } = weekPeriod();
  const ref = await db.collection(`elections/${key}/endorsements`).add({ uid, partyId, text, createdAt: FieldValue.serverTimestamp() });
  return { ok: true, id: ref.id };
});

exports.getElectionEndorsements = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const { key } = weekPeriod();
  const snap = await db.collection(`elections/${key}/endorsements`).orderBy('createdAt', 'desc').limit(30).get().catch(() => null);
  return { ok: true, endorsements: snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [] };
});

exports.claimRulingBonus = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const president = await currentPresident(uid);
  if (!president) return { ok: false, points: 0 };
  const userSnap = await db.doc(`users/${uid}`).get();
  const partyId = userSnap.exists ? userSnap.data().partyId : null;
  if (partyId !== president.partyId) return { ok: false, points: 0 };
  const key = `ruling_bonus_${president.periodId}_${uid}`;
  const awardRef = db.doc(`point_awards/${key}`);
  const awardSnap = await awardRef.get();
  if (awardSnap.exists) return { ok: true, points: 0, already: true };
  await awardRef.set({ uid, points: 10, type: 'ruling_bonus', createdAt: FieldValue.serverTimestamp() });
  await db.doc(`users/${uid}`).set({ points: FieldValue.increment(10), totalPoints: FieldValue.increment(10), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, points: 10 };
});

exports.getWeeklyCrisis = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const { key } = weekPeriod();
  const ref = db.doc(`political_crises/${key}`);
  let snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ periodId: key, title: '새공화국 권력구조 논쟁', desc: '개헌과 권력기관 개편을 둘러싸고 세 정당의 해석이 갈립니다.', options: PARTIES.map(p => ({ partyId: p.id, label: `${p.emoji} ${p.name} 해법 지지` })), votes: {}, totalVotes: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    snap = await ref.get();
  }
  let myVote = null;
  if (request.auth?.uid) {
    const vote = await ref.collection('votes').doc(request.auth.uid).get().catch(() => null);
    if (vote?.exists) myVote = vote.data().partyId;
  }
  return { ok: true, crisis: { id: key, ...snap.data(), myVote } };
});

exports.voteOnCrisis = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data?.partyId);
  const { key } = weekPeriod();
  const ref = db.doc(`political_crises/${key}`);
  await db.runTransaction(async tx => {
    const voteRef = ref.collection('votes').doc(uid);
    const old = await tx.get(voteRef);
    if (old.exists) throw new HttpsError('failed-precondition', '이미 참여했습니다.');
    tx.set(voteRef, { uid, partyId, createdAt: FieldValue.serverTimestamp() });
    tx.set(ref, { [`votes.${partyId}`]: FieldValue.increment(1), totalVotes: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true, partyId };
});

exports.campaignForParty = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data?.partyId);
  const today = kstToday();
  const { key: weekKey } = weekPeriod();
  const campaignRef = db.doc(`campaign_records/${uid}_${today}`);
  const userRef = db.doc(`users/${uid}`);
  await ensureParties();

  let response = { ok: true, partyId, points: 0, count: 0, dailyLimit: CAMPAIGN_DAILY_LIMIT };
  await db.runTransaction(async tx => {
    const [userSnap, campaignSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(campaignRef),
    ]);

    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    if (user.partyId !== partyId) {
      throw new HttpsError('permission-denied', '소속 정당만 선거운동할 수 있습니다.');
    }

    const count = Number(campaignSnap.exists ? campaignSnap.data().count || 0 : 0);
    if (count >= CAMPAIGN_DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', '오늘 선거운동 한도를 초과했습니다.');
    }

    const points = 3;
    const currentPower = Math.max(0, Number(user.totalPoints || user.points || 0));
    const nextPower = currentPower + points;
    const memberDocRef = memberRef(partyId, uid);
    const memberSnap = await tx.get(memberDocRef);
    const oldMemberPower = memberSnap.exists ? Number(memberSnap.data().power || 0) : 0;
    const memberData = memberSnap.exists ? memberSnap.data() || {} : {};
    const partyDelta = nextPower - oldMemberPower;

    const memberPatch = {
      ...publicMember(uid, { ...user, totalPoints: nextPower, points: nextPower }),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (memberData.weekKey === weekKey) {
      memberPatch.weeklyGain = FieldValue.increment(points);
    } else {
      memberPatch.weekKey = weekKey;
      memberPatch.weekStartPower = oldMemberPower;
      memberPatch.weeklyGain = Math.max(0, nextPower - oldMemberPower);
    }

    tx.set(campaignRef, {
      uid,
      partyId,
      date: today,
      count: FieldValue.increment(1),
      dailyLimit: CAMPAIGN_DAILY_LIMIT,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(userRef, {
      points: FieldValue.increment(points),
      totalPoints: FieldValue.increment(points),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(memberDocRef, memberPatch, { merge: true });
    tx.set(partyRef(partyId), {
      ...(memberSnap.exists ? {} : { memberCount: FieldValue.increment(1) }),
      totalPower: FieldValue.increment(partyDelta),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    response = { ok: true, partyId, points, count: count + 1, dailyLimit: CAMPAIGN_DAILY_LIMIT };
  });
  return response;
});

exports.getImpeachmentStatus = onCall({ region: REGION, timeoutSeconds: 20 }, async () => ({ ok: true, status: { active: false, signatures: 0, threshold: 100 } }));
exports.signImpeachmentPetition = onCall({ region: REGION, timeoutSeconds: 20 }, async request => ({ ok: true, signed: !!request.auth?.uid }));
exports.getPresidentQA = onCall({ region: REGION, timeoutSeconds: 20 }, async () => ({ ok: true, questions: [], answers: [] }));
exports.askPresidentQuestion = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const text = String(request.data?.text || '').trim().slice(0, 200);
  const ref = await db.collection('president_questions').add({ uid, text, createdAt: FieldValue.serverTimestamp() });
  return { ok: true, id: ref.id };
});
exports.answerPresidentQuestion = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  requireUid(request);
  return { ok: true, answer: String(request.data?.answer || '').slice(0, 300) };
});
exports.getCampaignMomentum = onCall({ region: REGION, timeoutSeconds: 20 }, async () => ({ ok: true, momentum: PARTY_IDS.map(pid => ({ partyId: pid, partyName: PARTY_BY_ID[pid].name, score: 0 })) }));
