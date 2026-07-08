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
function fallbackCaseFile(c, judgeType) {
  const title = cleanText(c.caseTitle, 60) || '소소한 일상 사건';
  const desc = cleanText(c.caseDescription, 260) || title;
  const objectHint = title.replace(/사건기록철|기록철|사건/g, '').trim() || title;
  const prosecutorName = c.prosecutorName || pickFrom(PROSECUTORS, title);
  const defenderName = c.defenderName || pickFrom(DEFENDERS, title);
  return {
    refinedCaseTitle: title,
    absurdityTitle: `${title} 기록철`,
    expandedCase: `문서명: 사건 배경 및 발단 기록\n본 사건은 '${desc}'라는 짧은 진술에서 출발하였다. 기록관은 ${objectHint}을 단순한 물건이나 순간으로 보지 않고, 원고의 하루가 잠시 믿고 있던 작은 질서로 보았다. 평온은 대개 큰 소리로 무너지지 않는다. 때로는 ${objectHint} 하나가 예상과 다르게 움직이는 순간, 원고의 표정 위에 조용한 정적이 내려앉는다. 그 정적이 바로 본 기록의 발단이다.`,
    imageAnalysis: imageForGemini(c.imageAttachment) ? `문서명: 첨부사진 현장참고 검토서\n첨부사진은 ${objectHint}의 위치와 장면 분위기를 보조적으로 확인하기 위한 참고자료로만 검토한다. 사진만으로 책임을 단정하지 않으며, 장면 속 배치와 비어 있는 공간만 기록한다.` : '',
    caseTimeline: `문서명: ${objectHint} 분초 단위 사건일지\n00분 00초, 원고는 ${objectHint}과 관련된 평온한 상태에 있었다.\n00분 07초, 사건 경위에 기재된 결정적 행동이 발생하였다.\n00분 12초, 원고는 상황이 원래대로 돌아오지 않는다는 사실을 인식하였다.\n00분 20초, 현장은 지나치게 조용했고 그 조용함은 ${objectHint} 사건의 무게를 키웠다.`,
    forensicReport: `문서명: 소소국과수 ${objectHint} 생활증거 감정서\n감정기관: 국립소소과학수사연구소 생활증거분석실\n감정대상: ${objectHint}의 위치, 접촉 가능성, 사라진 기대의 흔적\n감정방법: 현장진술 대조, 대상물 위치 추정, 사후 정적 분석\n감정의견: 제출된 자료만으로 책임을 단정할 수는 없으나, 원고가 ${objectHint}을 둘러싼 기대를 잃었다는 정황은 확인된다.`,
    plaintiffArg: `문서명: ${prosecutorName} 공소장\n검사는 ${objectHint}이 우연히 지나간 일이 아니라 원고의 사소한 평온을 정면으로 흔든 사건이라고 주장한다. 원고가 잃은 것은 물건 하나가 아니라 ${objectHint}을 당연히 누릴 수 있으리라는 믿음이었다. 검사는 피고 측이 이를 '그럴 수도 있는 일'로 축소하는 순간 본 사건의 황당성이 완성된다고 본다.`,
    defendantArg: `문서명: ${defenderName} 답변서\n피고 측은 ${objectHint}이 지나치게 정식 사건으로 격상되었다고 항변한다. 당시 상황은 급박하지 않았고, 피고에게 명확한 고의가 있었다고 단정하기 어렵다는 취지다. 다만 변호인의 항변은 원고가 ${objectHint} 앞에서 느낀 허탈함을 완전히 지우지는 못한다.`,
    courtOpinion: `문서명: 재판부 판단\n${judgeType} 재판부는 사건 배경 기록, 사건일지, 소소국과수 감정서, 공소장 및 답변서를 종합한다. ${objectHint}을 둘러싼 원고의 기대가 끊어진 사실은 기록상 인정된다. 재판부는 피고에게 과도한 책임을 부과하지 않되, ${objectHint} 앞에서 발생한 정적을 가볍게 보지 않는다.`,
    sentence: `문서명: 주문 및 집행권고\n1. 피고는 ${objectHint}과 관련하여 원고에게 사과 1회를 실시한다.\n2. 피고는 유사 상황에서 대상의 소유 또는 기대 상태를 먼저 확인한다.\n3. 피고는 원고의 상실된 기대 회복을 위한 간식 또는 음료 상당의 평화조치를 제안한다.\n4. 피고는 같은 사안을 두고 '별일 아니다'라고 말하기 전 3초간 숙고한다.\n5. 본 주문은 실제 강제력이 없으며 마음속 기록철 편철로 집행된다.`,
    closingComment: `${objectHint}은 사소했으나, 그 앞에서 멈춘 원고의 표정은 기록될 만하였다.`
  };
}
async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
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
  if (c.status !== 'pending') throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge);
  const courtroom = c.courtroom || pickFrom(COURTROOMS, c.caseTitle);
  const recordClerk = c.recordClerk || pickFrom(CLERKS, c.caseTitle);
  const analystName = c.analystName || pickFrom(ANALYSTS, c.caseTitle);
  const prosecutorName = c.prosecutorName || pickFrom(PROSECUTORS, c.caseTitle);
  const defenderName = c.defenderName || pickFrom(DEFENDERS, c.caseTitle);

  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (current.status !== 'pending') return;
    c = current;
    tx.update(caseRef, {
      status: 'processing',
      courtStage: 'hearing',
      courtName: '소소킹 황당재판소',
      courtroom,
      division: '제3황당재판부',
      recordClerk,
      analystName,
      prosecutorName,
      defenderName,
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
  let data = fallbackCaseFile({ ...c, courtroom, recordClerk, analystName, prosecutorName, defenderName }, judgeType);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let aiGenerated = false;

  try {
    const judgeGuide = {
      '엄벌주의형': '주문에서 책임을 비교적 엄격히 보되 실제 위해나 구금 표현은 쓰지 않는다.',
      '감성형': '원고가 잃은 기대와 허탈함을 세밀하게 참작한다.',
      '현실주의형': '실행 가능한 처분과 부담 없는 평화조치 중심으로 판단한다.',
      '과몰입형': '작은 사건을 대하드라마처럼 장엄하게 해석한다. 문체는 끝까지 엄숙하다.',
      '피곤형': '건조하고 짧게 판단하되 결론은 은근히 단호하다.',
      '논리집착형': '행위, 대상, 기대, 결과, 참작사유를 세분화한다.',
      '드립형': '말장난 대신 마지막 한 줄에만 절제된 재치를 허용한다.'
    }[judgeType] || '판결 부분에만 재판부 성향을 절제하여 반영한다.';

    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 1.02, topP: 0.98, topK: 50, responseMimeType: 'application/json' }
    });

    const prompt = `너는 '소소킹 황당재판소'의 수석검사, 소소국과수 감정관, 대법관이다.

가장 중요한 목표:
사용자가 짧게 접수한 내용을 그대로 요약하지 마라.
짧은 접수 내용을 바탕으로 사건의 배경, 원인, 발단, 전개, 결정적 장면, 피해 체감을 가상으로 확장한 뒤 그 장문 사건기록을 바탕으로 최종 문서를 작성하라.
단, 실제 인물 신상, 실제 범죄 단정, 실제 법률 조언은 만들지 않는다.
웃음은 농담이 아니라 지나치게 엄숙한 문체와 너무 사소한 사건의 간극에서 나오게 한다.

입력 사건:
- 사건번호: ${cleanText(c.docketNumber, 80)}
- 저장된 사건명: ${cleanText(c.caseTitle, 80)}
- 접수 내용: ${cleanText(c.caseDescription, 620)}
- 원하는 처분: ${cleanText(c.desiredVerdict, 180) || '없음'}
- 억울함 강도: ${Number(c.grievanceIndex || 5)}/10. 숫자는 출력하지 말고 강약만 반영한다.
- 담당 재판부: ${judgeType}
- 재판부 성향 적용: ${judgeGuide}
- 기록관: ${recordClerk}
- 수사관: ${analystName}
- 검사: ${prosecutorName}
- 변호인: ${defenderName}
- 법정: ${courtroom}
- 첨부 이미지: ${geminiImage ? '있음. 이미지는 현장 참고자료로만 다룬다.' : '없음'}

먼저 내부적으로 다음 순서로 사건을 키워라. 이 내부 과정은 출력하지 말고 결과 문서에 녹여라.
1. 배경: 사건 직전의 평온한 장면을 구체적으로 만든다.
2. 원인: 왜 그 사소한 물건이나 행동이 원고에게 중요했는지 만든다.
3. 발단: 원고가 이상함을 처음 감지한 순간을 만든다.
4. 전개: 행위자 또는 피고 측이 어떻게 문제를 키웠는지 만든다.
5. 결정적 장면: 빵 부스러기, 문틈, 봉지, 리모컨, 빈자리, 냉장고 선반 등 구체 증거가 드러나는 순간을 만든다.
6. 피해 체감: 원고가 잃은 것은 물건이 아니라 기대, 순서, 마지막 한입권, 평온, 체면 같은 사소한 권리임을 만든다.
7. 문서화: 위 장문 사건을 사건접수조서, 사건일지, 감정서, 공소장, 답변서, 판단, 주문으로 배분한다.

절대 금지:
- 사이트, 시스템, AI, 프롬프트, 7차 정리, 자동 생성, 사용자 입력, 오락용, 법률 자문이라는 말을 본문에 쓰지 마라.
- 생활질서 미세교란, 사소하지만 기록 보존 가치, 사건의 크기는 작으나, 마음속 CCTV, 상상 목격자, 방청석이 웃음을 참았다.
- 사건 대상의 위치와 상태에 관한 진술 메모, 사건 전후 원고의 기대 변화 정리표, CCTV 확인 대상 구간 특정표, 피고 측 예상 반박 문장, 담당 수사관 수첩 기재사항.
- 어느 사건에 붙여도 되는 추상문장. 반드시 빵, 리트리버, 공원 벤치, 카누 봉지, 문고리, 리모컨, 푸딩 같은 구체물을 넣어라.

문체 규칙:
- 셰익스피어 비극이나 대하드라마처럼 장엄하게 쓴다.
- 다만 모바일에서 읽기 좋게 문장은 짧고 단단하게 쓴다.
- 가벼운 농담투, 인터넷 밈, ㅋㅋ, 감탄사 금지.
- 사건의 사소함을 직접 비웃지 않는다.
- 모든 문서에는 사건 고유명사나 구체물이 반복해서 등장해야 한다.
- 소소국과수는 가상기관명으로만 쓴다. 실제 기관명처럼 단정하지 않는다.

출력 구조:
1. expandedCase: 짧은 접수 내용을 장문으로 확장한 '사건 배경 및 발단 기록'. 8~12문장. 배경, 원인, 발단, 전개, 결정적 장면, 피해 체감을 모두 포함.
2. caseTimeline: 분·초 단위 사건일지. 6개 시각 이상.
3. forensicReport: 소소국과수 감정서. 감정기관, 감정대상, 감정방법, 감정결과, 감정의견 포함. 사건별 미세증거 4개 이상.
4. plaintiffArg: 황당검사 공소장. 피를 토하듯 엄숙하게 주장. 구체물과 잃어버린 권리 중심.
5. defendantArg: 피고 측 답변서. 말은 되지만 얄미운 궤변. 피고 태도 포함.
6. courtOpinion: 재판부 판단. 공소장, 답변서, 소소국과수 감정서를 종합. 판사 성향은 여기서만 반영.
7. sentence: 주문 및 집행권고. 사건 맞춤 생활형 처분 5개. 실제 위해, 실제 구금, 폭력, 모욕 금지.

JSON만 출력한다.
{
  "refinedCaseTitle": "접수 내용을 바탕으로 다시 다듬은 최종 사건명",
  "absurdityTitle": "최종 사건명을 포함한 기록철 제목",
  "imageAnalysis": "이미지가 없으면 빈 문자열. 있으면 첨부사진 참고의견 3문장",
  "expandedCase": "문서명: ... 사건 배경 및 발단 기록 로 시작",
  "caseTimeline": "문서명: ... 사건일지 로 시작",
  "forensicReport": "문서명: ... 소소국과수 감정서 로 시작",
  "plaintiffArg": "문서명: ... 공소장 로 시작",
  "defendantArg": "문서명: ... 답변서 로 시작",
  "courtOpinion": "문서명: ... 재판부 판단 로 시작",
  "sentence": "문서명: 주문 및 집행권고 로 시작. 줄바꿈으로 5개 이상",
  "closingComment": "사건 고유명사를 포함한 장엄한 한 줄"
}`;

    const parts = [{ text: prompt }];
    if (geminiImage) parts.push({ inlineData: geminiImage });
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const meta = result.response.usageMetadata || {};
    totals = { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 };
    const parsed = safeJson(result.response.text());
    data = {
      ...data,
      refinedCaseTitle: cleanText(parsed.refinedCaseTitle, 80) || data.refinedCaseTitle,
      absurdityTitle: cleanText(parsed.absurdityTitle, 120) || data.absurdityTitle,
      imageAnalysis: geminiImage ? (cleanLong(parsed.imageAnalysis, 1200) || data.imageAnalysis) : '',
      expandedCase: cleanLong(parsed.expandedCase, 3600) || data.expandedCase,
      caseTimeline: cleanLong(parsed.caseTimeline, 2600) || data.caseTimeline,
      forensicReport: cleanLong(parsed.forensicReport, 3000) || data.forensicReport,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 2600) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 2400) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 2800) || data.courtOpinion,
      sentence: cleanLong(parsed.sentence, 2400) || data.sentence,
      closingComment: cleanText(parsed.closingComment, 240) || data.closingComment
    };
    aiGenerated = true;
  } catch (err) {
    console.error('generateTrial AI failed, using dramatic fallback:', err);
  }

  try {
    await resultRef.set({
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 황당재판소',
      courtroom,
      division: '제3황당재판부',
      recordClerk,
      analystName,
      prosecutorName,
      defenderName,
      caseTitle: data.refinedCaseTitle || c.caseTitle || '황당재판 결과',
      originalCaseTitle: c.caseTitle || '',
      refinedCaseTitle: data.refinedCaseTitle || c.caseTitle || '',
      absurdityTitle: data.absurdityTitle,
      imageAnalysis: data.imageAnalysis || '',
      hasImageAttachment: !!geminiImage,
      imageAttachmentMeta: imageMeta(c.imageAttachment),
      caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase,
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
      resultVersion: 'dramatic-expanded-case-v1',
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
      courtroom,
      division: '제3황당재판부',
      recordClerk,
      analystName,
      prosecutorName,
      defenderName,
      judgeType,
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    await caseRef.update({ status: 'error', courtStage: 'error', errorMessage: err.message || '알 수 없는 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw err;
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
        dramaticResultCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic, hasImageAttachment: !!geminiImage, resultVersion: 'dramatic-expanded-case-v1' };
});
