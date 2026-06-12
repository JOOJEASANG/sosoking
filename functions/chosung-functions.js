'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function clean(value, max = 180) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function normalizeAnswer(value) {
  return clean(value, 40).replace(/\s+/g, '').toLowerCase();
}

function cleanDocId(value, name) {
  const id = clean(value, 180);
  if (!id || id.includes('/')) {
    throw new HttpsError('invalid-argument', `${name} 정보가 올바르지 않습니다.`);
  }
  return id;
}

function assertLength(value, name, min, max) {
  const text = clean(value, max);
  if (text.length < min || text.length > max) {
    throw new HttpsError('invalid-argument', `${name} 길이가 올바르지 않습니다.`);
  }
  return text;
}

async function userName(uid, fallback = '익명') {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    const user = snap.exists ? (snap.data() || {}) : {};
    return clean(user.nickname || user.displayName || fallback, 20) || fallback;
  } catch {
    return fallback;
  }
}

const createChosungPuzzle = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const initials = assertLength(request.data?.initials, '초성', 1, 10);
  const answer = assertLength(request.data?.answer, '정답', 1, 20);
  const hint = clean(request.data?.hint, 30);
  const answerKey = normalizeAnswer(answer);
  if (!answerKey) throw new HttpsError('invalid-argument', '정답이 올바르지 않습니다.');

  const authorName = await userName(uid, request.auth?.token?.name || '익명');
  const puzzleRef = db.collection('chosung_puzzles').doc();
  const secretRef = puzzleRef.collection('secret').doc('answer');

  const batch = db.batch();
  batch.set(puzzleRef, {
    initials,
    hint,
    authorName,
    uid,
    solved: false,
    firstSolvedBy: null,
    firstSolvedName: null,
    solvedAnswer: null,
    answerLength: answer.length,
    guessCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(secretRef, {
    answer,
    answerKey,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return { ok: true, puzzleId: puzzleRef.id };
});

const submitChosungGuess = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const puzzleId = cleanDocId(request.data?.puzzleId, '문제');
  const guessKey = normalizeAnswer(request.data?.guess);
  if (!guessKey) throw new HttpsError('invalid-argument', '정답을 입력해주세요.');

  const puzzleRef = db.doc(`chosung_puzzles/${puzzleId}`);
  const secretRef = puzzleRef.collection('secret').doc('answer');
  const attemptRef = puzzleRef.collection('attempts').doc(uid);
  const solverName = await userName(uid, request.auth?.token?.name || '익명');

  let result = { correct: false, alreadyTried: false, alreadySolved: false };

  await db.runTransaction(async tx => {
    const [puzzleSnap, secretSnap, attemptSnap] = await Promise.all([
      tx.get(puzzleRef),
      tx.get(secretRef),
      tx.get(attemptRef),
    ]);

    if (!puzzleSnap.exists) throw new HttpsError('not-found', '문제를 찾을 수 없습니다.');
    const puzzle = puzzleSnap.data() || {};
    const legacyAnswer = puzzle.answer ? normalizeAnswer(puzzle.answer) : '';
    const answerKey = secretSnap.exists ? (secretSnap.data().answerKey || normalizeAnswer(secretSnap.data().answer)) : legacyAnswer;
    const answerText = secretSnap.exists ? (secretSnap.data().answer || '') : (puzzle.answer || '');
    if (!answerKey) throw new HttpsError('failed-precondition', '정답 정보가 없습니다.');

    if (attemptSnap.exists) {
      result = { correct: !!attemptSnap.data().correct, alreadyTried: true, alreadySolved: !!puzzle.solved };
      return;
    }

    const correct = guessKey === answerKey;
    result = { correct, alreadyTried: false, alreadySolved: !!puzzle.solved };

    tx.set(attemptRef, {
      uid,
      guessKey,
      correct,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });

    const updates = {
      guessCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (correct && !puzzle.solved) {
      updates.solved = true;
      updates.firstSolvedBy = uid;
      updates.firstSolvedName = solverName;
      updates.solvedAnswer = answerText;
    }
    tx.update(puzzleRef, updates);
  });

  return { ok: true, ...result };
});

module.exports = { createChosungPuzzle, submitChosungGuess };
