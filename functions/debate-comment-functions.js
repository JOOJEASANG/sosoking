'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { cleanText, isValidMaterialId, normalizeVoteSide } = require('./lib/material-policy');

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const COMMENT_DAILY_LIMIT = 40;
const COMMENT_COOLDOWN_MS = 5000;

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function validDebateId(value) {
  const id = cleanText(value, 80);
  if (!isValidMaterialId(id)) throw new HttpsError('invalid-argument', '토론 ID가 올바르지 않습니다.');
  return id;
}

const addDebateComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const id = validDebateId(request.data?.debateId);
  const text = cleanText(request.data?.text, 700);
  if (text.length < 2) throw new HttpsError('invalid-argument', '댓글을 2자 이상 입력해주세요.');

  const userSnap = await db.doc(`users/${uid}`).get().catch(() => null);
  const userData = userSnap?.exists ? userSnap.data() || {} : {};
  const nickname = cleanText(userData.nickname || userData.displayName || '익명', 30);
  const debateRef = db.doc(`debates/${id}`);
  const voteRef = debateRef.collection('votes').doc(uid);
  const commentRef = debateRef.collection('comments').doc();
  const limitRef = db.doc(`rate_limits/debate-comment-${uid}`);
  const nowMs = Date.now();
  const day = todayKst();
  let commentSide = null;

  await db.runTransaction(async transaction => {
    const [debateSnap, voteSnap, limitSnap] = await Promise.all([
      transaction.get(debateRef),
      transaction.get(voteRef),
      transaction.get(limitRef),
    ]);

    if (!debateSnap.exists || debateSnap.data()?.status !== 'published') {
      throw new HttpsError('not-found', '댓글을 작성할 토론을 찾을 수 없습니다.');
    }

    commentSide = voteSnap.exists ? normalizeVoteSide(voteSnap.data()?.side) : null;
    if (!commentSide) {
      throw new HttpsError('failed-precondition', '댓글을 작성하려면 먼저 A 또는 B를 선택해주세요.');
    }

    const limitData = limitSnap.exists ? limitSnap.data() || {} : {};
    const lastAtMs = Number(limitData.lastAtMs || 0);
    const count = limitData.day === day ? Number(limitData.count || 0) : 0;
    if (nowMs - lastAtMs < COMMENT_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', '댓글은 잠시 후 다시 작성해주세요.');
    }
    if (count >= COMMENT_DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', '오늘 작성할 수 있는 댓글 수를 초과했습니다.');
    }

    transaction.set(commentRef, {
      uid,
      debateId: id,
      nickname,
      text,
      side: commentSide,
      status: 'visible',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(debateRef, {
      commentCount: Math.max(0, Number(debateSnap.data()?.commentCount || 0)) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(limitRef, {
      uid,
      type: 'debate-comment',
      day,
      count: count + 1,
      lastAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(nowMs + 3 * 86400000),
    }, { merge: true });
  });

  return { ok: true, id: commentRef.id, side: commentSide };
});

module.exports = {
  addDebateComment,
  _test: { todayKst, validDebateId },
};
