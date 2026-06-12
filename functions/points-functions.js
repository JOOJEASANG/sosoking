'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('crypto');

const db = getFirestore();
const REGION = 'asia-northeast3';

const POINT_RULES = Object.freeze({
  post_create: { points: 10, label: '피드 글 작성' },
  comment_create: { points: 20, label: '댓글 작성' },
  reply_create: { points: 2, label: '답글 작성' },
  participation_create: { points: 3, label: '참여글 작성' },
  vote_participate: { points: 1, label: '투표 참여' },
  reaction_received: { points: 1, label: '반응 받음' },
  reaction_give: { points: 1, label: '댓글에 반응 남기기' },
});

const CLIENT_CALLABLE_ACTIONS = new Set(['post_create', 'comment_create', 'reaction_give']);

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

function clean(value, max = 160) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function cleanDocId(value, name) {
  const id = clean(value, 180);
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', `${name} 정보가 올바르지 않습니다.`);
  return id;
}

function makeAwardId(uid, action, target) {
  const raw = JSON.stringify({
    uid,
    action,
    postId: clean(target.postId, 180),
    itemId: clean(target.itemId, 180),
    onceKey: clean(target.onceKey, 180),
  });
  return createHash('sha256').update(raw).digest('hex');
}

async function validateClientAward(uid, action, meta) {
  if (!CLIENT_CALLABLE_ACTIONS.has(action)) {
    throw new HttpsError('permission-denied', '서버 지급 항목입니다.');
  }

  if (action === 'post_create') {
    const postId = cleanDocId(meta.postId, '게시글');
    const snap = await db.doc(`feeds/${postId}`).get();
    if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const post = snap.data() || {};
    if (post.authorId !== uid) throw new HttpsError('permission-denied', '본인 글만 인정됩니다.');
    if (post.hidden === true) throw new HttpsError('failed-precondition', '숨김 글은 제외됩니다.');
    return { postId, itemId: '', onceKey: 'post_create' };
  }

  if (action === 'comment_create') {
    const postId = cleanDocId(meta.postId, '게시글');
    const cutoff = new Date(Date.now() - 3 * 60 * 1000);
    const q = await db.collection(`feeds/${postId}/comments`)
      .where('authorId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (q.empty) throw new HttpsError('failed-precondition', '댓글을 찾을 수 없습니다.');
    const latest = q.docs[0];
    const commentTime = latest.data().createdAt?.toDate?.();
    if (commentTime && commentTime < cutoff) throw new HttpsError('failed-precondition', '댓글 시간이 초과됐습니다.');
    return { postId, itemId: latest.id, onceKey: 'comment_create' };
  }

  if (action === 'reaction_give') {
    const postId = cleanDocId(meta.postId, '게시글');
    const onceKey = clean(meta.onceKey, 180);
    const [commentIdRaw, reactionRaw] = onceKey.split(':');
    const commentId = cleanDocId(commentIdRaw, '댓글');
    const reaction = clean(reactionRaw, 40);
    if (!reaction) throw new HttpsError('invalid-argument', '반응 정보가 없습니다.');
    const snap = await db.doc(`feeds/${postId}/comments/${commentId}`).get();
    if (!snap.exists) throw new HttpsError('not-found', '댓글을 찾을 수 없습니다.');
    const reactedWith = (snap.data() || {}).reactedWith || {};
    if (reactedWith[uid] !== reaction) {
      throw new HttpsError('failed-precondition', '반응 기록을 확인할 수 없습니다.');
    }
    return { postId, itemId: commentId, onceKey: 'reaction_give' };
  }

  throw new HttpsError('permission-denied', '허용되지 않은 항목입니다.');
}

function weeklyPowerFields(memberData, oldPower, newPower) {
  const weekKey = kstMondayKey();
  if ((memberData || {}).weekKey !== weekKey) {
    return {
      weekKey,
      weekStartPower: oldPower,
      weeklyGain: Math.max(0, newPower - oldPower),
    };
  }
  const weekStartPower = Number((memberData || {}).weekStartPower || 0);
  return { weeklyGain: Math.max(0, newPower - weekStartPower) };
}

async function readPartySync(tx, userSnap, uid) {
  if (!userSnap.exists) return null;
  const user = userSnap.data() || {};
  const partyId = clean(user.partyId, 80);
  if (!partyId || partyId.includes('/')) return null;
  const memberRef = db.doc(`parties/${partyId}/members/${uid}`);
  const memberSnap = await tx.get(memberRef);
  if (!memberSnap.exists) return null;
  return { partyId, memberRef, memberSnap };
}

function writePartySync(tx, sync, userData, pointsToAdd) {
  if (!sync) return;
  const oldPower = Number(sync.memberSnap.data().power || 0);
  const currentTotal = Math.max(0, Number(userData.totalPoints || userData.points || 0));
  const newPower = Math.max(0, currentTotal + pointsToAdd);
  const delta = newPower - oldPower;
  const memberData = sync.memberSnap.data() || {};

  tx.update(sync.memberRef, {
    power: newPower,
    nickname: String(userData.nickname || userData.displayName || memberData.nickname || '시민').slice(0, 20),
    icon: (userData.nicknameIcon && typeof userData.nicknameIcon === 'object') ? userData.nicknameIcon : (memberData.icon || null),
    ...weeklyPowerFields(memberData, oldPower, newPower),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (delta !== 0) {
    tx.set(db.doc(`parties/${sync.partyId}`), {
      totalPower: FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function grantPoints(uid, action, rule, target) {
  const awardRef = db.doc(`point_awards/${makeAwardId(uid, action, target)}`);
  const userRef = db.doc(`users/${uid}`);
  const logRef = userRef.collection('point_logs').doc();
  const date = todayKey();

  let awarded = false;
  await db.runTransaction(async tx => {
    const awardSnap = await tx.get(awardRef);
    if (awardSnap.exists) return;

    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const sync = await readPartySync(tx, userSnap, uid);

    awarded = true;
    tx.set(awardRef, {
      uid,
      action,
      points: rule.points,
      postId: clean(target.postId, 180),
      itemId: clean(target.itemId, 180),
      onceKey: clean(target.onceKey, 180),
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.set(userRef, {
      points: FieldValue.increment(rule.points),
      totalPoints: FieldValue.increment(rule.points),
      [`pointStats.${action}`]: FieldValue.increment(rule.points),
      [`pointDaily.${date}`]: FieldValue.increment(rule.points),
      lastPointAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writePartySync(tx, sync, userData, rule.points);
    tx.set(logRef, {
      action,
      label: rule.label,
      points: rule.points,
      meta: {
        postId: clean(target.postId, 180),
        itemId: clean(target.itemId, 180),
        onceKey: clean(target.onceKey, 180),
      },
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
  });

  return { awarded, points: awarded ? rule.points : 0 };
}

const awardUserPoints = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const action = clean(request.data?.action, 60);
  const rule = POINT_RULES[action];
  if (!rule) throw new HttpsError('invalid-argument', '지원하지 않는 포인트 항목입니다.');

  const meta = request.data?.meta && typeof request.data.meta === 'object' ? request.data.meta : {};
  const target = await validateClientAward(uid, action, meta);
  const result = await grantPoints(uid, action, rule, target);
  return { ok: true, ...result };
});

const claimSignupBonus = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const bonusRef = db.doc(`point_awards/${uid}_signup`);
  const userRef = db.doc(`users/${uid}`);
  let awarded = false;

  await db.runTransaction(async tx => {
    const bonusSnap = await tx.get(bonusRef);
    if (bonusSnap.exists) return;

    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const sync = await readPartySync(tx, userSnap, uid);

    awarded = true;
    tx.set(bonusRef, { uid, claimed: true, points: 500, createdAt: FieldValue.serverTimestamp() });
    tx.set(userRef, {
      points: FieldValue.increment(500),
      totalPoints: FieldValue.increment(500),
      signupBonusClaimed: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writePartySync(tx, sync, userData, 500);
  });

  return { ok: true, awarded, points: awarded ? 500 : 0 };
});

const claimDailyBonus = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const today = todayKey();
  const dailyRef = db.doc(`point_awards/${uid}_daily_${today}`);
  const userRef = db.doc(`users/${uid}`);
  let awarded = false;
  let basePoints = 20;
  let isLeader = false;

  try {
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const partyId = clean(userData.partyId, 80);
    if (partyId && !partyId.includes('/')) {
      const top = await db.collection(`parties/${partyId}/members`)
        .orderBy('power', 'desc').limit(1).get();
      if (!top.empty && top.docs[0].id === uid) {
        isLeader = true;
        basePoints = 30;
      }
    }
  } catch {}

  await db.runTransaction(async tx => {
    const dailySnap = await tx.get(dailyRef);
    if (dailySnap.exists) return;

    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const sync = await readPartySync(tx, userSnap, uid);

    awarded = true;
    tx.set(dailyRef, { uid, date: today, isLeader, points: basePoints, createdAt: FieldValue.serverTimestamp() });
    tx.set(userRef, {
      points: FieldValue.increment(basePoints),
      totalPoints: FieldValue.increment(basePoints),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writePartySync(tx, sync, userData, basePoints);
  });

  return { ok: true, awarded, points: awarded ? basePoints : 0, isLeader };
});

module.exports = { awardUserPoints, claimSignupBonus, claimDailyBonus };
