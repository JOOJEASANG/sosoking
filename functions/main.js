const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { cleanText, cleanParagraph, buildCaseAnalysis } = require('./case-analysis');
const { normalizeJudgment, parseJudgmentJson, evaluateJudgment, isCompleteJudgment } = require('./judgment-contract');
const { buildFallbackJudgment, buildJudgmentPrompt } = require('./judgment-writer');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = 'asia-northeast3';
const MODEL_NAME = 'gemini-2.5-flash';
const geminiKey = defineSecret('GEMINI_API_KEY');
const CATEGORY_IDS = new Set(['food', 'late', 'relationship', 'family', 'work', 'digital', 'other']);
const JUDGE_TYPES = new Set(['드립형', '과몰입형', '논리집착형']);
const DAILY_CASE_LIMIT = 20;
const CASE_COOLDOWN_MS = 30 * 1000;
const GENERATION_LOCK_MS = 3 * 60 * 1000;

function koreaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인 후 이용해 주세요.');
  return request.auth;
}

function validateCasePayload(raw = {}) {
  const title = cleanText(raw.title, 70);
  const description = cleanParagraph(raw.description, 1500);
  const defendantName = cleanText(raw.defendantName, 40);
  const category = cleanText(raw.category, 20) || 'other';
  const judgeType = cleanText(raw.judgeType, 20) || '드립형';
  const desiredVerdict = cleanParagraph(raw.desiredVerdict, 240);
  const grievanceIndex = Number(raw.grievanceIndex);
  const isPublic = raw.isPublic === true;

  if (title.length < 4) throw new HttpsError('invalid-argument', '사건 제목은 4자 이상 입력해 주세요.');
  if (description.length < 30) throw new HttpsError('invalid-argument', '사건 내용은 30자 이상 입력해 주세요.');
  if (!CATEGORY_IDS.has(category)) throw new HttpsError('invalid-argument', '지원하지 않는 사건 분류입니다.');
  if (!JUDGE_TYPES.has(judgeType)) throw new HttpsError('invalid-argument', '지원하지 않는 판사 성향입니다.');
  if (!Number.isInteger(grievanceIndex) || grievanceIndex < 1 || grievanceIndex > 10) {
    throw new HttpsError('invalid-argument', '억울함 정도는 1에서 10 사이여야 합니다.');
  }
  return { title, description, defendantName, category, judgeType, desiredVerdict, grievanceIndex, isPublic };
}

function usageFromResponse(response) {
  const meta = response?.usageMetadata || {};
  return {
    promptTokens: Number(meta.promptTokenCount || 0),
    outputTokens: Number(meta.candidatesTokenCount || 0),
    totalTokens: Number(meta.totalTokenCount || 0),
  };
}

function addUsage(left, right) {
  return {
    promptTokens: Number(left?.promptTokens || 0) + Number(right?.promptTokens || 0),
    outputTokens: Number(left?.outputTokens || 0) + Number(right?.outputTokens || 0),
    totalTokens: Number(left?.totalTokens || 0) + Number(right?.totalTokens || 0),
  };
}

async function generateJudgmentWithFallback(caseData, analysis, apiKey) {
  const fallback = buildFallbackJudgment(caseData, analysis);
  const fallbackQuality = evaluateJudgment(fallback, analysis);
  if (!apiKey) {
    return { judgment: fallback, quality: fallbackQuality, generationMode: 'local-no-key', aiAttempts: 0, usage: addUsage() };
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.92,
      topP: 0.95,
      maxOutputTokens: 4200,
      responseMimeType: 'application/json',
    },
  });

  let evaluation = null;
  let usage = addUsage();
  let attempts = 0;
  for (let index = 0; index < 2; index += 1) {
    attempts += 1;
    try {
      const prompt = buildJudgmentPrompt(caseData, analysis, evaluation);
      const result = await model.generateContent(prompt);
      usage = addUsage(usage, usageFromResponse(result.response));
      const parsed = parseJudgmentJson(result.response.text());
      const judgment = normalizeJudgment(parsed, fallback);
      evaluation = evaluateJudgment(judgment, analysis);
      if (evaluation.passed) {
        return { judgment, quality: evaluation, generationMode: 'gemini', aiAttempts: attempts, usage };
      }
    } catch (error) {
      logger.warn('Gemini judgment attempt failed', { attempt: attempts, message: error?.message });
      evaluation = { passed: false, parseOrApiFailure: true };
    }
  }

  return { judgment: fallback, quality: fallbackQuality, generationMode: 'local-quality-fallback', aiAttempts: attempts, usage };
}

exports.systemHealth = onCall({ region: REGION, secrets: [geminiKey], cors: true }, async request => {
  requireUser(request);
  return {
    ok: true,
    service: 'sosoking-stage2',
    geminiConfigured: Boolean(geminiKey.value().trim()),
    model: MODEL_NAME,
    timestamp: new Date().toISOString(),
  };
});

