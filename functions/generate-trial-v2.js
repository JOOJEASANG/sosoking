const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  JUDGMENT_SCHEMA_VERSION,
  cleanText,
  cleanParagraph,
  extractJson,
  normalizeJudgment,
  isCompleteJudgment,
} = require('./judgment-v2');
const {
  buildCaseProfile,
  buildStoryPrompt,
  buildStoryFallback,
  evaluateStorySpecificity,
  buildRewriteInstruction,
} = require('./judgment-story-v2');
const { requireVerifiedUser, validDocumentId } = require('./security-utils');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const STORY_VERSION = 'case-story-v1';

const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CATEGORY_RULES = [
  { id: 'food', label: '음식·식탐', keys: ['먹', '음식', '밥', '라면', '치킨', '커피', '빵', '과자', '아이스크림', '간식', '배달', '만두', '푸딩'], grand: '식생활질서 및 최후섭취권 침해 사건' },
  { id: 'late', label: '약속·지각', keys: ['늦', '지각', '약속', '기다', '시간', '연락 없이', '출발'], grand: '시공간질서 왜곡 및 약속신뢰 붕괴 사건' },
  { id: 'love', label: '연인·관계', keys: ['남친', '여친', '애인', '연인', '데이트', '기념일', '부부', '남편', '아내'], grand: '정서신뢰질서 및 관계평온권 침해 사건' },
  { id: 'work', label: '직장·학교', keys: ['회사', '직장', '상사', '회의', '학교', '선생', '숙제', '과제', '동료'], grand: '조직평온 및 업무신뢰체계 교란 사건' },
  { id: 'digital', label: '디지털·연락', keys: ['카톡', '문자', '전화', '읽씹', '답장', '게임', '온라인', '앱', 'SNS', '리모컨'], grand: '디지털신뢰체계 및 통신평온 침해 사건' },
  { id: 'family', label: '가족·생활', keys: ['엄마', '아빠', '부모', '가족', '형', '누나', '언니', '오빠', '동생', '아이', '집', '남편', '아내'], grand: '가정평온 및 공동생활질서 침해 사건' },
];

function stableNumber(seed, min, max) {
  const text = String(seed || 'sosoking');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return min + ((hash >>> 0) % (max - min + 1));
}

function pick(items, seed) {
  return items[stableNumber(seed, 0, items.length - 1)];
}

function detectCategory(text) {
  const source = String(text || '');
  let selected = null;
  let score = 0;
  for (const rule of CATEGORY_RULES) {
    const next = rule.keys.reduce((sum, key) => sum + (source.includes(key) ? 1 : 0), 0);
    if (next > score) {
      selected = rule;
      score = next;
    }
  }
  return selected || { id: 'other', label: '기타 생활분쟁', grand: '생활평온 및 상호배려질서 침해 사건' };
}

function buildDocket(caseId, title, supplied) {
  const existing = cleanText(supplied, 50);
  if (existing) return existing;
  const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date());
  return `${year}소소${String(stableNumber(`${caseId}:${title}`, 1000, 9999))}`;
}

function addUsage(total = {}, next = {}) {
  const keys = [
    'promptTokenCount',
    'candidatesTokenCount',
    'totalTokenCount',
    'cachedContentTokenCount',
    'thoughtsTokenCount',
  ];
  return Object.fromEntries(keys.map(key => [key, Number(total[key] || 0) + Number(next[key] || 0)]));
}

async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}

async function imageForGemini(caseData) {
  const image = caseData?.imageAttachment || caseData?.imageAttachmentMeta || null;
  const storagePath = image?.storagePath || caseData?.imageStoragePath || '';
  const mimeType = cleanText(image?.mimeType, 30) || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;

  let data = String(image?.data || '')
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    .replace(/\s/g, '');
  if (!data && storagePath) {
    const [buffer] = await getStorage().bucket().file(storagePath).download();
    if (buffer.length > 700000) return null;
    data = buffer.toString('base64');
  }
  return data && data.length <= 950000 && /^[A-Za-z0-9+/=]+$/.test(data)
    ? { mimeType, data }
    : null;
}

function hasImageAttachment(caseData) {
  const image = caseData?.imageAttachment || caseData?.imageAttachmentMeta || null;
  return !!(
    image?.storagePath
    || caseData?.imageStoragePath
    || image?.data
  );
}

