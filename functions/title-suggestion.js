const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const MAX_TITLE = 40;
const MAX_DESC = 320;

function textValue(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function compact(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .replace(/["“”'‘’]/g, '')
    .trim();
}
function clipTitle(title) {
  const clean = compact(title).replace(/사건\s*사건$/g, '사건');
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trim()}…` : clean;
}
function normalizeAiTitle(raw, fallbackTitle) {
  let title = String(raw || '').replace(/```json|```/g, '').trim();
  try {
    const start = title.indexOf('{');
    const end = title.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(title.slice(start, end + 1));
      title = parsed.caseTitle || parsed.title || title;
    }
  } catch (_) {}
  title = textValue(title, MAX_TITLE)
    .replace(/^사건명\s*[:：]\s*/g, '')
    .replace(/["“”'‘’]/g, '')
    .replace(/[.!?。！？]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) return fallbackTitle || '';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return clipTitle(title);
}
function fallbackTitle(desc) {
  const text = textValue(desc, MAX_DESC)
    .replace(/^(제가|내가|나는|저는|나|저)\s*/g, '')
    .replace(/(하고 있었는데|하고 있었는 데|했는데|하던 중|한눈판사이|한눈 판 사이|잠깐 사이|사이에)/g, ' ')
    .replace(/[.!?。！？].*$/g, '')
    .trim();
  return clipTitle(`${text.slice(0, 28).trim() || '소소한 일상'} 사건`);
}
async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}

exports.suggestCaseTitle = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', '사건명 AI 분석은 로그인 후 이용할 수 있습니다.');

  const desc = textValue(request.data?.caseDescription || request.data?.description, MAX_DESC);
  if (desc.length < 10) throw new HttpsError('invalid-argument', '사건 내용을 10자 이상 입력해주세요.');

  const fallback = fallbackTitle(desc);
  try {
    const settings = await loadSettings();
    const modelName = textValue(settings.geminiModel, 60) || 'gemini-2.5-flash';
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.78,
        topP: 0.92,
        topK: 40,
        responseMimeType: 'application/json'
      }
    });
    const prompt = `너는 소소킹 황당재판소의 사건명 작성관이다.

사용자의 사건 내용을 전부 읽고 핵심을 가장 잘 드러내는 사건명 1개만 작성하라.

규칙:
- 18~35자 권장, 최대 40자.
- 반드시 사건의 핵심 대상과 핵심 행동을 포함한다.
- 문장 앞부분을 그대로 자르지 않는다.
- 너무 설명식으로 길게 쓰지 않는다.
- 반드시 '사건'으로 끝낸다.
- 실제 범죄처럼 보이게 과격하게 쓰지 않는다.
- 웃기려고 드립을 치지 말고, 너무 진지한 사건명처럼 쓴다.
- 장소, 행위자, 피해 대상, 핵심 행동이 명확하면 포함한다.
- 사용자가 직접 쓴 말 중 중요한 단어는 살리되, 어색한 조사와 배경문장은 정리한다.

좋은 예:
- 공원에서 리트리버가 내 빵을 먹은 사건
- 탕비실 마지막 카누 봉지 방치 사건
- 동생의 방문 미닫힘 반복 사건
- 침대 밑 이어폰 한쪽 실종 사건
- 리모컨 장기 점유 및 채널권 박탈 사건

나쁜 예:
- 공원에서 빵을 먹고 있었는데 사건
- 너무 억울한 사건
- 진짜 열받는 사건
- 카누 사건
- 이걸로 재판까지 간 사건

사건 내용:
${desc}

JSON만 출력하라.
{"caseTitle":"사건명"}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const caseTitle = normalizeAiTitle(result.response.text(), fallback);
    return { caseTitle, aiCaseTitle: caseTitle, fallbackCaseTitle: fallback };
  } catch (err) {
    console.error('suggestCaseTitle failed:', err);
    return { caseTitle: fallback, aiCaseTitle: '', fallbackCaseTitle: fallback, fallback: true };
  }
});
