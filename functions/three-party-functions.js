'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const PARTIES = Object.freeze([
  { id: 'national', name: '국민안정당', emoji: '🎙️', color: '#8B7355', leaderName: '안정파 대표', slogan: '검증된 경험, 흔들림 없는 안정' },
  { id: 'youth', name: '청년혁명당', emoji: '📱', color: '#E84393', leaderName: '개혁파 대표', slogan: '기득권을 바꾸는 개혁 정치' },
  { id: 'center', name: '중도민주당', emoji: '📊', color: '#00CEC9', leaderName: '실용파 대표', slogan: '데이터와 민심으로 움직이는 실용 정치' },
]);
const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);

const PARTY_NPCS = Object.freeze({
  national: [
    { name: '김중진', emoji: '🎩', power: 2400 },
    { name: '박관록', emoji: '📜', power: 1500 },
    { name: '정선배', emoji: '☕', power: 520 },
  ],
  youth: [
    { name: '갈아엎자', emoji: '🔥', power: 2200 },
    { name: '공정좌', emoji: '⚖️', power: 1300 },
    { name: '팩폭러', emoji: '🥊', power: 520 },
  ],
  center: [
    { name: '김퍼센트', emoji: '📊', power: 2100 },
    { name: '박표본', emoji: '🧮', power: 1350 },
    { name: '여론바람', emoji: '🌬️', power: 520 },
  ],
});

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
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
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
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      leaderName: p.leaderName,
      slogan: p.slogan,
      active: true,
      system: 'three-party',
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { memberCount: 0, totalPower: 0, createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    dirty = true;

    if (!data.npcSeededThreeParty) {
      let powerSum = 0;
      (PARTY_NPCS[p.id] || []).forEach((npc, idx) => {
        const npcUid = `npc_${p.id}_three_${idx + 1}`;
        powerSum += Number(npc.power || 0);
        batch.set(memberRef(p.id, npcUid), {
          uid: npcUid,
          nickname: npc.name,
          icon: { type: 'emoji', value: npc.emoji },
          power: Number(npc.power || 0),
          isNpc: true,
          joinedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      batch.set(partyRef(p.id), {
        npcSeededThreeParty: true,
        memberCount: FieldValue.increment((PARTY_NPCS[p.id] || []).length),
        totalPower: FieldValue.increment(powerSum),
        updatedAt: FieldValue.serverTimestamp(),
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
    return { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0), isNpc: !!m.isNpc };
  } catch {
    return null;
  }
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
      batch.update(partyRef(PARTY_IDS[i]), {
        powerSnapshotDate: today,
        prevDayPower: Number(d.totalPower || 0),
      });
      snapshotDirty = true;
    }
  });
  if (snapshotDirty) batch.commit().catch(() => {});

  const parties = PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    const totalPower = Number(data.totalPower || 0);
    const prevDayPower = Number(data.prevDayPower || 0);
    const powerDiff = prevDayPower > 0 ? totalPower - prevDayPower : 0;
    return {
      ...meta,
      memberCount: Number(data.memberCount || 0),
      totalPower,
      powerDiff,
      leader: leaders[i],
    };
  }).sort((a, b) => b.totalPower - a.totalPower || b.memberCount - a.memberCount);

  parties.forEach((p, i) => { p.rank = i + 1; });
  return { ok: true, mode: 'three-party', parties, me };
});

const getPartyMembers = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const partyId = assertPartyId(request.data && request.data.partyId);
  const currentWeekKey = kstMondayKey();
  const [powerQ, gainQ] = await Promise.all([
    partyRef(partyId).collection('members').orderBy('power', 'desc').limit(30).get(),
    partyRef(partyId).collection('members').orderBy('weeklyGain', 'desc').limit(3).get(),
  ]);
  const members = powerQ.docs.map((d, i) => {
    const m = d.data() || {};
    return { rank: i + 1, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0) };
  });
  const weeklyStars = gainQ.docs
    .filter(d => {
      const m = d.data() || {};
      return m.weekKey === currentWeekKey && Number(m.weeklyGain || 0) > 0;
    })
    .map(d => {
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

    let oldPRef = null;
    let oldMRef = null;
    let oldPSnap = null;
    let oldMSnap = null;
    if (oldPartyId && oldPartyId !== newPartyId) {
      oldPRef = partyRef(oldPartyId);
      oldMRef = memberRef(oldPartyId, uid);
      [oldPSnap, oldMSnap] = await Promise.all([tx.get(oldPRef), tx.get(oldMRef)]);
    }

    if (oldPartyId && oldPartyId !== newPartyId && oldMSnap && oldMSnap.exists) {
      const oldPower = Number(oldMSnap.data().power || 0);
      tx.delete(oldMRef);
      if (oldPSnap && oldPSnap.exists) {
        tx.update(oldPRef, {
          memberCount: FieldValue.increment(-1),
          totalPower: FieldValue.increment(-oldPower),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
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

const leaveParty = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const userRef = db.doc(`users/${uid}`);

  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const partyId = safePartyId(user.partyId);
    if (!partyId) return { left: false };

    const pRef = partyRef(partyId);
    const mRef = memberRef(partyId, uid);
    const [pSnap, mSnap] = await Promise.all([tx.get(pRef), tx.get(mRef)]);
    const power = mSnap.exists ? Number(mSnap.data().power || 0) : 0;

    if (mSnap.exists) tx.delete(mRef);
    if (pSnap.exists) {
      tx.update(pRef, {
        memberCount: FieldValue.increment(mSnap.exists ? -1 : 0),
        totalPower: FieldValue.increment(-power),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(userRef, { partyId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { left: true };
  });

  return { ok: true, ...result };
});

module.exports = { getPoliticsOverview, getPartyMembers, joinParty, leaveParty };