async function generateWithGemini({ settings, prompt, image, profile }) {
  const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
    model: cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.94,
      topP: 0.96,
      maxOutputTokens: 6000,
      responseMimeType: 'application/json',
    },
  });

  let lastEvaluation = { sectionHits: 0, primarySectionHits: 0, mentionedAnchorCount: 0, tailoredOrders: 0, primaryOrderHits: 0, seriousHumorHits: 0 };
  let lastError = null;
  let usage = {};
  let attempts = 0;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    attempts += 1;
    try {
      const attemptPrompt = attempt === 0
        ? prompt
        : `${prompt}${buildRewriteInstruction(profile, lastEvaluation)}`;
      const parts = [{ text: attemptPrompt }];
      if (image) parts.push({ inlineData: image });
      const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
      usage = addUsage(usage, response.response.usageMetadata || {});
      const raw = extractJson(response.response.text());
      const judgment = normalizeJudgment(raw);
      if (!isCompleteJudgment(judgment)) {
        lastError = new Error('AI judgment did not satisfy the V2 field contract');
        continue;
      }
      lastEvaluation = evaluateStorySpecificity(judgment, profile);
      if (!lastEvaluation.passed) {
        lastError = new Error(`AI judgment lacked case specificity: ${JSON.stringify(lastEvaluation)}`);
        continue;
      }
      return { judgment, usage, evaluation: lastEvaluation, attempts };
    } catch (error) {
      lastError = error;
    }
  }

  const failure = lastError || new Error('AI judgment generation failed');
  failure.usage = usage;
  failure.attempts = attempts;
  throw failure;
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function completeResult(data = {}) {
  return Number(data.schemaVersion) === JUDGMENT_SCHEMA_VERSION && isCompleteJudgment(data.judgment);
}

