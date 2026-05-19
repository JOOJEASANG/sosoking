'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get().catch(() => null);
  return !!snap?.exists;
}

async function deleteCollection(path, batchSize = 200) {
  let total = 0;
  while (true) {
    const snap = await db.collection(path).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < batchSize) break;
  }
  return total;
}

const deleteOwnPost = onCall({ region: REGION, timeoutSeconds: 90, memory: '256MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const postId = cleanId(request.data?.postId);
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');

  const postRef = db.doc(`feeds/${postId}`);
  const postSnap = await postRef.get();
  if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');

  const post = postSnap.data() || {};
  const admin = await isAdmin(uid);
  if (!admin && post.authorId !== uid) {
    throw new HttpsError('permission-denied', '작성자만 삭제할 수 있습니다.');
  }

  const counts = {};
  counts.comments = await deleteCollection(`feeds/${postId}/comments`);
  counts.acrostics = await deleteCollection(`feeds/${postId}/acrostics`);
  counts.quizAttempts = await deleteCollection(`feeds/${postId}/quiz_attempts`);
  counts.viewers = await deleteCollection(`feeds/${postId}/viewers`);
  counts.secret = await deleteCollection(`feeds/${postId}/secret`);

  const scrapSnap = await db.collectionGroup('scraps')
    .where('postId', '==', postId)
    .limit(300)
    .get()
    .catch(() => null);
  if (scrapSnap && !scrapSnap.empty) {
    const batch = db.batch();
    scrapSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    counts.scraps = scrapSnap.size;
  } else {
    counts.scraps = 0;
  }

  await db.collection('deleted_posts').doc(postId).set({
    postId,
    title: post.title || '',
    type: post.type || '',
    cat: post.cat || '',
    authorId: post.authorId || '',
    deletedBy: uid,
    deletedByAdmin: admin,
    deletedAt: FieldValue.serverTimestamp(),
    deletedAtMs: Date.now(),
    childDeleteCounts: counts,
  }, { merge: true }).catch(() => null);

  await postRef.delete();
  return { ok: true, postId, counts };
});

module.exports = { deleteOwnPost };
