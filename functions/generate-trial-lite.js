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
  '엄벌주의형': '사소한 일도 엄중하게 다룬다. 단호하고 과한 처분에서 웃음이 나와야 한다.',
  '감성형': '원고의 서운함과 마음의 손상을 크게 본다. 감정이입이 지나쳐야 한다.',
  '현실주의형': '현실적인 해결책을 이상하게 진지하게 제시한다.',
  '과몰입형': '작은 일을 거대한 질서 붕괴처럼 확대한다.',
  '피곤형': '어이없어하면서도 끝까지 판결한다. 건조한 툴툴거림을 쓴다.',
  '논리집착형': '사소한 쟁점을 지나치게 쪼개고 분석한다.',
  '드립형': '재판 형식을 유지하며 짧은 비유와 드립을 쓴다. 사건 밖으로 벗어나지 않는다.'
};

const BANNED_OUTPUT_PHRASES = [
  '방청석은 웃음을 참되', '웃음을 참되, 억울함은 참지', '긴급속보 자막', '종이컵', '공기청정기',
  '미세한 흔적', '기록 보존 가치', '정적', '평온', '단순한 배경', '생활형 증거'
];
const PROMPT_LEAK_PHRASES = [
  '입력 데이터', '절대 원칙', '역할별 작성 방식', 'JSON만 출력', '필드:', 'refinedCaseTitle',
  'absurdityTitle', 'expandedCase', 'caseTimeline', 'forensicReport', 'plaintiffArg', 'defendantArg',
  'courtOpinion', 'closingComment', 'BANNED_OUTPUT_PHRASES', '프롬프트', '지시문', '너는 소소킹'
];

