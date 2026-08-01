'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required');
}
if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const db = getFirestore();
const {
  deleteDripsoCommentData,
  deleteDripsoTopicData,
  moderateDripsoReportData,
  submitDripsoReportData
} = require('./dripso-moderation');

async function seedTopic(topicId, ownerUid, comments = []) {
  const now = Timestamp.now();
  const batch = db.batch();
  batch.set(db.doc(`dripso_topics/${topicId}`), {
    type: 'daily',
    title: `${topicId} 주제`,
    prompt: '통합검사용 드립 주제입니다.',
    status: 'visible',
    commentCount: comments.length,
    topLikeCount: comments.reduce((max, item) => Math.max(max, item.likeCount || 0), 0),
    createdAt: now,
    updatedAt: now
  });
  batch.set(db.doc(`dripso_topic_authors/${topicId}`), { uid: ownerUid, topicId, createdAt: now });
  comments.forEach(comment => {
    batch.set(db.doc(`dripso_topics/${topicId}/comments/${comment.id}`), {
      nickname: comment.nickname || '통합검사',
      text: comment.text || '검사용 댓글',
      status: 'visible',
      likeCount: comment.likeCount || 0,
      createdAt: now,
      updatedAt: now
    });
    batch.set(db.doc(`dripso_comment_authors/${topicId}/items/${comment.id}`), {
      uid: comment.ownerUid,
      topicId,
      commentId: comment.id,
      createdAt: now
    });
    if (comment.likeCount) {
      batch.set(db.doc(`dripso_topics/${topicId}/comments/${comment.id}/likes/like-user`), {
        uid: 'like-user',
        createdAt: now
      });
    }
  });
  await batch.commit();
}

async function exists(path) {
  return (await db.doc(path).get()).exists;
}

(async () => {
  const topicId = 'moderation-topic-1';
  const ownerUid = 'topic-owner';
  const commentId = 'reported-comment-1';
  await seedTopic(topicId, ownerUid, [
    { id: commentId, ownerUid: 'comment-owner', likeCount: 4 },
    { id: 'remaining-comment-1', ownerUid: 'other-owner', likeCount: 2 }
  ]);

  const report = await submitDripsoReportData(
    'reporter-user',
    'comment',
    topicId,
    commentId,
    '타인을 공격하는 표현이 포함되어 있습니다.'
  );
  assert.ok(report.reportId);
  await assert.rejects(
    () => submitDripsoReportData('reporter-user', 'comment', topicId, commentId, '중복 신고 사유입니다.'),
    error => error?.code === 'already-exists'
  );
  await assert.rejects(
    () => submitDripsoReportData('comment-owner', 'comment', topicId, commentId, '본인 댓글 신고입니다.'),
    error => error?.code === 'failed-precondition'
  );

  const moderated = await moderateDripsoReportData(report.reportId, 'hide', 'admin-user');
  assert.equal(moderated.hidden, true);
  assert.equal((await db.doc(`dripso_topics/${topicId}/comments/${commentId}`).get()).data().status, 'hidden');
  assert.equal((await db.doc(`dripso_reports/${report.reportId}`).get()).data().status, 'resolved');
  const topicAfterHide = (await db.doc(`dripso_topics/${topicId}`).get()).data();
  assert.equal(topicAfterHide.commentCount, 1);
  assert.equal(topicAfterHide.topLikeCount, 2);

  await assert.rejects(
    () => deleteDripsoCommentData(topicId, 'remaining-comment-1', { actorUid: 'not-owner' }),
    error => error?.code === 'permission-denied'
  );
  const deletedComment = await deleteDripsoCommentData(topicId, 'remaining-comment-1', { actorUid: 'other-owner' });
  assert.equal(deletedComment.commentCount, 0);
  assert.equal(await exists(`dripso_topics/${topicId}/comments/remaining-comment-1`), false);
  assert.equal(await exists(`dripso_comment_authors/${topicId}/items/remaining-comment-1`), false);

  const deleteTopicId = 'moderation-topic-2';
  await seedTopic(deleteTopicId, 'delete-owner', [
    { id: 'delete-comment-1', ownerUid: 'delete-owner', likeCount: 1 }
  ]);
  await assert.rejects(
    () => deleteDripsoTopicData(deleteTopicId, { actorUid: 'not-owner' }),
    error => error?.code === 'permission-denied'
  );
  const deletedTopic = await deleteDripsoTopicData(deleteTopicId, { actorUid: 'delete-owner' });
  assert.equal(deletedTopic.topicId, deleteTopicId);
  assert.equal(await exists(`dripso_topics/${deleteTopicId}`), false);
  assert.equal(await exists(`dripso_topic_authors/${deleteTopicId}`), false);
  assert.equal(await exists(`dripso_topics/${deleteTopicId}/comments/delete-comment-1`), false);
  assert.equal(await exists(`dripso_comment_authors/${deleteTopicId}/items/delete-comment-1`), false);

  console.log('Dripso moderation integration passed: duplicate reporting, self-report rejection, hide recalculation, owner deletion, and topic cascade cleanup.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
