const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');

exports.systemHealth = onCall({
  region: REGION,
  secrets: [geminiKey],
  cors: true,
}, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  return {
    ok: true,
    service: 'sosoking-clean-baseline',
    geminiConfigured: Boolean(geminiKey.value().trim()),
  };
});
