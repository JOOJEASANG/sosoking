'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAppCheck, enforceActionRateLimit } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ALLOWED = new Set(['advice_results', 'translation_results']);

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

async function loadNickname(uid) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists
    ? cleanText(snap.data().nickname, 20) || '익명'
    : '익명';
}

exports.addComment = onCall({ region: REGION, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '댓글은 로그인 후 작성 가능합니다.');
  requireAppCheck(request);

  const uid = request.auth.uid;
  const col = cleanText(request.data?.collection, 40);
  const resultId = cleanText(request.data?.resultId, 40);
  const text = cleanText(request.data?.text, 300);

  if (!ALLOWED.has(col)) throw new HttpsError('invalid-argument', '잘못된 컬렉션입니다.');
  if (!/^[A-Za-z0-9]{10,40}$/.test(resultId)) throw new HttpsError('invalid-argument', '잘못된 resultId입니다.');
  if (text.length < 1) throw new HttpsError('invalid-argument', '댓글 내용을 입력해주세요.');

  const safety = inspectContent(text);
  if (!safety.safe) throw new HttpsError('failed-precondition', '부적절한 표현이 포함되어 있습니다.');

  await enforceActionRateLimit(uid, 'content-comment', { cooldownSeconds: 10, dailyLimit: 30 });

  const mainRef = db.collection(col).doc(resultId);
  const commentRef = db.collection(`${col}_comments/${resultId}/items`).doc();
  const authorRef = db.doc(`${col}_comment_authors/${resultId}/items/${commentRef.id}`);

  const nickname = await loadNickname(uid);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async tx => {
    const mainSnap = await tx.get(mainRef);
    if (!mainSnap.exists) throw new HttpsError('not-found', '존재하지 않는 게시물입니다.');

    tx.set(commentRef, { nickname, text, status: 'visible', createdAt: now });
    tx.set(authorRef, { uid, resultId, commentId: commentRef.id, createdAt: now });
    tx.update(mainRef, { commentCount: FieldValue.increment(1), updatedAt: now });
  });

  return { success: true, commentId: commentRef.id, nickname };
});
