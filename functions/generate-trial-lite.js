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
  return `${out}\n피고는 사건 현장을 지날 때마다 1초간 주변 정돈 상태를 확인한다.\n피고는 유사 상황 발생 시 수첩에 '소소분쟁 가능성 있음'이라고 적고 말하기 전에 3초간 숙고한다.\n피고는 원고의 생활질서 회복을 위하여 간식 1개 상당의 임의적 평화조치를 제안한다.`;
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
    imageAnalysis: hasImage ? '첨부 이미지는 소소경찰 감식반에 의해 현장 참고자료로 분류되었다. 감식반은 사진 속 물건의 배치, 비어 있는 공간, 조명 방향, 주변 정돈 상태를 순서대로 확인하였다. 신원이나 실제 범죄 여부는 판단하지 않으며, 본 자료는 생활질서 미세변동 여부를 살피는 정황자료로만 채택된다.' : '',
    reception: `사건번호 ${docket}. 접수계는 ${thing}이라는 제목을 확인한 뒤 접수수첩 상단에 붉은 밑줄을 그었다. 기록관은 사건 규모에 비해 제목의 존재감이 크다고 판단하여 생활질서 미세교란 의심 사건으로 임시 분류하였다. 접수 당시 확보된 자료는 사건명, 진술 요지, 희망 처분, 그리고 원고가 굳이 이 내용을 제출했다는 사실 그 자체였다. 사건은 ${analyst}에게 배당되었고, 수사관은 즉시 수첩을 펴 시간대와 관계자를 정리하였다.`,
    absurdityReview: `재판부는 사건기록을 열람한 뒤 사안이 일상적인 해프닝에 가까우면서도 기록으로 남기는 순간 이상하게 중대해지는 성질을 가진다고 보았다. 사건의 핵심은 피해 규모가 아니라 사건 전후의 분위기 변화에 있었다. 원고의 진술은 짧았으나, 그 짧은 문장 안에 생활질서가 잠시 멈춘 흔적이 존재하였다. 재판부는 본 사안을 통상적 농담거리로 처리하지 않고, 수사기관과 법정이 모두 동원된 정식 황당재판 형식으로 심리하기로 한다.`,
    keyIssues: [
      `${thing}이 단순 우연인지 생활질서 미세교란 행위인지 여부`,
      `CCTV 또는 정황 재구성 결과 사건 전후의 분위기 변화가 확인되는지 여부`,
      `원고 진술의 짧은 분량에도 불구하고 사건성이 인정되는지 여부`,
      `${prosecutorName}의 확대 해석이 지나친지, 아니면 소소킹 관할상 필요한지 여부`,
      `${defenderName}의 상식론 방어가 오히려 사안을 더 크게 만드는지 여부`
    ],
    evidenceList: [
      hasImage ? '현장 참고 이미지 1매' : 'CCTV 확인 대상 구간 특정 메모 1부',
      '수사관 수첩에 기재된 시간대 재구성표',
      '원고 진술 중 강조 표시된 표현 2곳',
      '현장 분위기 변동을 나타내는 정황 메모',
      '피고 측 예상 반박 문장 초안',
      '소과수 감정 의견: 사소하나 기록 보존 가치 있음'
    ],
    investigation: `${analyst}은 사건 접수 직후 수첩에 발생 시각, 장소, 관련 물건, 원고의 기대 상태를 순서대로 기재하였다. 수사관은 CCTV 확인 대상 구간을 특정하고, 실제 영상 확보 여부와 무관하게 사건 전후 동선과 분위기 변화를 재구성하였다. 현장검증에서는 문제의 물건 또는 상황이 놓였던 위치를 중심으로 거리, 방향, 시선의 흐름을 확인하였다. 탐문수사 과정에서는 상상 목격자 1인이 '사소하지만 그냥 넘기기에는 기록이 너무 정성스럽다'는 취지로 진술한 것으로 정리되었다. 수사관은 관련 물건을 압수하지는 못했으나, 압수목록 양식에 '원고의 기대감, 피고의 무심함, 사건 후 정적'을 임시 기재하였다. 소과수 감정반은 현장 사진 또는 진술자료를 검토한 뒤 생활질서 미세교란 가능성을 배제하기 어렵다는 의견을 냈다. 수사관은 피고의 고의를 단정하지 않으면서도, 결과적으로 원고의 평온한 흐름이 끊긴 점은 인정된다고 보았다. 이에 본 건은 황당검찰청으로 송치되었다.`,
    plaintiffArg: `${prosecutorName}는 공판에서 본 사건을 단순한 생활 해프닝으로 축소해서는 안 된다고 주장하였다. 검사는 CCTV 확인 대상 구간, 수사관 수첩, 현장검증 메모, 소과수 감정 의견을 차례로 제시하며 사안의 무게를 필요 이상으로 끌어올렸다. 원고 측은 '${cleanText(c.desiredVerdict, 120) || '납득 가능한 사과와 황당 반성'}'을 구하고 있으며, 이는 처벌이 아니라 생활질서 회복을 위한 최소한의 절차라고 주장하였다. 검사는 피고가 몰랐다고 하더라도 몰랐다는 태도 자체가 사건을 재발시킬 위험요소라고 지적하였다. 또한 사건의 크기는 작으나 원고가 이를 다시 설명해야 하는 불편은 결코 작지 않다고 강조하였다. 마지막으로 검사는 본 사안이 작은 사건일수록 더 정밀한 기록이 필요하다는 논리를 펼쳤다.`,
    defendantArg: `${defenderName}은 피고 측을 대리하여 사건 전체가 과도하게 확대되었다고 반박하였다. 변호인은 수첩에 적었다고 해서 모든 일이 사건이 되는 것은 아니며, CCTV 확인 대상 구간을 특정했다는 사정만으로 피고의 책임이 생기지는 않는다고 주장하였다. 피고 측은 고의가 없었고, 원고가 사안을 지나치게 의미 있게 해석했을 가능성이 있다고 항변하였다. 그러나 변호인의 침착한 말투는 방청석에 이상한 얄미움을 남겼다. 변호인은 '일상생활상 충분히 발생할 수 있는 상황'이라는 표현을 사용했으나, 그 표현은 원고 측 공소사실의 2차 확대 근거로 즉시 채택되었다. 피고 측의 주장은 논리적으로 일부 타당하나, 이 법정에서는 너무 상식적인 말이 오히려 불리하게 작용할 수 있다.`,
    courtOpinion: `${judgeType} 재판부는 소소경찰의 수사기록, CCTV 확인 대상 구간, 수첩 메모, 현장검증 결과, 소과수 감정 의견을 모두 검토하였다. 재판부는 먼저 이 사건이 현실의 대형 분쟁은 아니라는 점을 전제로 한다. 그러나 본 법정에서 판단하는 것은 사건의 물리적 크기가 아니라 사소한 일이 얼마나 엄숙한 기록물로 변환될 수 있는가이다. 수사관이 수첩을 펼친 순간, 이 사건은 이미 평범한 해프닝의 영역을 일부 벗어났다. 검사는 사안을 지나치게 확대하였으나, 그 확대가 터무니없을수록 기록의 완성도는 높아졌다. 변호인은 상식적인 반박을 하였으나, 그 상식이 원고의 불편한 감정을 완전히 설명하지는 못한다. CCTV에 결정적 장면이 없더라도, 사건 전후의 분위기 변화는 진술과 정황 메모를 통해 재구성될 수 있다. 피고에게 중대한 책임을 묻기는 어렵지만, 사건이 여기까지 오게 만든 생활질서상의 빈틈은 인정된다. 재판부는 이 빈틈을 방치할 경우 향후 더 작은 사건도 접수될 위험이 있다고 판단한다. 따라서 본 사건은 작지만 문서화할 가치가 있고, 하찮지만 선고할 필요가 있다.`,
    verdict: `본 황당재판부는 수사기록, 증거 아닌 증거, 검사와 변호인의 공방을 종합하여 피고 측에 생활질서 미세교란 책임이 일부 있다고 판단한다. 이 판단은 실제 법적 효력을 갖는 판결이 아니라 소소킹 내부에서만 효력을 갖는 오락적 선고이다. 다만 본 사건처럼 작고 애매한 사안일수록 지나치게 진지한 절차를 거쳤을 때 기록의 의미가 발생한다. 피고의 행위가 중대하다고 보기는 어려우나, 원고가 이를 다시 설명해야 했던 사정은 참작된다. 이에 재판부는 원고의 청구를 일부 인용하고, 실현 가능하지만 불필요하게 엄숙한 처분을 명한다.`,
    sentence: `피고는 원고에게 '그 상황이 생각보다 신경 쓰였을 수 있다'는 취지의 사과를 1회 실시한다.\n피고는 향후 유사 상황 발생 시 즉시 수첩 또는 휴대폰 메모장에 '소소분쟁 가능성 있음'이라고 기재한다.\n피고는 원고의 생활질서 회복을 위하여 간식 또는 음료 상당의 임의적 평화조치를 제안한다.\n피고는 사건 현장을 지날 때마다 1초간 주변 정돈 상태를 확인한다.\n피고는 재발 방지를 위하여 '별일 아니다'라는 표현을 사용하기 전 3초간 숙고한다.`,
    executionOrder: '본 처분은 선고 즉시 마음속으로 집행된다. 간식 배상은 실제 의무가 아니나, 당사자 사이 분위기 복구를 위한 임의적 조치로 권고된다.',
    appealNotice: '본 판결에 불복하는 자는 마음속으로 3분 이내 항소할 수 있다. 다만 항소심에서는 CCTV 사각지대뿐 아니라 수첩 여백, 표정 변화, 침묵의 길이까지 확대 심리될 수 있다.',
    closingComment: '수첩을 펼친 순간, 작은 일은 이미 작지 않은 척을 하기 시작했다.'
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
사용자가 올린 제목, 내용, 이미지 파일을 바탕으로 사소한 일을 실제 수사기록과 판결문처럼 지나치게 진지하게 확대한다.
목표는 웃기려고 농담하는 것이 아니라, 너무 엄정하고 정식 절차처럼 보여서 결과적으로 웃기게 만드는 것이다.

