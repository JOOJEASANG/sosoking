const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isAdminAuth } = require('./admin-utils');
const {
  JUDGMENT_SCHEMA_VERSION,
  cleanText,
  cleanParagraph,
  extractJson,
  normalizeJudgment,
  isCompleteJudgment,
} = require('./judgment-v2');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

function docketNumber(dateKey) {
  return `${dateKey.slice(0, 4)}오늘${dateKey.replace(/-/g, '').slice(4)}01`;
}

function fallbackContent(dateKey) {
  return {
    caseTitle: '냉장고 마지막 푸딩 실종 사건',
    headline: '마지막 푸딩 무단소멸 및 퇴근 후 행복권 침해 사건',
    caseDescription: `${dateKey} 저녁, 원고는 퇴근 후 먹으려고 아껴 둔 마지막 푸딩이 냉장고에서 사라진 사실을 발견하였다.`,
    grievanceIndex: 7,
    nickname: '오늘의억울인',
    desiredVerdict: '푸딩 재구매 및 숟가락 반성',
    judgeType: '드립형',
    judgment: {
      headline: '마지막 푸딩 무단소멸 및 퇴근 후 행복권 침해 사건',
      summary: '재판부는 마지막 푸딩이 단순한 간식이 아니라 퇴근 후 행복의 최종 보루였다고 보아 피고의 생활형 책임을 인정한다.',
      facts: '원고는 퇴근 후 냉장고에 보관한 마지막 푸딩을 먹을 예정이었다. 그러나 냉장고 문을 열었을 때 푸딩은 사라지고 빈자리만 남아 있었다. 원고는 푸딩 한 개의 가격보다 하루 종일 품었던 기대가 사라진 점에서 더 큰 억울함을 느꼈다고 진술하였다.',
      investigation: '생활증거 감식반은 냉장고 내부의 빈자리, 작은 숟가락의 침묵, 사건 직후 집안 공기의 미묘한 변화를 조사하였다. 수사팀은 마지막 푸딩을 발견했을 때 원고의 동공이 흔들린 시점을 0.1초 단위로 재구성하고, 공동 냉장고에서 마지막 하나를 먹기 전 확인할 의무가 있었는지를 집중 심리하였다.',
      prosecution: '검사는 피고가 마지막 푸딩이라는 사실을 확인하지 않은 채 원고의 퇴근 후 행복권을 침해하였다고 주장하였다. 특히 먹은 사실을 먼저 알리지 않고 냉장고에 빈자리만 남긴 행위는 원고의 기대를 기습적으로 붕괴시킨 중대한 생활질서 위반이라고 의견을 밝혔다.',
      defense: '변호인은 공동 냉장고에 있던 음식이므로 누구나 먹을 수 있었고 피고는 그것이 마지막 하나인지 몰랐다고 항변하였다. 다만 마지막 푸딩을 먹은 뒤 대체품을 준비하지 않은 점에 대해서는 피고도 다소 곤란한 표정을 지었다.',
      opinion: '재판부는 공동 냉장고의 음식이라고 하더라도 마지막 하나에는 일반적인 간식보다 무거운 확인 의무가 발생한다고 판단한다. 이 사건은 실제 법정에서 다룰 사안은 아니지만, 하루의 마지막 기대를 보호하기 위해서는 피고에게 구체적인 관계 회복 의무를 부과할 필요가 있다.',
      orders: [
        { number: 1, text: '피고는 원고에게 동일하거나 상위 등급의 푸딩 두 개를 제공하라.' },
        { number: 2, text: '피고는 앞으로 냉장고의 마지막 하나를 먹기 전 반드시 소유자를 확인하라.' },
        { number: 3, text: '피고는 빈 용기를 방치하지 말고 “마지막 하나의 무게를 몰랐다”고 엄숙하게 사과하라.' },
      ],
      closingComment: '푸딩은 작았지만 기다림의 무게는 작지 않았다.',
      legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
    },
  };
}

function normalizeDailyContent(value, dateKey) {
  const fallback = fallbackContent(dateKey);
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const judgeType = JUDGES.includes(source.judgeType) ? source.judgeType : fallback.judgeType;
  const judgment = normalizeJudgment(source.judgment, fallback.judgment);
  return {
    caseTitle: cleanText(source.caseTitle, 80) || fallback.caseTitle,
    headline: cleanText(source.headline, 160) || judgment.headline || fallback.headline,
    caseDescription: cleanParagraph(source.caseDescription, 700) || fallback.caseDescription,
    grievanceIndex: clampNumber(source.grievanceIndex, fallback.grievanceIndex, 1, 10),
    nickname: cleanText(source.nickname, 30) || fallback.nickname,
    desiredVerdict: cleanText(source.desiredVerdict, 180) || fallback.desiredVerdict,
    judgeType,
    judgment,
  };
}

function isCompleteResult(data = {}) {
  return Number(data.schemaVersion) === JUDGMENT_SCHEMA_VERSION
    && cleanText(data.caseTitle, 80).length >= 4
    && isCompleteJudgment(data.judgment);
}

async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}

