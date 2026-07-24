'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

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

function storagePathFromUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.hostname !== 'firebasestorage.googleapis.com') return '';
    const match = url.pathname.match(/\/o\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

async function deletePostImages(images) {
  const bucket = getStorage().bucket();
  const paths = (Array.isArray(images) ? images : []).map(storagePathFromUrl).filter(Boolean).slice(0, 20);
  let deleted = 0;
  await Promise.all(paths.map(async path => {
    try {
      await bucket.file(path).delete({ ignoreNotFound: true });
      deleted += 1;
    } catch (error) {
      console.warn('[deleteOwnPost] image cleanup failed', path, error);
    }
  }));
  return deleted;
}

async function deleteQuery(query, batchSize = 300) {
  let deleted = 0;
  while (true) {
    const snap = await query.limit(batchSize).get().catch(() => null);
    if (!snap || snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

const deleteOwnPost = onCall({ region: REGION, timeoutSeconds: 300, memory: '512MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const postId = cleanId(request.data?.postId);
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');

  const postRef = db.doc(`feeds/${postId}`);
  const postSnap = await postRef.get();
  if (!postSnap.exists) return { ok: true, postId, deleted: false };
  const post = postSnap.data() || {};
  const admin = await isAdmin(uid);
  if (!admin && post.authorId !== uid) throw new HttpsError('permission-denied', '작성자만 삭제할 수 있습니다.');

  const [scraps, reports, notifications, images] = await Promise.all([
    deleteQuery(db.collectionGroup('scraps').where('postId', '==', postId)),
    deleteQuery(db.collection('reports').where('postId', '==', postId)),
    deleteQuery(db.collection('notifications').where('postId', '==', postId)),
    deletePostImages(post.images),
  ]);

  await db.doc(`deleted_posts/${postId}`).set({
    postId,
    title: String(post.title || '').slice(0, 100),
    subtype: post.subtype || '',
    authorId: post.authorId || '',
    deletedBy: uid,
    deletedByAdmin: admin,
    deletedAt: FieldValue.serverTimestamp(),
    deletedAtMs: Date.now(),
    cleanup: { scraps, reports, notifications, images },
  });

  try {
    await db.recursiveDelete(postRef);
  } catch (error) {
    console.error('[deleteOwnPost] recursiveDelete failed', error);
    throw new HttpsError('internal', '게시글 하위 데이터를 정리하지 못했습니다.');
  }
  return { ok: true, postId, deleted: true, cleanup: { scraps, reports, notifications, images } };
});

module.exports = { deleteOwnPost };
