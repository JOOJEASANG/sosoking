'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_MAX_LENGTH = 120;
const DEFAULT_MAX_LENGTH = 300;
const BLOCKED_WORDS = /(시발|씨발|병신|개새끼|죽어|자살|전화번호|주민등록번호|실명 공개)/i;

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocId(value) {
  const id = cleanText(value, 100);
  return /^[A-Za-z0-9_-]{8,100}$/.test(id) ? id : '';
}

function assertSafeText(text) {
  const safety = inspectContent(text);
  if (!safety.safe || BLOCKED_WORDS.test(text)) {
    throw new HttpsError('failed-precondition', '댓글에 공개하기 어려운 표현이 포함되어 있습니다.');
  }
}

async function loadNickname(uid) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists
    ? cleanText(snap.data().nickname, 20) || '익명 드리퍼'
    : '익명 드리퍼';
}

exports.addDripsoComment = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const rawText = String(request.data?.text || '');

  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');

  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const topicSnap = await topicRef.get();
  if (!topicSnap.exists || topicSnap.data()?.status !== 'visible') {
    throw new HttpsError('not-found', '드립 주제를 찾을 수 없습니다.');
  }

  const isDaily = topicSnap.data()?.type === 'daily';
  if (isDaily && /[\r\n]/.test(rawText)) {
    throw new HttpsError('invalid-argument', '오늘의 한줄은 줄바꿈 없이 한 줄로 입력해 주세요.');
  }
  if (isDaily && rawText.trim().length > DAILY_MAX_LENGTH) {
    throw new HttpsError('invalid-argument', `오늘의 한줄은 ${DAILY_MAX_LENGTH}자 이하로 입력해 주세요.`);
  }

  const text = cleanText(rawText, isDaily ? DAILY_MAX_LENGTH : DEFAULT_MAX_LENGTH);
  if (text.length < 2) throw new HttpsError('invalid-argument', '드립을 2자 이상 입력해 주세요.');
  assertSafeText(text);

  await enforceActionRateLimit(uid, 'dripso-comment', {
    cooldownSeconds: 8,
    dailyLimit: 60
  });

  const nickname = await loadNickname(uid);
  const commentRef = topicRef.collection('comments').doc();
  const authorRef = db.doc(`dripso_comment_authors/${topicId}/items/${commentRef.id}`);
  const batch = db.batch();

  batch.set(commentRef, {
    nickname,
    text,
    status: 'visible',
    likeCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(authorRef, {
    uid,
    topicId,
    commentId: commentRef.id,
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(topicRef, {
    commentCount: FieldValue.increment(1),
    lastCommentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();

  return { success: true, commentId: commentRef.id };
});
