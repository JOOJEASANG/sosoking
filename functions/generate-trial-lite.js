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
  const out = cleanLong(text, 2000);
  if (!out) return fallbackText;
  const lines = out.split('\n').map(x => x.trim()).filter(Boolean);
  if (lines.length >= 5) return out;
  return `${out}\n피고는 사건 현장을 지나갈 때마다 1초간 시선을 낮추는 주의의무를 부담한다.\n피고는 재범 방지를 위하여 유사 상황 발생 시 먼저 '잠깐, 이거 소소경찰 부를 일인가?'라고 자가진단한다.\n피고는 원고의 마음속 현장복구를 위해 간식 1개 상당의 평화조치를 제안한다.`;
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
  const title = cleanText(c.caseTitle, 40) || '소소한 현장 훼손 의혹 사건';
  const thing = title.replace(/사건$/g, '').trim() || '본 사안';
  const hasImage = !!imageForGemini(c.imageAttachment);
  const docket = cleanText(c.docketNumber, 80) || '2026황당-임시-0001';
  const analyst = c.analystName || pickFrom(ANALYSTS, title);
  const prosecutorName = c.prosecutorName || pickFrom(PROSECUTORS, title);
  const defenderName = c.defenderName || pickFrom(DEFENDERS, title);
  return {
    absurdityTitle: `${title} 관련 소소경찰 수사 및 황당재판 기록`,
    agencyName: '소소킹 황당재판소',
    courtroom: c.courtroom || pickFrom(ABSURD_DEPARTMENTS, title),
    division: '제3황당재판부',
    recordClerk: c.recordClerk || pickFrom(CLERKS, title),
    analystName: analyst,
    prosecutorName,
    defenderName,
    imageAnalysis: hasImage ? '첨부 이미지는 소소경찰 감식반에 의해 분위기 참고자료로 분류되었다. 감식반은 화면 속 물건의 배치, 비어 있는 공간, 괜히 수상해 보이는 구석을 중심으로 정황을 살폈다. 다만 인물 신원이나 실제 범죄 여부는 추정하지 않고, 본 자료는 오직 황당재판용 현장 분위기 자료로만 채택된다.' : '',
    reception: `사건번호 ${docket}. 접수 직후 ${c.recordClerk || '기록관'}은 사건명을 세 번 읽고 서류철 색깔부터 골랐다. ${thing}이라는 사안은 물리적으로는 작았지만, 기록관은 '이건 제목을 붙인 순간 이미 사건화가 끝났다'는 취지로 접수 도장을 찍었다. 접수부에는 '생활질서 미세균열 의혹'이라는 임시 죄명이 적혔다. 사건은 곧바로 ${analyst}에게 배당되었고, 수사관은 펜을 꺼내며 별일 아닌 표정을 지으려다 실패했다.`,
    absurdityReview: `재판부는 사건기록을 넘기며 이 사안이 평범한 해프닝인지, 아니면 조용히 사람 기분을 긁는 생활형 대형사건인지 검토하였다. 기록상 피해 규모는 작지만, 설명할 때마다 말이 길어지는 점이 중대하게 보였다. 특히 원고가 이 일을 그냥 넘기지 않고 사건명까지 붙인 대목은 재판부의 주목을 받았다. 본 법정은 작은 일을 작게 다루지 않는다는 원칙에 따라, 사안을 과장 가능한 범위 안에서 최대한 엄숙하게 다루기로 한다.`,
    keyIssues: [
      `${thing}이 단순한 우연인지, 생활질서 미세파괴 행위인지 여부`,
      `피고가 '별거 아니다'라는 표정으로 사건을 키웠는지 여부`,
      `CCTV에는 찍히지 않았지만 마음속 재생화면에는 선명히 남았는지 여부`,
      `${prosecutorName}의 과장된 공소사실이 웃기면서도 묘하게 설득력 있는지 여부`,
      `${defenderName}의 '그럴 수도 있다' 방어가 오히려 원고의 혈압을 올렸는지 여부`
    ],
    evidenceList: [
      hasImage ? '현장 분위기 참고 이미지 1매' : '현장 CCTV 0.5배속 상상 재생 결과 수상한 공백 1곳',
      '사건 직후 공기 중에 남은 어색한 정적',
      '원고가 설명 도중 점점 더 억울해진 정황',
      '피고 측이 몰랐다고 할수록 더 수상해지는 표정 가능성',
      '소소경찰이 현장 보존을 위해 마음속에 붙인 노란 테이프',
      '소과수 감정 결과: 별일 아닌데 이상하게 신경 쓰임'
    ],
    investigation: `${analyst}은 현장에 출동한 척하며 먼저 생활반경 CCTV를 확인한 것으로 기록하였다. 실제 CCTV가 존재하지 않는 경우에도 수사관은 '마음속 CCTV'를 0.5배속으로 돌려 보며 사건 전후의 분위기를 분석하였다. 이어 주변 공기, 빈자리, 원고의 말끝, 피고가 했을 법한 무심한 표정을 순서대로 채집하였다. 소소경찰은 압수수색영장 대신 포스트잇을 꺼내 현장에 '괜히 찝찝함'이라고 표시하였다. 탐문수사 결과, 지나가던 상상 목격자는 '큰일은 아닌데 듣다 보니 원고 편을 들고 싶다'는 취지로 진술하였다. 소과수 감정반은 본 사안을 생활질서 미세균열 사건으로 분류하였다. 이에 수사관은 본 건을 황당검찰청으로 송치하며 '그냥 넘어가기에는 제목이 너무 잘 붙었다'는 의견을 남겼다.`,
    plaintiffArg: `${prosecutorName}는 공판에서 원고의 하루가 평온하게 흘러가던 중 피고의 행위 또는 피고로 추정되는 분위기가 생활질서를 흔들었다고 주장한다. 검사는 CCTV가 없으면 마음속 CCTV라도 돌려봐야 한다며 수사기록을 높이 들어 보였다. 원고 측은 '${cleanText(c.desiredVerdict, 120) || '납득 가능한 사과와 황당 반성'}'을 구하고 있으며, 이는 과해 보이지만 소소킹 법정에서는 오히려 차분한 청구라고 주장하였다. 검사는 피고가 몰랐다고 하더라도 몰랐다는 말투가 이미 2차 피해에 가깝다고 몰아붙였다. 마지막으로 검사는 '작은 일이라고 방치하면 내일은 더 작은 일도 커질 수 있다'는 전혀 과학적이지 않지만 이상하게 진지한 논리를 펼쳤다.`,
    defendantArg: `${defenderName}은 피고 측을 대리하여 사건 전체가 지나치게 확대되었다고 반박하였다. 변호인은 '일상에서는 이런 일이 원래 가끔 발생한다'며 상식론을 폈지만, 그 말이 원고석을 다시 술렁이게 만들었다. 피고 측은 고의가 없었고 현장에 결정적 증거도 부족하다고 주장하였다. 그러나 변호인이 '그 정도는 아니지 않습니까'라고 말하는 순간 방청석 일부가 조용히 고개를 저었다. 변호인은 끝까지 침착했으나, 침착함이 오히려 얄미운 정상참작 사유로 기록되었다.`,
    courtOpinion: `${judgeType} 재판부는 소소경찰의 CCTV 확인, 정황감식, 탐문수사, 소과수 감정 결과를 모두 검토하였다. 물론 그 수사 중 상당 부분은 실제 수사라기보다 원고의 마음속에서 벌어진 재연에 가깝다. 그러나 황당재판에서 중요한 것은 물리적 피해의 크기가 아니라, 사건을 설명하는 순간 주변 사람들이 피식 웃으면서도 '아 그건 좀 그렇다'고 말하게 되는 힘이다. 황당검사의 주장은 과장되었으나, 본 법정은 과장 사용을 직무상 필요행위로 본다. 피고측 변호인의 방어도 일리가 있으나, '그럴 수도 있다'는 말 하나로 원고의 찝찝함이 증발하지는 않는다. 특히 본 사건은 CCTV가 없어도 마음속 재생화면이 너무 선명하다는 점에서 정황상 유죄 분위기가 짙다. 재판부는 피고가 대형사건을 일으켰다고 보지는 않는다. 다만 작은 일 하나를 굳이 머릿속에서 다시 재생하게 만든 책임은 가볍지 않다. 결국 본 사건은 현실에서는 웃고 넘길 수 있으나, 소소킹에서는 웃으면서도 선고할 수밖에 없는 유형이다. 따라서 재판부는 원고의 청구를 일부 인용하고, 피고에게 실현 가능하지만 어이없는 처분을 명한다.`,
    verdict: `본 황당재판부는 수사기록, 증거 아닌 증거, 검사와 변호인의 공방을 종합하여 피고 측에 생활질서 미세교란 책임이 있다고 판단한다. 이 판단은 실제 법률 판단이 아니라 오락 목적의 AI 판결이다. 다만 원고가 이 사건을 설명하면서 스스로도 웃기지만 계속 억울해지는 상태에 이르렀다면, 소소킹식 사건성은 충분히 성립한다. 피고의 행위가 크지는 않았으나, 작아서 더 오래 생각나는 종류의 문제였다는 점을 참작한다. 이에 재판부는 사건을 대형사건처럼 포장하되, 처분은 간식과 반성문 사이 어딘가에서 정하기로 한다.`,
    sentence: `피고는 원고에게 '생각보다 이게 신경 쓰였겠구나'라는 취지의 사과를 1회 실시한다.\n피고는 향후 유사 상황 발생 시 '그게 뭐가 문제야?'라는 표현을 72시간 동안 사용하지 못한다.\n피고는 원고의 생활질서 복구를 위하여 간식 또는 음료 상당의 평화적 배상을 제안한다.\n피고는 사건 현장을 지나갈 때마다 1초간 시선을 낮추고 재발방지 의사를 마음속으로 표시한다.\n피고는 재범 시 먼저 '잠깐, 이거 소소경찰 부를 일인가?'라고 자가진단한다.`,
    executionOrder: '본 처분은 선고 즉시 마음속으로 집행된다. 간식 배상은 실제 의무가 아니나, 분위기 회복에는 상당한 효력이 있을 수 있다.',
    appealNotice: '본 판결에 불복하는 자는 마음속으로 3분 이내 항소할 수 있다. 다만 항소심에서는 CCTV 사각지대뿐 아니라 표정 사각지대까지 확대 심리될 수 있다.',
    closingComment: '큰일은 아닌데, 이렇게까지 수사하니까 갑자기 큰일 같아졌다.'
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
    const prompt = `너는 '소소킹 황당재판소'의 예능형 법정드라마 작가다.
사용자가 올린 제목, 내용, 이미지 파일을 바탕으로 사소한 일을 수사극+법정극처럼 과장해서 완성한다.
목표는 사용자가 읽으면서 '이것들 웃기네'라고 느끼는 것이다.

출력 방향:
- 같은 말 반복 금지. 특히 '이걸 접수해야 하나', '억울함 몇 점', '사소함 몇 점', '법적 무게가 가볍다' 같은 템플릿 문구를 쓰지 마라.
- 실제 경찰 수사처럼 보이되, 내용은 하찮아야 한다.
- CCTV 확인, 현장검증, 탐문수사, 용의선상, 알리바이 검토, 압수수색 흉내, 소과수 감정, 수사보고서 같은 요소를 자연스럽게 섞어라.
- 실제 CCTV가 없더라도 '마음속 CCTV', '상상 CCTV', '냉장고 문 반사광 분석'처럼 웃기게 처리할 수 있다.
- 사용자가 올린 이미지가 있으면 사진 속 분위기, 물건 배치, 빈 공간, 수상한 정적 등을 참고자료로만 다뤄라.
- 인물 신원, 민감정보, 실제 범죄 여부는 추정하지 마라.

필수 장면:
1. 사건접수: 사건번호를 부여하고 접수계가 괜히 정색한다. 단, '이걸 접수해야 하나'라는 문장은 쓰지 않는다.
2. 소소경찰 수사: ${analystName}이 CCTV 확인, 현장검증, 탐문수사, 소과수 감정 중 3개 이상을 수행한다.
3. 증거채집: 증거 아닌 증거를 6개 이상 만든다. 예: 빈자리, 표정의 잔상, 말끝, 컵 위치, 사라진 한 조각, 수상한 침묵.
4. 황당검사: ${prosecutorName}가 작은 일을 대형사건처럼 몰아붙인다. 억지 논리여야 하지만 읽으면 피식해야 한다.
5. 피고측 변호인: ${defenderName}이 말은 되는 억지 반박을 한다. '그럴 수도 있지 않습니까'류의 방어를 창의적으로 변주한다.
6. 재판부 판단: 검사와 변호인의 공방을 받아 더 크게 부풀린다. 가장 길고 웃겨야 한다.
7. 판결: 실제 법적 효력은 없음을 자연스럽게 포함하되, 분위기를 깨는 안내문처럼 쓰지 않는다.

문체 규칙:
- 법정 드라마처럼 진지하지만 소재는 너무 하찮게 쓴다.
- 설명문보다 장면처럼 써라. 수사관이 무엇을 확인했고, 검사가 무엇을 들이밀었고, 변호인이 어떻게 우겼는지 보여줘라.
- 문장 안에 'CCTV를 확인해 본 결과', '탐문 결과', '소과수 감정 결과', '변호인은 이에 대해' 같은 진행감 있는 표현을 넣어라.
- 유행어 남발 금지. 과하게 진지한 행정문서 말투와 어이없는 소재의 충돌로 웃겨라.
- 처분은 실현 가능한데 어이없어야 한다. 사과, 금지명령, 간식 배상, 현장복구, 자가진단, 재발방지 교육 등을 섞어라.

사건번호: ${cleanText(c.docketNumber, 80)}
사건명: ${cleanText(c.caseTitle, 40)}
사건 경위: ${cleanText(c.caseDescription, 320)}
참고 억울지수: ${Number(c.grievanceIndex || 5)}/10. 수치 자체는 출력하지 말고 강도 조절에만 사용.
원하는 처분: ${cleanText(c.desiredVerdict, 160) || '없음'}
담당 판사: ${judgeType}
소소경찰 담당: ${analystName}
황당검사: ${prosecutorName}
피고측 변호인: ${defenderName}
기록관: ${recordClerk}
법정: ${courtroom}
첨부 이미지: ${geminiImage ? '있음. 사진은 분위기 참고자료로만 반영.' : '없음'}

반드시 JSON만 출력한다. 필드는 다음을 모두 포함한다.
{
  "absurdityTitle": "사건 제목을 더 웃긴 수사극/법정극 제목으로 바꾼 제목",
  "imageAnalysis": "이미지가 없으면 빈 문자열. 이미지가 있으면 3문장 이상. 분위기, 배치, 빈 공간, 수상한 정적 중심으로만 분석",
  "reception": "사건접수 기록. 사건번호, 접수계 정색, 수사 배당. 5문장 이상. 금지문구 사용 금지",
  "absurdityReview": "재판부 사전검토. 이 사건이 왜 이상하게 커졌는지 장면처럼 설명. 5문장 이상",
  "keyIssues": ["검사와 변호인이 다툴 거창하지만 하찮은 쟁점 1", "쟁점 2", "쟁점 3", "쟁점 4", "쟁점 5"],
  "evidenceList": ["증거 아닌 증거 1", "증거 아닌 증거 2", "증거 아닌 증거 3", "증거 아닌 증거 4", "증거 아닌 증거 5", "증거 아닌 증거 6"],
  "investigation": "소소경찰 수사보고서. CCTV 확인, 현장검증, 탐문수사, 압수수색 흉내, 소과수 감정 중 3개 이상 포함. 8문장 이상",
  "plaintiffArg": "황당검사 측 공소제기. 작은 일을 큰 사건처럼 몰아붙이는 억지 주장. 6문장 이상",
  "defendantArg": "피고측 변호인 반박. 말은 되지만 얄미운 억지 반박. 6문장 이상",
  "courtOpinion": "재판부 판단. 수사와 공방을 종합해서 작은 일을 크게 부풀림. 10문장 이상. 가장 길고 웃기게",
  "verdict": "최종 판결 이유. 오락 콘텐츠임을 자연스럽게 포함. 5문장 이상",
  "sentence": "주문 및 황당 처분. 줄바꿈으로 5개 이상. 피고는... 형태를 많이 사용. 금지명령, 간식 배상, 재발방지 포함",
  "executionOrder": "집행명령. 2문장 이상. 마음속 집행, 현장복구, 간식 집행 같은 표현 활용",
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
      imageAnalysis: geminiImage ? (cleanLong(parsed.imageAnalysis, 1600) || data.imageAnalysis) : '',
      reception: cleanLong(parsed.reception, 1800) || data.reception,
      absurdityReview: cleanLong(parsed.absurdityReview, 1800) || data.absurdityReview,
      keyIssues: cleanList(parsed.keyIssues, data.keyIssues, 6, 210),
      evidenceList: cleanList(parsed.evidenceList, data.evidenceList, 8, 210),
      investigation: cleanLong(parsed.investigation, 2600) || data.investigation,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 2100) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 2100) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 3200) || data.courtOpinion,
      verdict: cleanLong(parsed.verdict, 2200) || data.verdict,
      sentence: funnyDisposition(parsed.sentence, data.sentence),
      executionOrder: cleanLong(parsed.executionOrder, 1100) || data.executionOrder,
      appealNotice: cleanLong(parsed.appealNotice, 900) || data.appealNotice,
      closingComment: cleanText(parsed.closingComment, 220) || data.closingComment
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
