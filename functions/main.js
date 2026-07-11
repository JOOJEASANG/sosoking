const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { cleanText, cleanParagraph } = require('./case-analysis');
const {
  ROLE_TRIAL_VERSION,
  MODEL_NAME,
  makeDocketNumber,
  assignCourt,
  isCompleteRoleTrial,
  generateRoleBasedTrial,
} = require('./role-based-trial');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const CATEGORY_IDS = new Set(['food', 'late', 'relationship', 'family', 'work', 'digital', 'other']);
const JUDGE_TYPES = new Set(['드립형', '과몰입형', '논리집착형']);
const DAILY_CASE_LIMIT = 20;
const CASE_COOLDOWN_MS = 30 * 1000;
const GENERATION_LOCK_MS = 5 * 60 * 1000;

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

exports.systemHealth = onCall({ region: REGION, secrets: [geminiKey], cors: true }, async request => {
  requireUser(request);
  return {
    ok: true,
    service: 'sosoking-role-based-trial',
    geminiConfigured: Boolean(geminiKey.value().trim()),
    model: MODEL_NAME,
    pipeline: ROLE_TRIAL_VERSION,
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
  const docketNumber = makeDocketNumber(caseRef.id, now.toDate());

  await db.runTransaction(async transaction => {
    const limitSnap = await transaction.get(limitRef);
    const limit = limitSnap.exists ? limitSnap.data() : {};
    const sameDay = limit.dayKey === dayKey;
    const dailyCount = sameDay ? Number(limit.dailyCount || 0) : 0;
    const lastCreatedAt = limit.lastCreatedAt?.toMillis?.() || 0;

    if (dailyCount >= DAILY_CASE_LIMIT) throw new HttpsError('resource-exhausted', '오늘 접수 가능한 사건 수를 모두 사용했습니다.');
    if (Date.now() - lastCreatedAt < CASE_COOLDOWN_MS) throw new HttpsError('resource-exhausted', '중복 접수를 막기 위해 잠시 후 다시 시도해 주세요.');

    transaction.set(caseRef, {
      schemaVersion: 2,
      userId: auth.uid,
      userEmail: cleanText(auth.token?.email, 160),
      userDisplayName: cleanText(auth.token?.name, 60),
      docketNumber,
      title: input.title,
      caseDescription: input.description,
      defendantName: input.defendantName || '피고 미지정',
      category: input.category,
      judgeType: input.judgeType,
      grievanceIndex: input.grievanceIndex,
      desiredVerdict: input.desiredVerdict,
      isPublic: input.isPublic,
      status: 'received',
      courtStage: 'filed',
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

  logger.info('Case draft created', { caseId: caseRef.id, docketNumber, userId: auth.uid, category: input.category });
  return { caseId: caseRef.id, docketNumber, status: 'received', nextStage: ROLE_TRIAL_VERSION };
});

exports.generateJudgment = onCall({
  region: REGION,
  secrets: [geminiKey],
  cors: true,
  timeoutSeconds: 300,
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
    if (resultSnap.exists && resultSnap.data()?.resultVersion === ROLE_TRIAL_VERSION && isCompleteRoleTrial(resultSnap.data()?.trialRecord)) {
      return { existing: true, caseData, resultData: resultSnap.data() };
    }

    const startedAt = caseData.generationStartedAt?.toMillis?.() || 0;
    if (caseData.generationStatus === 'processing' && Date.now() - startedAt < GENERATION_LOCK_MS) {
      throw new HttpsError('aborted', '수사관과 재판부가 이미 이 사건을 처리 중입니다.');
    }

    const docketNumber = caseData.docketNumber || makeDocketNumber(caseId);
    const court = assignCourt(caseData, caseId);
    transaction.update(caseRef, {
      docketNumber,
      ...court,
      status: 'processing',
      courtStage: 'investigation',
      generationStatus: 'processing',
      generationStartedAt: now,
      updatedAt: now,
    });
    return { existing: false, caseData: { ...caseData, docketNumber } };
  });

  if (reserved.existing) {
    return {
      caseId,
      docketNumber: reserved.resultData.docketNumber,
      trialRecord: reserved.resultData.trialRecord,
      judgment: reserved.resultData.judgment,
      caseAnalysis: reserved.resultData.caseAnalysis,
      generationMode: reserved.resultData.generationMode,
      quality: reserved.resultData.quality,
      reused: true,
    };
  }

  try {
    const caseData = reserved.caseData;
    const generated = await generateRoleBasedTrial({
      caseData,
      caseId,
      apiKey: geminiKey.value().trim(),
    });
    const completedAt = admin.firestore.Timestamp.now();
    const trial = generated.trialRecord;
    const resultData = {
      schemaVersion: 4,
      resultVersion: ROLE_TRIAL_VERSION,
      caseId,
      userId: auth.uid,
      isPublic: caseData.isPublic === true,
      docketNumber: trial.docketNumber,
      courtName: trial.courtName,
      courtroom: trial.courtroom,
      division: trial.division,
      recordClerk: trial.recordClerk,
      analystName: trial.analystName,
      prosecutorName: trial.prosecutorName,
      defenderName: trial.defenderName,
      caseTitle: caseData.title,
      caseDescription: caseData.caseDescription,
      defendantName: caseData.defendantName,
      category: caseData.category,
      judgeType: trial.judgeType,
      grievanceIndex: caseData.grievanceIndex,
      desiredVerdict: caseData.desiredVerdict,
      caseAnalysis: generated.caseAnalysis,
      trialRecord: trial,
      reception: trial.expandedCase,
      caseTimeline: trial.caseTimeline,
      forensicReport: trial.forensicReport,
      evidenceBits: trial.evidenceBits,
      plaintiffArg: trial.plaintiffArg,
      defendantArg: trial.defendantArg,
      courtOpinion: trial.courtOpinion,
      sentence: trial.sentence,
      closingComment: trial.closingComment,
      absurdDetails: trial.absurdDetails,
      defendantExcuses: trial.defendantExcuses,
      penaltyIdeas: trial.penaltyIdeas,
      judgment: generated.judgment,
      generationMode: generated.generationMode,
      model: generated.generationMode.startsWith('gemini') ? MODEL_NAME : null,
      aiAttempts: generated.aiAttempts,
      usage: generated.usage,
      quality: generated.quality,
      reactionCount: 0,
      commentCount: 0,
      moderationStatus: 'clear',
      courtStage: 'sentenced',
      createdAt: completedAt,
      updatedAt: completedAt,
    };

    const batch = db.batch();
    batch.set(resultRef, resultData);
    batch.update(caseRef, {
      status: 'judged',
      courtStage: 'sentenced',
      generationStatus: 'completed',
      resultId: caseId,
      resultVersion: ROLE_TRIAL_VERSION,
      docketNumber: trial.docketNumber,
      courtName: trial.courtName,
      courtroom: trial.courtroom,
      division: trial.division,
      recordClerk: trial.recordClerk,
      analystName: trial.analystName,
      prosecutorName: trial.prosecutorName,
      defenderName: trial.defenderName,
      generationCompletedAt: completedAt,
      updatedAt: completedAt,
    });
    await batch.commit();

    logger.info('Role-based trial completed', {
      caseId,
      docketNumber: trial.docketNumber,
      userId: auth.uid,
      mode: generated.generationMode,
      attempts: generated.aiAttempts,
      passed: generated.quality?.passed,
    });

    return {
      caseId,
      docketNumber: trial.docketNumber,
      trialRecord: trial,
      judgment: generated.judgment,
      caseAnalysis: generated.caseAnalysis,
      generationMode: generated.generationMode,
      quality: generated.quality,
      reused: false,
    };
  } catch (error) {
    await caseRef.update({
      status: 'received',
      courtStage: 'filed',
      generationStatus: 'failed',
      generationError: cleanText(error?.message, 240),
      updatedAt: admin.firestore.Timestamp.now(),
    }).catch(() => null);
    if (error instanceof HttpsError) throw error;
    logger.error('Role-based trial generation failed', { caseId, userId: auth.uid, message: error?.message });
    throw new HttpsError('internal', '황당재판 기록 작성 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }
});