function cleanText(v, n) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
}
function cleanLong(v, n) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
}
const HANGUL_RE = /[\u3131-\u318E\uAC00-\uD7A3]/;
function stripPhrase(text, phrase) {
  if (!phrase) return text;
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(phrase, i)) {
      const before = text[i - 1];
      const after = text[i + phrase.length];
      const boundaryOk = (!before || !HANGUL_RE.test(before)) && (!after || !HANGUL_RE.test(after));
      if (boundaryOk) {
        i += phrase.length;
        continue;
      }
    }
    result += text[i++];
  }
  return result;
}
function sanitize(v, n = 6000) {
  let out = cleanLong(v, n)
    .replaceAll('사이트', '기록철')
    .replaceAll('시스템', '재판부')
    .replaceAll('AI', '재판부')
    .replaceAll('프롬프트', '지시문')
    .replaceAll('자동 생성', '작성')
    .replaceAll('사용자 입력', '접수진술');
  for (const phrase of BANNED_OUTPUT_PHRASES) out = stripPhrase(out, phrase);
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
  const persona = JUDGE_PERSONA[judgeType] || JUDGE_PERSONA['현실주의형'];
  return {
    refinedCaseTitle: title,
    absurdityTitle: title,
    expandedCase: `사건개요\n본 재판부는 접수내용을 기준으로 사건의 핵심을 정리한다. ${desc}\n쟁점은 사건의 크기가 아니라 당사자가 느낀 억울함과 상대방의 온도 차이에 있다.`,
    caseTimeline: `수사 진행 과정\n1. 접수 진술 확인\n2. 사건 당시 상황과 당사자 반응 재구성\n3. 원고가 억울함을 느낀 지점 특정\n4. 피고 측이 가볍게 본 정황 검토\n5. 재판부 판단 단계로 송치`,
    forensicReport: `수사보고서\n중심 증거는 접수 진술이다. 감정 결과, 본 사안은 물리적 피해보다 심리적 찝찝함과 어이없음의 잔존 시간이 더 큰 사건으로 분류된다.`,
    plaintiffArg: `원고 측 주장\n원고는 이 상황이 사소해 보일 수는 있어도 그냥 넘기기 어렵다고 주장한다. 핵심은 상대방이 문제를 작게 취급한 태도라고 본다.`,
    defendantArg: `피고 측 변론\n피고 측은 악의가 아니라 상황 판단의 차이라고 항변한다. 다만 원고가 불쾌감을 느낀 사실 자체는 쉽게 부정하기 어렵다.`,
    courtOpinion: `재판부 판단\n${judgeType} 재판부는 ${persona} 이 기준에 따라 원고의 억울함을 일부 인정한다. 본 사건은 실제 법률분쟁이 아니라 일상 속 황당함을 과장해 판결하는 오락용 사건이다.`,
    sentence: `판결\n주문 1. 피고 측은 원고가 왜 억울했는지 인정한다.\n주문 2. 같은 상황이 반복되지 않도록 주의한다.\n주문 3. 원고는 본 판결문으로 억울함을 일부 해소한 것으로 본다.\n주문 4. 양측은 가능한 경우 가벼운 사과 또는 작은 보상으로 사건을 종결한다.`,
    closingComment: `재판장 한마디: “사소한 일이라도 마음에 걸리면 기록으로 남길 가치는 있습니다.”`,
    absurdDetails: ['접수 진술 중심 사건', '원고의 억울함 발생', '피고 측의 온도 차이', '사소하지만 말하면 커지는 상황'],
    evidenceBits: ['접수된 사건내용', '원고의 감정 반응', '피고 측 추정 입장', '사건 이후 찝찝함'],
    defendantExcuses: ['그렇게까지 커질 줄 몰랐다는 주장', '별일 아니라고 생각했다는 주장', '고의는 아니었다는 주장'],
    penaltyIdeas: ['상황 인정', '가벼운 사과', '재발 방지 약속', '작은 보상 또는 화해']
  };
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
function hasBadOutput(data) {
  const joined = allResultText(data);
  return BANNED_OUTPUT_PHRASES.some(p => joined.includes(p)) || PROMPT_LEAK_PHRASES.some(p => joined.includes(p));
}
function trialPrompt({ caseTitle, caseDescription, desiredVerdict, grievanceIndex, judgeType, persona, people }) {
  return `오락용 황당재판 결과를 JSON 객체 하나로 작성한다.

사건명은 그대로 사용: ${caseTitle}
사건내용: ${caseDescription}
원하는 처분: ${desiredVerdict || '없음'}
억울함: ${grievanceIndex}/10
재판장: ${judgeType} - ${persona}
담당자: ${JSON.stringify(people)}

출력 본문에는 이 안내문, 규칙 설명, 필드명 나열, JSON 작성 지시를 절대 쓰지 않는다.
사건내용을 바탕으로 수사, 공방, 판단, 판결을 각각 실제 절차처럼 작성하되 중간중간 자연스럽게 웃긴 과장을 섞는다.
사건내용에 없는 물건, 증인, 장소, 고정 드립을 억지로 넣지 않는다.
판결로 갈수록 더 구체적이고 더 과장되게 만든다.
재판장 성격은 courtOpinion, sentence, closingComment에 강하게 반영한다.

필요한 키만 가진 JSON 객체를 반환한다:
{"refinedCaseTitle":"${caseTitle}","absurdityTitle":"${caseTitle}","expandedCase":"","caseTimeline":"","forensicReport":"","plaintiffArg":"","defendantArg":"","courtOpinion":"","sentence":"","closingComment":"","absurdDetails":[],"evidenceBits":[],"defendantExcuses":[],"penaltyIdeas":[]}`;
}
function retryPrompt({ caseTitle, caseDescription, desiredVerdict, grievanceIndex, judgeType, persona }) {
  return `JSON만 반환한다. 설명문과 작성 지시는 본문에 넣지 않는다.
사건명: ${caseTitle}
사건내용: ${caseDescription}
희망처분: ${desiredVerdict || '없음'}
억울함: ${grievanceIndex}/10
재판장 성격: ${judgeType}, ${persona}

위 사건 하나만 다룬다. 결과는 수사보고서, 원고 주장, 피고 반박, 재판부 판단, 주문형 판결로 나눈다.
본문에 '입력 데이터', '절대 원칙', '역할별 작성 방식', '필드', 'JSON만 출력' 같은 작성 안내 문구를 쓰면 실패다.
{"refinedCaseTitle":"${caseTitle}","absurdityTitle":"${caseTitle}","expandedCase":"","caseTimeline":"","forensicReport":"","plaintiffArg":"","defendantArg":"","courtOpinion":"","sentence":"","closingComment":"","absurdDetails":[],"evidenceBits":[],"defendantExcuses":[],"penaltyIdeas":[]}`;
}
async function askModel(model, prompt, geminiImage) {
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  return { text: result.response.text(), usage: result.response.usageMetadata || {} };
}
async function generateAi(model, c, judgeType, people, geminiImage, fb) {
  const caseTitle = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const args = {
    caseTitle,
    caseDescription: cleanText(c.caseDescription, 1200),
    desiredVerdict: cleanText(c.desiredVerdict, 240),
    grievanceIndex: Number(c.grievanceIndex || 5),
    judgeType,
    persona: JUDGE_PERSONA[judgeType] || JUDGE_PERSONA['현실주의형'],
    people
  };
  let first = await askModel(model, trialPrompt(args), geminiImage);
  let data = normalize(safeJson(first.text), fb, caseTitle);
  let usage = { requests: 1, inputTokens: first.usage.promptTokenCount || 0, outputTokens: first.usage.candidatesTokenCount || 0 };

  if (hasBadOutput(data)) {
    const second = await askModel(model, retryPrompt(args), geminiImage);
    const retryData = normalize(safeJson(second.text), fb, caseTitle);
    usage = {
      requests: 2,
      inputTokens: usage.inputTokens + (second.usage.promptTokenCount || 0),
      outputTokens: usage.outputTokens + (second.usage.candidatesTokenCount || 0)
    };
    data = hasBadOutput(retryData) ? normalize(fb, fb, caseTitle) : retryData;
  }
  return { data, usage };
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB', cors: true }, async request => {
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
  let generationMode = 'local-no-prompt-leak-v10';
  let aiGenerated = false;

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 1.15, topP: 0.96, topK: 48, maxOutputTokens: 8000, responseMimeType: 'application/json' }
    });
    const generated = await generateAi(model, c, judgeType, people, geminiImage, fb);
    data = generated.data;
    totals = generated.usage;
    generationMode = hasBadOutput(data) ? 'local-no-prompt-leak-v10' : 'ai-no-prompt-leak-v10';
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
      aiGenerated, generationMode, resultVersion: 'no-prompt-leak-v10', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${caseTitle}을 실제 법률 사안이 아닌 예능형 황당재판으로 판단한다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion,
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
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'no-prompt-leak-v10', generationMode };
});
