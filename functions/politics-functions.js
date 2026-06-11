'use strict';

// politics-functions.js — 소소공화국 정당·입당·정치력 시스템
// 7개 가상 정당(AI 정치인이 이끄는)에 유저가 입당하고, 활동 포인트가 '정치력'이 되어
// 정당 순위와 당대표(당내 활동 1위)가 결정된다. 모든 쓰기는 서버에서만 처리한다.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

// ── 7개 정당 (battle-functions.js의 AI 캐릭터 소속과 일치) ──
const PARTIES = Object.freeze([
  { id: 'national',  name: '국민안정당', emoji: '🎙️', color: '#8B7355', leaderName: '3선 의원',        slogan: '검증된 경험, 흔들림 없는 안정' },
  { id: 'truth',     name: '진실방송당', emoji: '📺', color: '#6C5CE7', leaderName: '정치 유튜버',      slogan: '숨겨진 진실을 폭로한다' },
  { id: 'youth',     name: '청년혁명당', emoji: '📱', color: '#E84393', leaderName: 'MZ 운동가',        slogan: '기득권을 갈아엎자' },
  { id: 'center',    name: '중도민주당', emoji: '📊', color: '#00CEC9', leaderName: '여론조사 전문가',  slogan: '데이터가 곧 민심이다' },
  { id: 'future',    name: '함께미래당', emoji: '🤝', color: '#FDCB6E', leaderName: '당 대변인',        slogan: '우리는 늘 여러분 편입니다' },
  { id: 'rights',    name: '알권리당',   emoji: '🔍', color: '#00B894', leaderName: '탐사 기자',        slogan: '국민은 알 권리가 있다' },
  { id: 'justice',   name: '법치정의당', emoji: '⚖️', color: '#2D3436', leaderName: '검사 출신 변호사', slogan: '법 앞에 예외는 없다' },
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

function partyRef(id) { return db.doc(`parties/${id}`); }
function memberRef(partyId, uid) { return db.doc(`parties/${partyId}/members/${uid}`); }

// 정당 문서가 없으면 기본 통계로 생성한다 (최초 1회).
async function ensureParties() {
  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const missing = [];
  snaps.forEach((snap, i) => { if (!snap.exists) missing.push(PARTIES[i]); });
  if (!missing.length) return;
  const batch = db.batch();
  for (const p of missing) {
    batch.set(partyRef(p.id), {
      id: p.id, name: p.name, emoji: p.emoji, color: p.color,
      leaderName: p.leaderName, slogan: p.slogan,
      memberCount: 0, totalPower: 0,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

function publicMember(uid, userData) {
  return {
    uid,
    nickname: String(userData.nickname || userData.displayName || '시민').slice(0, 20),
    icon: (userData.nicknameIcon && typeof userData.nicknameIcon === 'object') ? userData.nicknameIcon : null,
    power: Math.max(0, Number(userData.totalPoints || userData.points || 0)),
  };
}

// 각 정당 당대표(정치력 1위 당원) 1명을 조회한다.
async function topMemberOf(partyId) {
  try {
    const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get();
    if (q.empty) return null;
    const d = q.docs[0];
    const m = d.data() || {};
    return { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0) };
  } catch {
    return null;
  }
}

// ── 정당 현황 + 내 소속 (페이지 1회 호출) ──
exports.getPoliticsOverview = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await ensureParties();

  const uid = request.auth && request.auth.uid;
  let me = null;

  if (uid) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const myPartyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    if (myPartyId) {
      // 내 정치력을 현재 누적 포인트에 맞춰 동기화한다 (가벼운 트랜잭션).
      const myPower = Math.max(0, Number(user.totalPoints || user.points || 0));
      await db.runTransaction(async tx => {
        const mRef = memberRef(myPartyId, uid);
        const pRef = partyRef(myPartyId);
        const [mSnap, pSnap] = await Promise.all([tx.get(mRef), tx.get(pRef)]);
        if (!pSnap.exists) return;
        const oldPower = mSnap.exists ? Number(mSnap.data().power || 0) : 0;
        const delta = myPower - oldPower;
        tx.set(mRef, { ...publicMember(uid, user), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (delta !== 0) tx.update(pRef, { totalPower: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() });
      });
      me = { partyId: myPartyId, partyName: PARTY_BY_ID[myPartyId].name, power: myPower };
    } else {
      me = { partyId: null, partyName: null, power: Math.max(0, Number(user.totalPoints || user.points || 0)) };
    }
  }

  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const leaders = await Promise.all(PARTY_IDS.map(topMemberOf));

  const parties = PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    return {
      ...meta,
      memberCount: Number(data.memberCount || 0),
      totalPower: Number(data.totalPower || 0),
      leader: leaders[i], // 당대표(활동 1위) — 없으면 null
    };
  }).sort((a, b) => b.totalPower - a.totalPower || b.memberCount - a.memberCount);

  parties.forEach((p, i) => { p.rank = i + 1; });

  return { ok: true, parties, me };
});

// ── 당원 목록(정치력 순) ──
exports.getPartyMembers = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const partyId = assertPartyId(request.data && request.data.partyId);
  const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(30).get();
  const members = q.docs.map((d, i) => {
    const m = d.data() || {};
    return { rank: i + 1, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0) };
  });
  return { ok: true, partyId, party: PARTY_BY_ID[partyId], members };
});

