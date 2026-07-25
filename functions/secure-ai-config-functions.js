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
  const enabled = request.data?.enabled !== false;
  const features = request.data?.features && typeof request.data.features === 'object'
    ? request.data.features
    : {};
  const autoCommentsEnabled = enabled && request.data?.autoCommentsEnabled !== false;
  const autoCommentCount = Math.max(1, Math.min(Number(request.data?.autoCommentCount || 3), 3));

  await Promise.all([
    db.doc('config/ai').set({
      enabled,
      features,
      apiKey: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
      keyStorage: 'secret-manager-only',
    }, { merge: true }),
    db.doc('site_settings/aiCharacters').set({
      autoCommentsEnabled,
      autoCommentCount,
      settingsSource: 'config-ai-synced',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    }, { merge: true }),
  ]);

  return {
    ok: true,
    enabled,
    autoCommentsEnabled,
    autoCommentCount,
    message: 'AI 설정과 자동 캐릭터 댓글 설정을 함께 저장했습니다.',
  };
});

module.exports = { saveAiConfig };
