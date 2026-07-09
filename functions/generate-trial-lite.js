const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const JUDGE_PERSONA = {
  '엄벌주의형': '사소한 잘못도 중대 사건처럼 엄중하게 본다. 문장은 단호하고, 판단은 과하지만 웃음은 과한 엄숙함에서 나오게 한다.',
  '감성형': '원고가 느낀 서운함과 마음의 손상을 크게 본다. 따뜻하지만 지나치게 감정이입하는 판결을 쓴다.',
  '현실주의형': '현실적으로 보면 별일 아닌 점도 인정한다. 다만 생활감 있는 해결책을 이상하게 진지하게 제시한다.',
  '과몰입형': '작은 사건을 세계관이 흔들린 사건처럼 확장한다. 장면 묘사, 비유, 과장된 의미 부여가 강하다.',
  '피곤형': '재판장 본인도 어이없어하면서 판결한다. 건조한 한숨, 귀찮음, 현실적인 툴툴거림에서 웃음이 나오게 한다.',
  '논리집착형': '사소한 쟁점을 말도 안 되게 세밀하게 나누고 논리적으로 따진다. 과한 분석에서 웃음이 나오게 한다.',
  '드립형': '재판 형식은 지키되 비유와 짧은 드립을 적극 사용한다. 단, 사건내용에서 벗어난 억지 드립은 금지한다.'
};

const BANNED_OUTPUT_PHRASES = [
  '방청석은 웃음을 참되', '웃음을 참되, 억울함은 참지', '긴급속보 자막', '종이컵', '공기청정기',
  '미세한 흔적', '기록 보존 가치', '정적', '평온', '단순한 배경', '생활형 증거'
];