// ── 입당 / 정당 변경 ──
exports.joinParty = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const newPartyId = assertPartyId(request.data && request.data.partyId);
  await ensureParties();

  const userRef = db.doc(`users/${uid}`);

  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const oldPartyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    if (oldPartyId === newPartyId) return { changed: false, partyId: newPartyId };

    const power = Math.max(0, Number(user.totalPoints || user.points || 0));
    const newPRef = partyRef(newPartyId);
    const newMRef = memberRef(newPartyId, uid);

    // 읽기 먼저
    const newPSnap = await tx.get(newPRef);
    if (!newPSnap.exists) throw new HttpsError('failed-precondition', '정당 정보가 아직 준비되지 않았습니다.');

    let oldPSnap = null, oldMSnap = null, oldPRef = null, oldMRef = null;
    if (oldPartyId) {
      oldPRef = partyRef(oldPartyId);
      oldMRef = memberRef(oldPartyId, uid);
      [oldPSnap, oldMSnap] = await Promise.all([tx.get(oldPRef), tx.get(oldMRef)]);
    }

    // 쓰기
    if (oldPartyId && oldMSnap && oldMSnap.exists) {
      const oldPower = Number(oldMSnap.data().power || 0);
      tx.delete(oldMRef);
      tx.update(oldPRef, {
        memberCount: FieldValue.increment(-1),
        totalPower: FieldValue.increment(-oldPower),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(newMRef, { ...publicMember(uid, user), power, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(newPRef, {
      memberCount: FieldValue.increment(1),
      totalPower: FieldValue.increment(power),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, { partyId: newPartyId, partyJoinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    return { changed: true, partyId: newPartyId, switched: !!oldPartyId };
  });

  return { ok: true, ...result, party: PARTY_BY_ID[newPartyId] };
});

// ── 탈당 ──
exports.leaveParty = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const userRef = db.doc(`users/${uid}`);

  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    if (!partyId) return { left: false };

    const pRef = partyRef(partyId);
    const mRef = memberRef(partyId, uid);
    const mSnap = await tx.get(mRef);
    const power = mSnap.exists ? Number(mSnap.data().power || 0) : 0;

    if (mSnap.exists) tx.delete(mRef);
    tx.update(pRef, {
      memberCount: FieldValue.increment(mSnap.exists ? -1 : 0),
      totalPower: FieldValue.increment(-power),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, { partyId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { left: true };
  });

  return { ok: true, ...result };
});

// ──────────────────────────────────────────────
//  대통령 선거 — 매주(월요일~일요일) 7개 정당 후보로 진행
//  후보 = 당대표(당내 정치력 1위 인간) / 없으면 AI 정치인이 후보
//  유저가 없어도 항상 후보가 존재해 매주 대통령이 선출된다.
// ──────────────────────────────────────────────

// 이번 주(KST 월요일 기준) / 다음 주 / 지난 주 키
function weekPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const o = {}; parts.forEach(p => { o[p.type] = p.value; });
  const wmap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const off = (wmap[o.weekday] + 6) % 7; // 월요일로부터 지난 일수
  const base = Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day));
  const monMs = base - off * 86400000;
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  return { key: iso(monMs), endKey: iso(monMs + 7 * 86400000), prevKey: iso(monMs - 7 * 86400000) };
}

