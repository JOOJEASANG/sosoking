'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('crypto');

const db = getFirestore();
const REGION = 'asia-northeast3';

const POINT_RULES = Object.freeze({
  post_create: { points: 10, label: '피드 글 작성' },
  comment_create: { points: 3, label: '댓글 작성' },
  reply_create: { points: 2, label: '답글 작성' },
  participation_create: { points: 3, label: '참여글 작성' },
  vote_participate: { points: 1, label: '투표 참여' },
  reaction_received: { points: 1, label: '반응 받음' },
  reaction_give: { points: 1, label: '댓글에 반응 남기기' },
});

const CLIENT_CALLABLE_ACTIONS = new Set(['post_create']);

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function clean(value, max = 160) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function awardId(uid, action, meta) {
  const raw = JSON.stringify({
    uid,
    action,
    postId: clean(meta.postId, 180),
    itemId: clean(meta.itemId, 180),
    onceKey: clean(meta.onceKey, 180),
    type: clean(meta.type, 80),
  });
  return createHash('sha256').update(raw).digest('hex');
}

async function validateClientAward(uid, action, meta) {
  if (!CLIENT_CALLABLE_ACTIONS.has(action)) {
    throw new HttpsError('permission-denied', '이 포인트 항목은 서버 검증 액션에서만 지급됩니다.');
  }

  if (action === 'post_create') {
    const postId = clean(meta.postId, 180);
    if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
    const snap = await db.doc(`feeds/${postId}`).get();
    if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const post = snap.data() || {};
    if (post.authorId !== uid) throw new HttpsError('permission-denied', '본인이 작성한 글에만 포인트를 지급할 수 있습니다.');
    if (post.hidden === true) throw new HttpsError('failed-precondition', '숨김 글에는 포인트를 지급할 수 없습니다.');
    return;
  }

  throw new HttpsError('permission-denied', '허용되지 않은 포인트 항목입니다.');
}

const awardUserPoints = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const action = clean(request.data?.action, 60);
  const rule = POINT_RULES[action];
  if (!rule) throw new HttpsError('invalid-argument', '지원하지 않는 포인트 항목입니다.');

  const meta = request.data?.meta && typeof request.data.meta === 'object' ? request.data.meta : {};
  await validateClientAward(uid, action, meta);

  const id = awardId(uid, action, meta);
  const awardRef = db.doc(`point_awards/${id}`);
  const userRef = db.doc(`users/${uid}`);
  const logRef = userRef.collection('point_logs').doc();
  const date = todayKey();

  let awarded = false;
  await db.runTransaction(async tx => {
    const awardSnap = await tx.get(awardRef);
    if (awardSnap.exists) return;

    awarded = true;
    tx.set(awardRef, {
      uid,
      action,
      points: rule.points,
      postId: clean(meta.postId, 180),
      itemId: clean(meta.itemId, 180),
      onceKey: clean(meta.onceKey, 180),
      type: clean(meta.type, 80),
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
    tx.set(logRef, {
      action,
      label: rule.label,
      points: rule.points,
      meta: {
        postId: clean(meta.postId, 180),
        itemId: clean(meta.itemId, 180),
        type: clean(meta.type, 80),
      },
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
  });

  return { ok: true, awarded, points: awarded ? rule.points : 0 };
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
    awarded = true;
    tx.set(bonusRef, { uid, claimed: true, createdAt: FieldValue.serverTimestamp() });
    tx.set(userRef, {
      points: FieldValue.increment(500),
      totalPoints: FieldValue.increment(500),
      signupBonusClaimed: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { ok: true, awarded, points: awarded ? 500 : 0 };
});

const claimDailyBonus = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const dailyRef = db.doc(`point_awards/${uid}_daily_${today}`);
  const userRef = db.doc(`users/${uid}`);
  let awarded = false;

  await db.runTransaction(async tx => {
    const dailySnap = await tx.get(dailyRef);
    if (dailySnap.exists) return;
    awarded = true;
    tx.set(dailyRef, { uid, date: today, createdAt: FieldValue.serverTimestamp() });
    tx.set(userRef, {
      points: FieldValue.increment(20),
      totalPoints: FieldValue.increment(20),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { ok: true, awarded, points: awarded ? 20 : 0 };
});

module.exports = { awardUserPoints, claimSignupBonus, claimDailyBonus };
