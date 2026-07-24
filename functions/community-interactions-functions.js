'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const POST_REACTIONS = new Set(['like', 'funny', 'fire', 'skull']);
const COMMENT_REACTIONS = new Set(['like', 'funny', 'fire']);

function requireUid(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function cleanId(value, name) {
  const id = String(value || '').trim();
  if (!id || id.length > 180 || id.includes('/')) {
    throw new HttpsError('invalid-argument', `${name} 값이 올바르지 않습니다.`);
  }
  return id;
}

function cleanReaction(value, allowed) {
  const reaction = String(value || '').trim();
  if (!allowed.has(reaction)) throw new HttpsError('invalid-argument', '반응 정보가 올바르지 않습니다.');
  return reaction;
}

function safeCount(value) {
  return Math.max(0, Number(value || 0));
}

const incrementPostView = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const postId = cleanId(request.data?.postId, 'postId');
  const postRef = db.doc(`feeds/${postId}`);
  const viewerRef = postRef.collection('viewers').doc(uid);
  const now = Date.now();
  const intervalMs = 6 * 60 * 60 * 1000;
  let counted = false;

  await db.runTransaction(async tx => {
    const [postSnap, viewerSnap] = await Promise.all([tx.get(postRef), tx.get(viewerRef)]);
    if (!postSnap.exists || postSnap.data()?.hidden === true) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const lastViewedAtMs = Number(viewerSnap.exists ? viewerSnap.data()?.lastViewedAtMs || 0 : 0);
    counted = lastViewedAtMs <= now - intervalMs;
    tx.set(viewerRef, {
      uid,
      lastSeenAt: FieldValue.serverTimestamp(),
      lastSeenAtMs: now,
      ...(counted ? { lastViewedAt: FieldValue.serverTimestamp(), lastViewedAtMs: now } : {}),
    }, { merge: true });
    if (counted) tx.update(postRef, { viewCount: FieldValue.increment(1) });
  });

  return { ok: true, counted };
});

async function toggleReaction({ targetRef, markerRef, uid, reaction, allowed, totalField = null }) {
  let result;
  await db.runTransaction(async tx => {
    const [targetSnap, markerSnap] = await Promise.all([tx.get(targetRef), tx.get(markerRef)]);
    if (!targetSnap.exists) throw new HttpsError('not-found', '대상을 찾을 수 없습니다.');
    const current = markerSnap.exists ? String(markerSnap.data()?.reaction || '') : '';
    const data = targetSnap.data() || {};
    const reactions = { ...(data.reactions || {}) };
    for (const key of allowed) reactions[key] = safeCount(reactions[key]);
    if (totalField) reactions.total = safeCount(reactions.total);

    if (current === reaction) {
      tx.delete(markerRef);
      tx.update(targetRef, {
        [`reactions.${reaction}`]: Math.max(0, reactions[reaction] - 1),
        ...(totalField ? { [totalField]: Math.max(0, reactions.total - 1) } : {}),
      });
      result = { active: false, reaction: null, previousReaction: current };
      return;
    }

    const patch = { [`reactions.${reaction}`]: reactions[reaction] + 1 };
    if (current && allowed.has(current)) patch[`reactions.${current}`] = Math.max(0, reactions[current] - 1);
    if (totalField && !current) patch[totalField] = reactions.total + 1;
    tx.set(markerRef, { uid, reaction, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now() }, { merge: true });
    tx.update(targetRef, patch);
    result = { active: true, reaction, previousReaction: current || null };
  });
  return result;
}

const reactToPost = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const postId = cleanId(request.data?.postId, 'postId');
  const reaction = cleanReaction(request.data?.reaction, POST_REACTIONS);
  const postRef = db.doc(`feeds/${postId}`);
  const postSnap = await postRef.get();
  if (!postSnap.exists || postSnap.data()?.hidden === true) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const result = await toggleReaction({
    targetRef: postRef,
    markerRef: postRef.collection('reactions_by_user').doc(uid),
    uid,
    reaction,
    allowed: POST_REACTIONS,
    totalField: 'reactions.total',
  });
  return { ok: true, ...result };
});

const reactToComment = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const postId = cleanId(request.data?.postId, 'postId');
  const commentId = cleanId(request.data?.commentId, 'commentId');
  const reaction = cleanReaction(request.data?.reaction, COMMENT_REACTIONS);
  const postRef = db.doc(`feeds/${postId}`);
  const postSnap = await postRef.get();
  if (!postSnap.exists || postSnap.data()?.hidden === true) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const commentRef = postRef.collection('comments').doc(commentId);
  const result = await toggleReaction({
    targetRef: commentRef,
    markerRef: commentRef.collection('reactions_by_user').doc(uid),
    uid,
    reaction,
    allowed: COMMENT_REACTIONS,
  });
  return { ok: true, ...result };
});

module.exports = { incrementPostView, reactToPost, reactToComment };
