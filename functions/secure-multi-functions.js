'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

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

async function loadMultiPost(postId) {
  const safePostId = cleanId(postId);
  if (!safePostId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const ref = db.doc(`feeds/${safePostId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');
  if (post.type !== 'multi') throw new HttpsError('failed-precondition', '멀티 게시글이 아닙니다.');
  return { ref, postId: safePostId, post };
}

async function awardQuizPointOnce(uid, postId) {
  const awardRef = db.doc(`point_awards/${uid}_quiz_correct_${postId}`);
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async tx => {
    const awardSnap = await tx.get(awardRef);
    if (awardSnap.exists) return;
    tx.set(awardRef, {
      uid,
      action: 'quiz_correct',
      points: 5,
      postId,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.set(userRef, {
      points: FieldValue.increment(5),
      totalPoints: FieldValue.increment(5),
      'pointStats.quiz_correct': FieldValue.increment(5),
      lastPointAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(userRef.collection('point_logs').doc(), {
      action: 'quiz_correct',
      label: '퀴즈 정답',
      points: 5,
      meta: { postId },
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
  });
}

const checkMultiQuizAnswer = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, selected } = request.data || {};
  const { postId: safePostId, post } = await loadMultiPost(postId);
  if (post.modules?.quiz?.enabled !== true) {
    throw new HttpsError('failed-precondition', '퀴즈 게시글이 아닙니다.');
  }

  const secretSnap = await db.doc(`feeds/${safePostId}/secret/answer`).get();
  if (!secretSnap.exists) throw new HttpsError('failed-precondition', '정답 정보가 없습니다.');
  const secret = secretSnap.data() || {};
  const mode = secret.mode || secret.quizMode || post.modules?.quiz?.mode || 'subjective';

  let correct = false;
  let storedSelected = '';
  if (mode === 'multiple') {
    const idx = Number(selected);
    const answerIdx = Number(secret.answerIdx ?? secret.correctIndex);
    storedSelected = Number.isFinite(idx) ? String(idx) : '';
    correct = Number.isInteger(idx) && idx === answerIdx;
  } else {
    storedSelected = String(selected || '').slice(0, 80);
    correct = normalizeAnswer(storedSelected) === normalizeAnswer(secret.answer);
  }

  await db.doc(`feeds/${safePostId}/quiz_attempts/${uid}`).set({
    userId: uid,
    selected: storedSelected,
    correct,
    type: 'multi',
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  }, { merge: true });

  if (correct) await awardQuizPointOnce(uid, safePostId);
  return { ok: true, correct, explanation: String(secret.explanation || '').slice(0, 500) };
});

const castMultiVote = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const safePostId = cleanId(request.data && request.data.postId);
  const optionIdx = Number(request.data && request.data.optionIdx);
  if (!safePostId || !Number.isInteger(optionIdx) || optionIdx < 0) {
    throw new HttpsError('invalid-argument', '투표 정보가 올바르지 않습니다.');
  }

  const ref = db.doc(`feeds/${safePostId}`);
  const post = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const data = snap.data() || {};
    if (data.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');
    const vote = data.modules?.vote || {};
    if (data.type !== 'multi' || vote.enabled !== true) throw new HttpsError('failed-precondition', '투표 글이 아닙니다.');
    const options = Array.isArray(vote.options) ? vote.options : [];
    if (!options[optionIdx]) throw new HttpsError('invalid-argument', '존재하지 않는 선택지입니다.');
    if ((vote.votedBy || []).includes(uid)) throw new HttpsError('already-exists', '이미 투표했어요');

    const updatedOptions = options.map((option, index) => {
      const base = typeof option === 'object' && option !== null ? { ...option } : { text: String(option || '') };
      base.votes = Number(base.votes || 0) + (index === optionIdx ? 1 : 0);
      return base;
    });
    const updatedVote = { ...vote, options: updatedOptions, votedBy: [...(vote.votedBy || []), uid] };
    tx.update(ref, {
      'modules.vote': updatedVote,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ...data, id: safePostId, modules: { ...(data.modules || {}), vote: updatedVote } };
  });

  return { ok: true, post };
});

module.exports = { checkMultiQuizAnswer, castMultiVote };
