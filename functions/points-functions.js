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
  quiz_correct: { points: 5, label: '퀴즈 정답' },
  reaction_received: { points: 1, label: '반응 받음' },
});

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

const awardUserPoints = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const action = clean(request.data?.action, 60);
  const rule = POINT_RULES[action];
  if (!rule) throw new HttpsError('invalid-argument', '지원하지 않는 포인트 항목입니다.');

  const meta = request.data?.meta && typeof request.data.meta === 'object' ? request.data.meta : {};
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

module.exports = { awardUserPoints };
