'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_FORCE_ACTION_LIMIT = 3;
const FORCE_ACTION_REWARD = 3;

const EXTERNAL_FORCES = Object.freeze([
  {
    id: 'investigation',
    name: '특별수사청',
    emoji: '🕵️',
    color: '#334155',
    role: '수사·권력 감시',
    routeName: '수사권력 루트',
    agenda: '부패 수사, 권력기관 개혁, 정치권 압박',
    strength: '정치권을 압박하고 비리 프레임을 만들 수 있습니다.',
  },
  {
    id: 'police',
    name: '치안안전청',
    emoji: '🚓',
    color: '#1D4ED8',
    role: '치안·집회 관리',
    routeName: '치안권력 루트',
    agenda: '민생 안전, 집회 대응, 질서 유지',
    strength: '사회 불안 이슈에서 여론과 안정성에 영향을 줍니다.',
  },
  {
    id: 'business',
    name: '재계연합',
    emoji: '🏢',
    color: '#B45309',
    role: '경제·투자 압력',
    routeName: '경제권력 루트',
    agenda: '투자, 고용, 규제 완화, 성장 프레임',
    strength: '경제 위기와 성장 이슈에서 정당과 대통령을 움직입니다.',
  },
  {
    id: 'media',
    name: '전국언론연합',
    emoji: '📰',
    color: '#7C3AED',
    role: '여론·프레임 형성',
    routeName: '여론권력 루트',
    agenda: '보도 프레임, 지지율, 의혹 제기, 여론전',
    strength: '대선 판세와 정당 이미지에 강한 영향을 줍니다.',
  },
  {
    id: 'civic',
    name: '시민연대',
    emoji: '✊',
    color: '#059669',
    role: '개혁·시민권 요구',
    routeName: '시민운동 루트',
    agenda: '개혁 요구, 복지, 인권, 시민 참여',
    strength: '개혁 이슈와 광장 여론을 움직입니다.',
  },
  {
    id: 'bureaucracy',
    name: '행정관료단',
    emoji: '🏛️',
    color: '#475569',
    role: '예산·정책 집행',
    routeName: '관료권력 루트',
    agenda: '정책 집행, 예산 배분, 행정 저항, 실무 통제',
    strength: '대통령 공약이 실제로 실행되는 속도에 영향을 줍니다.',
  },
]);

const FORCE_BY_ID = Object.freeze(Object.fromEntries(EXTERNAL_FORCES.map(f => [f.id, f])));
const FORCE_IDS = EXTERNAL_FORCES.map(f => f.id);

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function assertForceId(value) {
  const id = String(value || '').trim();
  if (!FORCE_BY_ID[id]) throw new HttpsError('invalid-argument', '존재하지 않는 외부세력입니다.');
  return id;
}

function safeForceId(value) {
  const id = String(value || '').trim();
  return FORCE_BY_ID[id] ? id : null;
}

function forceRef(id) { return db.doc(`external_forces/${id}`); }
function memberRef(forceId, uid) { return db.doc(`external_forces/${forceId}/members/${uid}`); }

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function publicMember(uid, userData) {
  return {
    uid,
    nickname: String(userData.nickname || userData.displayName || '시민').slice(0, 20),
    icon: (userData.nicknameIcon && typeof userData.nicknameIcon === 'object') ? userData.nicknameIcon : null,
    influence: Math.max(0, Number(userData.totalPoints || userData.points || 0)),
  };
}

