'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function clean(value, max = 180) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function cleanDocId(value, name) {
  const id = clean(value, 180);
  if (!id || id.includes('/')) {
    throw new HttpsError('invalid-argument', `${name} 정보가 올바르지 않습니다.`);
  }
  return id;
}

const likeJabdamPost = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const postId = cleanDocId(request.data?.postId, '게시글');
  const postRef = db.doc(`jabdam_posts/${postId}`);
  const likeRef = postRef.collection('likes').doc(uid);

  let liked = false;
  await db.runTransaction(async tx => {
    const [postSnap, likeSnap] = await Promise.all([tx.get(postRef), tx.get(likeRef)]);
    if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    if (likeSnap.exists) return;

    liked = true;
    tx.set(likeRef, {
      uid,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.update(postRef, {
      likes: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, liked };
});

module.exports = { likeJabdamPost };
