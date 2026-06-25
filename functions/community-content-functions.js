'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { cleanText, clampLimit, isValidMaterialId } = require('./lib/material-policy');
const communityCleanup = require('./community-cleanup-functions.js');

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const COMMENT_DAILY_LIMIT = 40;
const POST_DAILY_LIMIT = 5;
const COMMENT_COOLDOWN_MS = 5000;
const POST_COOLDOWN_MS = 15000;

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function cleanList(value, maximum = 10, length = 200) {
  return Array.isArray(value)
    ? value.map(item => cleanText(item, length)).filter(Boolean).slice(0, maximum)
    : [];
}

function safeSourceUrl(value) {
  const url = cleanText(value, 500);
  return /^https?:\/\//i.test(url) ? url : '';
}

function requireUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인 후 이용할 수 있습니다.');
  return uid;
}

function validId(value, label) {
  const id = cleanText(value, 80);
  if (!isValidMaterialId(id)) throw new HttpsError('invalid-argument', `${label} ID가 올바르지 않습니다.`);
  return id;
}

async function profileFor(uid) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return { nickname: cleanText(data.nickname || data.displayName || '익명', 30) };
}

async function consumeLimit(uid, type, dailyLimit, cooldownMs) {
  const ref = db.doc(`rate_limits/${type}-${uid}`);
  const nowMs = Date.now();
  const day = todayKst();
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const count = data.day === day ? Number(data.count || 0) : 0;
    const lastAtMs = Number(data.lastAtMs || 0);
    if (nowMs - lastAtMs < cooldownMs) throw new HttpsError('resource-exhausted', '잠시 후 다시 시도해주세요.');
    if (count >= dailyLimit) throw new HttpsError('resource-exhausted', '오늘 등록할 수 있는 횟수를 초과했습니다.');
    transaction.set(ref, {
      uid, type, day, count: count + 1, lastAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(nowMs + 3 * 86400000),
    }, { merge: true });
  });
}

const createUserMaterial = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireUser(request);
  const title = cleanText(request.data?.title, 100);
  const summary = cleanText(request.data?.summary, 260);
  const body = cleanList(request.data?.body, 10, 800);
  if (title.length < 3 || summary.length < 10 || body.length < 1) {
    throw new HttpsError('invalid-argument', '제목, 요약, 핵심 내용을 입력해주세요.');
  }

  await consumeLimit(uid, 'material-create', POST_DAILY_LIMIT, POST_COOLDOWN_MS);
  const profile = await profileFor(uid);
  const ref = db.collection('materials').doc();
  await ref.set({
    title,
    summary,
    body,
    category: cleanText(request.data?.category || '생활정보', 40),
    tags: cleanList(request.data?.tags, 8, 24),
    sourceType: 'user',
    sourceName: cleanText(request.data?.sourceName || profile.nickname, 80),
    sourceUrl: safeSourceUrl(request.data?.sourceUrl),
    sourceGuide: cleanList(request.data?.sourceGuide, 8, 100),
    disclaimer: cleanText(request.data?.disclaimer || '회원이 직접 등록한 자료입니다. 중요한 정보는 관계 기관의 최신 안내를 확인해주세요.', 300),
    generatedDate: '',
    status: 'published',
    aiGenerated: false,
    imported: false,
    userGenerated: true,
    reviewStatus: 'user-published',
    viewCount: 0,
    commentCount: 0,
    createdBy: uid,
    authorName: profile.nickname,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, id: ref.id };
});

const createUserDebate = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireUser(request);
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

  await consumeLimit(uid, 'debate-create', POST_DAILY_LIMIT, POST_COOLDOWN_MS);
  const profile = await profileFor(uid);
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
    sourceType: 'user',
    sourceName: profile.nickname,
    generatedDate: '',
    status: 'published',
    aiGenerated: false,
    imported: false,
    userGenerated: true,
    reviewStatus: 'user-published',
    agreeCount: 0,
    disagreeCount: 0,
    totalVotes: 0,
    commentCount: 0,
    viewCount: 0,
    createdBy: uid,
    authorName: profile.nickname,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, id: ref.id };
});

const getMaterialComments = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const id = validId(request.data?.materialId, '자료');
  const limit = clampLimit(request.data?.limit, 40, 80);
  const materialSnap = await db.doc(`materials/${id}`).get().catch(() => null);
  if (!materialSnap?.exists || materialSnap.data()?.status !== 'published') throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
  const snap = await db.collection(`materials/${id}/comments`).orderBy('createdAt', 'desc').limit(limit).get().catch(() => null);
  const comments = snap ? snap.docs.map(item => {
    const data = item.data() || {};
    return {
      id: item.id,
      uid: cleanText(data.uid, 128),
      nickname: cleanText(data.nickname || '익명', 30),
      text: cleanText(data.text, 700),
      createdAtMillis: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
      status: data.status || 'visible',
    };
  }).filter(item => item.status === 'visible') : [];
  return { ok: true, comments };
});

const addMaterialComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireUser(request);
  const id = validId(request.data?.materialId, '자료');
  const text = cleanText(request.data?.text, 700);
  if (text.length < 2) throw new HttpsError('invalid-argument', '댓글을 2자 이상 입력해주세요.');

  const profile = await profileFor(uid);
  const materialRef = db.doc(`materials/${id}`);
  const commentRef = materialRef.collection('comments').doc();
  const limitRef = db.doc(`rate_limits/material-comment-${uid}`);
  const nowMs = Date.now();
  const day = todayKst();

  await db.runTransaction(async transaction => {
    const [materialSnap, limitSnap] = await Promise.all([transaction.get(materialRef), transaction.get(limitRef)]);
    if (!materialSnap.exists || materialSnap.data()?.status !== 'published') throw new HttpsError('not-found', '댓글을 작성할 자료를 찾을 수 없습니다.');
    const limitData = limitSnap.exists ? limitSnap.data() || {} : {};
    const count = limitData.day === day ? Number(limitData.count || 0) : 0;
    const lastAtMs = Number(limitData.lastAtMs || 0);
    if (nowMs - lastAtMs < COMMENT_COOLDOWN_MS) throw new HttpsError('resource-exhausted', '댓글은 잠시 후 다시 작성해주세요.');
    if (count >= COMMENT_DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘 작성할 수 있는 댓글 수를 초과했습니다.');

    transaction.set(commentRef, {
      uid,
      materialId: id,
      nickname: profile.nickname,
      text,
      status: 'visible',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(materialRef, {
      commentCount: Math.max(0, Number(materialSnap.data()?.commentCount || 0)) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(limitRef, {
      uid,
      type: 'material-comment',
      day,
      count: count + 1,
      lastAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(nowMs + 3 * 86400000),
    }, { merge: true });
  });
  return { ok: true, id: commentRef.id };
});

module.exports = {
  createUserMaterial,
  createUserDebate,
  getMaterialComments,
  addMaterialComment,
  ...communityCleanup,
  _test: { todayKst, cleanList, safeSourceUrl, validId },
};
