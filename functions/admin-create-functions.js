'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

async function requireAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 전용 기능입니다.');
  return uid;
}

function cleanText(value, maximum) {
  return String(value || '').replace(/[<>\u0000]/g, '').trim().slice(0, maximum);
}

function cleanList(value, maximum = 10, length = 200) {
  return Array.isArray(value)
    ? value.map(item => cleanText(item, length)).filter(Boolean).slice(0, maximum)
    : [];
}

const adminCreateDebate = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = await requireAdmin(request);
  const title = cleanText(request.data?.title, 100);
  const summary = cleanText(request.data?.summary, 260);
  const context = cleanList(request.data?.context, 8, 700);
  const agreeTitle = cleanText(request.data?.agreeTitle, 60);
  const agreeText = cleanText(request.data?.agreeText, 400);
  const disagreeTitle = cleanText(request.data?.disagreeTitle, 60);
  const disagreeText = cleanText(request.data?.disagreeText, 400);
  if (title.length < 3 || summary.length < 10 || context.length < 1 || agreeTitle.length < 1 || disagreeTitle.length < 1 || agreeText.length < 3 || disagreeText.length < 3) {
    throw new HttpsError('invalid-argument', '제목, 상황, A·B 선택 내용을 모두 입력해주세요.');
  }

  const ref = db.collection('debates').doc();
  await ref.set({
    title,
    summary,
    context,
    category: cleanText(request.data?.category || '생활토론', 40),
    tags: cleanList(request.data?.tags, 8, 24),
    agreeTitle,
    agreeText,
    disagreeTitle,
    disagreeText,
    questions: cleanList(request.data?.questions, 5, 140),
    sourceType: 'manual',
    sourceName: '관리자 직접 등록',
    generatedDate: '',
    status: request.data?.status === 'draft' ? 'draft' : 'published',
    aiGenerated: false,
    imported: true,
    userGenerated: false,
    reviewStatus: 'manual',
    agreeCount: 0,
    disagreeCount: 0,
    totalVotes: 0,
    commentCount: 0,
    viewCount: 0,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, id: ref.id };
});

module.exports = { adminCreateDebate };
