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
function cleanList(value, fallback = [], maxItems = 8, maxLen = 180) {
  const source = Array.isArray(value) ? value : [];
  const rows = source.map(v => cleanText(v, maxLen)).filter(Boolean).slice(0, maxItems);
  return rows.length ? rows : fallback;
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
  const objectHint = title.replace(/사건기록철|사건/g, '').trim() || title;
  const prosecutorName = c.prosecutorName || pickFrom(PROSECUTORS, title);
  const defenderName = c.defenderName || pickFrom(DEFENDERS, title);
  return {
    refinedCaseTitle: title,
    absurdityTitle: `${title} 기록철`,
    analysisDigest: [
      `접수 내용 핵심: ${objectHint}`,
      `피해 기대: ${objectHint}을 둘러싼 사소한 평온`,
      `최종 출력: 7개 핵심문서로 압축`
    ],
    imageAnalysis: imageForGemini(c.imageAttachment) ? `문서명: 첨부사진 현장참고 검토서\n첨부사진은 ${objectHint}의 위치와 장면 분위기를 보조적으로 확인하기 위한 참고자료로만 검토한다. 사진만으로 실제 책임을 단정하지 않으며, 소소킹 세계관의 오락용 감정 범위 안에서만 해석한다.` : '',
    reception: `문서명: ${title} 사건접수조서\n사건번호: ${cleanText(c.docketNumber, 80) || '황당사건번호 미상'}\n원고는 '${desc}'라는 취지로 본 사건을 접수하였다. 접수계는 ${objectHint}이 단순한 배경 사물이 아니라 원고가 기대하던 평온의 중심물이었다고 기록한다. 본 조서는 실제 법률문서가 아니라, ${objectHint}을 지나치게 정식으로 다루기 위한 소소킹 사건기록이다.`,
    caseTimeline: `문서명: ${objectHint} 분초 단위 사건일지\n00분 00초, 원고는 ${objectHint}과 관련된 평온한 상태에 있었다.\n00분 07초, 사건 경위에 기재된 결정적 행동이 발생하며 ${objectHint}을 둘러싼 질서가 흔들렸다.\n00분 12초, 원고는 상황이 원래대로 돌아오지 않는다는 사실을 인식하였다.\n00분 20초, 현장은 지나치게 조용했고, 그 조용함은 오히려 ${objectHint} 사건의 중대성을 키웠다.`,
    forensicReport: `문서명: 소소국과수 ${objectHint} 생활증거 감정서\n감정기관: 국립소소과학수사연구소 생활증거분석실\n감정대상: ${objectHint}의 위치, 접촉 가능성, 사라진 기대의 흔적.\n감정방법: 현장진술 대조, 대상물 위치 추정, 사후 정적 분석.\n감정의견: 제출된 자료만으로 실제 책임을 단정할 수는 없으나, 원고가 ${objectHint}을 둘러싼 기대를 잃었다는 정황은 소소킹 감정 기준상 확인된다.`,
    plaintiffArg: `문서명: ${prosecutorName} 공소장\n검사는 ${objectHint}이 우연히 지나간 일이 아니라 원고의 사소한 평온을 정면으로 흔든 사건이라고 주장한다. 원고가 잃은 것은 물건 하나가 아니라 ${objectHint}을 당연히 누릴 수 있으리라는 믿음이었다. 검사는 피고 측이 이를 '그럴 수도 있는 일'로 축소하려는 순간 본 사건의 황당성이 완성된다고 본다.`,
    defendantArg: `문서명: ${defenderName} 답변서\n피고 측은 ${objectHint}이 지나치게 정식 사건으로 격상되었다고 항변한다. 당시 상황은 급박하지 않았고, 피고에게 명확한 고의가 있었다고 단정하기 어렵다는 취지다. 다만 변호인의 항변은 원고가 ${objectHint} 앞에서 느낀 허탈함을 완전히 지우지는 못한다.`,
    courtOpinion: `문서명: 재판부 판단\n${judgeType} 재판부는 접수조서, 사건일지, 소소국과수 감정서, 공소장 및 답변서를 종합한다. 본 사건은 현실의 법률분쟁이 아니라 오락용 황당재판이나, ${objectHint}을 둘러싼 원고의 기대가 끊어진 사실은 기록상 인정된다. 재판부는 피고에게 과도한 책임을 부과하지 않되, ${objectHint} 앞에서 발생한 정적을 가볍게 보지 않는다.`,
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
      '과몰입형': '사건의 작은 디테일을 장엄하게 해석한다. 문체는 끝까지 엄숙하다.',
      '피곤형': '건조하고 짧게 판단하되 결론은 은근히 단호하다.',
      '논리집착형': '행위, 대상, 기대, 결과, 참작사유를 세분화한다.',
      '드립형': '말장난 대신 마지막 한 줄에만 절제된 재치를 허용한다.'
    }[judgeType] || '판결 부분에만 재판부 성향을 절제하여 반영한다.';

    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.96, topP: 0.97, topK: 40, responseMimeType: 'application/json' }
    });

    const prompt = `너는 '소소킹 황당재판소'의 수석검사·소소국과수 감정관·대법관이다.

이번 생성은 바로 결과문을 쓰면 실패다.
반드시 접수내용을 내부적으로 7차까지 정리·보완한 뒤, 사이트 화면에 어울리는 최종 문서만 출력한다.
내부 1차~7차 정리 내용은 길게 출력하지 말고, analysisDigest에 아주 짧게만 남긴다.

입력 사건:
- 사건번호: ${cleanText(c.docketNumber, 80)}
- 저장된 사건명: ${cleanText(c.caseTitle, 80)}
- 접수 내용: ${cleanText(c.caseDescription, 560)}
- 원하는 처분: ${cleanText(c.desiredVerdict, 180) || '없음'}
- 억울함 강도: ${Number(c.grievanceIndex || 5)}/10. 숫자는 출력하지 말고 강약만 반영한다.
- 담당 재판부: ${judgeType}
- 재판부 성향 적용: ${judgeGuide}
- 기록관: ${recordClerk}
- 수사관: ${analystName}
- 검사: ${prosecutorName}
- 변호인: ${defenderName}
- 법정: ${courtroom}
- 첨부 이미지: ${geminiImage ? '있음. 이미지 내용은 참고자료로만 다룬다.' : '없음'}

내부 7차 정리 절차:
1차 사실분해: 접수내용에서 행위자, 장소, 피해대상, 결정적 행동을 분리한다.
2차 피해정리: 원고가 잃은 물건, 기대, 순서, 평온, 마지막 한입권 같은 사소한 권리를 정리한다.
3차 반박예상: 피고가 할 법한 변명과 억울한 사정을 만든다.
4차 감정대상선정: 소소국과수가 분석할 미세증거 4개 이상을 고른다.
5차 제목보완: 저장된 사건명을 사이트 구성에 맞게 다시 다듬어 refinedCaseTitle을 만든다.
6차 문서압축: 7개 핵심 문서에 중복 내용을 배분하고, 쓸데없는 반복문을 제거한다.
7차 최종검수: 모든 문단에 사건 고유명사 또는 구체물이 들어갔는지 확인하고 최종 출력한다.

절대 금지 문장과 표현:
- 생활질서 미세교란
- 사소하지만 기록 보존 가치
- 사건의 크기는 작으나
- 마음속 CCTV
- 상상 목격자
- 방청석이 웃음을 참았다
- 사건 대상의 위치와 상태에 관한 진술 메모
- 사건 전후 원고의 기대 변화 정리표
- CCTV 확인 대상 구간 특정표
- 피고 측 예상 반박 문장
- 담당 수사관 수첩 기재사항
- 원고가 기대하던 흐름이 특정 행위로 끊어진 사실
- 사건 대상의 사소함과 기록 형식의 장엄함
- 이걸 접수해야 하나
- 실제 국과수, 실제 경찰, 실제 검찰을 직접 사칭하는 표현

문체 규칙:
- 진짜 문서처럼 깔끔하게 쓴다.
- 한 문장은 너무 길게 쓰지 않는다.
- 사건번호, 시각, 감정기관, 감정대상 같은 정보는 줄 단위로 정리한다.
- 절대 가벼운 농담투를 쓰지 않는다.
- 웃기다는 설명을 하지 않는다.
- 인터넷 밈, ㅋㅋ, 감탄사 금지.
- 각 문단에는 반드시 사건 고유명사 또는 구체물을 1개 이상 넣는다.
- 법적 효력 없음 문구는 본문에 넣지 말고 executionOrder 마지막에만 1회 넣는다.

출력 구조는 아래 7개 문서만 쓴다.
1. reception: 사건접수조서. 사건번호, 사건명, 장소, 피해대상, 원고의 잃어버린 기대를 줄 단위로 깔끔하게 작성.
2. caseTimeline: 분·초 단위 사건일지. 00분 00초부터 5~7개 시각으로 재구성. 보안 공백 또는 주의 공백 포함.
3. forensicReport: 소소국과수 감정서. 감정기관, 감정대상, 감정방법, 감정결과, 감정의견 포함. 사건별 미세증거 4개 이상.
4. plaintiffArg: 황당검사 공소장. 구체물과 잃어버린 권리를 중심으로 5~7문장.
5. defendantArg: 피고 측 답변서. 말은 되지만 얄미운 궤변. 피고 태도 포함. 5~7문장.
6. courtOpinion: 재판부 판단. 공소장, 답변서, 소소국과수 감정서를 종합. 판사 성향은 여기서만 반영. 6~8문장.
7. sentence: 주문 및 집행권고. 사건 맞춤 처분 5개. 실제 위해, 실제 구금, 폭력, 모욕 금지.

JSON만 출력한다.
{
  "refinedCaseTitle": "저장된 사건명을 한 번 더 보완한 최종 사건명",
  "absurdityTitle": "최종 사건명을 포함한 기록철 제목",
  "analysisDigest": ["1차~7차 정리 결과를 매우 짧게 요약", "구체명사 중심", "출력 전 보완 내용"],
  "imageAnalysis": "이미지가 없으면 빈 문자열. 있으면 첨부사진 참고의견 3문장",
  "reception": "문서명: ... 사건접수조서 로 시작",
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
      analysisDigest: cleanList(parsed.analysisDigest, data.analysisDigest, 7, 120),
      imageAnalysis: geminiImage ? (cleanLong(parsed.imageAnalysis, 1200) || data.imageAnalysis) : '',
      reception: cleanLong(parsed.reception, 2200) || data.reception,
      caseTimeline: cleanLong(parsed.caseTimeline, 2400) || data.caseTimeline,
      forensicReport: cleanLong(parsed.forensicReport, 2600) || data.forensicReport,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 2200) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 2200) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 2600) || data.courtOpinion,
      sentence: cleanLong(parsed.sentence, 2400) || data.sentence,
      closingComment: cleanText(parsed.closingComment, 240) || data.closingComment
    };
    aiGenerated = true;
  } catch (err) {
    console.error('generateTrial AI failed, using compact fallback:', err);
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
      analysisDigest: data.analysisDigest || [],
      imageAnalysis: data.imageAnalysis || '',
      hasImageAttachment: !!geminiImage,
      imageAttachmentMeta: imageMeta(c.imageAttachment),
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.reception,
      caseTimeline: data.caseTimeline,
      forensicReport: data.forensicReport,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      courtOpinion: data.courtOpinion,
      sentence: data.sentence,
      closingComment: data.closingComment,
      aiGenerated,
      resultVersion: 'seven-pass-document-v1',
      absurdityReview: '',
      keyIssues: [],
      evidenceList: [],
      investigation: '',
      verdict: data.courtOpinion,
      executionOrder: '본 기록은 실제 법적 효력이 없는 소소킹 오락용 문서이며, 법률 자문으로 활용할 수 없습니다.',
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
        compactResultCount: FieldValue.increment(1),
        sevenPassResultCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic, hasImageAttachment: !!geminiImage, resultVersion: 'seven-pass-document-v1' };
});
