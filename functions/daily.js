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
function cleanLong(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen);
}
function cleanList(value, fallback = [], maxItems = 6, maxLen = 150) {
  const source = Array.isArray(value) ? value : [];
  const rows = source.map(v => cleanText(v, maxLen)).filter(Boolean).slice(0, maxItems);
  return rows.length ? rows : fallback;
}
function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function oneSentence(text) {
  let s = cleanText(text, 120).replace(/["“”'`]/g, '').trim();
  if (!s) s = '피고는 하루 동안 간식을 눈으로만 먹는다.';
  if (!s.startsWith('피고는')) s = `피고는 ${s.replace(/^피고(인)?은?\s*/, '')}`;
  if (!s.endsWith('.')) s += '.';
  return s;
}
function extractJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function docketNumber(dateKey) {
  return `${dateKey.slice(0, 4)}황당-오늘-${dateKey.replace(/-/g, '').slice(4)}-0001`;
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
    absurdityTitle: '마지막 푸딩 무단증발 황당재판 기록',
    caseDescription: `${dateKey} 황당재판 기록에 따르면, 원고는 퇴근 후 마지막 푸딩을 기대했으나 냉장고에는 빈 자리만 남아 있었다.`,
    grievanceIndex: 7,
    nickname: '오늘의억울인',
    desiredVerdict: '푸딩 재구매 및 숟가락 반성',
    judgeType: '드립형',
    reception: '본 황당사건은 냉장고 안 마지막 푸딩이 사라진 사안으로 접수되었다. 일반적인 가정에서는 그냥 한숨 쉬고 넘어갈 수 있으나, 원고의 퇴근 후 행복권이 정면으로 흔들렸다는 점에서 재판부는 이를 가볍게 볼 수 없다고 판단하였다. 이에 사건은 제404호 황당법정에 배당되었다.',
    absurdityReview: '재판부는 이 사안을 두고 정말 재판까지 해야 하는지 잠시 고민하였다. 그러나 마지막 푸딩은 단순한 유제품이 아니라 하루의 마지막 희망일 수 있다. 본 법정은 바로 그런 지나치게 사소하지만 마음에는 오래 남는 사건을 다룬다. 따라서 본 사건은 황당재판 대상으로 충분하다.',
    keyIssues: ['마지막 푸딩의 소유권이 누구에게 있었는지 여부', '피고가 마지막이라는 사실을 알았는지 여부', '빈 용기를 남긴 행위가 추가 서운함을 유발했는지 여부', '푸딩 1개의 상징적 가치가 어느 정도인지 여부'],
    evidenceList: ['냉장고 안 빈자리', '작은 숟가락의 수상한 침묵', '원고의 퇴근 후 기대감 붕괴 정황', '집안 공기가 갑자기 차가워진 사정'],
    investigation: '억울함 분석관은 냉장고 내부의 빈자리와 원고의 허탈한 시선을 종합 검토하였다. 푸딩은 물리적으로 작지만 심리적 부피가 상당한 간식이다. 특히 마지막 푸딩이라는 점은 사건의 황당성을 크게 높인다. 피고가 이를 몰랐다고 하더라도 최소한의 냉장고 예절 위반 가능성은 남는다.',
    plaintiffArg: '원고는 마지막 푸딩을 하루의 보상으로 기대하고 있었다고 주장한다. 원고는 피고가 푸딩을 먹은 사실 자체보다 아무렇지 않게 사라졌다는 점에서 더 큰 허탈감을 느꼈다고 진술한다. 원고는 푸딩 재구매와 상징적 사과를 요구한다.',
    defendantArg: '피고 측은 해당 푸딩이 공동 냉장고에 있었으므로 누구나 먹을 수 있었다고 항변할 가능성이 있다. 그러나 재판부는 마지막 하나라는 사정이 있었을 경우, 적어도 먹기 전 확인 의무가 있었다고 본다. 특히 빈 용기 처리 여부는 피고 측 항변의 신빙성에 불리하게 작용한다.',
    courtOpinion: '재판부는 마지막 푸딩이 단순한 간식이 아니라 퇴근 후 인간이 냉장고 문을 열며 기대할 수 있는 작은 존엄이라고 판단한다. 피고가 이를 무단으로 섭취하였다면, 그 행위는 법적으로는 아무 일도 아닐 수 있으나 마음속으로는 꽤 큰 일이다. 본 사건이 실제 법정에 갈 일은 아니지만, 황당재판소에서는 충분히 다룰 가치가 있다. 따라서 재판부는 원고의 억울함을 상당 부분 인정한다.',
    verdict: '본 황당재판부는 원고의 청구를 일부 인용한다. 피고는 마지막 푸딩의 상징성을 가볍게 본 책임이 있다. 다만 본 판결은 오락 목적의 AI 콘텐츠이며 실제 법적 효력은 없다. 그럼에도 마음속 냉장고 질서 회복에는 일정한 도움이 될 수 있다.',
    sentence: '피고는 원고에게 동일 또는 상위 등급의 푸딩 2개를 제공한다.\n피고는 향후 7일간 냉장고의 마지막 1개 남은 음식에 접근하기 전 반드시 허가를 구한다.\n피고는 원고 앞에서 “마지막 하나의 무게를 몰랐다”고 1회 진술한다.\n피고는 빈 용기를 남기는 행위를 금지한다.',
    executionOrder: '본 처분은 선고 즉시 마음속으로 집행된다. 푸딩 배상은 가능한 빠른 시일 내 평화롭게 이행한다.',
    appealNotice: '본 판결에 불복하는 자는 마음속으로 3분 이내 항소할 수 있다. 다만 항소심에서는 평소 냉장고 사용 습관까지 추가 심리될 수 있다.',
    closingComment: '마지막 푸딩은 작았지만, 재판은 작지 않았다.'
  };
}
async function buildDailyContent(dateKey, settings = {}) {
  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({ model: cleanText(settings.geminiModel, 50) || 'gemini-2.5-flash' });
    const extra = [settings.dailyAiTopicHints && `주제 힌트: ${settings.dailyAiTopicHints}`, settings.dailyAiPrompt && `추가 지시: ${settings.dailyAiPrompt}`].filter(Boolean).join('\n');
    const prompt = `소소킹 황당재판소 공개 기록에 올릴 오늘의 황당사건 1개를 만든다. 사소하고 안전한 일상 소재만 사용한다. 실명, 연락처, 정치, 혐오, 성적 내용, 자해, 실제 범죄 묘사는 금지한다. 사건은 아무것도 아닌데 재판부가 지나치게 엄숙하고 과몰입해서 판결하는 톤으로 작성한다. 출력은 JSON만 한다.\n${extra}\n필드: caseTitle, absurdityTitle, caseDescription, grievanceIndex, nickname, desiredVerdict, judgeType, reception, absurdityReview, keyIssues, evidenceList, investigation, plaintiffArg, defendantArg, courtOpinion, verdict, sentence, executionOrder, appealNotice, closingComment. keyIssues와 evidenceList는 배열. sentence는 줄바꿈으로 3개 이상 처분. 판사 유형: ${JUDGES.join(', ')}. 날짜키: ${dateKey}`;
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
    caseTitle: cleanText(ai?.caseTitle, 40) || fb.caseTitle,
    absurdityTitle: cleanText(ai?.absurdityTitle, 80) || fb.absurdityTitle,
    caseDescription: cleanText(ai?.caseDescription, 320) || fb.caseDescription,
    grievanceIndex: clampNumber(ai?.grievanceIndex, fb.grievanceIndex, 1, 10),
    nickname: cleanText(ai?.nickname, 20) || fb.nickname,
    desiredVerdict: cleanText(ai?.desiredVerdict, 160) || fb.desiredVerdict,
    judgeType,
    reception: cleanLong(ai?.reception, 1200) || fb.reception,
    absurdityReview: cleanLong(ai?.absurdityReview, 1200) || fb.absurdityReview,
    keyIssues: cleanList(ai?.keyIssues, fb.keyIssues, 6, 180),
    evidenceList: cleanList(ai?.evidenceList, fb.evidenceList, 7, 180),
    investigation: cleanLong(ai?.investigation, 1400) || fb.investigation,
    plaintiffArg: cleanLong(ai?.plaintiffArg, 1200) || fb.plaintiffArg,
    defendantArg: cleanLong(ai?.defendantArg, 1200) || fb.defendantArg,
    courtOpinion: cleanLong(ai?.courtOpinion, 1800) || fb.courtOpinion,
    verdict: cleanLong(ai?.verdict, 1500) || fb.verdict,
    sentence: cleanLong(ai?.sentence, 1200) || oneSentence(fb.sentence),
    executionOrder: cleanLong(ai?.executionOrder, 800) || fb.executionOrder,
    appealNotice: cleanLong(ai?.appealNotice, 700) || fb.appealNotice,
    closingComment: cleanText(ai?.closingComment, 160) || fb.closingComment,
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
    courtName: '소소킹 황당재판소', courtroom: '제404호 황당법정', division: '제3황당재판부', courtStage: 'sentenced',
    caseTitle: data.caseTitle, caseDescription: data.caseDescription, grievanceIndex: data.grievanceIndex,
    nickname: data.nickname, desiredVerdict: data.desiredVerdict, selectedJudge: data.judgeType, judgeType: data.judgeType,
    status: 'completed', isPublic: true, reportCount: 0,
    createdAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(resultRef, {
    source: 'daily_ai', dailyDate: dateKey, docketNumber: dailyDocket, isPublic: true,
    courtName: '소소킹 황당재판소', courtroom: '제404호 황당법정', division: '제3황당재판부',
    caseTitle: data.caseTitle, absurdityTitle: data.absurdityTitle, caseDescription: data.caseDescription, grievanceIndex: data.grievanceIndex,
    nickname: data.nickname, desiredVerdict: data.desiredVerdict, judgeType: data.judgeType,
    reception: data.reception, absurdityReview: data.absurdityReview, keyIssues: data.keyIssues, evidenceList: data.evidenceList,
    investigation: data.investigation, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion,
    verdict: data.verdict, sentence: data.sentence, executionOrder: data.executionOrder, appealNotice: data.appealNotice, closingComment: data.closingComment,
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
