'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const PARTIES = Object.freeze([
  { id: 'national',  name: '국민안정당', emoji: '🎙️', color: '#8B7355', leaderName: '3선 의원' },
  { id: 'truth',     name: '진실방송당', emoji: '📺', color: '#6C5CE7', leaderName: '정치 유튜버' },
  { id: 'youth',     name: '청년혁명당', emoji: '📱', color: '#E84393', leaderName: 'MZ 운동가' },
  { id: 'center',    name: '중도민주당', emoji: '📊', color: '#00CEC9', leaderName: '여론조사 전문가' },
  { id: 'future',    name: '함께미래당', emoji: '🤝', color: '#FDCB6E', leaderName: '당 대변인' },
  { id: 'rights',    name: '알권리당',   emoji: '🔍', color: '#00B894', leaderName: '탐사 기자' },
  { id: 'justice',   name: '법치정의당', emoji: '⚖️', color: '#2D3436', leaderName: '검사 출신 변호사' },
]);
const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function assertPartyId(value) {
  const id = String(value || '').trim();
  if (!PARTY_BY_ID[id]) throw new HttpsError('invalid-argument', '존재하지 않는 정당입니다.');
  return id;
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
  return {
    key: iso(monMs),
    voteDeadlineKey: iso(monMs + 6 * 86400000),
    endKey: iso(monMs + 7 * 86400000),
    prevKey: iso(monMs - 7 * 86400000),
  };
}

function partyRef(id) { return db.doc(`parties/${id}`); }
function memberRef(partyId, uid) { return db.doc(`parties/${partyId}/members/${uid}`); }

async function topMemberOf(partyId) {
  try {
    const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get();
    if (q.empty) return null;
    const d = q.docs[0];
    const m = d.data() || {};
    return { uid: d.id, nickname: m.nickname || '시민', power: Number(m.power || 0), isNpc: !!m.isNpc };
  } catch {
    return null;
  }
}

async function buildCandidates() {
  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const leaders = await Promise.all(PARTY_IDS.map(topMemberOf));
  return PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    const leader = leaders[i];
    const isHuman = leader && leader.power > 0 && !leader.isNpc;
    return {
      partyId: meta.id,
      partyName: meta.name,
      emoji: meta.emoji,
      color: meta.color,
      candidateName: leader ? leader.nickname : meta.leaderName,
      candidateUid: isHuman ? (leader.uid || null) : null,
      isAI: !isHuman,
      power: Number(data.totalPower || 0),
    };
  }).sort((a, b) => b.power - a.power);
}

