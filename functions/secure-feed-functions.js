'use strict';

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ALLOWED_REACTIONS = ['like', 'funny', 'sad', 'wow'];

function cleanId(value, max = 160) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function requireUser(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function normalizeAnswer(value) {
  return String(value || '').trim().replace(/\s+/g, '').toLowerCase();
}

function clampCount(value) {
  return Math.max(0, Number(value || 0));
}

async function loadPost(postId) {
  const safePostId = cleanId(postId);
  if (!safePostId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const ref = db.doc(`feeds/${safePostId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');
  return { ref, postId: safePostId, post };
}

const checkQuizAnswer = onCall({ region: REGION, timeoutSeconds: 20 }, async (request) => {
  const userId = requireUser(request);
  const { postId, selected } = request.data || {};
  const { postId: safePostId, post } = await loadPost(postId);
  if (!['ox', 'quiz'].includes(post.type)) {
    throw new HttpsError('failed-precondition', '퀴즈 게시글이 아닙니다.');
  }

  const secretSnap = await db.doc(`feeds/${safePostId}/secret/answer`).get();
  if (!secretSnap.exists) throw new HttpsError('failed-precondition', '정답 정보가 없습니다.');
  const secret = secretSnap.data() || {};

  let correct = false;
  let storedSelected = '';
  if (post.type === 'ox') {
    storedSelected = String(selected || '').toUpperCase().slice(0, 1);
    correct = String(secret.answer || '').toUpperCase() === storedSelected;
  } else if (secret.quizMode === 'short' || post.quizMode === 'short') {
    storedSelected = String(selected || '').slice(0, 80);
    correct = normalizeAnswer(secret.answer) === normalizeAnswer(storedSelected);
  } else {
    const idx = Number(selected);
    storedSelected = Number.isFinite(idx) ? String(idx) : '';
    correct = Number(secret.answerIdx) === idx;
  }

  await db.doc(`feeds/${safePostId}/quiz_attempts/${userId}`).set({
    userId,
    authorName: request.auth.token && request.auth.token.name ? request.auth.token.name : '익명',
    selected: storedSelected,
    correct,
    type: post.type,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  }, { merge: true });

  return { ok: true, correct, explanation: String(secret.explanation || '').slice(0, 500) };
});

const castFeedVote = onCall({ region: REGION, timeoutSeconds: 20 }, async (request) => {
  const userId = requireUser(request);
  const safePostId = cleanId(request.data && request.data.postId);
  const optionIdx = Number(request.data && request.data.optionIdx);
  if (!safePostId || !Number.isInteger(optionIdx) || optionIdx < 0) {
    throw new HttpsError('invalid-argument', '투표 정보가 올바르지 않습니다.');
  }

  const postRef = db.doc(`feeds/${safePostId}`);
  const nextOptions = await db.runTransaction(async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const post = snap.data() || {};
    if (post.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');
    if (!['balance', 'vote', 'battle', 'concern'].includes(post.type)) {
      throw new HttpsError('failed-precondition', '투표할 수 없는 게시글입니다.');
    }
    const options = Array.isArray(post.options) ? post.options : [];
    if (!options[optionIdx]) throw new HttpsError('invalid-argument', '존재하지 않는 선택지입니다.');
    if ((post.votedBy || []).includes(userId)) throw new HttpsError('already-exists', '이미 투표했습니다.');

    const updated = options.map((option, index) => {
      const base = typeof option === 'object' && option !== null ? { ...option } : { text: String(option || '') };
      base.votes = Number(base.votes || 0) + (index === optionIdx ? 1 : 0);
      return base;
    });

    tx.update(postRef, {
      options: updated,
      votedBy: FieldValue.arrayUnion(userId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return updated;
  });

  return { ok: true, options: nextOptions };
});

const toggleFeedReaction = onCall({ region: REGION, timeoutSeconds: 20 }, async (request) => {
  const userId = requireUser(request);
  const safePostId = cleanId(request.data && request.data.postId);
  const key = String(request.data && request.data.reaction || '').trim();
  if (!safePostId || !ALLOWED_REACTIONS.includes(key)) {
    throw new HttpsError('invalid-argument', '반응 정보가 올바르지 않습니다.');
  }

  const postRef = db.doc(`feeds/${safePostId}`);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const post = snap.data() || {};
    if (post.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');

    const current = post.reactedWith && post.reactedWith[userId] ? post.reactedWith[userId] : null;
    const reactions = { ...(post.reactions || {}) };
    reactions.total = clampCount(reactions.total);
    ALLOWED_REACTIONS.forEach(k => { reactions[k] = clampCount(reactions[k]); });

    const patch = { updatedAt: FieldValue.serverTimestamp() };
    let myReaction = key;

    if (current === key) {
      patch[`reactions.${key}`] = FieldValue.increment(-1);
      patch['reactions.total'] = FieldValue.increment(-1);
      patch[`reactedWith.${userId}`] = FieldValue.delete();
      reactions[key] = Math.max(0, reactions[key] - 1);
      reactions.total = Math.max(0, reactions.total - 1);
      myReaction = null;
    } else if (current && ALLOWED_REACTIONS.includes(current)) {
      patch[`reactions.${current}`] = FieldValue.increment(-1);
      patch[`reactions.${key}`] = FieldValue.increment(1);
      patch[`reactedWith.${userId}`] = key;
      reactions[current] = Math.max(0, reactions[current] - 1);
      reactions[key] += 1;
    } else {
      patch[`reactions.${key}`] = FieldValue.increment(1);
      patch['reactions.total'] = FieldValue.increment(1);
      patch[`reactedWith.${userId}`] = key;
      reactions[key] += 1;
      reactions.total += 1;
    }

    tx.update(postRef, patch);
    return { reactions, myReaction };
  });

  return { ok: true, ...result };
});

const registerPostView = onCall({ region: REGION, timeoutSeconds: 15 }, async (request) => {
  const userId = requireUser(request);
  const safePostId = cleanId(request.data && request.data.postId);
  if (!safePostId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');

  const postRef = db.doc(`feeds/${safePostId}`);
  const viewRef = postRef.collection('viewers').doc(userId);
  const now = Date.now();
  const intervalMs = 6 * 60 * 60 * 1000;
  let counted = false;

  await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists || (postSnap.data() || {}).hidden === true) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const viewSnap = await tx.get(viewRef);
    const lastViewedAtMs = Number(viewSnap.exists ? viewSnap.data().lastViewedAtMs || 0 : 0);
    if (lastViewedAtMs > now - intervalMs) {
      tx.set(viewRef, { lastSeenAt: FieldValue.serverTimestamp(), lastSeenAtMs: now }, { merge: true });
      return;
    }
    counted = true;
    tx.set(viewRef, {
      lastViewedAt: FieldValue.serverTimestamp(),
      lastViewedAtMs: now,
      lastSeenAt: FieldValue.serverTimestamp(),
      lastSeenAtMs: now,
    }, { merge: true });
    tx.update(postRef, { viewCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  });

  return { ok: true, counted };
});

function escapeAttr(value, max = 500) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .slice(0, max);
}

function safeOgImage(value) {
  const raw = String(value || '').trim();
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return escapeAttr(url.toString(), 1000);
  } catch {}
  return 'https://sosoking.co.kr/og-image.png';
}

const seoPost = onRequest({ region: REGION }, async (req, res) => {
  const parts = req.path.split('/').filter(Boolean);
  const id = cleanId(parts[parts.length - 1] || req.query.id);
  if (!id) { res.redirect('https://sosoking.co.kr/'); return; }

  try {
    const snap = await db.doc(`feeds/${id}`).get();
    if (!snap.exists) { res.redirect(`https://sosoking.co.kr/#/detail/${id}`); return; }

    const post = snap.data() || {};
    const title = escapeAttr(post.title || '소소킹 놀이판', 80);
    const desc = escapeAttr(post.body || post.desc || post.subtitle || '소소킹에서 즐겨요', 160);
    const image = safeOgImage(Array.isArray(post.images) ? post.images[0] : post.thumbnailUrl);
    const url = `https://sosoking.co.kr/p/${id}`;
    const dest = `https://sosoking.co.kr/#/detail/${id}`;

    res.set('Cache-Control', 'public, max-age=300');
    res.send(`<!DOCTYPE html><html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${title} | 소소킹</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title} | 소소킹">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="소소킹">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} | 소소킹">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <link rel="canonical" href="${url}">
  <meta http-equiv="refresh" content="0;url=${dest}">
  <script>window.location.replace('${dest}');</script>
</head><body></body></html>`);
  } catch {
    res.redirect(`https://sosoking.co.kr/#/detail/${id}`);
  }
});

module.exports = {
  checkQuizAnswer,
  castFeedVote,
  toggleFeedReaction,
  registerPostView,
  seoPost,
};