출력 방향:
- 사건 내용 안에서만 확대한다. 사용자가 말하지 않은 전혀 다른 사건을 만들지 마라.
- 농담투, 유행어, 과한 드립, 장난스러운 감탄사를 쓰지 마라.
- 수사기관 기록, 검찰 공소장, 변호인 의견서, 재판부 판단문처럼 침착하고 엄숙하게 쓴다.
- 웃음은 문체의 진지함과 사안의 하찮음 사이의 간극에서 나오게 한다.
- 같은 말 반복 금지. 특히 '이걸 접수해야 하나', '억울함 몇 점', '사소함 몇 점', '법적 무게가 가볍다' 같은 템플릿 문구를 쓰지 마라.
- 수사는 실제 경찰 수사처럼 구성한다. CCTV 확인, 수첩 메모, 현장검증, 탐문수사, 관계자 진술, 용의선상, 알리바이 검토, 증거목록, 압수목록, 소과수 감정, 수사보고서를 동원한다.
- 실제 CCTV나 증거가 없더라도 'CCTV 확인 대상 구간 특정', '수첩상 시간대 재구성', '정황자료 검토', '현장 사진 감정'처럼 진짜 절차처럼 보이게 처리한다.
- 이미지가 있으면 사진 속 분위기, 물건 배치, 빈 공간, 조명, 주변 정돈 상태를 참고자료로만 분석한다.
- 인물 신원, 민감정보, 실제 범죄 여부는 추정하지 않는다.

