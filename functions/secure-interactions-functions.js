'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const POST_REACTIONS = ['like', 'funny', 'fire', 'skull'];
const COMMENT_REACTIONS = ['funny', 'fire', 'like'];
const ACROSTIC_REACTIONS = ['like', 'funny', 'fire'];

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function cleanId(value, name) {
  const id = String(value || '').trim();
  if (!id || id.length > 160 || id.includes('/')) {
    throw new HttpsError('invalid-argument', `${name} 값이 올바르지 않습니다.`);
  }
  return id;
}

function assertKey(key, allowed, name) {
  const value = String(key || '').trim();
  if (!allowed.includes(value)) throw new HttpsError('invalid-argument', `${name} 값이 올바르지 않습니다.`);
  return value;
}

async function assertPostVisible(postRef) {
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.hidden === true) throw new HttpsError('permission-denied', '숨김 처리된 글입니다.');
  return { snap, post };
}

function getCurrentReaction(map, uid) {
  return map && Object.prototype.hasOwnProperty.call(map, uid) ? map[uid] : null;
}

async function toggleReactionOnRef(ref, uid, key, allowed, totalField = null) {
  assertKey(key, allowed, 'reaction');
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '대상을 찾을 수 없습니다.');
    const data = snap.data() || {};
    const currentKey = getCurrentReaction(data.reactedWith || {}, uid);
    const updates = {};

    if (currentKey === key) {
      updates[`reactions.${key}`] = FieldValue.increment(-1);
      updates[`reactedWith.${uid}`] = FieldValue.delete();
      if (totalField) updates[totalField] = FieldValue.increment(-1);
      tx.update(ref, updates);
      return { active: false, reaction: null, previousReaction: currentKey };
    }

    if (currentKey && allowed.includes(currentKey)) {
      updates[`reactions.${currentKey}`] = FieldValue.increment(-1);
      updates[`reactions.${key}`] = FieldValue.increment(1);
      updates[`reactedWith.${uid}`] = key;
      tx.update(ref, updates);
      return { active: true, reaction: key, previousReaction: currentKey };
    }

    updates[`reactions.${key}`] = FieldValue.increment(1);
    updates[`reactedWith.${uid}`] = key;
    if (totalField) updates[totalField] = FieldValue.increment(1);
    tx.update(ref, updates);
    return { active: true, reaction: key, previousReaction: null };
  });
}

exports.incrementPostView = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const postId = cleanId(request.data && request.data.postId, 'postId');
  const postRef = db.doc(`feeds/${postId}`);
  await assertPostVisible(postRef);
  await postRef.update({ viewCount: FieldValue.increment(1) });
  return { ok: true };
});

exports.votePostOption = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const postId = cleanId(request.data && request.data.postId, 'postId');
  const optionIndex = Number(request.data && request.data.optionIndex);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 20) {
    throw new HttpsError('invalid-argument', '선택지 번호가 올바르지 않습니다.');
  }

  const postRef = db.doc(`feeds/${postId}`);
  return db.runTransaction(async tx => {
    const snap = await tx.get(postRef);
    if (!snap.exists) throw new HttpsError('not-found', '글을 찾을 수 없습니다.');
    const post = snap.data() || {};
    if (post.hidden === true) throw new HttpsError('permission-denied', '숨김 처리된 글입니다.');
    const options = Array.isArray(post.options) ? post.options.map(opt => ({ ...(typeof opt === 'object' ? opt : { text: String(opt || '') }) })) : [];
    if (!options[optionIndex]) throw new HttpsError('invalid-argument', '선택지를 찾을 수 없습니다.');
    const votedBy = Array.isArray(post.votedBy) ? post.votedBy : [];
    if (votedBy.includes(uid)) throw new HttpsError('failed-precondition', '이미 투표했습니다.');
    options[optionIndex].votes = Number(options[optionIndex].votes || 0) + 1;
    tx.update(postRef, { options, votedBy: FieldValue.arrayUnion(uid) });
    return { ok: true, options };
  });
});

exports.checkQuizAnswer = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  requireUid(request);
  const postId = cleanId(request.data && request.data.postId, 'postId');
  const selected = request.data && request.data.answer;
  const postRef = db.doc(`feeds/${postId}`);
  await assertPostVisible(postRef);
  const secretSnap = await postRef.collection('secret').doc('answer').get();
  if (!secretSnap.exists) throw new HttpsError('not-found', '정답 정보가 없습니다.');
  const secret = secretSnap.data() || {};
  let correct = false;
  if (typeof selected === 'number') {
    correct = Number(secret.answerIdx) === selected;
  } else {
    const normalizedSelected = String(selected || '').trim().toLowerCase();
    const normalizedAnswer = String(secret.answer || '').trim().toLowerCase();
    correct = !!normalizedAnswer && normalizedSelected === normalizedAnswer;
  }
  return { correct, explanation: String(secret.explanation || '').slice(0, 600) };
});

exports.reactToPost = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const postId = cleanId(request.data && request.data.postId, 'postId');
  const key = assertKey(request.data && request.data.reaction, POST_REACTIONS, 'reaction');
  const postRef = db.doc(`feeds/${postId}`);
  await assertPostVisible(postRef);
  const result = await toggleReactionOnRef(postRef, uid, key, POST_REACTIONS, 'reactions.total');
  return { ok: true, ...result };
});

exports.reactToComment = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const postId = cleanId(request.data && request.data.postId, 'postId');
  const commentId = cleanId(request.data && request.data.commentId, 'commentId');
  const key = assertKey(request.data && request.data.reaction, COMMENT_REACTIONS, 'reaction');
  const postRef = db.doc(`feeds/${postId}`);
  await assertPostVisible(postRef);
  const ref = postRef.collection('comments').doc(commentId);
  const result = await toggleReactionOnRef(ref, uid, key, COMMENT_REACTIONS, null);
  return { ok: true, ...result };
});

exports.reactToAcrostic = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const postId = cleanId(request.data && request.data.postId, 'postId');
  const acrosticId = cleanId(request.data && request.data.acrosticId, 'acrosticId');
  const key = assertKey(request.data && request.data.reaction, ACROSTIC_REACTIONS, 'reaction');
  const postRef = db.doc(`feeds/${postId}`);
  await assertPostVisible(postRef);
  const ref = postRef.collection('acrostics').doc(acrosticId);
  const result = await toggleReactionOnRef(ref, uid, key, ACROSTIC_REACTIONS, null);
  return { ok: true, ...result };
});
