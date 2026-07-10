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

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CATEGORY_RULES = [
  { id: 'food', label: '음식·식탐', keys: ['먹', '음식', '밥', '라면', '치킨', '커피', '빵', '과자', '아이스크림', '간식', '배달'], grand: '식생활질서 및 최후섭취권 침해 사건' },
  { id: 'late', label: '약속·지각', keys: ['늦', '지각', '약속', '기다', '시간', '연락 없이', '출발'], grand: '시공간질서 왜곡 및 약속신뢰 붕괴 사건' },
  { id: 'love', label: '연인·관계', keys: ['남친', '여친', '애인', '연인', '데이트', '기념일', '부부', '남편', '아내'], grand: '정서신뢰질서 및 관계평온권 침해 사건' },
  { id: 'work', label: '직장·학교', keys: ['회사', '직장', '상사', '회의', '학교', '선생', '숙제', '과제', '동료'], grand: '조직평온 및 업무신뢰체계 교란 사건' },
  { id: 'digital', label: '디지털·연락', keys: ['카톡', '문자', '전화', '읽씹', '답장', '게임', '온라인', '앱', 'SNS'], grand: '디지털신뢰체계 및 통신평온 침해 사건' },
  { id: 'family', label: '가족·생활', keys: ['엄마', '아빠', '부모', '가족', '형', '누나', '언니', '오빠', '동생', '아이', '집'], grand: '가정평온 및 공동생활질서 침해 사건' },
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

function buildLocalJudgment({ title, description, desiredVerdict, grievanceIndex, headline, defendantName, judgeType }) {
  const requested = desiredVerdict
    ? `원고가 희망한 “${desiredVerdict}”의 취지를 생활형 처분에 반영한다.`
    : '원고가 구체적인 처분을 정하지 않았으므로 재판부가 관계 회복에 필요한 조치를 직권으로 정한다.';
  return {
    headline,
    summary: `${judgeType} 재판부는 사안 자체는 작지만 원고의 억울함은 실제로 발생했다고 보아 피고의 생활형 책임을 인정한다.`,
    facts: `원고는 “${description}”라는 일이 발생하여 평온한 일상이 흔들렸다고 주장하였다. 사건명은 “${title}”로 접수되었고 억울함 지수는 ${grievanceIndex}/10으로 기록되었다. 피고 ${defendantName}은 사소한 일이라고 항변할 수 있으나, 재판부는 사소함이 상대방의 불편을 자동으로 없애지는 않는다고 보았다.`,
    investigation: '재판부는 사건 당시의 말과 행동, 반응의 속도, 사건 뒤 남은 찝찝함을 생활 증거로 검토하였다. 수사관은 원고의 기억 속 장면을 0.1초 단위로 재생한다는 과도한 자세로 정황을 분석하였고, 사건이 커진 핵심 원인은 행동 자체뿐 아니라 이후의 설명과 배려 부족에도 있다고 판단하였다.',
    prosecution: `검사는 피고 ${defendantName}이 원고의 작은 기대와 생활평온을 충분히 살피지 않았다고 주장하였다. 특히 사건을 대수롭지 않게 여기는 태도가 원고의 억울함을 더 오래 지속시켰으므로 엄숙한 사과와 재발 방지 조치가 필요하다고 의견을 밝혔다.`,
    defense: '변호인은 피고에게 악의가 없었고 피로, 착오, 주변 상황의 엇박자가 겹쳐 벌어진 일이라고 항변하였다. 또한 사건의 크기에 비해 재판 절차가 지나치게 장엄하다고 주장하였으나, 재판부는 바로 그 차이가 소소킹 판결소의 관할 사유라고 보았다.',
    opinion: `${judgeType} 재판부는 기록 전체를 검토한 결과 피고에게 실제 형벌을 부과할 사안은 아니지만, 원고의 감정을 인정하고 같은 일이 반복되지 않도록 생활형 의무를 명하는 것이 타당하다고 판단한다. ${requested} 이 판결은 웃음과 관계 회복을 위한 오락적 판단에 한정된다.`,
    orders: [
      { number: 1, text: `${defendantName}은 원고에게 사건 당시 배려가 부족했음을 엄숙한 표정으로 세 문장 이상 사과하라.` },
      { number: 2, text: `${defendantName}은 향후 비슷한 상황에서 “별일 아니다”라고 말하기 전에 원고의 표정을 3초 이상 확인하라.` },
      { number: 3, text: `${defendantName}은 소송 비용에 갈음하여 커피, 간식 또는 원고가 납득할 만한 동급의 생활형 위로물을 제공하라.` },
    ],
    closingComment: '사건은 작았으나 서로를 대하는 태도까지 작을 필요는 없다.',
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
  };
}

function buildPrompt({ title, description, desiredVerdict, grievanceIndex, headline, defendantName, judgeType, category }) {
  return `너는 소소킹 판결소의 AI 재판부다. 실제 법률 판단이 아닌 안전한 오락 콘텐츠를 작성한다.

사건명: ${title}
공식 사건명: ${headline}
사건 내용: ${description}
원고 희망 처분: ${desiredVerdict || '없음'}
억울함 지수: ${grievanceIndex}/10
피고 호칭: ${defendantName}
판사 성향: ${judgeType}
분류: ${category.label}

정치, 혐오, 성적 내용, 자해, 실제 범죄 조언, 개인정보를 만들지 마라. 입력에 없는 사람·장소·물건을 사실처럼 추가하지 마라. 실제 법적 효력이 없다는 안내를 포함하라. 사안은 사소하지만 재판부의 태도는 지나치게 엄숙해야 한다. 주문은 구체적이고 실행 가능한 생활형 처분 정확히 3개로 작성한다.

아래 JSON 객체 하나만 출력하라. 마크다운과 설명문을 붙이지 마라.
{
  "headline": "공식 사건명",
  "summary": "판결 핵심 2문장",
  "facts": "사건의 경위 2~4문단",
  "investigation": "과도하게 진지한 수사 과정 2~4문단",
  "prosecution": "검사의 주장 1~2문단",
  "defense": "변호인의 주장 1~2문단",
  "opinion": "재판부 판단 2~4문단",
  "orders": [
    {"number": 1, "text": "첫 번째 처분"},
    {"number": 2, "text": "두 번째 처분"},
    {"number": 3, "text": "생활형 위로물 또는 관계 회복 처분"}
  ],
  "closingComment": "재판부 마지막 한마디",
  "legalNotice": "실제 법적 효력이 없는 오락 콘텐츠라는 안내"
}`;
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

function imageMeta(caseData) {
  const image = caseData?.imageAttachment || caseData?.imageAttachmentMeta || null;
  if (!image || typeof image !== 'object') return null;
  return {
    storagePath: cleanText(image.storagePath || caseData.imageStoragePath, 240),
    mimeType: cleanText(image.mimeType, 30),
    width: Number(image.width || 0),
    height: Number(image.height || 0),
    originalName: cleanText(image.originalName, 80),
    originalSize: Number(image.originalSize || 0),
    resizedSize: Number(image.resizedSize || 0),
  };
}

async function generateWithGemini({ settings, prompt, image }) {
  const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
    model: cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.82,
      topP: 0.92,
      maxOutputTokens: 5000,
      responseMimeType: 'application/json',
    },
  });
  const parts = [{ text: prompt }];
  if (image) parts.push({ inlineData: image });
  const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const raw = extractJson(response.response.text());
  const judgment = normalizeJudgment(raw);
  if (!isCompleteJudgment(judgment)) throw new Error('AI judgment did not satisfy the V2 contract');
  return { judgment, usage: response.response.usageMetadata || {} };
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

