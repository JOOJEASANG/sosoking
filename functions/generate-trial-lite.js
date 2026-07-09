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
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

function cleanText(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function cleanLong(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n); }
function sanitize(v, n = 4000) {
  return cleanLong(v, n)
    .replaceAll('사이트', '기록철')
    .replaceAll('시스템', '재판부')
    .replaceAll('AI', '재판부')
    .replaceAll('프롬프트', '접수조서')
    .replaceAll('자동 생성', '작성')
    .replaceAll('사용자 입력', '접수진술')
    .replaceAll('생활형 처분', '소소형량')
    .replaceAll('원고의 평온', '원고의 멘탈 방어막')
    .replaceAll('생활 평온', '일상 방어막')
    .replaceAll('평온', '멘탈 방어막')
    .replaceAll('정적', '갑자기 열린 무음모드')
    .replaceAll('미세한 흔적', '수상한 생활 잔여물')
    .replaceAll('기록 보존 가치', '방청석 박제 가치')
    .replaceAll('실제 법률 문제가 아니라', '진짜 법원에 갈 일은 아니지만');
}
function pickFrom(arr, seed = '') { let x = 0; const s = String(seed || Date.now()); for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i) * (i + 1)) % 9973; return arr[x % arr.length]; }
function pickJudge(v) { return JUDGES.includes(v) ? v : JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length]; }
function kstDateKey(d = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
function safeJson(text) { const raw = String(text || '').replace(/```json|```/g, '').trim(); const a = raw.indexOf('{'); const b = raw.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('JSON parse failed'); return JSON.parse(raw.slice(a, b + 1)); }
function list(v, fallback, max, len) { const rows = Array.isArray(v) ? v.map(x => sanitize(x, len)).filter(Boolean).slice(0, max) : []; while (rows.length < fallback.length) rows.push(fallback[rows.length]); return rows.slice(0, max); }
async function loadSettings() { try { const s = await db.doc('site_settings/config').get(); return s.exists ? s.data() : {}; } catch { return {}; } }
function softenCaseText(text) {
  return cleanText(text, 900)
    .replaceAll('음주운전', '술기운 의혹')
    .replaceAll('고소', '엄숙 항의')
    .replaceAll('신고', '방청석 제보')
    .replaceAll('절도', '슬쩍 실종')
    .replaceAll('사기', '말바꾸기 의혹')
    .replaceAll('폭행', '과격한 몸짓')
    .replaceAll('형사', '매우 진지한')
    .replaceAll('법원', '마음속 재판장');
}
async function imageForGemini(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  const path = img?.storagePath || c?.imageStoragePath || '';
  const mimeType = cleanText(img?.mimeType, 30) || 'image/jpeg';
  if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) return null;
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
  return img && typeof img === 'object' ? { storagePath: cleanText(img.storagePath || c.imageStoragePath, 240), mimeType: cleanText(img.mimeType, 30), width: Number(img.width || 0), height: Number(img.height || 0), originalName: cleanText(img.originalName, 80), originalSize: Number(img.originalSize || 0), resizedSize: Number(img.resizedSize || 0) } : null;
}
function funnyTitle(title, desc) {
  const base = softenCaseText(title || desc).replace(/사건$/g, '').trim() || '사소한 억울함';
  const seed = base.slice(0, 18).trim() || '생활참사';
  const endings = ['대참사 사건', '소소내란 사건', '멘탈 압수 사건', '방청석 술렁 사건', '일상질서 붕괴 사건'];
  return `${seed} ${pickFrom(endings, seed)}`.replace(/사건\s*사건$/g, '사건').slice(0, 44);
}
function fallbackFor(c, judgeType, people) {
  const rawTitle = cleanText(c.caseTitle, 80) || '소소한 황당사건';
  const desc = softenCaseText(c.caseDescription) || rawTitle;
  const finalTitle = funnyTitle(rawTitle, desc);
  const subject = finalTitle.replace(/사건$/g, '').trim() || '문제의 대상';
  const absurdDetails = [
    `${subject} 때문에 원고 멘탈이 출석요구서를 받음`,
    '방심하던 일상이 갑자기 증인석에 앉음',
    '피고의 태연함이 방청석의 혈압을 소환함',
    '원고의 표정이 3초간 로딩 화면으로 변함',
    '사소함이 스스로 확대복사를 시작함',
    '돈봉투 또는 마음봉투가 예상보다 가벼워짐',
    '그럴 수도 있다는 말이 현장에서 압수됨',
    '원고 마음속 북이 둥둥 울리기 시작함',
    '대수롭지 않은 척한 순간 더 대수로워짐',
    '방청석이 동시에 고개를 갸웃한 정황',
    '피고의 무심함이 사건에 양념을 추가함',
    '원고의 억울함이 자력으로 기록철을 펼침'
  ];
  const evidenceBits = [
    '원고 표정의 급격한 화면정지',
    '말다툼 끝에 남은 감정 잔돈',
    '피고 측 태연함의 과다 검출',
    '현장 공기 중 억울함 농도 상승',
    '원고가 기대한 상식의 삐끗함',
    '방청석이 외면하지 못한 찜찜함',
    '사건 직후 생긴 마음속 밑줄',
    '작은 일인데 이상하게 오래 남는 기분'
  ];
  const defendantExcuses = [
    '피고 측은 상황이 그렇게 커질 줄 몰랐다고 주장한다.',
    '피고 측은 당시 태연함이 기본 표정일 뿐이었다고 항변한다.',
    '피고 측은 원고가 너무 진지한 재판모드였다고 말한다.',
    '피고 측은 돈보다 분위기가 먼저 꼬였다고 설명한다.',
    '피고 측은 기억이 선풍기 약풍처럼 희미하다고 진술한다.'
  ];
  const penaltyIdeas = [
    '피고는 같은 상황에서 3초간 멈춰 분위기를 스캔한다.',
    '피고는 원고에게 작은 간식 또는 음료로 평화협정을 제안한다.',
    '피고는 그럴 수도 있지라는 말을 1회 압수당한다.',
    '피고는 사건을 사소하다고 부르기 전에 원고 표정을 확인한다.',
    '피고는 다음부터 돈과 감정을 따로 구분해 전달한다.',
    '피고는 원고 앞에서 이 일의 소소하지만 거대한 무게를 인정한다.'
  ];
  return {
    refinedCaseTitle: finalTitle,
    absurdityTitle: `${finalTitle} 기록철`,
    expandedCase: `문서명: 사건 배경 및 발단 기록\n접수된 사건내용은 다음과 같다. ${desc}\n재판부는 이 일을 그냥 넘겼다면 오늘 하루의 자존심이 신발장 한구석에서 울었을 것이라고 본다. 사소한 돈, 사소한 말, 사소한 표정이 모였으나 원고 마음속에서는 이미 작은 북소리가 울린 상태다.`,
    caseTimeline: `문서명: 분초 단위 사건일지\n00분 00초, 원고는 아직 세상이 상식대로 굴러간다고 믿고 있었다.\n00분 03초, ${subject}이 원고의 멘탈 문패를 두드렸다.\n00분 07초, 원고 표정은 잠시 와이파이 끊긴 화면처럼 멈췄다.\n00분 12초, 방청석 없는 현장에 혼자 방청석이 생겼다.`,
    forensicReport: `문서명: 소소국과수 감정서\n감정기관: 소소국과수 생활증거분석실\n감정대상 1. ${evidenceBits[0]}\n감정대상 2. ${evidenceBits[1]}\n감정결과: 본 사안은 피해 금액보다 기분 손상률이 높다. 특히 피고 측의 태연함은 원고의 억울함을 전자레인지처럼 데운 것으로 보인다.`,
    plaintiffArg: `문서명: ${people.prosecutorName} 공소장\n검사는 본 사건을 단순 해프닝으로 접기 어렵다고 본다. 원고가 잃은 것은 몇 글자의 설명이 아니라, '그래도 이 정도는 맞춰주겠지'라는 생활 신뢰의 앞니 한 조각이다.`,
    defendantArg: `문서명: ${people.defenderName} 답변서\n${defendantExcuses[0]} ${defendantExcuses[1]} 다만 피고 측도 사건 직후 원고의 표정이 평소보다 오래 굳어 있었다는 점은 부인하기 어렵다.`,
    courtOpinion: `문서명: 재판부 판단\n${judgeType} 재판부는 이 사건이 실제 법정에 갈 일은 아니라고 본다. 그러나 마음속 재판장 기준으로는 피고의 태연함, 원고의 억울함, 현장의 찜찜함이 삼각편대를 이루었으므로 황당재판 대상성이 충분하다.`,
    sentence: `문서명: 주문 및 소소형량\n1. ${penaltyIdeas[0]}\n2. ${penaltyIdeas[1]}\n3. ${penaltyIdeas[2]}\n4. ${penaltyIdeas[3]}\n5. ${penaltyIdeas[4]}\n6. ${penaltyIdeas[5]}`,
    closingComment: `${subject}은 작았으나, 원고 마음속 확성기는 이미 켜져 있었다.`,
    absurdDetails, evidenceBits, defendantExcuses, penaltyIdeas
  };
}
function normalize(raw, fb) {
  return {
    refinedCaseTitle: sanitize(raw.refinedCaseTitle, 80) || fb.refinedCaseTitle,
    absurdityTitle: sanitize(raw.absurdityTitle, 120) || fb.absurdityTitle,
    expandedCase: sanitize(raw.expandedCase || fb.expandedCase, 4400),
    caseTimeline: sanitize(raw.caseTimeline || fb.caseTimeline, 3200),
    forensicReport: sanitize(raw.forensicReport || fb.forensicReport, 3600),
    plaintiffArg: sanitize(raw.plaintiffArg || fb.plaintiffArg, 3000),
    defendantArg: sanitize(raw.defendantArg || fb.defendantArg, 2800),
    courtOpinion: sanitize(raw.courtOpinion || fb.courtOpinion, 3200),
    sentence: sanitize(raw.sentence || fb.sentence, 2600),
    closingComment: sanitize(raw.closingComment || fb.closingComment, 260),
    absurdDetails: list(raw.absurdDetails, fb.absurdDetails, 12, 150),
    evidenceBits: list(raw.evidenceBits, fb.evidenceBits, 8, 150),
    defendantExcuses: list(raw.defendantExcuses, fb.defendantExcuses, 5, 180),
    penaltyIdeas: list(raw.penaltyIdeas, fb.penaltyIdeas, 6, 180)
  };
}
async function generateAi(model, c, judgeType, people, geminiImage, fb) {
  const caseTitle = softenCaseText(c.caseTitle || '');
  const caseDescription = softenCaseText(c.caseDescription || '');
  const prompt = `너는 소소킹 황당재판소의 예능형 재판부다. 실제 법률 조언이 아니라, 사소한 일상 사건을 마치 나라가 뒤집힌 대형사건처럼 코미디로 부풀리는 황당판결문을 JSON으로만 작성한다.

핵심 규칙:
- 반드시 사용자가 쓴 사건내용의 구체 요소를 잡아라. 돈, 음식, 시간, 말투, 표정, 물건, 약속 같은 디테일을 살려라.
- 재미없는 추상어를 반복하지 마라. 금지 표현: 평온, 정적, 미세한 흔적, 기록 보존 가치, 결정적 순간, 원래 상태, 단순한 배경, 생활형 증거.
- 범죄자처럼 몰아가지 말고, 마음속 방청석이 과몰입한 것처럼 써라.
- 각 문단마다 최소 1개 이상 웃긴 비유를 넣어라. 예: 돈봉투가 다이어트했다, 표정이 와이파이 끊긴 화면처럼 멈췄다, 억울함이 셀프로 기립했다.
- 제목은 밋밋한 '황당한 OO 사건' 금지. 'OO 대참사 사건', 'OO 멘탈 압수 사건', 'OO 방청석 술렁 사건'처럼 써라.
- 결과는 JSON만 출력한다.

사건명: ${caseTitle}
사건내용: ${caseDescription}
재판부: ${judgeType}
담당자: ${JSON.stringify(people)}

필드:
refinedCaseTitle, absurdityTitle, expandedCase, caseTimeline, forensicReport, plaintiffArg, defendantArg, courtOpinion, sentence, closingComment, absurdDetails(12개), evidenceBits(8개), defendantExcuses(5개), penaltyIdeas(6개).
sentence는 반드시 '문서명: 주문 및 소소형량'으로 시작하고 6개 번호 처분을 작성한다.`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  return { data: normalize(safeJson(result.response.text()), fb), usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
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
  const fb = fallbackFor(c, judgeType, people);
  const geminiImage = await imageForGemini(c).catch(err => { console.warn('image load skipped:', err.message || err); return null; });
  let data = fb;
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let generationMode = 'local-comedy-safe';
  let aiGenerated = false;
  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName, generationConfig: { temperature: 1.22, topP: 0.98, topK: 60, responseMimeType: 'application/json' } });
    const generated = await generateAi(model, c, judgeType, people, geminiImage, fb);
    data = generated.data;
    totals = generated.usage;
    generationMode = 'ai-comedy-docs-v4';
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
      courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      caseTitle: data.refinedCaseTitle || c.caseTitle || '황당재판 결과', originalCaseTitle: c.caseTitle || '', refinedCaseTitle: data.refinedCaseTitle || c.caseTitle || '', absurdityTitle: data.absurdityTitle,
      imageAnalysis: '', hasImageAttachment: !!geminiImage, imageAttachmentMeta: imageMeta(c), caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, defendantExcuses: data.defendantExcuses, penaltyIdeas: data.penaltyIdeas,
      grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
      reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
      aiGenerated, generationMode, resultVersion: 'comedy-absurd-scene-v4', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${data.refinedCaseTitle || c.caseTitle || '본 사건'}이 진짜 법원에 갈 일은 아니지만 마음속 방청석 기준으로는 충분히 호들갑 떨 만한 사안이라고 본다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion,
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
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'comedy-absurd-scene-v4', generationMode };
});
