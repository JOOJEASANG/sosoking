'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const LEAVE_PARTY_PENALTY = 30;

const PARTIES = Object.freeze([
  {
    id: 'national',
    name: '국민질서당',
    emoji: '🛡️',
    color: '#263B66',
    leaderName: '강도윤',
    slogan: '흔들림 없는 안보, 질서 있는 개혁',
    ideology: '보수파',
    keywords: ['안보', '질서', '성장', '책임'],
  },
  {
    id: 'youth',
    name: '시민개혁당',
    emoji: '🕯️',
    color: '#B8323B',
    leaderName: '한서윤',
    slogan: '시민이 만든 권력, 시민에게 돌아가는 개혁',
    ideology: '진보파',
    keywords: ['개혁', '복지', '시민권', '공정'],
  },
  {
    id: 'center',
    name: '국민통합당',
    emoji: '⚖️',
    color: '#2F7D6E',
    leaderName: '윤태건',
    slogan: '갈라진 광장을 하나로 묶는 실용 정치',
    ideology: '중도파',
    keywords: ['협치', '균형', '실용', '통합'],
  },
]);
const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);

const PARTY_NPCS = Object.freeze({
  national: [
    { name: '강도윤', emoji: '🛡️', power: 2600, role: '국민질서당 대표', profile: '군사독재 이후 혼란을 경계하며 안보와 국가 운영의 연속성을 강조하는 보수파 정치인', flaw: '위기 대응에는 강하지만 권위주의 논란에 자주 휘말린다.' },
    { name: '서문하', emoji: '📈', power: 1700, role: '경제·언론 전략가', profile: '성장, 시장, 언론 프레임을 다루는 냉정한 전략가', flaw: '정책의 인간적 비용을 과소평가한다는 비판을 받는다.' },
  ],
  youth: [
    { name: '한서윤', emoji: '🕯️', power: 2500, role: '시민개혁당 대표', profile: '광장과 시민권을 정치의 중심에 두는 개혁파 정치인', flaw: '개혁 속도가 빠를수록 재정·갈등 관리 논란이 커진다.' },
    { name: '백진우', emoji: '📜', power: 1650, role: '제도개혁 참모', profile: '권력기관, 노동, 재벌 개혁 이슈를 파고드는 원칙주의자', flaw: '타협을 배신으로 보는 경향 때문에 연정에 약하다.' },
  ],
  center: [
    { name: '윤태건', emoji: '⚖️', power: 2400, role: '국민통합당 대표', profile: '진영 갈등보다 협치와 제도 안정성을 앞세우는 중도파 정치인', flaw: '결정적 순간마다 우유부단하다는 공격을 받는다.' },
    { name: '오하린', emoji: '🧭', power: 1600, role: '여론·세대 분석가', profile: '세대, 지역, 온라인 여론을 분석해 판세를 읽는 현실주의자', flaw: '정치가 숫자로만 움직인다고 보는 냉소적 태도가 약점이다.' },
  ],
});

const HISTORICAL_NPC_UIDS = new Set(PARTY_IDS.flatMap(pid => (PARTY_NPCS[pid] || []).map((_, idx) => `npc_${pid}_historical_${idx + 1}`)));

function isVisibleMemberDoc(docSnap) {
  const m = docSnap.data() || {};
  if (!m.isNpc) return true;
  return HISTORICAL_NPC_UIDS.has(docSnap.id);
}

function publicMemberFromDoc(docSnap, rank = null) {
  const m = docSnap.data() || {};
  return {
    ...(rank != null ? { rank } : {}),
    uid: docSnap.id,
    nickname: m.nickname || '시민',
    icon: m.icon || null,
    power: Number(m.power || 0),
    role: m.role || null,
    profile: m.profile || null,
    flaw: m.flaw || null,
    isNpc: !!m.isNpc,
  };
}

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function assertPartyId(value) {
  const id = String(value || '').trim();
  if (!PARTY_BY_ID[id]) throw new HttpsError('invalid-argument', '현재 운영 중인 3개 정당 중에서 선택해주세요.');
  return id;
}

function safePartyId(value) {
  const id = String(value || '').trim();
  return id && !id.includes('/') ? id : null;
}