exports.createCaseDraft = onCall({ region: REGION, cors: true }, async request => {
  const auth = requireUser(request);
  const input = validateCasePayload(request.data);
  const now = admin.firestore.Timestamp.now();
  const dayKey = koreaDayKey(now.toDate());
  const caseRef = db.collection('cases').doc();
  const limitRef = db.collection('rate_limits').doc(auth.uid);

  await db.runTransaction(async transaction => {
    const limitSnap = await transaction.get(limitRef);
    const limit = limitSnap.exists ? limitSnap.data() : {};
    const sameDay = limit.dayKey === dayKey;
    const dailyCount = sameDay ? Number(limit.dailyCount || 0) : 0;
    const lastCreatedAt = limit.lastCreatedAt?.toMillis?.() || 0;

    if (dailyCount >= DAILY_CASE_LIMIT) throw new HttpsError('resource-exhausted', '오늘 접수 가능한 사건 수를 모두 사용했습니다.');
    if (Date.now() - lastCreatedAt < CASE_COOLDOWN_MS) throw new HttpsError('resource-exhausted', '중복 접수를 막기 위해 잠시 후 다시 시도해 주세요.');

    transaction.set(caseRef, {
      schemaVersion: 1,
      userId: auth.uid,
      userEmail: cleanText(auth.token?.email, 160),
      userDisplayName: cleanText(auth.token?.name, 60),
      title: input.title,
      caseDescription: input.description,
      defendantName: input.defendantName || '피고 미지정',
      category: input.category,
      judgeType: input.judgeType,
      grievanceIndex: input.grievanceIndex,
      desiredVerdict: input.desiredVerdict,
      isPublic: input.isPublic,
      status: 'received',
      generationStatus: 'not_started',
      createdAt: now,
      updatedAt: now,
    });

    transaction.set(limitRef, {
      userId: auth.uid,
      dayKey,
      dailyCount: dailyCount + 1,
      lastCreatedAt: now,
      updatedAt: now,
    }, { merge: true });
  });

  logger.info('Case draft created', { caseId: caseRef.id, userId: auth.uid, category: input.category });
  return { caseId: caseRef.id, status: 'received', nextStage: 'ai-judgment-engine' };
});

exports.generateJudgment = onCall({
  region: REGION,
  secrets: [geminiKey],
  cors: true,
  timeoutSeconds: 120,
  memory: '512MiB',
  maxInstances: 10,
}, async request => {
  const auth = requireUser(request);
  const caseId = cleanText(request.data?.caseId, 80);
  if (!caseId) throw new HttpsError('invalid-argument', '사건 번호가 필요합니다.');

  const caseRef = db.collection('cases').doc(caseId);
  const resultRef = db.collection('results').doc(caseId);
  const now = admin.firestore.Timestamp.now();

  const reserved = await db.runTransaction(async transaction => {
    const caseSnap = await transaction.get(caseRef);
    if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const caseData = caseSnap.data();
    if (caseData.userId !== auth.uid) throw new HttpsError('permission-denied', '본인 사건만 심리할 수 있습니다.');

    const resultSnap = await transaction.get(resultRef);
    if (resultSnap.exists && isCompleteJudgment(resultSnap.data()?.judgment)) {
      return { existing: true, caseData, resultData: resultSnap.data() };
    }

    const startedAt = caseData.generationStartedAt?.toMillis?.() || 0;
    if (caseData.generationStatus === 'processing' && Date.now() - startedAt < GENERATION_LOCK_MS) {
      throw new HttpsError('aborted', '이미 AI 재판부가 이 사건을 심리 중입니다.');
    }

    transaction.update(caseRef, {
      generationStatus: 'processing',
      generationStartedAt: now,
      updatedAt: now,
    });
    return { existing: false, caseData };
  });

  if (reserved.existing) {
    return {
      caseId,
      judgment: reserved.resultData.judgment,
      caseAnalysis: reserved.resultData.caseAnalysis,
      generationMode: reserved.resultData.generationMode,
      quality: reserved.resultData.quality,
      reused: true,
    };
  }

  try {
    const caseData = reserved.caseData;
    const analysis = buildCaseAnalysis(caseData);
    const generated = await generateJudgmentWithFallback(caseData, analysis, geminiKey.value().trim());
    const completedAt = admin.firestore.Timestamp.now();
    const resultData = {
      schemaVersion: 2,
      caseId,
      userId: auth.uid,
      isPublic: caseData.isPublic === true,
      caseTitle: caseData.title,
      caseDescription: caseData.caseDescription,
      defendantName: caseData.defendantName,
      category: caseData.category,
      judgeType: caseData.judgeType,
      grievanceIndex: caseData.grievanceIndex,
      desiredVerdict: caseData.desiredVerdict,
      caseAnalysis: analysis,
      judgment: generated.judgment,
      generationMode: generated.generationMode,
      model: generated.generationMode === 'gemini' ? MODEL_NAME : null,
      aiAttempts: generated.aiAttempts,
      usage: generated.usage,
      quality: generated.quality,
      createdAt: completedAt,
      updatedAt: completedAt,
    };

    const batch = db.batch();
    batch.set(resultRef, resultData);
    batch.update(caseRef, {
      status: 'judged',
      generationStatus: 'completed',
      resultId: caseId,
      generationCompletedAt: completedAt,
      updatedAt: completedAt,
    });
    await batch.commit();

    logger.info('Judgment completed', {
      caseId,
      userId: auth.uid,
      mode: generated.generationMode,
      attempts: generated.aiAttempts,
      passed: generated.quality?.passed,
    });

    return {
      caseId,
      judgment: generated.judgment,
      caseAnalysis: analysis,
      generationMode: generated.generationMode,
      quality: generated.quality,
      reused: false,
    };
  } catch (error) {
    await caseRef.update({
      generationStatus: 'failed',
      generationError: cleanText(error?.message, 240),
      updatedAt: admin.firestore.Timestamp.now(),
    }).catch(() => null);
    if (error instanceof HttpsError) throw error;
    logger.error('Judgment generation failed', { caseId, userId: auth.uid, message: error?.message });
    throw new HttpsError('internal', 'AI 판결 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }
});