function cleanText(v, n) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
}
function cleanLong(v, n) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
}
function sanitize(v, n = 6000) {
  let out = cleanLong(v, n)
    .replaceAll('사이트', '기록철')
    .replaceAll('시스템', '재판부')
    .replaceAll('AI', '재판부')
    .replaceAll('프롬프트', '접수조서')
    .replaceAll('자동 생성', '작성')
    .replaceAll('사용자 입력', '접수진술');
  for (const phrase of BANNED_OUTPUT_PHRASES) out = out.replaceAll(phrase, '');
  return out.trim();
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(a, b + 1));
}
function pickFrom(arr, seed = '') {
  let x = 0;
  const s = String(seed || Date.now());
  for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i) * (i + 1)) % 9973;
  return arr[Math.abs(x) % arr.length];
}
function pickJudge(v) {
  return JUDGES.includes(v) ? v : JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length];
}
function kstDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function list(v, fallback, max, len) {
  const rows = Array.isArray(v) ? v.map(x => sanitize(x, len)).filter(Boolean).slice(0, max) : [];
  while (rows.length < Math.min(fallback.length, max)) rows.push(fallback[rows.length]);
  return rows.slice(0, max);
}
async function loadSettings() {
  try {
    const s = await db.doc('site_settings/config').get();
    return s.exists ? s.data() : {};
  } catch {
    return {};
  }
}
async function imageForGemini(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  const path = img?.storagePath || c?.imageStoragePath || '';
  const mimeType = cleanText(img?.mimeType, 30) || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
  let data = String(img?.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data && path) {
    const [buf] = await getStorage().bucket().file(path).download();
    if (buf.length > 700000) return null;
    data = buf.toString('base64');
  }
  return data && data.length <= 950000 && /^[A-Za-z0-9+/=]+$/.test(data) ? { mimeType, data } : null;
}
function imageMeta(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  return img && typeof img === 'object' ? {
    storagePath: cleanText(img.storagePath || c.imageStoragePath, 240),
    mimeType: cleanText(img.mimeType, 30),
    width: Number(img.width || 0),
    height: Number(img.height || 0),
    originalName: cleanText(img.originalName, 80),
    originalSize: Number(img.originalSize || 0),
    resizedSize: Number(img.resizedSize || 0)
  } : null;
}
function fallbackFor(c, judgeType) {
  const title = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const desc = cleanText(c.caseDescription, 1200) || title;
  const base = {
    refinedCaseTitle: title,
    absurdityTitle: title,
    expandedCase: `사건개요\n접수된 내용은 다음과 같다. ${desc}\n재판부는 이 사안을 실제 법률문제가 아닌 사소한 일상 분쟁의 과장 재판으로 본다.`,
    caseTimeline: `수사 진행 과정\n1. 접수 내용 확인\n2. 사건 당시 상황 재구성\n3. 원고가 느낀 억울함 확인\n4. 피고 측 입장 추정\n5. 재판부 판단으로 이송`,
    forensicReport: `수사보고서\n접수 진술을 중심 증거로 삼는다. 사건의 핵심은 규모보다 당사자가 느낀 어이없음에 있다.`,
    plaintiffArg: `원고 측 주장\n원고는 이 상황을 그냥 넘기기 어렵다고 주장한다. 사소해 보이지만 당사자에게는 충분히 억울한 일이라는 취지다.`,
    defendantArg: `피고 측 변론\n피고 측은 악의가 아니라 상황 판단의 차이라고 주장한다. 다만 원고가 불쾌감을 느꼈다는 점은 쉽게 부정하기 어렵다.`,
    courtOpinion: `재판부 판단\n${judgeType} 재판부는 사건내용을 기준으로 판단한다. ${JUDGE_PERSONA[judgeType] || JUDGE_PERSONA['현실주의형']} 재판부는 원고의 억울함을 일부 인정하되, 오락용 황당재판의 성격상 과장된 처분을 선고한다.`,
    sentence: `판결\n1. 피고 측은 원고가 왜 억울했는지 인정한다.\n2. 같은 상황이 반복되지 않도록 주의한다.\n3. 원고는 본 판결문으로 억울함을 일부 해소한 것으로 본다.\n4. 양측은 가능한 경우 가벼운 사과 또는 작은 보상으로 마무리한다.`,
    closingComment: `재판장 한마디: “사소한 일이라도 당사자 마음에 걸리면 재판감은 됩니다.”`,
    absurdDetails: ['접수 진술 중심 사건', '원고의 억울함 발생', '피고 측의 온도 차이', '사소하지만 말하면 커지는 상황'],
    evidenceBits: ['접수된 사건내용', '원고의 감정 반응', '피고 측 추정 입장', '사건 이후 찝찝함'],
    defendantExcuses: ['그렇게까지 커질 줄 몰랐다는 주장', '별일 아니라고 생각했다는 주장', '고의는 아니었다는 주장'],
    penaltyIdeas: ['상황 인정', '가벼운 사과', '재발 방지 약속', '작은 보상 또는 화해']
  };
  return base;
}
function normalize(raw, fb, caseTitle) {
  const keepTitle = cleanText(caseTitle || fb.refinedCaseTitle, 90) || fb.refinedCaseTitle;
  return {
    refinedCaseTitle: keepTitle,
    absurdityTitle: keepTitle,
    expandedCase: sanitize(raw.expandedCase || fb.expandedCase, 7600),
    caseTimeline: sanitize(raw.caseTimeline || fb.caseTimeline, 7000),
    forensicReport: sanitize(raw.forensicReport || fb.forensicReport, 7000),
    plaintiffArg: sanitize(raw.plaintiffArg || fb.plaintiffArg, 6200),
    defendantArg: sanitize(raw.defendantArg || fb.defendantArg, 6200),
    courtOpinion: sanitize(raw.courtOpinion || fb.courtOpinion, 6200),
    sentence: sanitize(raw.sentence || fb.sentence, 5200),
    closingComment: sanitize(raw.closingComment || fb.closingComment, 520),
    absurdDetails: list(raw.absurdDetails, fb.absurdDetails, 12, 240),
    evidenceBits: list(raw.evidenceBits, fb.evidenceBits, 8, 240),
    defendantExcuses: list(raw.defendantExcuses, fb.defendantExcuses, 5, 280),
    penaltyIdeas: list(raw.penaltyIdeas, fb.penaltyIdeas, 6, 280)
  };
}
function allResultText(data) {
  return [data.expandedCase, data.caseTimeline, data.forensicReport, data.plaintiffArg, data.defendantArg, data.courtOpinion, data.sentence, data.closingComment, ...(data.absurdDetails || []), ...(data.evidenceBits || []), ...(data.defendantExcuses || []), ...(data.penaltyIdeas || [])].join(' ');
}
function hasFixedPhrase(data) {
  const joined = allResultText(data);
  return BANNED_OUTPUT_PHRASES.some(p => joined.includes(p));
}
async function generateAi(model, c, judgeType, people, geminiImage, fb) {
  const caseTitle = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const caseDescription = cleanText(c.caseDescription, 1200);
  const desiredVerdict = cleanText(c.desiredVerdict, 240);
  const grievanceIndex = Number(c.grievanceIndex || 5);
  const persona = JUDGE_PERSONA[judgeType] || JUDGE_PERSONA['현실주의형'];
  const prompt = `너는 소소킹 황당재판소의 역할 분리형 AI 재판 시스템이다. 실제 법률 조언이 아니라 오락용 황당재판 결과를 JSON으로만 작성한다.

입력 데이터:
- 사용자가 직접 정한 사건명: ${caseTitle}
- 무슨 일이 있었나요: ${caseDescription}
- 원하는 황당 처분: ${desiredVerdict || '없음'}
- 억울함 레벨: ${grievanceIndex}/10
- 배정 재판장 성격: ${judgeType}
- 재판장 성격 설명: ${persona}
- 사건 담당자 이름: ${JSON.stringify(people)}

절대 원칙:
1. refinedCaseTitle과 absurdityTitle은 반드시 사용자가 직접 정한 사건명을 그대로 사용한다.
2. 결과의 모든 내용은 '무슨 일이 있었나요'에 적힌 사건내용에서 출발한다.
3. 특정 단어, 증인, 물건, 장소, 드립을 억지로 끼워 넣지 않는다. 사건내용에 없는 요소는 새로 만들더라도 사건의 자연스러운 확장이어야 한다.
4. 수사는 수사답게, 재판 공방은 공방답게, 판결은 판결문답게 쓴다.
5. 웃긴 포인트는 각 단계의 상황, 말투, 과장, 모순, 판사의 성격에서 자연스럽게 섞는다.
6. 같은 문구를 반복하는 템플릿형 결과를 만들지 않는다.
7. 금지 반복 문구: ${BANNED_OUTPUT_PHRASES.join(', ')}.

역할별 작성 방식:
- expandedCase: 접수 담당자가 사건의 핵심 쟁점과 웃긴 포인트를 정리한다. 사건내용을 그대로 복붙하지 말고 요약·확대한다.
- caseTimeline: 수사관이 실제로 수사하듯 시간순으로 사건을 재구성한다. 정황, 원고 반응, 피고 측 행동을 사건내용에 맞춰 추론한다.
- forensicReport: 수사관 또는 감식관이 증거와 정황을 분석한다. 실제 증거가 없어도 사건내용에서 파생 가능한 가상 증거만 만든다.
- plaintiffArg: 검사 또는 원고 측 대리인이 주장한다. 왜 억울한지, 무엇이 문제인지 과장하되 사건내용 안에서 주장한다.
- defendantArg: 변호사 또는 피고 측이 반박한다. 말도 안 되지만 그럴듯한 변론을 사건내용에 맞춰 만든다.
- courtOpinion: 판사가 재판장 성격(${judgeType})에 맞춰 쟁점, 판단 이유, 웃긴 해석을 쓴다.
- sentence: 실제 판결문처럼 주문을 쓴다. 원하는 황당 처분이 있으면 자연스럽게 반영하고, 사건별 맞춤 처분을 선고한다.
- closingComment: 재판장 성격이 가장 잘 드러나는 마지막 한마디를 새로 만든다.

필드:
refinedCaseTitle, absurdityTitle, expandedCase, caseTimeline, forensicReport, plaintiffArg, defendantArg, courtOpinion, sentence, closingComment, absurdDetails(6~12개), evidenceBits(4~8개), defendantExcuses(3~5개), penaltyIdeas(4~6개).

JSON만 출력하라.`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const data = normalize(safeJson(result.response.text()), fb, caseTitle);
  return { data: hasFixedPhrase(data) ? normalize(fb, fb, caseTitle) : data, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await caseRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  let c = snap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(c.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge);
  const people = {
    courtroom: c.courtroom || pickFrom(COURTROOMS, c.caseTitle),
    recordClerk: c.recordClerk || pickFrom(CLERKS, c.caseTitle),
    analystName: c.analystName || pickFrom(ANALYSTS, c.caseTitle),
    prosecutorName: c.prosecutorName || pickFrom(PROSECUTORS, c.caseTitle),
    defenderName: c.defenderName || pickFrom(DEFENDERS, c.caseTitle)
  };

  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (!['pending', 'error'].includes(current.status)) return;
    c = current;
    tx.update(caseRef, {
      status: 'processing', courtStage: 'hearing', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부',
      recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      judgeType, processingStartedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete()
    });
  });

  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const caseTitle = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const fb = fallbackFor(c, judgeType);
  const geminiImage = await imageForGemini(c).catch(err => { console.warn('image load skipped:', err.message || err); return null; });
  let data = normalize(fb, fb, caseTitle);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let generationMode = 'local-role-based-trial-v9';
  let aiGenerated = false;

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 1.2, topP: 0.97, topK: 48, maxOutputTokens: 8000, responseMimeType: 'application/json' }
    });
    const generated = await generateAi(model, c, judgeType, people, geminiImage, fb);
    data = generated.data;
    totals = generated.usage;
    generationMode = hasFixedPhrase(data) ? 'local-role-based-trial-v9' : 'ai-role-based-trial-v9';
    aiGenerated = generationMode.startsWith('ai-');
  } catch (err) {
    console.error('document generation skipped:', err);
  }

  try {
    await resultRef.set({
      userId: c.userId,
      ownerId: c.userId,
      isPublic: c.isPublic === true,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      caseTitle: caseTitle, originalCaseTitle: caseTitle, refinedCaseTitle: caseTitle, absurdityTitle: caseTitle,
      imageAnalysis: '', hasImageAttachment: !!geminiImage, imageAttachmentMeta: imageMeta(c), caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, defendantExcuses: data.defendantExcuses, penaltyIdeas: data.penaltyIdeas,
      grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
      reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
      aiGenerated, generationMode, resultVersion: 'role-based-trial-v9', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${caseTitle}을 실제 법률 사안이 아닌 예능형 황당재판으로 판단한다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion,
      executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', appealNotice: '본 사건은 1회에 한하여 마음속 항소가 가능하다. 다만 항소심도 실제 법적 효력은 없다.', reactionTotal: 0, totalVotes: 0, commentCount: 0, courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await caseRef.update({ status: 'completed', courtStage: 'sentenced', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, isPublic: c.isPublic === true, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  } catch (err) {
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: err.message || '저장 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw new HttpsError('internal', '판결문 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({ date: today, geminiRequests: FieldValue.increment(totals.requests), geminiInputTokens: FieldValue.increment(totals.inputTokens), geminiOutputTokens: FieldValue.increment(totals.outputTokens), caseCount: FieldValue.increment(1), imageCaseCount: FieldValue.increment(geminiImage ? 1 : 0), firestoreReads: FieldValue.increment(3), firestoreWrites: FieldValue.increment(4), functionInvocations: FieldValue.increment(1), robustAbsurdCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) { console.error('usage log failed:', e); }
  }
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'role-based-trial-v9', generationMode };
});
