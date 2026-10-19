'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAppCheck, enforceActionRateLimit } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ALLOWED = new Set(['advice_results', 'translation_results']);

function clean(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen);
}

exports.toggleLike = onCall({ region: REGION, memory: '128MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  requireAppCheck(request);

  const uid = request.auth.uid;
  const col = clean(request.data?.collection, 40);
  const docId = clean(request.data?.docId, 40);

  if (!ALLOWED.has(col)) throw new HttpsError('invalid-argument', '잘못된 컬렉션입니다.');
  if (!/^[A-Za-z0-9]{10,40}$/.test(docId)) throw new HttpsError('invalid-argument', '잘못된 문서 ID입니다.');

  await enforceActionRateLimit(uid, 'like', { cooldownSeconds: 1, dailyLimit: 200 });

  const likeRef = db.collection(`${col}_likes`).doc(`${docId}_${uid}`);
  const mainRef = db.collection(col).doc(docId);

  let liked;
  await db.runTransaction(async t => {
    const [likeSnap, mainSnap] = await Promise.all([t.get(likeRef), t.get(mainRef)]);
    if (!mainSnap.exists) throw new HttpsError('not-found', '존재하지 않는 게시물입니다.');
    liked = !likeSnap.exists;
    if (liked) {
      t.set(likeRef, { uid, docId, col, createdAt: FieldValue.serverTimestamp() });
      t.update(mainRef, { likeCount: FieldValue.increment(1) });
    } else {
      t.delete(likeRef);
      t.update(mainRef, { likeCount: FieldValue.increment(-1) });
    }
  });

  return { liked };
});
