'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

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

function normalizeAnswer(value) {
  return String(value || '')
    .replace(/[\s\n\r\t]+/g, '')
    .trim()
    .toLowerCase()
    .slice(0, 20);
}

exports.checkInitialGameAnswer = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  requireUid(request);
  const postId = cleanId(request.data && request.data.postId, 'postId');
  const selected = normalizeAnswer(request.data && request.data.answer);
  if (!selected) throw new HttpsError('invalid-argument', '정답을 입력해주세요.');

  const postRef = db.doc(`feeds/${postId}`);
  const postSnap = await postRef.get();
  if (!postSnap.exists) throw new HttpsError('not-found', '글을 찾을 수 없습니다.');
  const post = postSnap.data() || {};
  if (post.type !== 'initial_game') throw new HttpsError('failed-precondition', '초성게임 글이 아닙니다.');
  if (post.hidden === true) throw new HttpsError('permission-denied', '숨김 처리된 글입니다.');

  const secretSnap = await postRef.collection('secret').doc('initial').get();
  if (!secretSnap.exists) throw new HttpsError('not-found', '정답 정보가 없습니다.');
  const secret = secretSnap.data() || {};
  const answer = normalizeAnswer(secret.answer);
  const correct = !!answer && selected === answer;

  return {
    correct,
    answer: correct ? String(secret.answer || '') : '',
    hint: String(post.hint || '').slice(0, 120),
  };
});
