'use strict';

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const TITLES = [
  { min: 30, label: '👑 소소킹' },
  { min: 20, label: '⭐ 소소러' },
  { min: 10, label: '🔥 이야기꾼' },
  { min: 3, label: '😊 소소인' },
  { min: 1, label: '🌱 새싹' },
  { min: 0, label: '🥚 뉴비' },
];

function computeTitle(count) {
  return (TITLES.find(item => count >= item.min) || TITLES.at(-1)).label;
}

exports.onCommentCreated = onDocumentCreated({
  document: 'feeds/{postId}/comments/{commentId}',
  region: REGION,
}, async event => {
  const comment = event.data?.data();
  if (!comment) return;
  const postRef = db.doc(`feeds/${event.params.postId}`);
  await db.runTransaction(async tx => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) return;
    const post = postSnap.data() || {};
    tx.update(postRef, {
      commentCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (post.authorId && post.authorId !== comment.authorId && !String(post.authorId).startsWith('deleted_')) {
      const noticeRef = db.collection('notifications').doc();
      tx.set(noticeRef, {
        uid: post.authorId,
        type: 'comment',
        title: '내 글에 댓글이 달렸어요',
        body: `${String(comment.authorName || '익명').slice(0, 40)}: ${String(comment.text || '').slice(0, 80)}`,
        postId: event.params.postId,
        actorId: comment.authorId || '',
        actorName: String(comment.authorName || '익명').slice(0, 40),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
      });
    }
  });
});

exports.onCommentDeleted = onDocumentDeleted({
  document: 'feeds/{postId}/comments/{commentId}',
  region: REGION,
}, async event => {
  const postRef = db.doc(`feeds/${event.params.postId}`);
  await db.runTransaction(async tx => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) return;
    const current = Number(postSnap.data()?.commentCount || 0);
    tx.update(postRef, {
      commentCount: Math.max(0, current - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
});

exports.updateUserTitle = onDocumentCreated({
  document: 'feeds/{postId}',
  region: REGION,
}, async event => {
  const post = event.data?.data();
  if (!post?.authorId || post.isAiGenerated === true || post.authorId === 'sosoking-ai') return;
  const userRef = db.doc(`users/${post.authorId}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const postCount = Number(snap.data()?.postCount || 0) + 1;
    tx.update(userRef, {
      postCount,
      title: computeTitle(postCount),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
});

exports.cleanupNotifications = onSchedule({
  schedule: '0 3 * * *',
  region: REGION,
  timeZone: 'Asia/Seoul',
  timeoutSeconds: 120,
}, async () => {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - 30 * 86400000));
  let deleted = 0;
  while (true) {
    const snap = await db.collection('notifications')
      .where('read', '==', true)
      .where('createdAt', '<', cutoff)
      .limit(400)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  console.log(`[cleanupNotifications] ${deleted} deleted`);
});
