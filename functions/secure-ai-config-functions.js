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
    keyStorage: 'secret-manager-only',
  }, { merge: true });

  return {
    ok: true,
    message: 'AI 설정을 저장했습니다. API 키는 Firebase Secret Manager의 GEMINI_API_KEY를 사용합니다.',
  };
});

module.exports = { saveAiConfig };
