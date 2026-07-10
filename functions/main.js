const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const CATEGORY_IDS = new Set(['food', 'late', 'relationship', 'family', 'work', 'digital', 'other']);
const JUDGE_TYPES = new Set(['드립형', '과몰입형', '논리집착형']);
const DAILY_CASE_LIMIT = 20;
const CASE_COOLDOWN_MS = 30 * 1000;

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanParagraph(value, maxLength) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function koreaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function requireUser(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', '로그인 후 이용해 주세요.');
  }
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

  return {
    title,
    description,
    defendantName,
    category,
    judgeType,
    desiredVerdict,
    grievanceIndex,
    isPublic,
  };
}

exports.systemHealth = onCall({
  region: REGION,
  secrets: [geminiKey],
  cors: true,
}, async request => {
  requireUser(request);
  return {
    ok: true,
    service: 'sosoking-stage1',
    geminiConfigured: Boolean(geminiKey.value().trim()),
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

    if (dailyCount >= DAILY_CASE_LIMIT) {
      throw new HttpsError('resource-exhausted', '오늘 접수 가능한 사건 수를 모두 사용했습니다.');
    }
    if (Date.now() - lastCreatedAt < CASE_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', '중복 접수를 막기 위해 잠시 후 다시 시도해 주세요.');
    }

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
  return {
    caseId: caseRef.id,
    status: 'received',
    nextStage: 'ai-judgment-engine',
  };
});
