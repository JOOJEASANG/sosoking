'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const PARTIES = Object.freeze([
  { id: 'national',  name: '국민안정당', emoji: '🎙️', color: '#8B7355' },
  { id: 'truth',     name: '진실방송당', emoji: '📺', color: '#6C5CE7' },
  { id: 'youth',     name: '청년혁명당', emoji: '📱', color: '#E84393' },
  { id: 'center',    name: '중도민주당', emoji: '📊', color: '#00CEC9' },
  { id: 'future',    name: '함께미래당', emoji: '🤝', color: '#FDCB6E' },
  { id: 'rights',    name: '알권리당',   emoji: '🔍', color: '#00B894' },
  { id: 'justice',   name: '법치정의당', emoji: '⚖️', color: '#2D3436' },
]);
const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);
const WEEKLY_REWARD = 30;

function weekKey() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function partyRef(id) { return db.doc(`parties/${id}`); }
function memberRef(partyId, uid) { return db.doc(`parties/${partyId}/members/${uid}`); }

async function loadStandings() {
  const snaps = await db.getAll(...PARTY_IDS.map(partyRef));
  return PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? snaps[i].data() || {} : {};
    return {
      ...meta,
      totalPower: Number(data.totalPower || 0),
      memberCount: Number(data.memberCount || 0),
      weeklyWins: Number(data.weeklyWins || 0),
    };
  }).sort((a, b) => b.totalPower - a.totalPower || b.memberCount - a.memberCount || a.id.localeCompare(b.id));
}

function weeklyPowerFields(memberData, oldPower, newPower) {
  const currentWeekKey = weekKey();
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

exports.getWeeklyPartyWar = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth && request.auth.uid;
  const currentWeekKey = weekKey();
  const standings = await loadStandings();
  const winner = standings[0] || null;

  let myPartyId = null;
  let eligible = false;
  let claimed = false;

  if (uid) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.exists ? userSnap.data() || {} : {};
    myPartyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    eligible = !!winner && myPartyId === winner.id;
    const claimSnap = await db.doc(`point_awards/partywar_${currentWeekKey}_${uid}`).get();
    claimed = claimSnap.exists;
  }

  return {
    ok: true,
    weekKey: currentWeekKey,
    reward: WEEKLY_REWARD,
    winner,
    standings: standings.map((p, i) => ({ ...p, rank: i + 1 })),
    myPartyId,
    eligible,
    claimed,
  };
});

exports.claimWeeklyPartyWarReward = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const currentWeekKey = weekKey();
  const claimRef = db.doc(`point_awards/partywar_${currentWeekKey}_${uid}`);
  const userRef = db.doc(`users/${uid}`);
  const standings = await loadStandings();
  const winner = standings[0] || null;
  if (!winner) throw new HttpsError('failed-precondition', '정당전이 아직 준비되지 않았습니다.');

  let awarded = false;
  await db.runTransaction(async tx => {
    const [claimSnap, userSnap] = await Promise.all([tx.get(claimRef), tx.get(userRef)]);
    if (claimSnap.exists) return;
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');

    const user = userSnap.data() || {};
    const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    if (partyId !== winner.id) {
      throw new HttpsError('failed-precondition', '이번 주 1위 정당 소속만 받을 수 있습니다.');
    }

    const mRef = memberRef(partyId, uid);
    const mSnap = await tx.get(mRef);
    const oldPower = mSnap.exists ? Number(mSnap.data().power || 0) : Number(user.totalPoints || user.points || 0);
    const newPower = Math.max(0, Number(user.totalPoints || user.points || 0) + WEEKLY_REWARD);
    const delta = newPower - oldPower;

    awarded = true;
    tx.set(claimRef, {
      uid,
      action: 'party_war_reward',
      weekKey: currentWeekKey,
      partyId,
      points: WEEKLY_REWARD,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, {
      points: FieldValue.increment(WEEKLY_REWARD),
      totalPoints: FieldValue.increment(WEEKLY_REWARD),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(mRef, {
      power: newPower,
      nickname: String(user.nickname || user.displayName || '시민').slice(0, 20),
      icon: (user.nicknameIcon && typeof user.nicknameIcon === 'object') ? user.nicknameIcon : null,
      ...weeklyPowerFields(mSnap.exists ? mSnap.data() || {} : {}, oldPower, newPower),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(partyRef(partyId), {
      totalPower: FieldValue.increment(delta || WEEKLY_REWARD),
      weeklyWins: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { ok: true, awarded, points: awarded ? WEEKLY_REWARD : 0, party: winner };
});