async function ensureExternalForces() {
  const batch = db.batch();
  const snaps = await db.getAll(...FORCE_IDS.map(forceRef));
  let dirty = false;
  EXTERNAL_FORCES.forEach((f, i) => {
    const snap = snaps[i];
    batch.set(forceRef(f.id), {
      id: f.id,
      name: f.name,
      emoji: f.emoji,
      color: f.color,
      role: f.role,
      routeName: f.routeName,
      agenda: f.agenda,
      strength: f.strength,
      active: true,
      system: 'external-power-force',
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { memberCount: 0, totalInfluence: 0, createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    dirty = true;
  });
  if (dirty) await batch.commit();
}

async function topMemberOf(forceId) {
  try {
    const q = await forceRef(forceId).collection('members').orderBy('influence', 'desc').limit(1).get();
    if (q.empty) return null;
    const d = q.docs[0];
    const m = d.data() || {};
    return { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, influence: Number(m.influence || 0) };
  } catch { return null; }
}

async function syncUserForceMembership(uid, user) {
  const forceId = safeForceId(user.externalForceId);
  if (!forceId) return null;
  const influence = Math.max(0, Number(user.totalPoints || user.points || 0));
  await db.runTransaction(async tx => {
    const fRef = forceRef(forceId);
    const mRef = memberRef(forceId, uid);
    const [fSnap, mSnap] = await Promise.all([tx.get(fRef), tx.get(mRef)]);
    if (!fSnap.exists) return;
    const oldInfluence = mSnap.exists ? Number(mSnap.data().influence || 0) : 0;
    const delta = influence - oldInfluence;
    tx.set(mRef, { ...publicMember(uid, user), influence, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (!mSnap.exists) tx.update(fRef, { memberCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    if (delta !== 0) tx.update(fRef, { totalInfluence: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() });
  });
  return { forceId, forceName: FORCE_BY_ID[forceId].name, influence };
}

const getExternalForcesOverview = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await ensureExternalForces();
  const uid = request.auth && request.auth.uid;
  let me = null;
  if (uid) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.exists ? userSnap.data() || {} : {};
    me = await syncUserForceMembership(uid, user);
  }

  const snaps = await db.getAll(...FORCE_IDS.map(forceRef));
  const leaders = await Promise.all(FORCE_IDS.map(topMemberOf));
  const forces = EXTERNAL_FORCES.map((meta, i) => {
    const data = snaps[i].exists ? snaps[i].data() || {} : {};
    return {
      ...meta,
      memberCount: Number(data.memberCount || 0),
      totalInfluence: Number(data.totalInfluence || 0),
      leader: leaders[i],
    };
  }).sort((a, b) => b.totalInfluence - a.totalInfluence || b.memberCount - a.memberCount);
  forces.forEach((f, i) => { f.rank = i + 1; });
  return { ok: true, forces, me, dailyLimit: DAILY_FORCE_ACTION_LIMIT, reward: FORCE_ACTION_REWARD };
});

const joinExternalForce = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const newForceId = assertForceId(request.data && request.data.forceId);
  await ensureExternalForces();
  const userRef = db.doc(`users/${uid}`);

  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const oldForceId = safeForceId(user.externalForceId);
    if (oldForceId === newForceId) return { changed: false, forceId: newForceId };

    const influence = Math.max(0, Number(user.totalPoints || user.points || 0));
    const newFRef = forceRef(newForceId);
    const newMRef = memberRef(newForceId, uid);
    const newFSnap = await tx.get(newFRef);
    if (!newFSnap.exists) throw new HttpsError('failed-precondition', '외부세력 정보가 아직 준비되지 않았습니다.');

    if (oldForceId && oldForceId !== newForceId) {
      const oldFRef = forceRef(oldForceId);
      const oldMRef = memberRef(oldForceId, uid);
      const [oldFSnap, oldMSnap] = await Promise.all([tx.get(oldFRef), tx.get(oldMRef)]);
      if (oldMSnap.exists) {
        const oldInfluence = Number(oldMSnap.data().influence || 0);
        tx.delete(oldMRef);
        if (oldFSnap.exists) tx.update(oldFRef, { memberCount: FieldValue.increment(-1), totalInfluence: FieldValue.increment(-oldInfluence), updatedAt: FieldValue.serverTimestamp() });
      }
    }

    tx.set(newMRef, { ...publicMember(uid, user), influence, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(newFRef, { memberCount: FieldValue.increment(1), totalInfluence: FieldValue.increment(influence), updatedAt: FieldValue.serverTimestamp() });
    tx.set(userRef, { externalForceId: newForceId, externalForceJoinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { changed: true, forceId: newForceId, switched: !!oldForceId };
  });

  return { ok: true, ...result, force: FORCE_BY_ID[newForceId] };
});

const leaveExternalForce = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const userRef = db.doc(`users/${uid}`);
  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const forceId = safeForceId(user.externalForceId);
    if (!forceId) return { left: false };
    const fRef = forceRef(forceId);
    const mRef = memberRef(forceId, uid);
    const [fSnap, mSnap] = await Promise.all([tx.get(fRef), tx.get(mRef)]);
    const influence = mSnap.exists ? Number(mSnap.data().influence || 0) : 0;
    if (mSnap.exists) tx.delete(mRef);
    if (fSnap.exists) tx.update(fRef, { memberCount: FieldValue.increment(mSnap.exists ? -1 : 0), totalInfluence: FieldValue.increment(-influence), updatedAt: FieldValue.serverTimestamp() });
    tx.set(userRef, { externalForceId: FieldValue.delete(), externalForceLeftAt: FieldValue.serverTimestamp(), lastExternalForceId: forceId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { left: true, forceId };
  });
  return { ok: true, ...result };
});

const actForExternalForce = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  await ensureExternalForces();
  const today = kstToday();
  const userRef = db.doc(`users/${uid}`);
  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const forceId = safeForceId(user.externalForceId);
    if (!forceId) throw new HttpsError('failed-precondition', '먼저 외부세력을 선택해주세요.');

    const recordRef = db.doc(`external_force_actions/${uid}_${today}`);
    const fRef = forceRef(forceId);
    const mRef = memberRef(forceId, uid);
    const [recordSnap, fSnap, mSnap] = await Promise.all([tx.get(recordRef), tx.get(fRef), tx.get(mRef)]);
    if (!fSnap.exists) throw new HttpsError('failed-precondition', '외부세력 정보가 아직 준비되지 않았습니다.');
    const count = recordSnap.exists ? Number(recordSnap.data().count || 0) : 0;
    if (count >= DAILY_FORCE_ACTION_LIMIT) throw new HttpsError('resource-exhausted', '오늘 외부세력 활동은 모두 사용했습니다.');

    const nextCount = count + 1;
    const currentPoints = Math.max(0, Number(user.points || user.totalPoints || 0));
    const currentTotalPoints = Math.max(0, Number(user.totalPoints || user.points || 0));
    const nextPoints = currentPoints + FORCE_ACTION_REWARD;
    const nextTotalPoints = currentTotalPoints + FORCE_ACTION_REWARD;
    const oldInfluence = mSnap.exists ? Number(mSnap.data().influence || 0) : 0;
    const nextInfluence = Math.max(0, nextTotalPoints);
    const delta = nextInfluence - oldInfluence;

    tx.set(userRef, { points: nextPoints, totalPoints: nextTotalPoints, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(recordRef, { uid, forceId, date: today, count: nextCount, updatedAt: FieldValue.serverTimestamp(), createdAt: recordSnap.exists ? recordSnap.data().createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp() }, { merge: true });
    tx.set(mRef, { ...publicMember(uid, { ...user, points: nextPoints, totalPoints: nextTotalPoints }), influence: nextInfluence, updatedAt: FieldValue.serverTimestamp(), joinedAt: mSnap.exists ? mSnap.data().joinedAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp() }, { merge: true });
    if (!mSnap.exists) tx.update(fRef, { memberCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    tx.update(fRef, { totalInfluence: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`point_awards/${uid}_external_force_${today}_${nextCount}`), { uid, action: 'external_force_action', points: FORCE_ACTION_REWARD, forceId, date: today, createdAt: FieldValue.serverTimestamp() }, { merge: false });
    return { forceId, count: nextCount, dailyLimit: DAILY_FORCE_ACTION_LIMIT, points: FORCE_ACTION_REWARD, pointsAfter: nextPoints, influenceAfter: nextInfluence };
  });
  return { ok: true, ...result, force: FORCE_BY_ID[result.forceId] };
});

module.exports = { getExternalForcesOverview, joinExternalForce, leaveExternalForce, actForExternalForce };
