const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function oneSentence(text) {
  let s = cleanText(text, 80).replace(/["“”'`]/g, '').trim();
  if (!s) s = '피고는 하루 동안 간식을 눈으로만 먹는다.';
  if (!s.startsWith('피고는')) s = `피고는 ${s.replace(/^피고(인)?은?\s*/, '')}`;
  if (!s.endsWith('.')) s += '.';
  return s.length > 45 ? '피고는 하루 동안 과자를 눈으로만 먹는다.' : s;
}
function extractJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function docketNumber(dateKey) {
  return `소소${dateKey.replace(/-/g, '').slice(2)}-오늘의판결-0001`;
}
function isCompleteResult(data = {}) {
  return !!(
    cleanText(data.caseTitle, 30) &&
    cleanText(data.reception, 80) &&
    cleanText(data.investigation, 80) &&
    cleanText(data.plaintiffArg, 80) &&
    cleanText(data.defendantArg, 80) &&
    cleanText(data.verdict, 120) &&
    cleanText(data.sentence, 30)
  );
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}
function fallbackContent(dateKey) {
  return {
    caseTitle: '냉장고 마지막 푸딩 실종 사건',
    caseDescription: `${dateKey} 생활법정 기록에 따르면, 원고는 퇴근 후 마지막 푸딩을 기대했으나 냉장고에는 빈 자리만 남아 있었다.`,
    grievanceIndex: 7,
    nickname: '오늘의억울인',
    desiredVerdict: '푸딩 재구매 및 숟가락 반성',
    judgeType: '드립형',
    reception: '소소킹 판결소 제3생활부는 본 건을 냉장 보관 신뢰 붕괴 사안으로 접수한다. 본 접수는 오락 목적이며 실제 법적 효력은 없다.',
    investigation: '조사관은 냉장고 내부에서 빈 자리와 작은 숟가락의 침묵을 확인하였다. 해당 정황은 푸딩 기대권 침해의 간접자료로 기록된다.',
    plaintiffArg: '원고는 마지막 푸딩이 하루의 마지막 희망이었다고 주장한다. 특히 퇴근 후 숟가락을 들고 냉장고 앞에 선 행위는 명백한 섭취 의사의 표시라고 진술한다.',
    defendantArg: '피고 측은 해당 푸딩이 가족 공용 행복으로 오인될 여지가 있었다고 항변한다. 다만 빈 용기를 남긴 점에 대해서는 방어 논리가 다소 약하다.',
    verdict: '본 생활법정은 마지막 푸딩을 무단으로 소비한 행위가 원고의 퇴근 후 기대권을 침해했다고 판단한다. 다만 본 판결은 오락 목적이며 실제 법률상 효력은 없다.',
    sentence: '피고는 3일간 디저트를 먼저 제안한다.'
  };
}
async function buildDailyContent(dateKey, settings = {}) {
  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({ model: cleanText(settings.geminiModel, 50) || 'gemini-2.5-flash' });
    const extra = [settings.dailyAiTopicHints && `주제 힌트: ${settings.dailyAiTopicHints}`, settings.dailyAiPrompt && `추가 지시: ${settings.dailyAiPrompt}`].filter(Boolean).join('\n');
    const prompt = `소소킹 판결소 게시판에 올릴 오늘의 생활형 AI 사건 1개를 만든다. 사소하고 안전한 일상 소재만 사용한다. 실명, 연락처, 정치, 혐오, 성적 내용, 자해, 실제 범죄 묘사는 금지한다. 사건은 아무것도 아닌데 재판부가 지나치게 엄숙하고 게임처럼 과몰입해서 판결하는 톤으로 작성한다. 반드시 모든 필드를 빈 값 없이 채운다. 출력은 JSON만 한다.\n${extra}\n필드: caseTitle, caseDescription, grievanceIndex, nickname, desiredVerdict, judgeType, reception, investigation, plaintiffArg, defendantArg, verdict, sentence. 판사 유형: ${JUDGES.join(', ')}. 날짜키: ${dateKey}`;
    const result = await model.generateContent(prompt);
    return extractJson(result.response.text());
  } catch (err) {
    console.error('daily AI generation failed, using fallback:', err);
    return fallbackContent(dateKey);
  }
}
function normalizeDailyContent(ai, dateKey) {
  const fb = fallbackContent(dateKey);
  const judgeType = JUDGES.includes(ai?.judgeType) ? ai.judgeType : fb.judgeType;
  return {
    caseTitle: cleanText(ai?.caseTitle, 30) || fb.caseTitle,
    caseDescription: cleanText(ai?.caseDescription, 200) || fb.caseDescription,
    grievanceIndex: clampNumber(ai?.grievanceIndex, fb.grievanceIndex, 1, 10),
    nickname: cleanText(ai?.nickname, 20) || fb.nickname,
    desiredVerdict: cleanText(ai?.desiredVerdict, 100) || fb.desiredVerdict,
    judgeType,
    reception: cleanText(ai?.reception, 500) || fb.reception,
    investigation: cleanText(ai?.investigation, 500) || fb.investigation,
    plaintiffArg: cleanText(ai?.plaintiffArg, 500) || fb.plaintiffArg,
    defendantArg: cleanText(ai?.defendantArg, 500) || fb.defendantArg,
    verdict: cleanText(ai?.verdict, 900) || fb.verdict,
    sentence: oneSentence(ai?.sentence || fb.sentence),
  };
}

async function createDailyAiCase(force = false) {
  const settings = await loadSettings();
  if (!force && settings.dailyAiEnabled === false) return { created: false, disabled: true };

  const dateKey = kstDateKey();
  const caseId = `daily_${dateKey.replace(/-/g, '')}`;
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const existing = await resultRef.get();

  if (existing.exists && !force && isCompleteResult(existing.data())) {
    return { created: false, caseId, skipped: 'already-complete' };
  }

  const ai = await buildDailyContent(dateKey, settings);
  const data = normalizeDailyContent(ai, dateKey);
  const dailyDocket = docketNumber(dateKey);

  const batch = db.batch();
  batch.set(caseRef, {
    userId: 'system-daily-ai', source: 'daily_ai', dailyDate: dateKey, docketNumber: dailyDocket,
    courtName: '소소킹 판결소', courtroom: '제404호 생활법정', division: '제3생활부', courtStage: 'sentenced',
    caseTitle: data.caseTitle, caseDescription: data.caseDescription, grievanceIndex: data.grievanceIndex,
    nickname: data.nickname, desiredVerdict: data.desiredVerdict, selectedJudge: data.judgeType, judgeType: data.judgeType,
    status: 'completed', isPublic: true, reportCount: 0,
    createdAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(resultRef, {
    source: 'daily_ai', dailyDate: dateKey, docketNumber: dailyDocket, isPublic: true,
    caseTitle: data.caseTitle, caseDescription: data.caseDescription, grievanceIndex: data.grievanceIndex,
    nickname: data.nickname, desiredVerdict: data.desiredVerdict, judgeType: data.judgeType,
    reception: data.reception, investigation: data.investigation, plaintiffArg: data.plaintiffArg,
    defendantArg: data.defendantArg, verdict: data.verdict, sentence: data.sentence,
    courtStage: 'sentenced', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
  await db.doc('site_settings/config').set({ dailyAiLastRunAt: FieldValue.serverTimestamp(), dailyAiLastCaseId: caseId }, { merge: true });
  return { created: true, caseId, repaired: existing.exists && !isCompleteResult(existing.data()) };
}

exports.createDailyAiCase = onSchedule({ region: REGION, schedule: '0 9 * * *', timeZone: 'Asia/Seoul', secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async () => {
  console.log('daily ai case result:', await createDailyAiCase(false));
});
exports.generateDailyAiNow = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth || !(await isAdminAuth(request.auth))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  return await createDailyAiCase(true);
});