async function buildDailyContent(dateKey, settings = {}) {
  const fallback = fallbackContent(dateKey);
  const key = geminiKey.value().trim();
  if (!key) return { data: normalizeDailyContent(fallback, dateKey), aiGenerated: false, attempted: false };

  const extra = [
    settings.dailyAiTopicHints && `주제 힌트: ${cleanText(settings.dailyAiTopicHints, 300)}`,
    settings.dailyAiPrompt && `추가 지시: ${cleanText(settings.dailyAiPrompt, 500)}`,
  ].filter(Boolean).join('\n');
  const prompt = `소소킹 판결소의 오늘의 공개 판결 한 건을 만든다. 안전하고 사소한 일상 소재만 사용한다. 실명, 연락처, 정치, 혐오, 성적 내용, 자해, 실제 범죄와 법률 조언은 금지한다. 사건은 작지만 재판부는 지나치게 엄숙해야 한다. 주문은 구체적인 생활형 처분 정확히 3개다. 실제 법적 효력이 없는 오락 콘텐츠라는 안내를 포함한다.
${extra}
날짜: ${dateKey}
판사 유형: ${JUDGES.join(', ')}

아래 형식의 JSON 객체 하나만 출력한다.
{
  "caseTitle": "짧은 사건명",
  "headline": "과도하게 거창한 공식 사건명",
  "caseDescription": "사건 입력 내용",
  "grievanceIndex": 1,
  "nickname": "가상 닉네임",
  "desiredVerdict": "희망 처분",
  "judgeType": "판사 유형 중 하나",
  "judgment": {
    "headline": "공식 사건명",
    "summary": "판결 핵심",
    "facts": "사건의 경위",
    "investigation": "과도하게 진지한 수사 과정",
    "prosecution": "검사의 주장",
    "defense": "변호인의 주장",
    "opinion": "재판부 판단",
    "orders": [
      {"number": 1, "text": "처분"},
      {"number": 2, "text": "처분"},
      {"number": 3, "text": "처분"}
    ],
    "closingComment": "마지막 한마디",
    "legalNotice": "오락 콘텐츠 안내"
  }
}`;

  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash',
      generationConfig: { temperature: 0.86, topP: 0.94, maxOutputTokens: 5000, responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
    const parsed = extractJson(result.response.text());
    const data = normalizeDailyContent(parsed, dateKey);
    if (!isCompleteJudgment(data.judgment)) throw new Error('Daily judgment did not satisfy the V2 contract');
    return { data, aiGenerated: true, attempted: true, usage: result.response.usageMetadata || {} };
  } catch (error) {
    console.error('daily V2 generation failed, using fallback:', error.message || error);
    return { data: normalizeDailyContent(fallback, dateKey), aiGenerated: false, attempted: true, usage: {} };
  }
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

  const generated = await buildDailyContent(dateKey, settings);
  const data = generated.data;
  const dailyDocket = docketNumber(dateKey);
  const batch = db.batch();

  batch.set(caseRef, {
    userId: 'system-daily-ai',
    source: 'daily_ai',
    dailyDate: dateKey,
    docketNumber: dailyDocket,
    courtName: '소소킹 판결소',
    courtroom: '제404호 황당법정',
    division: '제2소소재판부',
    courtStage: 'sentenced',
    caseTitle: data.caseTitle,
    caseDescription: data.caseDescription,
    grievanceIndex: data.grievanceIndex,
    nickname: data.nickname,
    desiredVerdict: data.desiredVerdict,
    selectedJudge: data.judgeType,
    judgeType: data.judgeType,
    resultSchemaVersion: JUDGMENT_SCHEMA_VERSION,
    status: 'completed',
    isPublic: true,
    reportCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(resultRef, {
    schemaVersion: JUDGMENT_SCHEMA_VERSION,
    resultVersion: 'judgment-v2',
    source: 'daily_ai',
    dailyDate: dateKey,
    userId: 'system-daily-ai',
    ownerId: 'system-daily-ai',
    isPublic: true,
    docketNumber: dailyDocket,
    courtName: '소소킹 판결소',
    courtroom: '제404호 황당법정',
    division: '제2소소재판부',
    caseTitle: data.caseTitle,
    headline: data.judgment.headline || data.headline,
    caseDescription: data.caseDescription,
    grievanceIndex: data.grievanceIndex,
    nickname: data.nickname,
    desiredVerdict: data.desiredVerdict,
    judgeType: data.judgeType,
    judgment: data.judgment,
    aiGenerated: generated.aiGenerated,
    generationMode: generated.aiGenerated ? 'daily-gemini-json-v2' : 'daily-local-json-v2',
    reactionTotal: 0,
    totalVotes: 0,
    commentCount: 0,
    courtStage: 'sentenced',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  await Promise.all([
    db.doc('site_settings/config').set({
      dailyAiLastRunAt: FieldValue.serverTimestamp(),
      dailyAiLastCaseId: caseId,
    }, { merge: true }),
    db.doc(`usage_stats/daily_${dateKey}`).set({
      date: dateKey,
      geminiRequests: FieldValue.increment(generated.attempted ? 1 : 0),
      geminiInputTokens: FieldValue.increment(Number(generated.usage?.promptTokenCount || 0)),
      geminiOutputTokens: FieldValue.increment(Number(generated.usage?.candidatesTokenCount || 0)),
      caseCount: FieldValue.increment(1),
      dailyAiCaseCount: FieldValue.increment(1),
      judgmentV2Count: FieldValue.increment(1),
      firestoreReads: FieldValue.increment(3),
      firestoreWrites: FieldValue.increment(3),
      functionInvocations: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);

  return {
    created: true,
    caseId,
    schemaVersion: JUDGMENT_SCHEMA_VERSION,
    aiGenerated: generated.aiGenerated,
    repaired: existing.exists && !isCompleteResult(existing.data()),
  };
}

exports.createDailyAiCase = onSchedule({
  region: REGION,
  schedule: '0 9 * * *',
  timeZone: 'Asia/Seoul',
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB',
}, async () => {
  console.log('daily AI V2 case result:', await createDailyAiCase(false));
});

exports.generateDailyAiNow = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB',
}, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  }
  return await createDailyAiCase(true);
});
