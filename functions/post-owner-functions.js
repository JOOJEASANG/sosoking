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

  // 하위 답글이 있는 컬렉션은 replies를 먼저 명시적으로 삭제합니다.
  counts.comments = await deleteCollectionWithReplies(`feeds/${postId}/comments`);
  counts.acrostics = await deleteCollectionWithReplies(`feeds/${postId}/acrostics`);
  counts.multiNaming = await deleteCollectionWithReplies(`feeds/${postId}/multi_naming`);
  counts.multiAcrostic = await deleteCollectionWithReplies(`feeds/${postId}/multi_acrostic`);
  counts.multiRelay = await deleteCollectionWithReplies(`feeds/${postId}/multi_relay`);

  // 답글이 없는 보조 컬렉션은 문서만 삭제합니다.
  counts.quizAttempts = await deleteDocsInCollection(`feeds/${postId}/quiz_attempts`);
  counts.viewers = await deleteDocsInCollection(`feeds/${postId}/viewers`);
  counts.viewEvents = await deleteDocsInCollection(`feeds/${postId}/view_events`);
  counts.secret = await deleteDocsInCollection(`feeds/${postId}/secret`);

  // BUG-013: 스크랩이 300건을 초과할 경우 모두 삭제하도록 페이지네이션 루프 처리
  let scrapLastDoc = null;
  let scrapHasMore = true;
  counts.scraps = 0;
  while (scrapHasMore) {
    let scrapQuery = db.collectionGroup('scraps').where('postId', '==', postId).limit(300);
    if (scrapLastDoc) scrapQuery = scrapQuery.startAfter(scrapLastDoc);
    const scrapSnap = await scrapQuery.get().catch(() => null);
    if (!scrapSnap || scrapSnap.empty) break;
    const batch = db.batch();
    scrapSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    counts.scraps += scrapSnap.size;
    scrapLastDoc = scrapSnap.docs[scrapSnap.docs.length - 1];
    scrapHasMore = scrapSnap.size === 300;
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
