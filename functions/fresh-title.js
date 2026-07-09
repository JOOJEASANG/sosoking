const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { REGION, clean, safeJson, buildModel, loadSettings, titleFromDescription } = require('./fresh-utils');

const geminiKey = defineSecret('GEMINI_API_KEY');

exports.suggestCaseTitle = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const desc = clean(request.data?.caseDescription, 500);
  if (desc.length < 5) return { caseTitle: '' };
  const fallback = titleFromDescription(desc);

  try {
    const settings = await loadSettings();
    const model = buildModel(geminiKey.value(), clean(settings.geminiModel, 60) || 'gemini-2.5-flash', 0.75);
    const prompt = `접수내용을 소소킹 황당재판소 사건명으로 만들어라. 18~35자, 구체명사 포함, 반드시 사건으로 끝낸다. JSON만 출력: {"caseTitle":"..."}\n접수내용: ${desc}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const parsed = safeJson(result.response.text());
    let title = clean(parsed.caseTitle, 50) || fallback;
    if (!title.endsWith('사건')) title += ' 사건';
    return { caseTitle: title };
  } catch (err) {
    return { caseTitle: fallback };
  }
});