// 7개 정당 후보 스냅샷 (정치력 순)
async function buildCandidates() {
  await ensureParties();
  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const leaders = await Promise.all(PARTY_IDS.map(topMemberOf));
  return PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    const leader = leaders[i];
    const hasHuman = leader && leader.power > 0;
    return {
      partyId: meta.id, partyName: meta.name, emoji: meta.emoji, color: meta.color,
      candidateName: hasHuman ? leader.nickname : meta.leaderName,
      isAI: !hasHuman,
      power: Number(data.totalPower || 0),
    };
  }).sort((a, b) => b.power - a.power);
}

async function finalizeElection(periodId) {
  const ref = db.doc(`elections/${periodId}`);
  await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) return;
    const d = s.data() || {};
    if (d.status === 'closed') return;
    const cands = d.candidates || [];
    const votes = d.votes || {};
    let win = null, best = -1;
    cands.forEach(c => {
      const v = Number(votes[c.partyId] || 0);
      if (v > best) { best = v; win = c; } // 동률 시 정치력 상위(후보 정렬 순) 우선
    });
    tx.update(ref, {
      status: 'closed',
      winnerPartyId: win ? win.partyId : null,
      winner: win || null,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// 이번 주 선거 보장 + 지난 주 선거 마감 처리
async function ensureElection() {
  const { key, endKey, prevKey } = weekPeriod();
  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const candidates = await buildCandidates();
    await ref.set({
      periodId: key, status: 'open', startKey: key, endKey,
      candidates, votes: {}, totalVotes: 0,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await finalizeElection(prevKey); // 지난 주 당선자 확정
  }
  return key;
}

// ── 현재 선거 현황 + 현 대통령 ──
exports.getElection = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const key = await ensureElection();
  const { prevKey } = weekPeriod();
  const uid = request.auth && request.auth.uid;

  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  const d = snap.data() || {};
  const votes = d.votes || {};
  const candidates = (d.candidates || []).map(c => ({ ...c, votes: Number(votes[c.partyId] || 0) }));

  let myVote = null;
  if (uid) {
    const b = await ref.collection('ballots').doc(uid).get();
    if (b.exists) myVote = b.data().partyId || null;
  }

  let president = null;
  const prevSnap = await db.doc(`elections/${prevKey}`).get();
  if (prevSnap.exists && prevSnap.data().status === 'closed' && prevSnap.data().winner) {
    president = { ...prevSnap.data().winner, periodId: prevKey };
  }

  return {
    ok: true,
    election: { periodId: key, endKey: d.endKey, totalVotes: Number(d.totalVotes || 0), candidates, myVote },
    president,
  };
});

// ── 대통령 후보 투표 (1인 1표) ──
exports.voteForPresident = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data && request.data.partyId);
  const key = await ensureElection();
  const ref = db.doc(`elections/${key}`);

  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('failed-precondition', '선거가 준비되지 않았습니다.');
    const d = s.data() || {};
    if (d.status !== 'open') throw new HttpsError('failed-precondition', '종료된 선거입니다.');
    if (!(d.candidates || []).some(c => c.partyId === partyId)) {
      throw new HttpsError('invalid-argument', '후보 정당이 아닙니다.');
    }
    const ballotRef = ref.collection('ballots').doc(uid);
    const b = await tx.get(ballotRef);
    if (b.exists) throw new HttpsError('failed-precondition', '이미 투표했습니다.');
    tx.set(ballotRef, { partyId, createdAt: FieldValue.serverTimestamp() });
    tx.update(ref, {
      [`votes.${partyId}`]: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, partyId };
  });
});
