const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { isAdminAuth } = require('./admin-utils');
const { generateJson, DEFAULT_MODEL } = require('./gemini-runtime');

const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

exports.checkGeminiConnection = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 60,
  memory: '256MiB',
}, async request => {
  if (!isAdminAuth(request.auth)) {
    throw new HttpsError('permission-denied', '관리자만 Gemini 연결을 진단할 수 있습니다.');
  }

  const startedAt = Date.now();
  try {
    const generated = await generateJson({
      apiKey: geminiKey.value(),
      configuredModel: DEFAULT_MODEL,
      prompt: 'JSON으로만 응답한다. ok는 true, service는 sosoking으로 작성한다.',
      responseJsonSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          service: { type: 'string' },
        },
        required: ['ok', 'service'],
      },
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 200,
    });
    const parsed = JSON.parse(generated.text);
    if (parsed.ok !== true || parsed.service !== 'sosoking') {
      throw new Error('Gemini health response was invalid');
    }
    return {
      connected: true,
      model: generated.modelName,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.error('Gemini connection check failed:', error.message || error);
    throw new HttpsError('unavailable', 'Gemini API 연결에 실패했습니다. API 키, 결제, 모델 접근 권한을 확인해주세요.');
  }
});
