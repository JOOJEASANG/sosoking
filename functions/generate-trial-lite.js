const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보', '한과몰입 법정주사'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '사소범죄전담 나과몰입 형사', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '한입권 담당 나과장 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사', '피고방어전담 임몰랐다 변호인'];

function cleanText(value, maxLen) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen); }
function cleanLong(value, maxLen) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen); }
function sanitize(value, maxLen = 4000) {
  let t = cleanLong(value, maxLen);
  const pairs = [['사이트','기록철'], ['시스템','재판부'], ['AI','재판부'], ['프롬프트','접수조서'], ['자동 생성','작성'], ['사용자 입력','접수진술'], ['생활형 처분','소소형량']];
  for (const [a, b] of pairs) t = t.split(a).join(b);
  return t;
}
function pickFrom(arr, seedText = '') { const s = String(seedText || Date.now()); let n = 0; for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 9973; return arr[n % arr.length]; }
function pickJudge(value) { return JUDGES.includes(value) ? value : JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length]; }
function kstDateKey(date = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function safeJson(text) { const raw = String(text || '').replace(/```json|```/g, '').trim(); const start = raw.indexOf('{'); const end = raw.lastIndexOf('}'); if (start < 0 || end < start) throw new Error('JSON parse failed'); return JSON.parse(raw.slice(start, end + 1)); }
function arr(value, fallback, maxItems, maxLen) { const rows = Array.isArray(value) ? value.map(v => cleanText(v, maxLen)).filter(Boolean).slice(0, maxItems) : []; while (rows.length < fallback.length) rows.push(fallback[rows.length]); return rows; }
async function loadSettings() { try { const snap = await db.doc('site_settings/config').get(); return snap.exists ? snap.data() : {}; } catch { return {}; } }
function buildModel(modelName) { return new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName, generationConfig: { temperature: 1.02, topP: 0.98, topK: 50, responseMimeType: 'application/json' } }); }
async function imageForGemini(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = cleanText(value.mimeType, 30);
  if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) return null;
  let data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data && value.storagePath) {
    const [buffer] = await getStorage().bucket().file(value.storagePath).download();
    if (buffer.length > 700000) return null;
    data = buffer.toString('base64');
  }
  if (!data || data.length > 950000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { mimeType, data };
}
function imageMeta(value) {
  if (!value || typeof value !== 'object') return null;
  return { storagePath: cleanText(value.storagePath, 240), mimeType: cleanText(value.mimeType, 30), width: Number(value.width || 0), height: Number(value.height || 0), originalName: cleanText(value.originalName, 80), originalSize: Number(value.originalSize || 0), resizedSize: Number(value.resizedSize || 0) };
}
function fallbackFor(c, judgeType, people) {
  const title = cleanText(c.caseTitle, 80) || '소소한 황당사건';
  const desc = cleanText(c.caseDescription, 700) || title;
  const object = title.replace(/사건$/g, '').trim() || '문제의 대상';
  const absurdDetails = ['원고의 평온을 흔든 결정적 순간', '너무 자연스러운 피고 측 태도', '현장에 남은 설명하기 어려운 정적', '사건 직후 원고의 멈춘 표정', '평소라면 넘어갔을 사소한 불편', '누구도 책임지지 않는 3초의 공백', '문제의 대상 주변에 남은 미세한 흔적', '원고가 기대했던 원래 상태', '피고 측의 그럴 수도 있지 분위기', '사라진 마지막 한입권', '생활 질서가 접힌 순간', '사건 후 더 크게 들린 주변 소음'];
  const evidenceBits = ['현장 주변의 미세한 어긋남', '원고 진술 속 반복되는 억울함', '피고 측의 지나치게 태연한 반응', '사건 직후 남은 정적', '문제 대상의 위치 변화', '원고가 기대한 평온의 붕괴', '주변 사물의 침묵', '방청석이 납득하지 못한 분위기'];
  const defendantExcuses = ['피고 측은 고의가 없었다고 주장한다.', '당시 상황이 너무 일상적이었다고 항변한다.', '원고가 지나치게 엄숙하게 받아들였다고 말한다.', '문제의 대상이 원래 그런 상태였다고 주장한다.', '피고 측은 3초의 공백을 기억하지 못한다고 한다.'];
  const penaltyIdeas = ['피고는 같은 상황에서 3초간 멈춰 확인한다.', '피고는 원고에게 작은 간식 또는 음료로 평화조치를 제안한다.', '피고는 그럴 수도 있지라는 말을 1회 보류한다.', '피고는 사건 현장을 원상회복에 가깝게 정리한다.', '피고는 같은 실수를 반복하지 않겠다는 소소한 서약을 한다.', '피고는 원고 앞에서 사건의 사소하지만 큰 무게를 인정한다.'];
  return {
    refinedCaseTitle: title.endsWith('사건') ? title : `${title} 사건`,
    absurdityTitle: `${title} 기록철`,
    expandedCase: `문서명: 사건 배경 및 발단 기록\n원고의 진술은 짧았다. ${desc}\n그러나 재판부는 이 짧은 문장 안에서 생활 평온이 접힌 순간을 발견하였다. 본 사건은 실제 법률 문제가 아니라, 사소한 억울함을 지나치게 엄숙하게 기록하는 황당재판 대상이다.`,
    caseTimeline: `문서명: 분초 단위 사건일지\n00분 00초, 원고는 아직 일상이 정상적으로 굴러간다고 믿고 있었다.\n00분 03초, ${absurdDetails[0]}이 발생하였다.\n00분 07초, 현장에는 ${evidenceBits[0]}이 남았다.\n00분 12초, 원고는 이 일을 그냥 넘기기에는 마음이 너무 시끄럽다는 사실을 깨달았다.`,
    forensicReport: `문서명: 소소국과수 감정서\n감정기관: 소소국과수 생활증거분석실\n감정대상 1. ${evidenceBits[0]}\n감정대상 2. ${evidenceBits[1]}\n감정결과: ${object}은 단순한 배경이 아니라 원고의 억울함을 설명하는 생활형 증거로 보인다.`,
    plaintiffArg: `문서명: ${people.prosecutorName} 공소장\n검사는 본 사건을 단순 해프닝으로 축소할 수 없다고 본다. 원고가 잃은 것은 물건이나 상황 하나가 아니라, 방심해도 된다는 생활의 작은 신뢰였다고 주장한다.`,
    defendantArg: `문서명: ${people.defenderName} 답변서\n${defendantExcuses[0]} ${defendantExcuses[1]} 다만 피고 측도 원고의 표정이 평소보다 오래 정지했다는 점은 부인하기 어렵다.`,
    courtOpinion: `문서명: 재판부 판단\n${judgeType} 재판부는 사건 배경 기록, 소소국과수 감정서, 공소장 및 답변서를 종합한다. 본 사건은 법적으로는 아무 일도 아닐 수 있으나 마음속 방청석 기준으로는 충분히 기록 보존 가치가 있다.`,
    sentence: `문서명: 주문 및 소소형량\n1. ${penaltyIdeas[0]}\n2. ${penaltyIdeas[1]}\n3. ${penaltyIdeas[2]}\n4. ${penaltyIdeas[3]}\n5. ${penaltyIdeas[4]}\n6. ${penaltyIdeas[5]}`,
    closingComment: `${object}은 작았으나, 그 앞의 침묵은 충분히 길었다.`,
    absurdDetails,
    evidenceBits,
    defendantExcuses,
    penaltyIdeas
  };
}\nfunction normalizeAiData(raw, fallback) {
  return {
    refinedCaseTitle: cleanText(raw.refinedCaseTitle, 80) || fallback.refinedCaseTitle,
    absurdityTitle: cleanText(raw.absurdityTitle, 120) || fallback.absurdityTitle,
    expandedCase: sanitize(raw.expandedCase || fallback.expandedCase, 4400),
    caseTimeline: sanitize(raw.caseTimeline || fallback.caseTimeline, 3200),
    forensicReport: sanitize(raw.forensicReport || fallback.forensicReport, 3600),
    plaintiffArg: sanitize(raw.plaintiffArg || fallback.plaintiffArg, 3000),
    defendantArg: sanitize(raw.defendantArg || fallback.defendantArg, 2800),
    courtOpinion: sanitize(raw.courtOpinion || fallback.courtOpinion, 3200),
    sentence: sanitize(raw.sentence || fallback.sentence, 2600),
    closingComment: sanitize(raw.closingComment || fallback.closingComment, 260),
    absurdDetails: arr(raw.absurdDetails, fallback.absurdDetails, 12, 140),
    evidenceBits: arr(raw.evidenceBits, fallback.evidenceBits, 8, 140),
    defendantExcuses: arr(raw.defendantExcuses, fallback.defendantExcuses, 5, 160),
    penaltyIdeas: arr(raw.penaltyIdeas, fallback.penaltyIdeas, 6, 160)
  };
}
async function generateAiDocs(model, c, judgeType, people, geminiImage, fallback) {
  const prompt = `너는 소소킹 황당재판소 재판부다. 실제 법률 조언이 아닌 오락형 황당재판 판결문을 JSON으로만 작성한다. 심각한 범죄·혐오·성적 내용·개인정보는 피하고, 사소한 일상 사건을 과하게 엄숙하게 다룬다.\n사건명: ${cleanText(c.caseTitle, 90)}\n사건내용: ${cleanText(c.caseDescription, 700)}\n재판부: ${judgeType}\n담당자: ${JSON.stringify(people)}\n필드: refinedCaseTitle, absurdityTitle, expandedCase, caseTimeline, forensicReport, plaintiffArg, defendantArg, courtOpinion, sentence, closingComment, absurdDetails(12개), evidenceBits(8개), defendantExcuses(5개), penaltyIdeas(6개). sentence는 '문서명: 주문 및 소소형량'으로 시작하고 3개 이상 처분을 번호로 쓴다.`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const parsed = safeJson(result.response.text());
  return { data: normalizeAiData(parsed, fallback), usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  let c = caseSnap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(c.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');
  const judgeType = pickJudge(c.selectedJudge);
  const people = { courtroom: c.courtroom || pickFrom(COURTROOMS, c.caseTitle), recordClerk: c.recordClerk || pickFrom(CLERKS, c.caseTitle), analystName: c.analystName || pickFrom(ANALYSTS, c.caseTitle), prosecutorName: c.prosecutorName || pickFrom(PROSECUTORS, c.caseTitle), defenderName: c.defenderName || pickFrom(DEFENDERS, c.caseTitle) };

  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (!['pending', 'error'].includes(current.status)) return;
    c = current;
    tx.update(caseRef, { status: 'processing', courtStage: 'hearing', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, processingStartedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  });

  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const fallback = fallbackFor(c, judgeType, people);
  const geminiImage = await imageForGemini(c.imageAttachment).catch(err => { console.warn('image load skipped:', err.message || err); return null; });
  let data = fallback;
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let generationMode = 'local-safe';
  let aiGenerated = false;

  try {
    const generated = await generateAiDocs(buildModel(modelName), c, judgeType, people, geminiImage, fallback);
    data = generated.data;
    totals = generated.usage;
    generationMode = 'ai-docs-v3';
    aiGenerated = true;
  } catch (err) {
    console.error('document generation skipped:', err);
  }

  try {
    await resultRef.set({
      userId: c.userId,
      ownerId: c.userId,
      isPublic: c.isPublic === true,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 황당재판소',
      courtroom: people.courtroom,
      division: '제3황당재판부',
      recordClerk: people.recordClerk,
      analystName: people.analystName,
      prosecutorName: people.prosecutorName,
      defenderName: people.defenderName,
      caseTitle: data.refinedCaseTitle || c.caseTitle || '황당재판 결과',
      originalCaseTitle: c.caseTitle || '',
      refinedCaseTitle: data.refinedCaseTitle || c.caseTitle || '',
      absurdityTitle: data.absurdityTitle,
      imageAnalysis: '',
      hasImageAttachment: !!geminiImage,
      imageAttachmentMeta: imageMeta(c.imageAttachment),
      caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase,
      absurdDetails: data.absurdDetails,
      evidenceBits: data.evidenceBits,
      defendantExcuses: data.defendantExcuses,
      penaltyIdeas: data.penaltyIdeas,
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.expandedCase,
      caseTimeline: data.caseTimeline,
      forensicReport: data.forensicReport,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      courtOpinion: data.courtOpinion,
      sentence: data.sentence,
      closingComment: data.closingComment,
      aiGenerated,
      generationMode,
      resultVersion: 'robust-absurd-scene-v3',
      analysisDigest: [],
      absurdityReview: `재판부는 ${data.refinedCaseTitle || c.caseTitle || '본 사건'}이 실제 법률 문제가 아니라 사소한 생활 평온 침범을 과하게 기록하는 오락형 황당재판 대상이라고 본다.`,
      keyIssues: data.absurdDetails.slice(0, 4),
      evidenceList: data.evidenceBits.slice(0, 7),
      investigation: data.forensicReport,
      verdict: data.courtOpinion,
      executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.',
      appealNotice: '본 사건은 1회에 한하여 마음속 항소가 가능하다. 다만 항소심도 실제 법적 효력은 없다.',
      reactionTotal: 0,
      totalVotes: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: c.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'robust-absurd-scene-v3', generationMode };
});
