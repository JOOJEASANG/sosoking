const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const ABSURD_DEPARTMENTS = ['제404호 황당법정', '제101호 황당분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보', '한과몰입 법정주사'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '사소범죄전담 나과몰입 형사', '증거아닌증거팀 정침묵 수사관', '냉장고평온권 특별수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '한입조항 담당 나과장 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 변호사 조그럴수도', '피고방어전담 변호인 임몰랐다'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanLong(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen);
}
function cleanList(value, fallback = [], maxItems = 6, maxLen = 160) {
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
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  return JUDGES[seed % JUDGES.length];
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
function funnyDisposition(text, fallbackText) {
  const out = cleanLong(text, 1800);
  if (!out) return fallbackText;
  const lines = out.split('\n').map(x => x.trim()).filter(Boolean);
  if (lines.length >= 5) return out;
  return `${out}\n피고는 본 사건이 소소킹까지 송치된 이유를 10초간 묵념한다.\n피고는 재범 시 같은 상황에서 먼저 '혹시 이거 황당재판 갈 일인가?'라고 자가진단한다.\n피고는 원고의 마음속 찝찝함을 간식 1개 상당의 평화조치로 달랜다.`;
}
function imageForGemini(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = cleanText(value.mimeType, 30);
  const data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
  if (!data || data.length > 700000) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return null;
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
function fallback(c, judgeType) {
  const title = cleanText(c.caseTitle, 40) || '이걸로 재판까지 온 사건';
  const thing = title.replace(/사건$/g, '').trim() || '본 사안';
  const hasImage = !!imageForGemini(c.imageAttachment);
  const docket = cleanText(c.docketNumber, 80) || '2026황당-임시-0001';
  const analyst = c.analystName || pickFrom(ANALYSTS, title);
  const prosecutorName = c.prosecutorName || pickFrom(PROSECUTORS, title);
  const defenderName = c.defenderName || pickFrom(DEFENDERS, title);
  return {
    absurdityTitle: `${title} 관련 제404호 과몰입 판결문`,
    agencyName: '소소킹 황당재판소',
    courtroom: c.courtroom || pickFrom(ABSURD_DEPARTMENTS, title),
    division: '제3황당재판부',
    recordClerk: c.recordClerk || pickFrom(CLERKS, title),
    analystName: analyst,
    prosecutorName,
    defenderName,
    imageAnalysis: hasImage ? '첨부 이미지는 본 사건의 결정적 증거가 아니라 분위기 참고자료로 접수되었다. 다만 소소경찰은 사진 한 장을 보는 순간 원고가 이 일을 그냥 넘기지 못한 사정을 직감하였다. 이미지 속 정황은 법적 증거가 아니라 마음속 현장검증 자료로만 채택된다.' : '',
    reception: `사건번호 ${docket}. 접수계는 ${thing}이라는 제목을 확인한 뒤 약 1.7초간 침묵하였다. 처음에는 '이걸 사건으로 받아도 되는가'라는 내부 회의가 열렸으나, 원고가 굳이 소소킹까지 찾아온 점이 중대하게 고려되었다. ${c.recordClerk || '기록관'}은 서류철 위에 '별일 아닌데 자꾸 생각나는 유형'이라는 붉은 메모를 붙였다. 결국 본 사건은 소소경찰 초동수사를 거쳐 ${c.courtroom || '제404호 황당법정'}으로 송치되었고, 법정 안의 공기는 필요 이상으로 무거워졌다.`,
    absurdityReview: `재판부는 이 사건이 실제 법원에 갈 일은 전혀 아니라고 보았다. 그러나 바로 그래서 소소킹 관할이 열린다고 판단하였다. 큰 피해는 없지만 마음속에 아주 작은 모래알이 들어간 사건, 말하자니 쪼잔하고 참자니 계속 떠오르는 사건은 황당재판의 핵심 소재다. 본 재판부는 이 사안을 '하찮음은 작으나 여운은 길다'는 기준으로 정식 심리한다.`,
    keyIssues: [
      `${thing}이 단순 해프닝인지, 원고의 하루 평온권을 침해한 소소 중대사안인지 여부`,
      `피고의 '그 정도는 아니지 않나'라는 태도가 사건을 2.4배 키웠는지 여부`,
      `황당검사의 공소제기가 과한지, 아니면 소소킹 기준으로 적정한지 여부`,
      `피고측 변호인의 '몰랐다' 주장이 마음속 배심원단을 설득할 수 있는지 여부`,
      hasImage ? '첨부 이미지가 황당성 가산점 17점을 발생시키는지 여부' : '증거가 없는데도 분위기상 너무 그럴듯한지 여부'
    ],
    evidenceList: [
      hasImage ? '분위기 참고 이미지 1매' : '원고의 말끝에서 감지된 미세한 억울 진동',
      '사건 직후 주변에 남은 애매한 침묵',
      '피고가 대수롭지 않게 넘겼을 가능성',
      '원고가 굳이 사건명을 붙인 정황',
      '평범한 하루가 괜히 찝찝해진 사후 상태',
      '소소경찰이 수첩에 밑줄을 두 번 그은 내부 심증'
    ],
    investigation: `${analyst}은 본 사건을 접수한 뒤 현장검증 대신 상상검증을 실시하였다. 조사 결과 사소함 지수는 91점, 억울함 잔향은 ${Number(c.grievanceIndex || 5) * 9}점, 주변인이 들으면 '아 그건 좀 웃기네'라고 말할 가능성은 88점으로 산정되었다. 특히 본 사건은 피해 규모보다 설명할 때의 민망함이 더 큰 유형이다. 조사관은 원고가 이 일을 말하면서도 '내가 지금 뭐 하는 거지'라고 느꼈을 가능성을 인정하였다. 그러나 그 민망함이야말로 소소킹 수사기관이 보호하는 핵심 법익이다. 이에 소소경찰은 사건을 황당검찰청으로 송치한다는 의견을 붙였다.`,
    plaintiffArg: `${prosecutorName}는 본 사건이 그냥 넘길 수 있는 일처럼 보이지만 실제로는 하루의 질서를 살짝 비틀었다고 주장한다. 검사는 피고가 조금만 눈치가 있었더라면 사건번호까지 부여되는 일은 없었을 것이라고 공소장을 낭독하였다. 원하는 처분은 '${cleanText(c.desiredVerdict, 120) || '납득 가능한 사과와 황당 반성'}'이다. 검사는 본 사안이 법률적으로는 가볍지만, 마음속 판례집에는 충분히 등재될 만하다고 강조하였다. 마지막으로 검사는 '이 정도면 그냥 웃고 넘길 수도 있지만, 원고가 이미 접수 버튼을 눌렀다'고 덧붙였다.`,
    defendantArg: `${defenderName}은 피고 측을 대리하여 '그게 그렇게까지 갈 일인가'라고 항변할 가능성이 높다. 변호인은 피고에게 악의가 없었고, 사건의 물리적 규모가 지나치게 작다고 주장한다. 그러나 그 주장은 너무 그럴듯해서 오히려 황당재판의 긴장감을 높인다. 변호인은 원고가 조금 예민했을 수 있다고 말하지만, 재판부는 바로 그 '조금'이 소소킹 사건의 출발점이라고 본다. 따라서 피고의 변론은 일부 참작하되 전부 면책할 수 없다.`,
    courtOpinion: `${judgeType} 재판부는 본 사건의 법적 무게가 종이컵보다 가볍다는 점을 인정한다. 그러나 감정적 존재감은 냉장고 마지막 디저트, 치킨 마지막 다리, 단체방 읽씹 알림에 버금간다. 실제 법원이라면 접수창구가 잠시 눈을 깜빡였겠지만, 소소킹에서는 바로 그 순간부터 재판이 시작된다. 소소경찰의 수사기록은 대체로 상상에 기반하고 있으나, 원고의 찝찝함을 설명하는 데에는 이상하게 설득력이 있다. 황당검사의 주장은 과하지만, 이 서비스에서는 과한 것이 직무상 미덕이다. 피고측 변호인의 반박 또한 말은 되지만, 말이 된다고 해서 원고의 마음속 빈자리가 자동으로 채워지는 것은 아니다. 사건의 핵심은 큰 피해가 아니라 '작은데 자꾸 생각나는 억울함'이다. 피고에게 악의가 없었을 수는 있다. 하지만 원고의 하루에 아주 작은 모래알을 넣은 책임까지 사라지는 것은 아니다. 재판부는 이 사건을 크게 키우는 것이 과하다는 사실을 알면서도, 과하게 키우는 것이 본 법정의 존재 이유라고 판단한다. 따라서 원고의 청구를 일부 인용하되, 처분은 엄숙하지만 어이없게 정한다. 이것이 소소킹식 정의다.`,
    verdict: `본 황당재판부는 원고의 청구를 상당 부분 받아들인다. 피고의 행위는 일상 속 사소한 선을 넘은 것으로 평가된다. 소소경찰의 수사, 황당검사의 공소, 피고측 변호인의 반박을 모두 살펴본 결과 본 사건은 '진짜로 큰일은 아니지만 기분상 그냥 넘어가기 싫은 일'에 해당한다. 원고가 '내가 이런 걸로 재판까지 해야 하나'라고 느낀 바로 그 순간, 사건성은 충분히 발생하였다. 다만 본 판결은 오락 목적의 AI 콘텐츠로서 실제 법적 효력은 없다. 효력은 오직 마음속 찝찝함을 웃음으로 정리하는 범위에서만 인정된다.`,
    sentence: `피고는 원고에게 진심 51%, 민망함 49%가 섞인 사과를 1회 실시한다.\n피고는 향후 3일간 유사 상황에서 '그게 뭐가 문제야?'라는 표현을 사용하지 못한다.\n피고는 원고에게 작은 간식 또는 커피 상당의 황당배상을 제안한다.\n피고는 본 사건이 소소킹까지 온 이유를 10초 이상 생각한 뒤 조용히 고개를 끄덕인다.\n재범 시 피고는 같은 상황에서 먼저 '혹시 이거 소소킹 갈 일인가?'라고 자가진단한다.`,
    executionOrder: '본 처분은 선고 즉시 마음속으로 집행된다. 피고가 불복할 경우 원고는 같은 사건을 더 억울한 제목으로 재접수할 수 있다.',
    appealNotice: '본 판결에 불복하는 자는 마음속으로 3분 이내 항소할 수 있다. 다만 항소심에서는 소소경찰의 수첩 여백까지 확대 심리될 수 있다.',
    closingComment: '이걸로 수사까지 한 것은 과하지만, 그래서 판결문이 완성됐다.'
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
  const courtroom = c.courtroom || pickFrom(ABSURD_DEPARTMENTS, c.caseTitle);
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
  let data = fallback({ ...c, courtroom, recordClerk, analystName, prosecutorName, defenderName }, judgeType);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName });
    const prompt = `너는 '소소킹 황당재판소'의 예능형 AI 법정드라마 작가 겸 재판부다.
목표는 사용자가 올린 제목, 내용, 이미지 파일을 분석해서 사건접수 → 소소경찰 수사 → 증거채집 → 황당검사 공소제기 → 피고측 변호인 반박 → 재판부 공방 → 판결까지 완성하는 것이다.

이 서비스의 핵심:
- 사용자는 짧게 접수하지만, 너는 그 일을 법정 드라마처럼 장황하게 키운다.
- 진짜 범죄처럼 만들지 말고, 소소한 생활사건을 과하게 엄숙한 수사극/법정극으로 바꾼다.
- 경찰, 검사, 변호사, 재판부가 모두 등장하되 실제 법률문서가 아니라 오락 콘텐츠여야 한다.
- 수사는 '소소경찰'의 상상검증과 정황감식이다. 실제 범죄 판단, 신원 추정, 위험 판단은 하지 않는다.
- 공방은 치열하지만 내용은 하찮아야 한다.

필수 재미 장치:
- 접수계가 '이걸 접수해야 하나' 고민하다 사건번호를 부여한다.
- ${analystName}이 초동수사, 현장 아닌 현장검증, 증거 아닌 증거 채집을 한다.
- ${prosecutorName}가 작은 일을 너무 엄숙하게 공소제기한다.
- ${defenderName}은 '그 정도는 아니지 않습니까' 계열의 말은 되는 반박을 한다.
- 재판부는 양쪽 공방을 듣고 작은 일을 더 크게 키운다.
- 증거는 실제 증거가 아니라 말끝의 떨림, 빈자리, 어색한 침묵, 이미지 속 분위기, 남은 흔적 같은 '증거 아닌 증거'다.
- 하찮은데 이름만 거창해야 한다. 예: 젓가락 권한 남용, 푸딩 기대권 침해, 한입 조항 위반, 마지막 조각 우선배당권, 리모컨 소재 은닉 의혹.

문체:
- 판결문처럼 진지하지만 실제 내용은 어이없게 쓴다.
- 짧은 드립 한 문장 다음에 과하게 엄숙한 긴 문장을 섞어 리듬을 만든다.
- '사과 1회' 같은 밋밋한 결론으로 끝내지 말고, 금지명령, 재발방지명령, 마음속 집행명령, 간식 상당 배상, 자가진단 의무를 섞는다.
- 마지막 closingComment는 공유하고 싶은 한 줄이어야 한다.

첨부 이미지가 있으면 이미지를 실제 범죄나 신원 증거처럼 단정하지 말고 분위기 참고자료로만 유머러스하게 다뤄라. 인물 신원, 민감정보, 실제 범죄 여부는 추정하지 않는다.

금지: 실제 법률 자문처럼 단정 금지, 욕설/혐오/성적 표현/자해/위험행위 조장 금지, 실명/연락처 생성 금지.

사건번호: ${cleanText(c.docketNumber, 80)}
사건명: ${cleanText(c.caseTitle, 40)}
사건 경위: ${cleanText(c.caseDescription, 320)}
억울지수: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 160) || '없음'}
담당 판사: ${judgeType}
소소경찰 담당: ${analystName}
황당검사: ${prosecutorName}
피고측 변호인: ${defenderName}
기록관: ${recordClerk}
법정: ${courtroom}
첨부 이미지: ${geminiImage ? '있음. 이미지 감정 내용을 분위기 참고자료로 반영할 것.' : '없음'}

반드시 JSON만 출력한다. 필드는 다음을 모두 포함한다.
{
  "absurdityTitle": "사건 제목을 더 웃긴 법정드라마식 제목으로 바꾼 제목",
  "imageAnalysis": "첨부 이미지 분석. 이미지가 없으면 빈 문자열. 이미지가 있으면 3문장 이상. 분위기 참고자료로만 다룸",
  "reception": "사건접수 기록. 사건번호, 접수계의 망설임, 소소경찰로 넘어가는 흐름. 5문장 이상",
  "absurdityReview": "재판까지 올 일인지 재판부가 과몰입해서 고민하는 내용. 5문장 이상",
  "keyIssues": ["검사와 변호인이 다툴 거창하지만 하찮은 쟁점 1", "쟁점 2", "쟁점 3", "쟁점 4", "쟁점 5"],
  "evidenceList": ["소소경찰이 채집한 증거 아닌 증거 1", "증거 아닌 증거 2", "증거 아닌 증거 3", "증거 아닌 증거 4", "증거 아닌 증거 5", "증거 아닌 증거 6"],
  "investigation": "소소경찰 수사보고서. 초동수사, 증거채집, 엉뚱한 수치 분석 포함. 7문장 이상",
  "plaintiffArg": "황당검사 측 공소제기와 공격. 작지만 중대한 척. 5문장 이상",
  "defendantArg": "피고측 변호인 반박. 말은 되지만 어이없게. 5문장 이상",
  "courtOpinion": "재판부 판단. 검사와 변호인 공방을 받은 뒤 판단. 9문장 이상. 가장 길고 웃기게",
  "verdict": "최종 판결 이유. 수사·증거·공방을 종합. 5문장 이상. 오락 콘텐츠임을 자연스럽게 포함",
  "sentence": "주문 및 황당 처분. 줄바꿈으로 5개 이상. 피고는... 형태를 많이 사용. 하찮은 금지명령과 재발방지 드립 포함",
  "executionOrder": "집행명령. 2문장 이상. 마음속 집행, 간식 집행 같은 표현 활용",
  "appealNotice": "항소 안내. 2문장 이상. 더 사소한 정황까지 심리될 수 있다는 드립 포함",
  "closingComment": "짧고 웃긴 마지막 한 줄"
}`;
    const parts = [{ text: prompt }];
    if (geminiImage) parts.push({ inlineData: geminiImage });
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const meta = result.response.usageMetadata || {};
    totals = {
      requests: 1,
      inputTokens: meta.promptTokenCount || 0,
      outputTokens: meta.candidatesTokenCount || 0
    };
    const parsed = safeJson(result.response.text());
    data = {
      ...data,
      absurdityTitle: cleanText(parsed.absurdityTitle, 90) || data.absurdityTitle,
      imageAnalysis: geminiImage ? (cleanLong(parsed.imageAnalysis, 1400) || data.imageAnalysis) : '',
      reception: cleanLong(parsed.reception, 1700) || data.reception,
      absurdityReview: cleanLong(parsed.absurdityReview, 1600) || data.absurdityReview,
      keyIssues: cleanList(parsed.keyIssues, data.keyIssues, 6, 190),
      evidenceList: cleanList(parsed.evidenceList, data.evidenceList, 8, 190),
      investigation: cleanLong(parsed.investigation, 2200) || data.investigation,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 1700) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 1700) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 2800) || data.courtOpinion,
      verdict: cleanLong(parsed.verdict, 2000) || data.verdict,
      sentence: funnyDisposition(parsed.sentence, data.sentence),
      executionOrder: cleanLong(parsed.executionOrder, 1000) || data.executionOrder,
      appealNotice: cleanLong(parsed.appealNotice, 800) || data.appealNotice,
      closingComment: cleanText(parsed.closingComment, 200) || data.closingComment
    };
  } catch (err) {
    console.error('generateTrial AI failed, using fallback:', err);
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
      caseTitle: c.caseTitle || '황당재판 결과',
      absurdityTitle: data.absurdityTitle,
      imageAnalysis: data.imageAnalysis || '',
      hasImageAttachment: !!geminiImage,
      imageAttachmentMeta: imageMeta(c.imageAttachment),
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.reception,
      absurdityReview: data.absurdityReview,
      keyIssues: data.keyIssues,
      evidenceList: data.evidenceList,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      courtOpinion: data.courtOpinion,
      verdict: data.verdict,
      sentence: data.sentence,
      executionOrder: data.executionOrder,
      appealNotice: data.appealNotice,
      closingComment: data.closingComment,
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
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic, hasImageAttachment: !!geminiImage };
});
