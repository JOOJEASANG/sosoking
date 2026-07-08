const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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
const BANNED_RESULT_WORDS = ['사이트', '시스템', 'AI', '프롬프트', '자동 생성', '사용자 입력', '7차 정리', '정리·보완', '생활질서 미세교란', '사소하지만 기록 보존 가치', '사건 경위에 기재된 결정적 행동', '평온한 상태에 있었다', '마음속 CCTV', '상상 목격자'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanLong(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen);
}
function pickFrom(arr, seedText = '') {
  const s = String(seedText || Date.now());
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 9973;
  return arr[n % arr.length];
}
function pickJudge(value) {
  if (JUDGES.includes(value)) return value;
  return JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length];
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function imageForGemini(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = cleanText(value.mimeType, 30);
  const data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
  if (!data || data.length > 700000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { mimeType, data };
}
function imageMeta(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    mimeType: cleanText(value.mimeType, 30),
    width: Number(value.width || 0),
    height: Number(value.height || 0),
    originalName: cleanText(value.originalName, 80),
    originalSize: Number(value.originalSize || 0),
    resizedSize: Number(value.resizedSize || 0)
  };
}
function validateResultText(data) {
  const joined = [data.expandedCase, data.caseTimeline, data.forensicReport, data.plaintiffArg, data.defendantArg, data.courtOpinion, data.sentence].join('\n');
  const hit = BANNED_RESULT_WORDS.find(w => joined.includes(w));
  if (hit) throw new Error(`Banned generic wording: ${hit}`);
  const uniqueConcrete = new Set((joined.match(/[가-힣A-Za-z0-9]{2,}/g) || []).filter(w => !['문서명','사건','원고','피고','재판부','공소장','답변서','판단','주문','감정서','기록'].includes(w)));
  if (uniqueConcrete.size < 18) throw new Error('Not enough concrete details');
}
function assertFields(data) {
  const required = ['refinedCaseTitle', 'absurdityTitle', 'expandedCase', 'caseTimeline', 'forensicReport', 'plaintiffArg', 'defendantArg', 'courtOpinion', 'sentence', 'closingComment'];
  required.forEach(k => { if (!String(data[k] || '').trim()) throw new Error(`Missing field: ${k}`); });
}
async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}
function buildModel(modelName, temperature = 1.08) {
  return new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
    model: modelName,
    generationConfig: { temperature, topP: 0.98, topK: 50, responseMimeType: 'application/json' }
  });
}
async function generateScene(model, c, judgeType, people, geminiImage) {
  const prompt = `너는 소소킹 황당재판소의 '황당 장면 확대관'이다.

목표:
짧은 접수글을 그대로 요약하지 말고, 웃긴 장면 자체를 먼저 만들어라.
재미는 농담이 아니라 '너무 사소한 일을 목숨 걸고 수사하는 엄숙함'에서 나와야 한다.

입력:
- 사건번호: ${cleanText(c.docketNumber, 80)}
- 저장된 사건명: ${cleanText(c.caseTitle, 90)}
- 접수 내용: ${cleanText(c.caseDescription, 700)}
- 원하는 처분: ${cleanText(c.desiredVerdict, 200) || '없음'}
- 억울함 강도: ${Number(c.grievanceIndex || 5)}/10
- 재판부: ${judgeType}
- 기록관: ${people.recordClerk}
- 수사관: ${people.analystName}
- 검사: ${people.prosecutorName}
- 변호인: ${people.defenderName}
- 첨부 이미지: ${geminiImage ? '있음. 이미지 속 단서는 참고만 한다.' : '없음'}

반드시 만들어야 하는 것:
1. 사건명은 짧고 강하게. 예: '공원 리트리버 빵 무단섭취 사건'
2. expandedCase는 12~16문장. 배경, 원인, 발단, 전개, 결정적 장면, 피해 체감이 모두 있어야 한다.
3. absurdDetails는 12개 이상. 전부 구체물이어야 한다.
4. evidenceBits는 8개 이상. 부스러기, 봉투 주름, 산책줄 장력, 벤치 위치, 냄새, 시선 이탈 각도 같은 미세증거.
5. defendantExcuses는 5개 이상. 말은 되지만 얄미운 변명이어야 한다.
6. penaltyIdeas는 6개 이상. 사건 맞춤 생활형 처분이어야 한다.

리트리버+빵 사건이면 반드시 살릴 디테일 예시:
- 벤치 위 빵 봉투의 열린 입구
- 원고가 물병 뚜껑을 돌리던 3초
- 산책줄이 허용한 42cm의 자유
- 리트리버의 코끝이 빵 봉투를 향한 각도
- 사라진 마지막 한입권
- 손바닥에 남은 빵 기름기
- 봉투 바닥의 부스러기 반달 모양
- 견주의 '어머 얘가 왜 이러지'식 표정
- 피고견의 무죄 눈망울

절대 금지:
사이트, 시스템, AI, 프롬프트, 7차 정리, 자동 생성, 사용자 입력, 오락용, 법률 자문, 생활질서 미세교란, 사건 경위에 기재된 결정적 행동, 평온한 상태에 있었다, 사소하지만 기록 보존 가치, 마음속 CCTV, 상상 목격자.

JSON만 출력:
{
  "refinedCaseTitle":"최종 사건명",
  "absurdityTitle":"기록철 제목",
  "expandedCase":"문서명: 사건 배경 및 발단 기록\\n...",
  "absurdDetails":["구체 디테일 1", "구체 디테일 2"],
  "evidenceBits":["미세증거 1", "미세증거 2"],
  "defendantExcuses":["피고 측 변명 1", "피고 측 변명 2"],
  "penaltyIdeas":["처분 아이디어 1", "처분 아이디어 2"],
  "closingCommentSeed":"마지막 한 줄 소재"
}`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const scene = safeJson(result.response.text());
  return {
    scene: {
      refinedCaseTitle: cleanText(scene.refinedCaseTitle, 80),
      absurdityTitle: cleanText(scene.absurdityTitle, 120),
      expandedCase: cleanLong(scene.expandedCase, 4200),
      absurdDetails: Array.isArray(scene.absurdDetails) ? scene.absurdDetails.map(x => cleanText(x, 140)).filter(Boolean).slice(0, 18) : [],
      evidenceBits: Array.isArray(scene.evidenceBits) ? scene.evidenceBits.map(x => cleanText(x, 140)).filter(Boolean).slice(0, 14) : [],
      defendantExcuses: Array.isArray(scene.defendantExcuses) ? scene.defendantExcuses.map(x => cleanText(x, 160)).filter(Boolean).slice(0, 10) : [],
      penaltyIdeas: Array.isArray(scene.penaltyIdeas) ? scene.penaltyIdeas.map(x => cleanText(x, 160)).filter(Boolean).slice(0, 10) : [],
      closingCommentSeed: cleanText(scene.closingCommentSeed, 160)
    },
    usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 }
  };
}
async function generateDocuments(model, c, judgeType, people, scene) {
  const judgeGuide = {
    '엄벌주의형': '주문은 엄격하지만 폭력·실제 위해·실제 구금은 금지한다.',
    '감성형': '원고가 잃은 기대와 허탈함을 과장되게 참작한다.',
    '현실주의형': '처분은 실제 생활에서 할 수 있는 행동으로 만든다.',
    '과몰입형': '모든 디테일을 대하드라마처럼 장엄하게 해석한다.',
    '피곤형': '건조하고 짧지만 한 줄 한 줄이 은근히 웃기게 만든다.',
    '논리집착형': '행위, 대상, 기대, 결과를 지나치게 세분화한다.',
    '드립형': '말장난은 최소화하고 엄숙한 문서 속에서만 웃기게 만든다.'
  }[judgeType] || '문서 전체에 재판부 성향을 절제하여 반영한다.';
  const prompt = `너는 소소킹 황당재판소의 수석검사·소소국과수 감정관·대법관이다.

아래 장면 확대 자료를 반드시 사용해서 최종 문서를 작성하라.
추상적인 공문서 문장을 쓰면 실패다. 모든 문서에 아래 absurdDetails와 evidenceBits 중 최소 2개 이상을 직접 넣어라.

사건 정보:
- 사건번호: ${cleanText(c.docketNumber, 80)}
- 원 사건명: ${cleanText(c.caseTitle, 90)}
- 접수 내용: ${cleanText(c.caseDescription, 700)}
- 원하는 처분: ${cleanText(c.desiredVerdict, 200) || '없음'}
- 재판부: ${judgeType}
- 재판부 성향: ${judgeGuide}
- 기록관: ${people.recordClerk}
- 수사관: ${people.analystName}
- 검사: ${people.prosecutorName}
- 변호인: ${people.defenderName}

장면 확대 자료:
${JSON.stringify(scene, null, 2)}

작성 규칙:
- 진지함 100%, 사건은 하찮음 100%.
- 각 문단마다 구체 디테일을 넣어라. '사건의 무게', '정황상 확인', '기대가 끊어짐' 같은 말만 반복하지 마라.
- 사건일지는 6개 이상 시각을 넣고, 각 시각마다 실제 장면이 있어야 한다.
- 소소국과수 감정서는 감정대상 5개 이상을 줄 단위로 제시한다.
- 공소장은 검사가 사소한 권리를 인류 문명급으로 과장한다.
- 답변서는 피고가 얄밉게 그럴듯한 변명을 한다.
- 주문은 scene.penaltyIdeas를 적극 활용해 사건 맞춤 처분 5개 이상으로 쓴다.
- '사이트, 시스템, AI, 프롬프트, 7차 정리, 자동 생성, 사용자 입력, 오락용, 법률 자문'은 본문에 쓰지 마라.
- '사건 경위에 기재된 결정적 행동', '평온한 상태에 있었다', '생활질서 미세교란', '마음속 CCTV' 같은 범용 문구 금지.

JSON만 출력:
{
  "refinedCaseTitle":"${scene.refinedCaseTitle || '최종 사건명'}",
  "absurdityTitle":"${scene.absurdityTitle || '기록철 제목'}",
  "expandedCase":"${String(scene.expandedCase || '').replace(/"/g, '\\"')}",
  "caseTimeline":"문서명: ... 분초 단위 사건일지\\n...",
  "forensicReport":"문서명: ... 소소국과수 감정서\\n...",
  "plaintiffArg":"문서명: ... 공소장\\n...",
  "defendantArg":"문서명: ... 답변서\\n...",
  "courtOpinion":"문서명: 재판부 판단\\n...",
  "sentence":"문서명: 주문 및 집행권고\\n1. ...\\n2. ...",
  "closingComment":"사건 고유명사를 포함한 장엄하고 웃긴 한 줄"
}`;
  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const meta = result.response.usageMetadata || {};
  const parsed = safeJson(result.response.text());
  const data = {
    refinedCaseTitle: cleanText(parsed.refinedCaseTitle, 80) || scene.refinedCaseTitle,
    absurdityTitle: cleanText(parsed.absurdityTitle, 120) || scene.absurdityTitle,
    expandedCase: cleanLong(parsed.expandedCase, 4400) || scene.expandedCase,
    caseTimeline: cleanLong(parsed.caseTimeline, 3200),
    forensicReport: cleanLong(parsed.forensicReport, 3600),
    plaintiffArg: cleanLong(parsed.plaintiffArg, 3000),
    defendantArg: cleanLong(parsed.defendantArg, 2800),
    courtOpinion: cleanLong(parsed.courtOpinion, 3200),
    sentence: cleanLong(parsed.sentence, 2600),
    closingComment: cleanText(parsed.closingComment, 260)
  };
  assertFields(data);
  validateResultText(data);
  return { data, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
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
      status: 'processing',
      courtStage: 'hearing',
      courtName: '소소킹 황당재판소',
      courtroom: people.courtroom,
      division: '제3황당재판부',
      recordClerk: people.recordClerk,
      analystName: people.analystName,
      prosecutorName: people.prosecutorName,
      defenderName: people.defenderName,
      judgeType,
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete()
    });
  });

  const latest = await caseRef.get();
  if (latest.data()?.status !== 'processing') return { success: true, skipped: latest.data()?.status || 'unknown' };

  const isPublic = c.isPublic !== false;
  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const geminiImage = imageForGemini(c.imageAttachment);
  const sceneModel = buildModel(modelName, 1.18);
  const documentModel = buildModel(modelName, 1.05);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const sceneResult = await generateScene(sceneModel, c, judgeType, people, geminiImage);
    totals.requests += sceneResult.usage.requests;
    totals.inputTokens += sceneResult.usage.inputTokens;
    totals.outputTokens += sceneResult.usage.outputTokens;

    if (!sceneResult.scene.absurdDetails || sceneResult.scene.absurdDetails.length < 8) throw new Error('Scene details too weak');
    if (!sceneResult.scene.evidenceBits || sceneResult.scene.evidenceBits.length < 5) throw new Error('Evidence details too weak');

    const docResult = await generateDocuments(documentModel, c, judgeType, people, sceneResult.scene);
    totals.requests += docResult.usage.requests;
    totals.inputTokens += docResult.usage.inputTokens;
    totals.outputTokens += docResult.usage.outputTokens;
    const data = docResult.data;

    await resultRef.set({
      isPublic,
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
      imageAnalysis: geminiImage ? '' : '',
      hasImageAttachment: !!geminiImage,
      imageAttachmentMeta: imageMeta(c.imageAttachment),
      caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase,
      absurdDetails: sceneResult.scene.absurdDetails,
      evidenceBits: sceneResult.scene.evidenceBits,
      defendantExcuses: sceneResult.scene.defendantExcuses,
      penaltyIdeas: sceneResult.scene.penaltyIdeas,
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
      aiGenerated: true,
      resultVersion: 'two-step-absurd-scene-v1',
      analysisDigest: [],
      absurdityReview: '',
      keyIssues: [],
      evidenceList: [],
      investigation: '',
      verdict: data.courtOpinion,
      executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.',
      appealNotice: '본 사건은 단심으로 종결한다.',
      reactionTotal: 0,
      totalVotes: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: c.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await caseRef.update({
      status: 'completed',
      courtStage: 'sentenced',
      courtName: '소소킹 황당재판소',
      courtroom: people.courtroom,
      division: '제3황당재판부',
      recordClerk: people.recordClerk,
      analystName: people.analystName,
      prosecutorName: people.prosecutorName,
      defenderName: people.defenderName,
      judgeType,
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('generateTrial failed, no boring fallback saved:', err);
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      errorMessage: '재판부가 사건을 충분히 웃기게 구성하지 못했습니다. 다시 선고를 요청해주세요.',
      updatedAt: FieldValue.serverTimestamp()
    }).catch(() => null);
    throw new HttpsError('internal', '재판부가 사건을 충분히 웃기게 구성하지 못했습니다. 다시 시도해주세요.');
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(1),
        imageCaseCount: FieldValue.increment(geminiImage ? 1 : 0),
        firestoreReads: FieldValue.increment(3),
        firestoreWrites: FieldValue.increment(4),
        functionInvocations: FieldValue.increment(1),
        twoStepAbsurdCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic, hasImageAttachment: !!geminiImage, resultVersion: 'two-step-absurd-scene-v1' };
});
