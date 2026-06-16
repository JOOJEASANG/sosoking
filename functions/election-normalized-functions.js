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

function normalizeCandidateRecord(c) {
  const party = PARTY_BY_ID[c?.partyId] || null;
  if (!party) return c || {};
  const isHuman = !!c?.candidateUid && !c?.isAI;
  return {
    ...c,
    partyId: party.id,
    partyName: party.name,
    emoji: party.emoji,
    color: party.color,
    ideology: party.ideology,
    slogan: c?.slogan || party.slogan,
    candidateName: isHuman ? (c.candidateName || '시민 후보') : party.leaderName,
    isAI: !isHuman,
    candidateUid: isHuman ? c.candidateUid : null,
  };
}

function sameCandidates(a, b) {
  return JSON.stringify((a || []).map(x => normalizeCandidateRecord(x))) === JSON.stringify((b || []).map(x => normalizeCandidateRecord(x)));
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
      candidateName: isHuman ? leader.nickname : p.leaderName,
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
  const sumPower = candidates.reduce((s, x) => s + Number(x.power || 0), 0);
  candidates.forEach((c, i) => {
    const v = Math.max(3, Math.round((Number(c.power || 0) / Math.max(1, sumPower)) * 30) || (8 - i));
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
    const candidates = (d.candidates || []).map(normalizeCandidateRecord);
    let best = -1;
    candidates.forEach(c => {
      const v = Number(votes[c.partyId] || 0);
      if (v > best) { best = v; winner = c; }
    });
    tx.update(ref, { candidates, status: 'closed', winnerPartyId: winner?.partyId || null, winner: winner || null, closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
}

async function normalizeElectionDoc(ref, snap) {
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const original = Array.isArray(data.candidates) ? data.candidates : [];
  let candidates = original.map(normalizeCandidateRecord);
  if (!candidates.length) candidates = await buildCandidates();
  const patch = {};
  if (!sameCandidates(original, candidates)) patch.candidates = candidates;
  if (data.winner) {
    const winner = normalizeCandidateRecord(data.winner);
    if (JSON.stringify(winner) !== JSON.stringify(data.winner)) patch.winner = winner;
  }
  if (Object.keys(patch).length) {
    patch.updatedAt = FieldValue.serverTimestamp();
    await ref.set(patch, { merge: true });
  }
  return { ...data, ...patch, candidates };
}

async function ensureElection() {
  const { key, endKey, prevKey } = weekPeriod();
  const ref = db.doc(`elections/${key}`);
  let snap = await ref.get();
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
    return key;
  }
  await normalizeElectionDoc(ref, snap);
  return key;
}

async function currentPresident(uid = null) {
  const { prevKey } = weekPeriod();
  const ref = db.doc(`elections/${prevKey}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().status !== 'closed' || !snap.data().winner) return null;
  const d = await normalizeElectionDoc(ref, snap) || snap.data();
  let myDecreeRating = null;
  if (uid && d.decree) {
    const r = await db.doc(`elections/${prevKey}/decree_ratings/${uid}`).get().catch(() => null);
    if (r?.exists) myDecreeRating = r.data().approve;
  }
  return { ...normalizeCandidateRecord(d.winner), decree: d.decree || null, periodId: prevKey, decreeApprove: Number(d.decreeApprove || 0), decreeDisapprove: Number(d.decreeDisapprove || 0), myDecreeRating, presidentRemoved: !!d.presidentRemoved, earlyElectionRequired: !!d.earlyElectionRequired };
}

const getElection = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const key = await ensureElection();
  const uid = request.auth?.uid || null;
  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  const d = await normalizeElectionDoc(ref, snap) || {};
  const votes = d.votes || {};
  const pledges = d.pledges || {};
  const candidates = (d.candidates || []).map(c => ({ ...normalizeCandidateRecord(c), votes: Number(votes[c.partyId] || 0), pledge: pledges[c.partyId] || null }));
  let myVote = null;
  if (uid) {
    const b = await db.doc(`elections/${key}/ballots/${uid}`).get().catch(() => null);
    if (b?.exists) myVote = b.data().partyId || null;
  }
  return { ok: true, election: { periodId: key, endKey: d.endKey, totalVotes: Number(d.totalVotes || 0), candidates, myVote, status: d.status || 'open' }, president: await currentPresident(uid) };
});

const getPresident = onCall({ region: REGION, timeoutSeconds: 20 }, async request => ({ ok: true, president: await currentPresident(request.auth?.uid || null) }));

const getElectionHistory = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const snap = await db.collection('elections').orderBy('periodId', 'desc').limit(20).get().catch(() => null);
  const history = snap ? snap.docs.map(d => {
    const data = d.data() || {};
    return { id: d.id, ...data, candidates: (data.candidates || []).map(normalizeCandidateRecord), winner: data.winner ? normalizeCandidateRecord(data.winner) : null };
  }) : [];
  return { ok: true, history };
});

const voteForPresident = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
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

module.exports = { getElection, getPresident, getElectionHistory, voteForPresident };
