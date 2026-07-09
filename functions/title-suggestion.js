const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const MAX_TITLE = 40;
const MAX_DESC = 320;
const TITLE_DAILY_LIMIT = 30;
const TITLE_COOLDOWN_SEC = 10;

function textValue(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').replace(/["“”'‘’]/g, '').trim();
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
      title = parsed.caseTitle || parsed.refinedTitle || parsed.draftTitle || parsed.title || title;
    }
  } catch (_) {}
  title = textValue(title, MAX_TITLE).replace(/^사건명\s*[:：]\s*/g, '').replace(/["“”'‘’]/g, '').replace(/[.!?。！？]+$/g, '').replace(/\s+/g, ' ').trim();
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
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function requireRealUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', '사건명 AI 분석은 구글 또는 이메일 로그인 후 이용할 수 있습니다.');
}
async function reserveTitleSuggestion(uid) {
  const today = kstDateKey();
  const ref = db.doc(`title_suggestion_limits/${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= TITLE_DAILY_LIMIT) throw new HttpsError('resource-exhausted', `오늘 AI 사건명 분석 한도 ${TITLE_DAILY_LIMIT}회를 모두 사용했습니다.`);
    if (current.lastSuggestedAt && current.date === today) {
      const lastMs = current.lastSuggestedAt.toMillis ? current.lastSuggestedAt.toMillis() : new Date(current.lastSuggestedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < TITLE_COOLDOWN_SEC) throw new HttpsError('resource-exhausted', `${TITLE_COOLDOWN_SEC - diffSec}초 후에 다시 분석할 수 있습니다.`);
    }
    tx.set(ref, { date: today, count: count + 1, lastSuggestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
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
  requireRealUser(request);
  const desc = textValue(request.data?.caseDescription || request.data?.description, MAX_DESC);
  if (desc.length < 10) throw new HttpsError('invalid-argument', '사건 내용을 10자 이상 입력해주세요.');

  const fallback = fallbackTitle(desc);
  await reserveTitleSuggestion(request.auth.uid);
  try {
    const settings = await loadSettings();
    const modelName = textValue(settings.geminiModel, 60) || 'gemini-2.5-flash';
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.82, topP: 0.94, topK: 40, responseMimeType: 'application/json' }
    });
    const prompt = `너는 소소킹 황당재판소의 사건명 작성관이다.

사용자의 접수 내용을 바로 제목으로 만들지 말고, 내부적으로 정리한 뒤 최종 사건명 1개를 만든다. 내부 정리 과정은 출력하지 않는다.

규칙:
- 18~35자 권장, 최대 40자.
- 사건의 핵심 대상과 핵심 행동을 포함한다.
- 문장 앞부분을 그대로 자르지 않는다.
- 반드시 '사건'으로 끝낸다.
- 실제 범죄처럼 보이게 과격하게 쓰지 않는다.
- 웃기려고 드립을 치지 말고, 너무 진지한 사건명처럼 쓴다.

사건 내용:
${desc}

JSON만 출력하라.
{"draftTitle":"1차 사건명 초안","refinedTitle":"보완 사건명","caseTitle":"최종 사건명","titleBasis":["구체명사","핵심 행동"]}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const parsedText = result.response.text();
    const caseTitle = normalizeAiTitle(parsedText, fallback);
    let parsed = {};
    try {
      const raw = parsedText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    } catch (_) {}
    return {
      caseTitle,
      aiCaseTitle: caseTitle,
      draftTitle: textValue(parsed.draftTitle, MAX_TITLE),
      refinedTitle: textValue(parsed.refinedTitle, MAX_TITLE),
      titleBasis: Array.isArray(parsed.titleBasis) ? parsed.titleBasis.map(x => textValue(x, 40)).filter(Boolean).slice(0, 4) : [],
      fallbackCaseTitle: fallback
    };
  } catch (err) {
    console.error('suggestCaseTitle failed:', err);
    return { caseTitle: fallback, aiCaseTitle: '', fallbackCaseTitle: fallback, fallback: true };
  }
});
