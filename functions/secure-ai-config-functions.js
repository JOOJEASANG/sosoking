'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '인증 필요');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');
}

function cleanModel(value, fallback) {
  const model = String(value || fallback).trim().slice(0, 100);
  return model || fallback;
}

function clampNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

const saveAiConfig = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertAdmin(request.auth?.uid);
  const features = request.data?.features && typeof request.data.features === 'object'
    ? request.data.features
    : {};

  await db.doc('config/ai').set({
    enabled: request.data?.enabled !== false,
    features,
    apiKey: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    keyStorage: 'managed-secret-only',
  }, { merge: true });

  return {
    ok: true,
    message: 'AI 설정을 저장했습니다. 인증 정보는 관리형 비밀 저장소에서만 사용합니다.',
  };
});

const saveAiKingConfig = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  await assertAdmin(uid);
  const data = request.data || {};
  const activeModel = data.activeModel === 'gemini' ? 'gemini' : 'anthropic';
  const dailyFreeLimit = clampNumber(data.dailyFreeLimit, 3, 1, 20);
  const monthlyCap = clampNumber(data.monthlyCap, 0, 0, 100000);
  const enabled = data.enabled !== false;

  await db.doc('config/ai_king').set({
    enabled,
    activeModel,
    geminiModel: cleanModel(data.geminiModel, 'gemini-2.5-flash'),
    claudeModel: cleanModel(data.claudeModel, 'claude-haiku-4-5-20251001'),
    dailyFreeLimit,
    monthlyCap,
    geminiApiKey: FieldValue.delete(),
    claudeApiKey: FieldValue.delete(),
    openaiApiKey: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid,
    keyStorage: 'managed-secret-only',
  }, { merge: true });

  return {
    success: true,
    updated: ['enabled', 'activeModel', 'geminiModel', 'claudeModel', 'dailyFreeLimit', 'monthlyCap'],
    message: 'AI 실행 설정을 저장했습니다. 인증 정보는 Firestore에 저장하지 않습니다.',
  };
});

module.exports = { saveAiConfig, saveAiKingConfig, clampNumber };