exports.generateTrial = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB',
  cors: true,
}, async request => {
  const uid = requireVerifiedUser(request, '재판 생성은 구글 또는 인증된 이메일 로그인 후 이용할 수 있습니다.');
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const [initial, initialResult] = await Promise.all([caseRef.get(), resultRef.get().catch(() => null)]);
  if (!initial.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');

  let caseData = initial.data();
  if (caseData.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (caseData.status === 'completed' && initialResult?.exists && completeResult(initialResult.data())) {
    return { success: true, skipped: 'completed' };
  }
  if (caseData.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error', 'completed'].includes(caseData.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const title = cleanText(caseData.caseTitle, 90) || '소소한 황당사건';
  const description = cleanParagraph(caseData.caseDescription, 1800) || title;
  const desiredVerdict = cleanText(caseData.desiredVerdict, 240);
  const grievanceIndex = Math.max(1, Math.min(10, Number(caseData.grievanceIndex || 5)));
  const category = detectCategory(`${title} ${description} ${desiredVerdict}`);
  const headline = `${title} 관련 ${category.grand}`;
  const defendantName = cleanText(caseData.defendantName || caseData.accusedName || caseData.whoDidIt || caseData.targetName, 40) || '피고 측';
  const judgeType = JUDGES.includes(caseData.selectedJudge) ? caseData.selectedJudge : pick(JUDGES, `${caseId}:${title}`);
  const docketNumber = buildDocket(caseId, title, caseData.docketNumber);
  const courtroom = cleanText(caseData.courtroom, 60) || pick(COURTROOMS, `${caseId}:courtroom`);
  const profile = buildCaseProfile({
    title,
    description,
    desiredVerdict,
    grievanceIndex,
    headline,
    defendantName,
    judgeType,
    category,
  });

  let acquired = false;
  let recoveredExistingResult = false;
  await db.runTransaction(async transaction => {
    const [fresh, freshResult] = await Promise.all([
      transaction.get(caseRef),
      transaction.get(resultRef),
    ]);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');

    if (freshResult.exists && completeResult(freshResult.data())) {
      recoveredExistingResult = true;
      transaction.update(caseRef, {
        status: 'completed',
        courtStage: 'sentenced',
        completedAt: current.completedAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        errorMessage: FieldValue.delete(),
      });
      return;
    }

    if (!['pending', 'error', 'completed'].includes(current.status)) return;
    acquired = true;
    caseData = current;
    transaction.update(caseRef, {
      status: 'processing',
      courtStage: 'hearing',
      docketNumber,
      courtName: '소소킹 판결소',
      courtroom,
      division: '제2소소재판부',
      defendantName,
      judgeType,
      category: profile.categoryId,
      categoryLabel: profile.categoryLabel,
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
    });
  });
  if (recoveredExistingResult) return { success: true, skipped: 'recovered-existing-result' };
  if (!acquired) return { success: true, skipped: 'already-started' };

  const fallback = buildStoryFallback(profile);
  let judgment = fallback;
  let aiGenerated = false;
  let aiAttempted = false;
  let aiAttempts = 0;
  let usage = {};
  let image = null;
  let saveSucceeded = false;

  try {
    const key = geminiKey.value().trim();
    aiAttempted = !!key;
    if (key) {
      const settings = await loadSettings();
      image = await imageForGemini(caseData).catch(error => {
        console.warn('image load skipped:', error.message || error);
        return null;
      });
      const generated = await generateWithGemini({
        settings,
        prompt: buildStoryPrompt(profile),
        image,
        profile,
      });
      judgment = generated.judgment;
      aiGenerated = true;
      aiAttempts = generated.attempts;
      usage = generated.usage;
    }
  } catch (error) {
    aiAttempts = Number(error.attempts || (aiAttempted ? 1 : 0));
    usage = error.usage || usage;
    console.error('case-specific AI judgment failed, using tailored local judgment:', error.message || error);
  }

  try {
    const batch = db.batch();
    batch.set(resultRef, {
      schemaVersion: JUDGMENT_SCHEMA_VERSION,
      resultVersion: 'judgment-v2',
      storyVersion: STORY_VERSION,
      source: caseData.source || 'user',
      isPublic: false,
      caseTitle: title,
      headline: judgment.headline || headline,
      caseDescription: description,
      desiredVerdict,
      grievanceIndex,
      nickname: cleanText(caseData.nickname, 30) || '익명 원고',
      docketNumber,
      courtName: '소소킹 판결소',
      courtroom,
      division: '제2소소재판부',
      defendantName,
      judgeType,
      category: profile.categoryId,
      categoryLabel: profile.categoryLabel,
      judgment,
      hasImageAttachment: hasImageAttachment(caseData),
      aiGenerated,
      aiAttempts,
      generationMode: aiGenerated ? 'gemini-case-story-v1' : 'local-case-story-v1',
      reactionTotal: 0,
      totalVotes: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: caseData.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(caseRef, {
      status: 'completed',
      courtStage: 'sentenced',
      docketNumber,
      courtName: '소소킹 판결소',
      courtroom,
      division: '제2소소재판부',
      defendantName,
      category: profile.categoryId,
      categoryLabel: profile.categoryLabel,
      judgeType,
      resultSchemaVersion: JUDGMENT_SCHEMA_VERSION,
      storyVersion: STORY_VERSION,
      isPublic: false,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
    });
    await batch.commit();
    saveSucceeded = true;
  } catch (error) {
    await caseRef.update({
      status: 'error',
      courtStage: 'filed',
      errorMessage: cleanText(error.message, 300) || '판결 저장 오류',
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => null);
    throw new HttpsError('internal', '판결문 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(aiAttempted ? Math.max(1, aiAttempts) : 0),
        geminiInputTokens: FieldValue.increment(Number(usage.promptTokenCount || 0)),
        geminiOutputTokens: FieldValue.increment(Number(usage.candidatesTokenCount || 0)),
        caseCount: FieldValue.increment(saveSucceeded ? 1 : 0),
        generationSaveErrorCount: FieldValue.increment(saveSucceeded ? 0 : 1),
        imageCaseCount: FieldValue.increment(saveSucceeded && image ? 1 : 0),
        firestoreReads: FieldValue.increment(4),
        firestoreWrites: FieldValue.increment(saveSucceeded ? 3 : 2),
        functionInvocations: FieldValue.increment(1),
        judgmentV2Count: FieldValue.increment(saveSucceeded ? 1 : 0),
        caseStoryCount: FieldValue.increment(saveSucceeded ? 1 : 0),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('usage log failed:', error.message || error);
    }
  }

  return {
    success: true,
    caseId,
    schemaVersion: JUDGMENT_SCHEMA_VERSION,
    storyVersion: STORY_VERSION,
    aiGenerated,
  };
});