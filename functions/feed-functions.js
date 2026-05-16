const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

const REACTIONS = new Set(['like', 'funny', 'sad', 'wow']);

function clean(value, max = 500) {
  return String(value || '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeAnswer(value) {
  return clean(value, 300).replace(/\s+/g, '').toLowerCase();
}

function answerHash(answer, salt) {
  return crypto.createHash('sha256').update(`${salt}:${normalizeAnswer(answer)}`).digest('hex');
}

function requireUser(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

async function rateLimit(uid, action, maxCount, windowSeconds) {
  const ref = db.doc(`rate_limits/${uid}`);
  const now = Date.now();
  const min = now - windowSeconds * 1000;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const list = (data[action] || []).filter(v => Number(v) > min);
    if (list.length >= maxCount) {
      throw new HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }
    tx.set(ref, { [action]: [...list, now].slice(-maxCount) }, { merge: true });
  });
}

const registerFeedView = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async (request) => {
  const postId = clean(request.data && request.data.postId, 120);
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');

  const uid = request.auth && request.auth.uid;
  const postRef = db.doc(`feeds/${postId}`);

  if (!uid) {
    await postRef.update({ viewCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  }

  const viewRef = postRef.collection('viewers').doc(uid);
  const now = Date.now();
  const interval = 6 * 60 * 60 * 1000;

  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const viewSnap = await tx.get(viewRef);
    const last = Number(viewSnap.exists ? viewSnap.data().lastViewedAtMs || 0 : 0);
    if (last > now - interval) {
      tx.set(viewRef, { lastSeenAt: FieldValue.serverTimestamp(), lastSeenAtMs: now }, { merge: true });
      return;
    }
    tx.set(viewRef, {
      lastViewedAt: FieldValue.serverTimestamp(),
      lastViewedAtMs: now,
      lastSeenAt: FieldValue.serverTimestamp(),
      lastSeenAtMs: now,
    }, { merge: true });
    tx.update(postRef, { viewCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });

  return { ok: true };
});

const reactFeedPost = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async (request) => {
  const uid = requireUser(request);
  const postId = clean(request.data && request.data.postId, 120);
  const reaction = clean(request.data && request.data.reactionKey, 30);
  if (!postId || !REACTIONS.has(reaction)) throw new HttpsError('invalid-argument', '반응 정보가 올바르지 않습니다.');
  await rateLimit(uid, 'reactFeedPost', 200, 86400);

  const postRef = db.doc(`feeds/${postId}`);
  const reactionRef = postRef.collection('reactions').doc(`${uid}_${reaction}`);
  let alreadyReacted = false;

  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const reactionSnap = await tx.get(reactionRef);
    if (reactionSnap.exists) {
      alreadyReacted = true;
      return;
    }
    tx.set(reactionRef, { uid, reaction, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    tx.update(postRef, {
      [`reactions.${reaction}`]: FieldValue.increment(1),
      'reactions.total': FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, alreadyReacted };
});

const voteFeedOption = onCall({ region: 'asia-northeast3', timeoutSeconds: 20 }, async (request) => {
  const uid = requireUser(request);
  const postId = clean(request.data && request.data.postId, 120);
  const optionIdx = Number(request.data && request.data.optionIdx);
  if (!postId || !Number.isInteger(optionIdx) || optionIdx < 0) throw new HttpsError('invalid-argument', '투표 정보가 올바르지 않습니다.');
  await rateLimit(uid, 'voteFeedOption', 120, 86400);

  const postRef = db.doc(`feeds/${postId}`);
  const voterRef = postRef.collection('voters').doc(uid);
  let options = [];

  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const post = postSnap.data() || {};
    options = Array.isArray(post.options) ? post.options : [];
    if (!options[optionIdx]) throw new HttpsError('invalid-argument', '존재하지 않는 선택지입니다.');
    const voterSnap = await tx.get(voterRef);
    if (voterSnap.exists) throw new HttpsError('already-exists', '이미 투표했습니다.');

    options = options.map((option, idx) => {
      if (idx !== optionIdx) return option;
      if (typeof option === 'object') return { ...option, votes: Number(option.votes || 0) + 1 };
      return { text: clean(option, 100), votes: 1 };
    });

    tx.set(voterRef, { uid, optionIdx, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    tx.update(postRef, { options, voteTotal: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });

  return { ok: true, options };
});

const addFeedComment = onCall({ region: 'asia-northeast3', timeoutSeconds: 20 }, async (request) => {
  const uid = requireUser(request);
  const postId = clean(request.data && request.data.postId, 120);
  const text = clean(request.data && request.data.text, 500);
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  if (!text) throw new HttpsError('invalid-argument', '댓글을 입력해주세요.');
  await rateLimit(uid, 'addFeedComment', 80, 86400);

  const postRef = db.doc(`feeds/${postId}`);
  const commentRef = postRef.collection('comments').doc();
  const authorName = clean((request.auth.token && (request.auth.token.name || request.auth.token.email)) || '익명', 40);
  const createdAtMs = Date.now();

  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    tx.set(commentRef, {
      text,
      authorId: uid,
      authorName,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs,
    });
    tx.update(postRef, { commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });

  return { ok: true, comment: { id: commentRef.id, text, authorId: uid, authorName, createdAtMs } };
});

const checkQuizAnswer = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async (request) => {
  const postId = clean(request.data && request.data.postId, 120);
  const answer = clean(request.data && request.data.answer, 300);
  const optionIdx = Number(request.data && request.data.optionIdx);
  if (!postId || !answer) throw new HttpsError('invalid-argument', '정답 정보가 없습니다.');

  const [answerSnap, postSnap] = await Promise.all([
    db.doc(`feed_quiz_answers/${postId}`).get(),
    db.doc(`feeds/${postId}`).get(),
  ]);
  if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = postSnap.data() || {};

  if (!answerSnap.exists) {
    const correct = post.answerIdx !== undefined
      ? optionIdx === Number(post.answerIdx)
      : normalizeAnswer(answer) === normalizeAnswer(post.answer || '');
    return { ok: true, correct, explanation: clean(post.explanation, 500), legacy: true };
  }

  const data = answerSnap.data() || {};
  const correct = answerHash(answer, data.salt || '') === data.answerHash;
  return { ok: true, correct, explanation: clean(post.explanation, 500) };
});

module.exports = {
  registerFeedView,
  reactFeedPost,
  voteFeedOption,
  addFeedComment,
  checkQuizAnswer,
};
