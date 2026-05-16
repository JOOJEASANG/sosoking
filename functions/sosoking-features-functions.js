'use strict';
const { onCall }            = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

/* ── 칭호 계산 ─────────────────────────────────────── */
const TITLES = [
  { min: 30, label: '👑 소소킹' },
  { min: 20, label: '⭐ 소소러' },
  { min: 10, label: '🔥 놀이꾼' },
  { min: 3,  label: '😊 소소인' },
  { min: 1,  label: '🌱 새싹'   },
  { min: 0,  label: '🥚 뉴비'   },
];
function computeTitle(count) {
  return (TITLES.find(t => count >= t.min) || TITLES.at(-1)).label;
}

/* ── getWeeklyBest ─────────────────────────────────── */
// 최근 7일 acrostic 참여글 TOP5 + drip 댓글 TOP5 집계
exports.getWeeklyBest = onCall({ region: REGION, timeoutSeconds: 60 }, async () => {
  const weekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 86400000));

  const [acrosticFeeds, dripFeeds] = await Promise.all([
    db.collection('feeds')
      .where('type', '==', 'acrostic')
      .where('createdAt', '>=', weekAgo)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get().catch(() => ({ docs: [] })),
    db.collection('feeds')
      .where('type', '==', 'drip')
      .where('createdAt', '>=', weekAgo)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get().catch(() => ({ docs: [] })),
  ]);

  // 각 삼행시 포스트의 acrostics 서브컬렉션 집계
  const acrosticGroups = await Promise.all(
    acrosticFeeds.docs
      .filter(d => !d.data().hidden)
      .map(async feedDoc => {
        const post = feedDoc.data();
        const snap = await feedDoc.ref.collection('acrostics')
          .orderBy('createdAt', 'desc').limit(30)
          .get().catch(() => ({ docs: [] }));
        return snap.docs.map(d => {
          const a = d.data();
          const total = (a.reactions?.like || 0) + (a.reactions?.funny || 0) + (a.reactions?.fire || 0);
          return {
            id:        d.id,
            lines:     a.lines || [],
            text:      a.text  || '',
            authorName: a.authorName || '익명',
            total,
            keyword:   post.keyword  || '',
            postId:    feedDoc.id,
            postTitle: post.title    || '',
          };
        });
      })
  );

  // 각 드립 포스트의 comments 서브컬렉션 집계
  const dripGroups = await Promise.all(
    dripFeeds.docs
      .filter(d => !d.data().hidden)
      .map(async feedDoc => {
        const post = feedDoc.data();
        const snap = await feedDoc.ref.collection('comments')
          .orderBy('createdAt', 'desc').limit(30)
          .get().catch(() => ({ docs: [] }));
        return snap.docs
          .map(d => ({ id: d.id, ...d.data(), postId: feedDoc.id, postTitle: post.title || '' }))
          .filter(c => (c.likes || 0) > 0);
      })
  );

  const topAcrostics = acrosticGroups.flat()
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(({ id, lines, text, authorName, total, keyword, postId, postTitle }) =>
      ({ id, lines, text, authorName, total, keyword, postId, postTitle }));

  const topDrips = dripGroups.flat()
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 5)
    .map(({ id, text, authorName, likes, postId, postTitle }) =>
      ({ id, text, authorName, likes: likes || 0, postId, postTitle }));

  return { topAcrostics, topDrips };
});

/* ── notifyOnComment ───────────────────────────────── */
// 내 글에 댓글이 달리면 notifications 컬렉션에 기록
exports.notifyOnComment = onDocumentCreated(
  { document: 'feeds/{postId}/comments/{commentId}', region: REGION },
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;
    const { postId } = event.params;
    try {
      const postSnap = await db.doc(`feeds/${postId}`).get();
      if (!postSnap.exists) return;
      const post = postSnap.data();
      if (!post.authorId || post.authorId === comment.authorId) return;
      await db.collection('notifications').add({
        userId:    post.authorId,
        type:      'comment',
        postId,
        postTitle: post.title || '',
        actorName: comment.authorName || '익명',
        read:      false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch { /* non-critical */ }
  }
);

/* ── updateUserTitle ───────────────────────────────── */
// 글 등록 시 작성자 칭호 자동 갱신
exports.updateUserTitle = onDocumentCreated(
  { document: 'feeds/{postId}', region: REGION },
  async (event) => {
    const post = event.data?.data();
    if (!post?.authorId) return;
    try {
      const countSnap = await db.collection('feeds')
        .where('authorId', '==', post.authorId)
        .count().get();
      const title = computeTitle(countSnap.data().count);
      await db.doc(`users/${post.authorId}`).set({ title }, { merge: true });
    } catch { /* non-critical */ }
  }
);

/* ── cleanupNotifications ──────────────────────────── */
// 읽음 처리된 30일 이상 알림 일괄 삭제 (매일 새벽 3시)
exports.cleanupNotifications = onSchedule(
  { schedule: '0 3 * * *', region: REGION, timeZone: 'Asia/Seoul' },
  async () => {
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 30 * 86400000));
    const snap = await db.collection('notifications')
      .where('read', '==', true)
      .where('createdAt', '<', cutoff)
      .limit(500).get().catch(() => null);
    if (!snap?.docs.length) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
);
