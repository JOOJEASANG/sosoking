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
function cleanList(value, fallback = [], maxItems = 6, maxLen = 180) {
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
function ensureOrder(text, fallbackText) {
  const out = cleanLong(text, 2400);
  if (!out) return fallbackText;
  const lines = out.split('\n').map(x => x.trim()).filter(Boolean);
  if (lines.length >= 5) return out;
  return `${out}\n피고는 사건 대상과 동일하거나 유사한 물건 앞에서 3초간 정지하여 소유관계를 확인한다.\n피고는 원고의 상실된 기대를 회복하기 위한 임의적 평화조치를 제안한다.\n피고는 재발 방지를 위하여 같은 상황에서 같은 행동을 반복하지 않는다는 확인을 1회 실시한다.`;
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
  const title = cleanText(c.caseTitle, 40) || '소소한 일상사건';
  const desc = cleanText(c.caseDescription, 220) || title;
  const hasImage = !!imageForGemini(c.imageAttachment);
  const docket = cleanText(c.docketNumber, 80) || '2026황당-임시-0001';
  const analyst = c.analystName || pickFrom(ANALYSTS, title);
  const prosecutorName = c.prosecutorName || pickFrom(PROSECUTORS, title);
  const defenderName = c.defenderName || pickFrom(DEFENDERS, title);
  return {
    absurdityTitle: `${title} 사건기록철`,
    agencyName: '소소킹 황당재판소',
    courtroom: c.courtroom || pickFrom(ABSURD_DEPARTMENTS, title),
    division: '제3황당재판부',
    recordClerk: c.recordClerk || pickFrom(CLERKS, title),
    analystName: analyst,
    prosecutorName,
    defenderName,
    imageAnalysis: hasImage ? `문서명: 첨부사진 검토의견서\n감식반은 제출된 사진을 ${title}의 현장 참고자료로 분류하였다. 사진 속 배치와 빈 공간은 사건 경위와 직접 결합되는 범위에서만 검토한다. 인물의 신원, 실제 범죄 여부, 책임 주체는 사진만으로 판단하지 않는다.` : '',
    reception: `문서명: ${title} 접수조서\n사건번호: ${docket}\n접수계는 '${desc}'라는 진술을 기초로 사건의 대상, 행위, 상실된 기대를 분리하여 기록하였다. 본 조서의 핵심은 사건이 크다는 데 있지 않고, 원고가 해당 장면을 그냥 넘기지 못하고 접수했다는 점에 있다. 사건은 ${analyst}에게 배당되었다.`,
    absurdityReview: `문서명: 기록화 필요성 검토서\n재판부는 ${title}이 단순한 해프닝으로 보일 수 있다는 점을 전제로 검토하였다. 그러나 사건명에 포함된 대상과 행위가 원고의 기대를 끊어 놓았다는 점에서 별도 기록의 필요성이 인정된다. 본 기록철은 과장된 처벌보다 사건을 지나치게 정식으로 읽어내는 데 목적이 있다.`,
    keyIssues: [
      `쟁점 1. ${title}에서 원고의 기대가 실제로 형성되어 있었는지 여부`,
      `쟁점 2. 사건 대상이 원고의 지배 또는 관심 영역에 있었는지 여부`,
      `쟁점 3. 피고 측 행위가 결과 발생에 어느 정도 기여했는지 여부`,
      `쟁점 4. 피고 측이 내세울 수 있는 우연·착오·관행 항변의 범위`,
      `쟁점 5. 사과, 원상회복, 간식 상당 평화조치 중 어떤 주문이 사안에 맞는지 여부`
    ],
    evidenceList: [
      `증 제1호: 원고가 제출한 '${title}' 진술`,
      `증 제2호: 사건 대상의 위치와 상태에 관한 진술 메모`,
      `증 제3호: 사건 전후 원고의 기대 변화 정리표`,
      hasImage ? '증 제4호: 첨부사진 참고자료' : '증 제4호: CCTV 확인 대상 구간 특정표',
      `증 제5호: 피고 측 예상 반박 문장`,
      `증 제6호: 담당 수사관 수첩 기재사항`
    ],
    investigation: `문서명: ${analyst} 수사보고서\n수사관은 ${title}의 발생 장면을 사건 경위에 따라 시간순으로 재구성하였다. 수첩에는 사건 대상의 위치, 원고의 시선 또는 주의 상태, 피고 측 접근 가능성이 각각 분리 기재되었다. CCTV가 실제로 확보되지 않은 경우에도 확인 대상 구간과 사각지대를 표시하였다. 현장검증은 사건 대상이 원래 있어야 했던 지점과 결과 발생 후 달라진 지점을 비교하는 방식으로 진행되었다. 탐문은 사건의 크기를 묻는 방식이 아니라 원고가 왜 멈칫했는지를 확인하는 방식으로 정리되었다.`,
    plaintiffArg: `문서명: 원고 측 준비서면\n${prosecutorName}는 ${title}이 단순한 우연으로 축소되어서는 안 된다고 주장한다. 원고는 사건 대상에 대하여 일정한 기대를 가지고 있었고, 그 기대는 사건 경위에 기재된 행위로 중단되었다. 원고 측은 이 중단 자체가 본 사건의 핵심 손해라고 본다.`,
    defendantArg: `문서명: 피고 측 답변서\n${defenderName}은 ${title}이 지나치게 정식화되었다고 항변한다. 피고 측은 고의가 없었거나 사건 당시 상황을 명확히 인식하기 어려웠다고 주장할 수 있다. 다만 피고 측 항변은 원고가 느낀 상실감이나 허탈함을 완전히 소멸시키지는 못한다.`,
    courtOpinion: `문서명: 판결 이유\n${judgeType} 재판부는 접수조서, 수사보고서, 준비서면 및 답변서를 종합한다. 본 사건은 현실의 중대한 법률분쟁이 아니나, 원고가 기대하던 흐름이 특정 행위로 끊어진 사실은 인정된다. 재판부는 사건 대상의 사소함과 기록 형식의 장엄함 사이에서 책임의 범위를 제한적으로 정한다.`,
    verdict: `문서명: 판결문\n본 황당재판부는 ${title}에 관하여 원고의 청구를 일부 인용한다. 본 문서는 실제 법적 효력이 없는 소소킹 오락용 사건기록이다. 다만 기록상 확인되는 기대의 중단과 사건 후 정적은 무시하지 않는다.`,
    sentence: `문서명: 주문\n피고는 ${title}의 원고에게 사건 대상과 관련한 사과를 1회 실시한다.\n피고는 동일하거나 유사한 상황에서 대상의 소유 또는 기대 상태를 먼저 확인한다.\n피고는 원고의 상실된 기대를 회복하기 위한 간식 또는 음료 상당의 임의적 평화조치를 제안한다.\n피고는 사건 발생 장소 또는 이에 준하는 장소에서 재발방지 확인을 1회 실시한다.\n피고는 같은 사안을 두고 '그 정도는 별일 아니다'라는 표현을 사용하기 전 3초간 숙고한다.`,
    executionOrder: `문서명: 집행권고문\n본 주문은 실제 법적 강제력이 없으며, 당사자 간 웃음 회복을 위한 임의적 권고이다. 집행은 마음속 기록철에 편철하는 방식으로 완료된다.`,
    appealNotice: '본 사건은 단심으로 종결한다.',
    closingComment: `${title}은 작았으나, 기록철은 필요 이상으로 두꺼웠다.`
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
    const judgeGuide = {
      '엄벌주의형': '판결 이유와 주문에서 책임을 비교적 엄격히 본다. 단, 앞선 수사보고서와 양측 서면에는 성격을 넣지 않는다.',
      '감성형': '판결 이유에서 원고의 기대감과 허탈함을 더 섬세하게 참작한다. 단, 앞선 문서는 중립적으로 둔다.',
      '현실주의형': '판결 이유에서 실제 실행 가능한 처분과 당사자 부담을 조정한다. 과장된 주문을 줄인다.',
      '과몰입형': '판결 이유에서 사건의 작은 정황을 장엄하게 해석한다. 다만 문장 자체는 법원 문서처럼 담담해야 한다.',
      '피곤형': '판결 이유에서 건조하고 짧게 판단하되, 결론은 은근히 단호하게 쓴다.',
      '논리집착형': '판결 이유에서 행위, 대상, 기대, 결과, 참작사유를 세분화하여 판단한다.',
      '드립형': '판결 이유와 마지막 한 줄에만 아주 절제된 재치를 허용한다. 유행어와 과한 말장난은 금지한다.'
    }[judgeType] || '판결 이유에서만 재판부 성향을 절제하여 반영한다.';

    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.92,
        topP: 0.95,
        topK: 40,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `너는 '소소킹 황당재판소'의 사건기록 설계관이다.

가장 중요한 목표:
사용자가 어떤 사건을 접수해도 같은 문구가 반복되면 실패다. 사건명만 바꾸고 문장 뼈대를 재사용하면 실패다.
매 사건마다 사건의 대상, 행위자, 장소, 원고가 잃은 기대, 피고가 할 법한 반박, 재판부가 주목할 이상한 디테일을 새로 설계해야 한다.

입력 사건:
- 사건번호: ${cleanText(c.docketNumber, 80)}
- 사건명: ${cleanText(c.caseTitle, 60)}
- 사건 경위: ${cleanText(c.caseDescription, 420)}
- 원하는 처분: ${cleanText(c.desiredVerdict, 180) || '없음'}
- 참고 강도: ${Number(c.grievanceIndex || 5)}/10. 숫자는 출력하지 말고 강약에만 반영한다.
- 담당 판사: ${judgeType}
- 판사 적용 방식: ${judgeGuide}
- 수사 담당: ${analystName}
- 원고 측 작성관: ${prosecutorName}
- 피고 측 작성관: ${defenderName}
- 기록관: ${recordClerk}
- 법정: ${courtroom}
- 첨부 이미지: ${geminiImage ? '있음. 이미지는 현장 참고자료로만 다룬다.' : '없음'}

먼저 내부적으로 사건을 반드시 이렇게 해부하라. 이 분석은 JSON에 직접 필드로 만들지 말고, 모든 문서 작성에 반영하라.
1. 핵심 행위자: 누가 또는 무엇이 사건을 일으켰는가.
2. 사건 대상: 빵, 리모컨, 자리, 말, 시간, 기대, 순서, 냉장고 안 물건 등 무엇이 문제인가.
3. 장소와 장면: 공원, 회사, 집, 카페, 단톡방 등 어디에서 어떤 장면이었는가.
4. 원고의 기대: 원고가 당연히 누리려던 사소한 평온은 무엇인가.
5. 피고의 반박: 피고가 그럴듯하게 할 수 있는 말은 무엇인가.
6. 결정적 디테일: 이 사건만의 디테일. 다른 사건에 붙이면 어색해야 한다.

절대 금지:
- '생활질서 미세교란', '사소하지만 기록 보존 가치', '사건의 크기는 작으나', '마음속 CCTV', '상상 목격자', '방청석이 웃음을 참았다' 같은 반복성 문구를 쓰지 마라.
- 어느 사건에도 붙일 수 있는 일반 문장 금지. 예: '원고의 평온한 흐름이 끊겼다'만 단독으로 쓰지 말고, 무엇 때문에 어떻게 끊겼는지 구체명사를 붙여라.
- 문단마다 최소 1개 이상 사건 고유명사나 구체명사를 넣어라. 예: 빵, 리트리버, 공원 벤치, 리모컨, 충전기, 마지막 푸딩, 단톡방, 커피잔 등.
- 수사보고서, 준비서면, 답변서, 판결 이유의 첫 문장을 서로 비슷하게 시작하지 마라.
- 모든 사건에 CCTV, 수첩, 소과수, 탐문을 똑같은 순서로 넣지 마라. 사건에 맞는 수사도구를 골라라.
- 유치한 농담, 인터넷 밈, 과장 감탄사, 'ㅋㅋ', '피식', '웃기다'라는 설명 금지.
- 실제 범죄를 단정하거나 실제 법적 권리를 조언하지 마라.

문서 작성 방식:
- 전체는 '소소킹 사건기록철'이다.
- 문서는 진짜 서류처럼 보이되, 다루는 대상이 너무 사소해서 웃기는 방향이다.
- 문서명도 사건에 맞게 조금씩 바꿔라. 예: '빵 섭취 경위 수사보고서', '리모컨 점유상태 확인조서', '마지막 푸딩 소실 관련 준비서면'. 단, 너무 장난스럽게 만들지 마라.
- 수사보고서는 사건에 맞는 도구를 선택한다. CCTV, 수첩, 현장검증, 냄새/자리/시간/물건 위치 확인, 동선 재구성, 주변인 진술, 사진 감정, 대화기록 확인, 냉장고 상태 확인, 테이블 배치 확인 등.
- 원고 측 준비서면은 원고가 잃은 '사소하지만 구체적인 기대'를 중심으로 쓴다.
- 피고 측 답변서는 피고가 할 법한 그럴듯한 항변을 쓴다. 동물 사건이면 보호자 또는 관리자의 항변처럼 처리한다.
- 판사 캐릭터는 재판부 판단, 판결문, 주문, 마지막 한 줄에만 반영한다. 수사보고서와 양측 서면에는 판사 성격을 넣지 않는다.
- 결과는 과하게 웃기려 하지 말고, 너무 정식이라 웃기는 쪽으로 쓴다.
- 본 사건은 단심으로 끝난다. 항소 안내를 만들지 않는다.

출력 품질 기준:
- 각 필드는 해당 사건에만 맞아야 한다. 사건명만 바꿔도 다른 사건에 쓸 수 있는 문장은 실패다.
- evidenceList의 각 항목은 '증 제N호:'로 시작하고, 사건 대상과 직접 관련되어야 한다.
- keyIssues의 각 항목은 '쟁점 N.'으로 시작하고, 그 사건의 구체물 또는 구체행동을 포함해야 한다.
- sentence는 실제로 할 수 있는 가벼운 처분이어야 하며, 사건 대상에 맞춰야 한다.
- closingComment는 한 줄만. 장엄하되 그 사건의 구체명사를 반드시 포함한다.

JSON만 출력한다. 다음 필드를 모두 포함한다.
{
  "absurdityTitle": "사건 고유명사를 포함한 기록철 제목",
  "imageAnalysis": "이미지가 없으면 빈 문자열. 있으면 '문서명: ... 사진감정의견서'로 시작하고 사건 장면과 관련된 시각 자료만 3문장 이상",
  "reception": "문서명: ... 접수조서 로 시작. 사건번호, 사건명, 원고가 무엇을 기대했고 무엇이 깨졌는지 포함. 6문장 이상",
  "absurdityReview": "문서명: ... 기록화 검토의견서 로 시작. 이 사건만의 기록화 이유. 6문장 이상",
  "keyIssues": ["쟁점 1. ...", "쟁점 2. ...", "쟁점 3. ...", "쟁점 4. ...", "쟁점 5. ..."],
  "evidenceList": ["증 제1호: ...", "증 제2호: ...", "증 제3호: ...", "증 제4호: ...", "증 제5호: ...", "증 제6호: ...", "증 제7호: ..."],
  "investigation": "문서명: ... 수사보고서 로 시작. 사건에 맞는 수사도구 4개 이상. 같은 순서 반복 금지. 10문장 이상",
  "plaintiffArg": "문서명: 원고 측 ... 준비서면 로 시작. 원고가 잃은 구체적 기대와 청구 이유. 7문장 이상",
  "defendantArg": "문서명: 피고 측 ... 답변서 로 시작. 피고가 할 법한 그럴듯한 반박. 7문장 이상",
  "courtOpinion": "문서명: 판결 이유 로 시작. 여기서만 판사 성향 반영. 수사기록과 양측 서면을 종합. 11문장 이상",
  "verdict": "문서명: 판결문 로 시작. 최종 판단과 오락용 문서임을 자연스럽게 포함. 6문장 이상",
  "sentence": "문서명: 주문 로 시작. 줄바꿈으로 5개 이상. 각 줄은 사건 대상에 맞는 처분이어야 함",
  "executionOrder": "문서명: 집행권고문 로 시작. 실제 효력 없음, 임의적 평화조치, 마음속 집행 포함. 3문장 이상",
  "appealNotice": "본 사건은 단심으로 종결한다.",
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
      absurdityTitle: cleanText(parsed.absurdityTitle, 100) || data.absurdityTitle,
      imageAnalysis: geminiImage ? (cleanLong(parsed.imageAnalysis, 1800) || data.imageAnalysis) : '',
      reception: cleanLong(parsed.reception, 2300) || data.reception,
      absurdityReview: cleanLong(parsed.absurdityReview, 2300) || data.absurdityReview,
      keyIssues: cleanList(parsed.keyIssues, data.keyIssues, 7, 260),
      evidenceList: cleanList(parsed.evidenceList, data.evidenceList, 8, 260),
      investigation: cleanLong(parsed.investigation, 3800) || data.investigation,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 2900) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 2900) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 4200) || data.courtOpinion,
      verdict: cleanLong(parsed.verdict, 2800) || data.verdict,
      sentence: ensureOrder(parsed.sentence, data.sentence),
      executionOrder: cleanLong(parsed.executionOrder, 1500) || data.executionOrder,
      appealNotice: '본 사건은 단심으로 종결한다.',
      closingComment: cleanText(parsed.closingComment, 240) || data.closingComment
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
