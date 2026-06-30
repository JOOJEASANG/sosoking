const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function oneSentence(text) {
  let s = cleanText(text, 80).replace(/["“”'`]/g, '').trim();
  if (!s.startsWith('피고는')) s = `피고는 ${s.replace(/^피고(인)?은?\s*/, '')}`;
  if (!s.endsWith('.')) s += '.';
  if (s.length > 45) s = '피고는 하루 동안 과자를 눈으로만 먹는다.';
  return s;
}

function extractJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}

function fallbackContent(dateKey) {
  return {
    caseTitle: '냉장고 마지막 푸딩 실종 사건',
    caseDescription: `${dateKey} 생활법정 기록에 따르면, 원고는 퇴근 후 마지막 푸딩을 기대했으나 냉장고에는 빈 자리와 차가운 배신감만 남아 있었다.`,
    grievanceIndex: 7,
    nickname: '오늘의억울인',
    desiredVerdict: '푸딩 재구매 및 숟가락 반성',
    judgeType: '드립형',
    reception: '소소킹 판결소는 본 건을 냉장 보관 신뢰 붕괴 사안으로 접수한다. 본 접수는 오락 목적이며 실제 법적 효력은 없다.',
    investigation: '수사 결과 냉장고 내부에는 푸딩의 흔적 대신 작은 숟가락 하나가 침묵하고 있었다. 수사관은 이를 생활 질서의 미세한 균열로 기록한다.',
    plaintiffArg: '존경하는 재판장님, 이것은 단순한 간식 문제가 아닙니다. 하루의 마지막 희망이 사라진 중대한 생활 감정 사건입니다.',
    defendantArg: '피고는 억울합니다. 피고는 푸딩이 모두의 공용 행복이라고 오해했을 가능성이 있으며, 이는 냉장고 민주주의의 부작용입니다.',
    verdict: '본 생활법정은 마지막 푸딩을 무단으로 소비한 행위가 원고의 퇴근 후 기대권을 침해했다고 본다. 다만 본 판결은 오락 목적이며 실제 법적 효력은 없다.',
    sentence: '피고는 3일간 디저트를 먼저 제안한다.'
  };
}

async function buildDailyContent(dateKey) {
  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `소소킹 판결소에 매일 자동 게시할 생활형 AI 사건 1개를 생성하세요. 누구나 공감할 사소한 일상 억울함만 다루고, 실명과 연락처는 쓰지 마세요. 진지한 판결문 말투지만 웃기게 작성하세요. 한국어 JSON만 출력하세요.

형식:
{
  "caseTitle":"30자 이하 사건명",
  "caseDescription":"120자 이하 사건 경위",
  "grievanceIndex":7,
  "nickname":"12자 이하 별칭",
  "desiredVerdict":"60자 이하 원하는 판결",
  "judgeType":"드립형",
  "reception":"2문장 이하 접수관 기록",
  "investigation":"2문장 이하 수사 기록",
  "plaintiffArg":"2문장 이하 원고 측 주장",
  "defendantArg":"2문장 이하 피고 측 주장",
  "verdict":"3문장 이하 최종 판결문. 오락 목적 및 법적 효력 없음 포함",
  "sentence":"피고는 ...한다. 형식의 한 문장"
}

판사 유형은 다음 중 하나만 사용: ${JUDGES.join(', ')}
날짜키: ${dateKey}`;
    const result = await model.generateContent(prompt);
    return extractJson(result.response.text());
  } catch (err) {
    console.error('daily AI generation failed, using fallback:', err);
    return fallbackContent(dateKey);
  }
}

async function createDailyAiCase() {
  const dateKey = kstDateKey();
  const docKey = dateKey.replace(/-/g, '');
  const caseId = `daily_${docKey}`;
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const existing = await resultRef.get();
  if (existing.exists) return { created: false, caseId };

  const ai = await buildDailyContent(dateKey);
  const judgeType = JUDGES.includes(ai.judgeType) ? ai.judgeType : JUDGES[Math.floor(Math.random() * JUDGES.length)];
  const data = {
    caseTitle: cleanText(ai.caseTitle, 30) || '오늘의 소소한 억울함 사건',
    caseDescription: cleanText(ai.caseDescription, 200),
    grievanceIndex: clampNumber(ai.grievanceIndex, 6, 1, 10),
    nickname: cleanText(ai.nickname, 20) || '오늘의원고',
    desiredVerdict: cleanText(ai.desiredVerdict, 100),
    judgeType,
    reception: cleanText(ai.reception, 500),
    investigation: cleanText(ai.investigation, 500),
    plaintiffArg: cleanText(ai.plaintiffArg, 500),
    defendantArg: cleanText(ai.defendantArg, 500),
    verdict: cleanText(ai.verdict, 900),
    sentence: oneSentence(ai.sentence),
  };

  const batch = db.batch();
  batch.set(caseRef, {
    userId: 'system-daily-ai',
    source: 'daily_ai',
    dailyDate: dateKey,
    caseTitle: data.caseTitle,
    caseDescription: data.caseDescription,
    grievanceIndex: data.grievanceIndex,
    nickname: data.nickname,
    desiredVerdict: data.desiredVerdict,
    selectedJudge: data.judgeType,
    judgeType: data.judgeType,
    status: 'completed',
    isPublic: true,
    reportCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    completedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  batch.set(resultRef, {
    source: 'daily_ai',
    dailyDate: dateKey,
    isPublic: true,
    caseTitle: data.caseTitle,
    grievanceIndex: data.grievanceIndex,
    judgeType: data.judgeType,
    reception: data.reception,
    investigation: data.investigation,
    plaintiffArg: data.plaintiffArg,
    defendantArg: data.defendantArg,
    verdict: data.verdict,
    sentence: data.sentence,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();
  return { created: true, caseId };
}

exports.createDailyAiCase = onSchedule({
  region: REGION,
  schedule: '0 9 * * *',
  timeZone: 'Asia/Seoul',
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB',
}, async () => {
  const result = await createDailyAiCase();
  console.log('daily ai case result:', result);
});
