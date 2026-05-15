const { onCall } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

function clean(value, max = 500) {
  return String(value || '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function safeVoteKey(option) {
  return clean(option, 40).replace(/[.~*/\[\]]/g, '_') || 'option';
}

async function getAuthorName(uid) {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    if (snap.exists && snap.data().nickname) return clean(snap.data().nickname, 40);
  } catch {}
  return '익명 소소러';
}

async function checkRateLimit(userId, action, maxCount, windowSeconds) {
  const ref = db.doc(`rate_limits/${userId}`);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const timestamps = (data[action] || []).filter(ts => Number(ts) > now - windowMs);
    if (timestamps.length >= maxCount) throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    tx.set(ref, { [action]: [...timestamps, now].slice(-maxCount) }, { merge: true });
  });
}

async function assertPublishedPost(postRef) {
  const snap = await postRef.get();
  if (!snap.exists) throw new Error('게시글을 찾을 수 없습니다.');
  const post = snap.data();
  if (post.status !== 'published') throw new Error('공개되지 않은 게시글입니다.');
  return { snap, post };
}

const registerFeedView = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async (request) => {
  const userId = request.auth?.uid || '';
  const postId = clean(request.data?.postId, 120);
  if (!userId) throw new Error('인증 필요');
  if (!postId) throw new Error('게시글을 찾을 수 없습니다.');

  const postRef = db.doc(`soso_feed_posts/${postId}`);
  const viewRef = postRef.collection('viewers').doc(userId);
  const now = Date.now();
  const minIntervalMs = 6 * 60 * 60 * 1000;

  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists || postSnap.data().status !== 'published') throw new Error('게시글을 찾을 수 없습니다.');
    const viewSnap = await tx.get(viewRef);
    const lastViewedAtMs = Number(viewSnap.exists ? viewSnap.data().lastViewedAtMs || 0 : 0);
    if (lastViewedAtMs > now - minIntervalMs) {
      tx.set(viewRef, { lastSeenAt: FieldValue.serverTimestamp(), lastSeenAtMs: now }, { merge: true });
      return;
    }
    tx.set(viewRef, { lastViewedAt: FieldValue.serverTimestamp(), lastViewedAtMs: now, lastSeenAt: FieldValue.serverTimestamp(), lastSeenAtMs: now }, { merge: true });
    tx.update(postRef, { views: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

const likeFeedPost = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async (request) => {
  const userId = request.auth?.uid || '';
  const postId = clean(request.data?.postId, 120);
  if (!userId) throw new Error('인증 필요');
  if (!postId) throw new Error('게시글을 찾을 수 없습니다.');
  await checkRateLimit(userId, 'likeFeedPost', 200, 86400);

  const postRef = db.doc(`soso_feed_posts/${postId}`);
  const likeRef = postRef.collection('likers').doc(userId);
  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists || postSnap.data().status !== 'published') throw new Error('게시글을 찾을 수 없습니다.');
    const likeSnap = await tx.get(likeRef);
    if (likeSnap.exists) return;
    tx.set(likeRef, { authorId: userId, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    tx.update(postRef, { likes: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

const voteFeedOption = onCall({ region: 'asia-northeast3', timeoutSeconds: 20 }, async (request) => {
  const userId = request.auth?.uid || '';
  const postId = clean(request.data?.postId, 120);
  const option = clean(request.data?.option, 40);
  if (!userId) throw new Error('로그인 후 투표할 수 있습니다.');
  if (!postId) throw new Error('게시글을 찾을 수 없습니다.');
  if (!option) throw new Error('선택지를 골라주세요.');
  await checkRateLimit(userId, 'voteFeedOption', 120, 86400);

  const postRef = db.doc(`soso_feed_posts/${postId}`);
  const voterRef = postRef.collection('voters').doc(userId);
  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists || postSnap.data().status !== 'published') throw new Error('게시글을 찾을 수 없습니다.');
    const post = postSnap.data();
    const allowedOptions = Array.isArray(post.options) ? post.options.map(v => clean(v, 40)) : [];
    if (!allowedOptions.includes(option)) throw new Error('존재하지 않는 선택지입니다.');
    const voterSnap = await tx.get(voterRef);
    if (voterSnap.exists) throw new Error('이미 이 글에 투표했습니다.');
    tx.set(voterRef, { option, authorId: userId, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    tx.update(postRef, { [`votes.${safeVoteKey(option)}`]: FieldValue.increment(1), voteTotal: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, option };
});

const addFeedComment = onCall({ region: 'asia-northeast3', timeoutSeconds: 20 }, async (request) => {
  const userId = request.auth?.uid || '';
  const postId = clean(request.data?.postId, 120);
  const text = clean(request.data?.text, 300);
  if (!userId) throw new Error('로그인 후 댓글을 남길 수 있습니다.');
  if (!postId) throw new Error('게시글을 찾을 수 없습니다.');
  if (text.length < 2) throw new Error('댓글을 2자 이상 입력해주세요.');
  await checkRateLimit(userId, 'addFeedComment', 60, 86400);

  const postRef = db.doc(`soso_feed_posts/${postId}`);
  await assertPublishedPost(postRef);
  const authorName = await getAuthorName(userId);
  const payload = { text, likes: 0, authorId: userId, authorName, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() };
  const commentRef = postRef.collection('comments').doc();
  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists || postSnap.data().status !== 'published') throw new Error('게시글을 찾을 수 없습니다.');
    tx.set(commentRef, payload);
    tx.update(postRef, { comments: FieldValue.increment(1), topComment: text, updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, comment: { id: commentRef.id, ...payload } };
});

module.exports = { registerFeedView, likeFeedPost, voteFeedOption, addFeedComment };