필수 장면:
1. 사건접수: 사건번호를 부여하고 접수계가 정식 사건처럼 기록한다. 단, 금지 문구는 쓰지 않는다.
2. 소소경찰 수사: ${analystName}이 CCTV 확인, 수첩 메모, 현장검증, 탐문수사, 소과수 감정 중 4개 이상을 수행한다.
3. 증거채집: 증거 아닌 증거를 6개 이상 만든다. 예: 수첩 메모, CCTV 확인대상 구간, 빈자리, 말끝, 컵 위치, 사라진 한 조각, 정적, 현장 사진.
4. 황당검사: ${prosecutorName}가 작은 일을 대형사건처럼 엄숙하게 몰아붙인다. 주장은 억지지만 문체는 매우 진지해야 한다.
5. 피고측 변호인: ${defenderName}이 말은 되는 억지 반박을 한다. 상식적인 말로 방어하지만 오히려 얄밉게 보이게 쓴다.
6. 재판부 판단: 수사기록, 검사 주장, 변호인 반박을 종합하여 작은 일을 더 큰 사건처럼 정리한다.
7. 판결: 실제 법적 효력은 없음을 자연스럽게 포함하되, 안내문처럼 분위기를 깨지 않는다.

문체 규칙:
- '재미있다', '웃기다', '피식' 같은 직접 설명은 출력하지 마라.
- 'CCTV를 확인해 본 결과', '수첩 기재 내용에 따르면', '탐문 결과', '소과수 감정 결과', '변호인은 이에 대해', '재판부는 기록을 종합하여' 같은 진지한 연결어를 적극 사용한다.
- 작은 물건, 작은 말투, 작은 빈자리도 대형 사건의 단서처럼 다룬다.
- 처분은 실현 가능하지만 과하게 엄숙해야 한다. 사과, 금지명령, 간식 배상, 현장복구, 수첩 기재 의무, 재발방지 교육 등을 섞어라.

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
  "absurdityTitle": "사건 제목을 엄숙한 수사극/법정극 제목으로 바꾼 제목",
  "imageAnalysis": "이미지가 없으면 빈 문자열. 이미지가 있으면 3문장 이상. 분위기, 배치, 빈 공간, 조명, 주변 정돈 상태 중심으로만 분석",
  "reception": "사건접수 기록. 사건번호, 접수계 기록, 수사 배당. 5문장 이상. 금지문구 사용 금지",
  "absurdityReview": "재판부 사전검토. 이 사건이 어떻게 정식 사건처럼 커졌는지 엄숙하게 설명. 5문장 이상",
  "keyIssues": ["검사와 변호인이 다툴 거창하지만 하찮은 쟁점 1", "쟁점 2", "쟁점 3", "쟁점 4", "쟁점 5"],
  "evidenceList": ["증거 아닌 증거 1", "증거 아닌 증거 2", "증거 아닌 증거 3", "증거 아닌 증거 4", "증거 아닌 증거 5", "증거 아닌 증거 6"],
  "investigation": "소소경찰 수사보고서. CCTV 확인, 수첩 메모, 현장검증, 탐문수사, 압수목록, 소과수 감정 중 4개 이상 포함. 9문장 이상",
  "plaintiffArg": "황당검사 측 공소제기. 작은 일을 대형사건처럼 엄숙하게 몰아붙이는 억지 주장. 6문장 이상",
  "defendantArg": "피고측 변호인 반박. 말은 되지만 얄미운 억지 반박. 6문장 이상",
  "courtOpinion": "재판부 판단. 수사와 공방을 종합해서 작은 일을 정식 사건처럼 크게 부풀림. 10문장 이상. 가장 길고 진지하게",
  "verdict": "최종 판결 이유. 오락 콘텐츠임을 자연스럽게 포함. 5문장 이상",
  "sentence": "주문 및 황당 처분. 줄바꿈으로 5개 이상. 피고는... 형태를 많이 사용. 금지명령, 간식 배상, 수첩 기재 의무, 재발방지 포함",
  "executionOrder": "집행명령. 2문장 이상. 마음속 집행, 현장복구, 간식 집행 같은 표현 활용",
  "appealNotice": "항소 안내. 2문장 이상. 더 사소한 정황까지 심리될 수 있다는 진지한 경고 포함",
  "closingComment": "짧고 엄숙한데 어이없는 마지막 한 줄"
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
      investigation: cleanLong(parsed.investigation, 2800) || data.investigation,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 2200) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 2200) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 3400) || data.courtOpinion,
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