function partyRef(id) { return db.doc(`parties/${id}`); }
function memberRef(partyId, uid) { return db.doc(`parties/${partyId}/members/${uid}`); }

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function kstMondayKey() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function publicMember(uid, userData) {
  return {
    uid,
    nickname: String(userData.nickname || userData.displayName || '시민').slice(0, 20),
    icon: (userData.nicknameIcon && typeof userData.nicknameIcon === 'object') ? userData.nicknameIcon : null,
    power: Math.max(0, Number(userData.totalPoints || userData.points || 0)),
  };
}

async function ensureThreeParties() {
  const snaps = await db.getAll(...PARTY_IDS.map(partyRef));
  const batch = db.batch();
  let dirty = false;

  snaps.forEach((snap, i) => {
    const p = PARTIES[i];
    const data = snap.exists ? snap.data() || {} : {};
    batch.set(partyRef(p.id), {
      id: p.id, name: p.name, emoji: p.emoji, color: p.color, leaderName: p.leaderName, slogan: p.slogan, ideology: p.ideology, keywords: p.keywords,
      active: true, system: 'three-party-historical', updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { memberCount: 0, totalPower: 0, createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    dirty = true;

    if (!data.npcSeededHistoricalSix) {
      let powerSum = 0;
      (PARTY_NPCS[p.id] || []).forEach((npc, idx) => {
        const npcUid = `npc_${p.id}_historical_${idx + 1}`;
        powerSum += Number(npc.power || 0);
        batch.set(memberRef(p.id, npcUid), {
          uid: npcUid, nickname: npc.name, icon: { type: 'emoji', value: npc.emoji }, power: Number(npc.power || 0), role: npc.role, profile: npc.profile, flaw: npc.flaw, isNpc: true,
          joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      batch.set(partyRef(p.id), { npcSeededHistoricalSix: true, memberCount: FieldValue.increment((PARTY_NPCS[p.id] || []).length), totalPower: FieldValue.increment(powerSum), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      dirty = true;
    }
  });

  if (dirty) await batch.commit();
}

async function topMemberOf(partyId) {
  try {
    const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(30).get();
    const docSnap = q.docs.find(isVisibleMemberDoc);
    return docSnap ? publicMemberFromDoc(docSnap) : null;
  } catch { return null; }
}

const getPoliticsOverview = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await ensureThreeParties();
  const uid = request.auth && request.auth.uid;
  let me = null;

  if (uid) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const myPartyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    const myPower = Math.max(0, Number(user.totalPoints || user.points || 0));
    if (myPartyId) {
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
      me = { partyId: null, partyName: null, power: myPower };
    }
  }

  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const leaders = await Promise.all(PARTY_IDS.map(topMemberOf));
  const today = kstToday();
  const batch = db.batch();
  let snapshotDirty = false;

  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const d = snap.data() || {};
    if (d.powerSnapshotDate !== today) {
      batch.update(partyRef(PARTY_IDS[i]), { powerSnapshotDate: today, prevDayPower: Number(d.totalPower || 0) });
      snapshotDirty = true;
    }
  });
  if (snapshotDirty) batch.commit().catch(() => {});

  const parties = PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    const totalPower = Number(data.totalPower || 0);
    const prevDayPower = Number(data.prevDayPower || 0);
    const powerDiff = prevDayPower > 0 ? totalPower - prevDayPower : 0;
    return { ...meta, memberCount: Number(data.memberCount || 0), totalPower, powerDiff, leader: leaders[i] };
  }).sort((a, b) => b.totalPower - a.totalPower || b.memberCount - a.memberCount);

  parties.forEach((p, i) => { p.rank = i + 1; });
  return { ok: true, mode: 'three-party-historical', parties, me };
});

const getPartyMembers = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const partyId = assertPartyId(request.data && request.data.partyId);
  const currentWeekKey = kstMondayKey();
  const [powerQ, gainQ] = await Promise.all([
    partyRef(partyId).collection('members').orderBy('power', 'desc').limit(50).get(),
    partyRef(partyId).collection('members').orderBy('weeklyGain', 'desc').limit(10).get(),
  ]);
  const members = powerQ.docs.filter(isVisibleMemberDoc).slice(0, 30).map((d, i) => publicMemberFromDoc(d, i + 1));
  const weeklyStars = gainQ.docs.filter(isVisibleMemberDoc).filter(d => {
    const m = d.data() || {};
    return m.weekKey === currentWeekKey && Number(m.weeklyGain || 0) > 0;
  }).slice(0, 3).map(d => {
    const m = d.data() || {};
    return { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, weeklyGain: Number(m.weeklyGain || 0) };
  });
  return { ok: true, partyId, party: PARTY_BY_ID[partyId], members, weeklyStars };
});