exports.generateTrial = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB',
  cors: true,
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const initial = await caseRef.get();
  if (!initial.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');

  let caseData = initial.data();
  if (caseData.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (caseData.status === 'completed') return { success: true, skipped: 'completed' };
  if (caseData.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(caseData.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const title = cleanText(caseData.caseTitle, 90) || '소소한 황당사건';
  const description = cleanParagraph(caseData.caseDescription, 1600) || title;
  const desiredVerdict = cleanText(caseData.desiredVerdict, 240);
  const grievanceIndex = Math.max(1, Math.min(10, Number(caseData.grievanceIndex || 5)));
  const category = detectCategory(`${title} ${description} ${desiredVerdict}`);
  const headline = `${title} 관련 ${category.grand}`;
  const defendantName = cleanText(caseData.defendantName || caseData.accusedName || caseData.whoDidIt || caseData.targetName, 40) || '피고 측';
  const judgeType = JUDGES.includes(caseData.selectedJudge) ? caseData.selectedJudge : pick(JUDGES, `${caseId}:${title}`);
  const docketNumber = buildDocket(caseId, title, caseData.docketNumber);
  const courtroom = cleanText(caseData.courtroom, 60) || pick(COURTROOMS, `${caseId}:courtroom`);

  let acquired = false;
  await db.runTransaction(async transaction => {
    const fresh = await transaction.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (!['pending', 'error'].includes(current.status)) return;
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
      category: category.id,
      categoryLabel: category.label,
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
    });
  });
  if (!acquired) return { success: true, skipped: 'already-started' };

  const fallback = normalizeJudgment(buildLocalJudgment({
    title, description, desiredVerdict, grievanceIndex, headline, defendantName, judgeType,
  }));
  let judgment = fallback;
  let aiGenerated = false;
  let aiAttempted = false;
  let usage = {};
  let image = null;

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
        prompt: buildPrompt({ title, description, desiredVerdict, grievanceIndex, headline, defendantName, judgeType, category }),
        image,
      });
      judgment = generated.judgment;
      aiGenerated = true;
      usage = generated.usage;
    }
  } catch (error) {
    console.error('V2 AI judgment generation failed, using local judgment:', error.message || error);
  }

  try {
    await resultRef.set({
      schemaVersion: JUDGMENT_SCHEMA_VERSION,
      resultVersion: 'judgment-v2',
      source: caseData.source || 'user',
      userId: caseData.userId,
      ownerId: caseData.userId,
      isPublic: caseData.isPublic === true,
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
      category: category.id,
      categoryLabel: category.label,
      judgment,
      hasImageAttachment: !!image,
      imageAttachmentMeta: imageMeta(caseData),
      aiGenerated,
      generationMode: aiGenerated ? 'gemini-json-v2' : 'local-json-v2',
      reactionTotal: 0,
      totalVotes: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: caseData.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await caseRef.update({
      status: 'completed',
      courtStage: 'sentenced',
      docketNumber,
      courtName: '소소킹 판결소',
      courtroom,
      division: '제2소소재판부',
      defendantName,
      category: category.id,
      categoryLabel: category.label,
      judgeType,
      resultSchemaVersion: JUDGMENT_SCHEMA_VERSION,
      isPublic: caseData.isPublic === true,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
    });
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
        geminiRequests: FieldValue.increment(aiAttempted ? 1 : 0),
        geminiInputTokens: FieldValue.increment(Number(usage.promptTokenCount || 0)),
        geminiOutputTokens: FieldValue.increment(Number(usage.candidatesTokenCount || 0)),
        caseCount: FieldValue.increment(1),
        imageCaseCount: FieldValue.increment(image ? 1 : 0),
        firestoreReads: FieldValue.increment(3),
        firestoreWrites: FieldValue.increment(3),
        functionInvocations: FieldValue.increment(1),
        judgmentV2Count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('usage log failed:', error.message || error);
    }
  }

  return { success: true, caseId, schemaVersion: JUDGMENT_SCHEMA_VERSION, aiGenerated };
});