async function ensureElectionLite() {
  const { key, endKey, voteDeadlineKey } = weekPeriod();
  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const candidates = await buildCandidates();
    await ref.set({
      periodId: key,
      status: 'open',
      startKey: key,
      endKey,
      voteDeadlineKey,
      candidates,
      votes: {},
      totalVotes: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } else if (!snap.data().voteDeadlineKey) {
    await ref.set({ voteDeadlineKey, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return key;
}

function weeklyPowerFields(memberData, oldPower, newPower) {
  const currentWeekKey = weekPeriod().key;
  if ((memberData || {}).weekKey !== currentWeekKey) {
    return {
      weekKey: currentWeekKey,
      weekStartPower: oldPower,
      weeklyGain: Math.max(0, newPower - oldPower),
    };
  }
  const weekStartPower = Number((memberData || {}).weekStartPower || 0);
  return { weeklyGain: Math.max(0, newPower - weekStartPower) };
}

function writePartyPowerInTx(tx, uid, user, memberSnap, points) {
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  if (!partyId || !memberSnap || !memberSnap.exists) return;

  const oldPower = Number(memberSnap.data().power || 0);
  const newPower = Math.max(0, Number(user.totalPoints || user.points || 0) + points);
  const delta = newPower - oldPower;
  tx.update(memberRef(partyId, uid), {
    power: newPower,
    ...weeklyPowerFields(memberSnap.data() || {}, oldPower, newPower),
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (delta !== 0) {
    tx.set(partyRef(partyId), { totalPower: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

const voteForPresident = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data && request.data.partyId);
  const key = await ensureElectionLite();
  const ref = db.doc(`elections/${key}`);
  const { voteDeadlineKey } = weekPeriod();
  const isFinalDay = kstToday() === voteDeadlineKey;
  const points = isFinalDay ? 10 : 5;

  return db.runTransaction(async tx => {
    const userRef = db.doc(`users/${uid}`);
    const ballotRef = ref.collection('ballots').doc(uid);
    const [s, userSnap, b] = await Promise.all([tx.get(ref), tx.get(userRef), tx.get(ballotRef)]);

    if (!s.exists) throw new HttpsError('failed-precondition', '선거가 준비되지 않았습니다.');
    const d = s.data() || {};
    if (d.status !== 'open') throw new HttpsError('failed-precondition', '종료된 선거입니다.');
    if (!(d.candidates || []).some(c => c.partyId === partyId)) {
      throw new HttpsError('invalid-argument', '후보 정당이 아닙니다.');
    }
    if (b.exists) throw new HttpsError('failed-precondition', '이미 투표했습니다.');

    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const myPartyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    const memberSnap = myPartyId ? await tx.get(memberRef(myPartyId, uid)) : null;

    tx.set(ballotRef, { partyId, createdAt: FieldValue.serverTimestamp() });
    tx.update(ref, {
      [`votes.${partyId}`]: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
      voteDeadlineKey,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const awardRef = db.doc(`point_awards/${uid}_election_vote_${key}`);
    tx.set(awardRef, {
      uid,
      action: 'election_vote',
      points,
      weekKey: key,
      finalDay: isFinalDay,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: false });
    tx.set(userRef, {
      points: FieldValue.increment(points),
      totalPoints: FieldValue.increment(points),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writePartyPowerInTx(tx, uid, user, memberSnap, points);

    return { ok: true, partyId, points, electionDay: isFinalDay, finalDay: isFinalDay };
  });
});

const getMyStatus = onCall({ region: REGION, timeoutSeconds: 10 }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) return { loggedIn: false };

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : {};
  const power = Math.max(0, Number(user.totalPoints || user.points || 0));
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  const party = partyId ? PARTY_BY_ID[partyId] : null;

  let partyRank = null, isLeader = false, weeklyGain = 0;
  if (partyId) {
    try {
      const [rankSnap, memberSnap] = await Promise.all([
        partyRef(partyId).collection('members').orderBy('power', 'desc').limit(30).get(),
        partyRef(partyId).collection('members').doc(uid).get().catch(() => null),
      ]);
      const ids = rankSnap.docs.map(d => d.id);
      const i = ids.indexOf(uid);
      if (i >= 0) { partyRank = i + 1; isLeader = i === 0; }
      if (memberSnap && memberSnap.exists) {
        const md = memberSnap.data() || {};
        const currentWeekKey = weekPeriod().key;
        weeklyGain = md.weekKey === currentWeekKey ? Number(md.weeklyGain || 0) : 0;
      }
    } catch {}
  }

  let votedElection = false;
  let votedCrisis = false;
  let campaignsToday = 0;
  let askedQAThisWeek = false;
  let electionEndKey = weekPeriod().voteDeadlineKey;
  const today = kstToday();
  try {
    const { key, voteDeadlineKey, prevKey } = weekPeriod();
    const [b, crisisVoteSnap, campaignSnap, qaAwardSnap] = await Promise.all([
      db.doc(`elections/${key}/ballots/${uid}`).get(),
      db.doc(`political_crises/${key}/votes/${uid}`).get().catch(() => null),
      db.doc(`campaign_records/${uid}_${today}`).get().catch(() => null),
      db.doc(`point_awards/president_q_${prevKey}_${uid}`).get().catch(() => null),
    ]);
    votedElection = b.exists;
    votedCrisis = !!(crisisVoteSnap && crisisVoteSnap.exists);
    campaignsToday = campaignSnap && campaignSnap.exists ? Number(campaignSnap.data().count || 0) : 0;
    askedQAThisWeek = !!(qaAwardSnap && qaAwardSnap.exists);
    electionEndKey = voteDeadlineKey;
  } catch {}

  let pointsToLeader = null;
  if (partyId && partyRank && partyRank > 1) {
    try {
      const leaderSnap = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get();
      if (!leaderSnap.empty) {
        const leaderPower = Number(leaderSnap.docs[0].data().power || 0);
        pointsToLeader = Math.max(0, leaderPower - power + 1);
      }
    } catch {}
  }

  return {
    loggedIn: true,
    power,
    partyId,
    partyName: party ? party.name : null,
    partyEmoji: party ? party.emoji : null,
    partyColor: party ? party.color : null,
    partyRank,
    isLeader,
    votedElection,
    electionEndKey,
    pointsToLeader,
    votedCrisis,
    campaignsToday,
    askedQAThisWeek,
    weeklyGain,
  };
});

module.exports = { voteForPresident, getMyStatus };
