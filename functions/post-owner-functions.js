'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const CHILD_COLLECTIONS_WITH_REPLIES = Object.freeze([
  'comments',
  'acrostics',
  'multi_naming',
  'multi_acrostic',
  'multi_relay',
  'multi_drip',
  'multi_fill',
]);

const CHILD_COLLECTIONS_SIMPLE = Object.freeze([
  'quiz_attempts',
  'viewers',
  'view_events',
  'secret',
]);

function cleanId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get().catch(() => null);
  return !!snap?.exists;
}

function countKey(collectionName) {
  return collectionName.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

async function deleteDocsInCollection(path, batchSize = 200) {
  let total = 0;
  while (true) {
    const snap = await db.collection(path).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < batchSize) break;
  }
  return total;
}

async function deleteCollectionWithReplies(path, batchSize = 100) {
  let total = 0;
  while (true) {
    const snap = await db.collection(path).limit(batchSize).get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      total += await deleteDocsInCollection(`${path}/${docSnap.id}/replies`, batchSize);
    }

    const batch = db.batch();
    snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < batchSize) break;
  }
  return total;
}

const deleteOwnPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async request => {
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

  for (const collectionName of CHILD_COLLECTIONS_WITH_REPLIES) {
    counts[countKey(collectionName)] = await deleteCollectionWithReplies(`feeds/${postId}/${collectionName}`);
  }

  for (const collectionName of CHILD_COLLECTIONS_SIMPLE) {
    counts[countKey(collectionName)] = await deleteDocsInCollection(`feeds/${postId}/${collectionName}`);
  }

  // BUG-013: 스크랩이 300건을 초과할 경우 모두 삭제하도록 페이지네이션 루프 처리
  counts.scraps = 0;
  while (true) {
    const scrapSnap = await db.collectionGroup('scraps').where('postId', '==', postId).limit(300).get().catch(() => null);
    if (!scrapSnap || scrapSnap.empty) break;
    const batch = db.batch();
    scrapSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    counts.scraps += scrapSnap.size;
    if (scrapSnap.size < 300) break;
  }

  await db.collection('deleted_posts').doc(postId).set({
    postId,
    title: post.title || '',
    type: post.type || '',
    cat: post.cat || '',
    modules: post.modules || null,
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