const joinParty = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const newPartyId = assertPartyId(request.data && request.data.partyId);
  await ensureThreeParties();

  const userRef = db.doc(`users/${uid}`);
  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const oldPartyId = safePartyId(user.partyId);
    if (oldPartyId === newPartyId) return { changed: false, partyId: newPartyId };

    const power = Math.max(0, Number(user.totalPoints || user.points || 0));
    const newPRef = partyRef(newPartyId);
    const newMRef = memberRef(newPartyId, uid);
    const newPSnap = await tx.get(newPRef);
    if (!newPSnap.exists) throw new HttpsError('failed-precondition', '정당 정보가 아직 준비되지 않았습니다.');

    let oldPRef = null, oldMRef = null, oldPSnap = null, oldMSnap = null;
    if (oldPartyId && oldPartyId !== newPartyId) {
      oldPRef = partyRef(oldPartyId);
      oldMRef = memberRef(oldPartyId, uid);
      [oldPSnap, oldMSnap] = await Promise.all([tx.get(oldPRef), tx.get(oldMRef)]);
    }

    if (oldPartyId && oldPartyId !== newPartyId && oldMSnap && oldMSnap.exists) {
      const oldPower = Number(oldMSnap.data().power || 0);
      tx.delete(oldMRef);
      if (oldPSnap && oldPSnap.exists) tx.update(oldPRef, { memberCount: FieldValue.increment(-1), totalPower: FieldValue.increment(-oldPower), updatedAt: FieldValue.serverTimestamp() });
    }

    tx.set(newMRef, { ...publicMember(uid, user), power, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(newPRef, { memberCount: FieldValue.increment(1), totalPower: FieldValue.increment(power), updatedAt: FieldValue.serverTimestamp() });
    tx.set(userRef, { partyId: newPartyId, partyJoinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { changed: true, partyId: newPartyId, switched: !!oldPartyId };
  });

  return { ok: true, ...result, party: PARTY_BY_ID[newPartyId] };
});

const leaveParty = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const userRef = db.doc(`users/${uid}`);

  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const partyId = safePartyId(user.partyId);
    if (!partyId) return { left: false, penalty: 0, pointsAfter: Math.max(0, Number(user.points || user.totalPoints || 0)) };

    const pRef = partyRef(partyId);
    const mRef = memberRef(partyId, uid);
    const [pSnap, mSnap] = await Promise.all([tx.get(pRef), tx.get(mRef)]);
    const memberPower = mSnap.exists ? Number(mSnap.data().power || 0) : Math.max(0, Number(user.totalPoints || user.points || 0));
    const currentPoints = Math.max(0, Number(user.points ?? user.totalPoints ?? 0));
    const currentTotalPoints = Math.max(0, Number(user.totalPoints ?? user.points ?? 0));
    const penalty = Math.min(LEAVE_PARTY_PENALTY, Math.max(currentPoints, currentTotalPoints));
    const nextPoints = Math.max(0, currentPoints - penalty);
    const nextTotalPoints = Math.max(0, currentTotalPoints - penalty);

    if (mSnap.exists) tx.delete(mRef);
    if (pSnap.exists) {
      tx.update(pRef, {
        memberCount: FieldValue.increment(mSnap.exists ? -1 : 0),
        totalPower: FieldValue.increment(-memberPower),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(userRef, {
      partyId: FieldValue.delete(),
      partyLeftAt: FieldValue.serverTimestamp(),
      lastPartyId: partyId,
      points: nextPoints,
      totalPoints: nextTotalPoints,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(db.doc(`point_awards/${uid}_leave_party_${Date.now()}`), {
      uid,
      action: 'leave_party_penalty',
      points: -penalty,
      partyId,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: false });
    return { left: true, partyId, penalty, pointsAfter: nextPoints, totalPointsAfter: nextTotalPoints };
  });

  return { ok: true, ...result };
});

module.exports = { getPoliticsOverview, getPartyMembers, joinParty, leaveParty };
