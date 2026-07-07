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
const ANALYSTS = ['억울함 분석관', '황당성 감정관', '사소함 확대관', '황당질서 검토관', '한입만 감별관'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanLong(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen);
}
function cleanList(value, fallback = [], maxItems = 6, maxLen = 140) {
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
  const out = cleanLong(text, 1500);
  if (!out) return fallbackText;
  return out.length < 110 ? `${out}\n\n피고는 추가로 본 사건이 여기까지 올라온 사유를 10초간 묵념하고, 원고 앞에서 '생각보다 사소하지 않았네'를 1회 낭독한다.` : out;
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
  return {
    absurdityTitle: `${title} 관련 소소킹 과몰입 판결문`,
    agencyName: '소소킹 황당재판소',
    courtroom: pickFrom(ABSURD_DEPARTMENTS, title),
    division: '제3황당재판부',
    recordClerk: pickFrom(CLERKS, title),
    analystName: pickFrom(ANALYSTS, title),
    imageAnalysis: hasImage ? '첨부 이미지는 황당사건 참고자료로 접수되었다. 재판부는 이미지 속 정황을 실제 증거처럼 단정하지 않고, 원고의 마음속 확대경에 비친 참고 장면으로만 살펴본다. 사진 한 장이 모든 진실을 말하지는 않지만, 적어도 원고가 이 사건을 그냥 넘기기 싫어했다는 점은 분명히 드러난다.' : '',
    reception: `본 사건은 ${thing}이라는 사소해 보이는 문제에서 출발하였다. 접수계는 처음에는 '이게 접수까지 올 일인가'라고 생각했으나, 원고의 문장 끝에 묻어 있는 억울함을 확인하고 즉시 자세를 고쳐 앉았다. 소소킹 황당재판소는 소소한 억울함도 왕처럼 모신다는 원칙에 따라 본 사건을 정상 접수하였다. 이에 사건은 제404호 황당법정에 배당되었고, 법정 안의 공기는 필요 이상으로 진지해졌다.`,
    absurdityReview: `재판부는 먼저 이 사건이 정말 재판까지 올 일인지 심리하였다. 결론부터 말하면 현실 세계에서는 대개 한숨 한 번으로 끝날 일이다. 그러나 바로 그 한숨이 길어지고, 마음속에서 '아니 근데 생각할수록 좀 그렇네'로 번지는 순간 소소킹의 관할이 열린다. 별일 아닌데 자꾸 생각나는 일, 말하자니 쪼잔하고 참자니 억울한 일이야말로 황당재판의 핵심 소재다.`,
    keyIssues: [
      `${thing}이 단순 해프닝인지, 아니면 원고의 평온한 하루를 살짝 비틀어 놓은 황당행위인지 여부`,
      `피고의 '그 정도까지는 아니지 않나'라는 태도가 오히려 사건을 키웠는지 여부`,
      `원고의 억울함이 과장인지, 소소킹 기준으로는 충분히 접수 가능한 감정인지 여부`,
      hasImage ? '첨부 이미지가 원고의 억울함에 어느 정도 분위기 가산점을 주는지 여부' : `원하는 처분이 과한지, 아니면 오히려 유머상 적정한지 여부`
    ],
    evidenceList: [
      hasImage ? '원고가 제출한 분위기 참고 이미지 1매' : '원고의 말끝에서 감지된 미세한 억울 진동',
      '피고가 대수롭지 않게 넘겼을 가능성',
      '사건 직후 주변 공기에 남아 있던 어색한 침묵',
      '원고가 굳이 소소킹까지 찾아왔다는 결정적 정황',
      '평범한 일상이 괜히 찝찝해진 사후 상태'
    ],
    investigation: `황당성 감정 결과, 본 사건은 사소함 94점, 억울함 ${Number(c.grievanceIndex || 5) * 9}점, 주변 사람이 들으면 '그건 좀 웃긴데?'라고 말할 가능성 89점으로 산정된다. 특히 사건의 물리적 규모는 작지만 감정적 여운은 생각보다 오래 남는 유형이다. 억울함 분석관은 원고가 이 일을 설명하면서도 스스로 조금 웃겼을 가능성을 인정하였다. 그러나 웃기다고 해서 억울하지 않은 것은 아니다. 소소킹에서는 바로 그 모순을 판결한다.`,
    plaintiffArg: `원고는 본 사건이 단순한 장난이나 오해가 아니라, 평온한 일상에 생긴 작지만 선명한 흠집이라고 주장한다. 원고는 피고가 조금만 더 눈치가 있었더라면 이런 황당재판까지 오지 않았을 것이라고 진술한다. 원고는 특히 '${cleanText(c.desiredVerdict, 120) || '납득 가능한 사과와 황당 반성'}'을 구하고 있다. 원고의 주장은 법률적으로는 가볍지만, 마음속 판례집에는 충분히 등재될 만하다.`,
    defendantArg: `피고 측은 아마도 '그 정도는 아니지 않느냐'는 취지로 항변할 가능성이 높다. 그러나 재판부는 바로 그 문장이 원고의 억울함을 증폭시킨 핵심 발언일 수 있다고 본다. 피고가 가볍게 생각할수록 원고 입장에서는 더 무거워지는 것이 황당사건의 오래된 구조다. 피고의 항변은 일부 참작하되, '몰랐다'만으로 모든 사소함이 면책되지는 않는다.`,
    courtOpinion: `${judgeType} 재판부는 본 사건의 법적 무게가 종이컵보다 가볍다고 본다. 그러나 감정적 존재감은 냉장고 마지막 디저트, 치킨 마지막 다리, 단체방 읽씹 알림에 버금간다. 실제 법원에 가져가면 접수창구가 잠시 멈칫할 사안이지만, 소소킹에서는 오히려 정식 관할이다. 재판부는 본 사건의 핵심이 '큰 피해'가 아니라 '작은데 자꾸 생각나는 억울함'에 있다고 판단한다. 피고는 악의가 없었을 수 있으나, 원고의 하루에 아주 작은 모래알을 넣은 책임은 피하기 어렵다. 따라서 재판부는 원고의 청구를 일부 인용하되, 처분은 엄숙하지만 어이없게 정한다. 이것이 소소킹식 정의다.`,
    verdict: `본 황당재판부는 원고의 청구를 상당 부분 받아들인다. 피고의 행위는 일상 속 사소한 선을 넘은 것으로 평가된다. 원고가 '내가 이런 걸로 재판까지 해야 하나'라고 느낀 바로 그 순간, 이미 소소킹식 사건성은 충분히 발생하였다. 다만 본 판결은 오락 목적의 AI 콘텐츠로서 실제 법적 효력은 없다. 효력은 오직 마음속 찝찝함을 웃음으로 정리하는 범위에서만 인정된다.`,
    sentence: `피고는 원고에게 진심 51%, 민망함 49%가 섞인 사과를 1회 실시한다.\n피고는 향후 3일간 유사 상황에서 '그게 뭐가 문제야?'라는 표현을 사용하지 못한다.\n피고는 원고에게 작은 간식 또는 커피 상당의 황당배상을 제안한다.\n피고는 본 사건이 소소킹까지 온 이유를 10초 이상 생각한 뒤 조용히 고개를 끄덕인다.\n재범 시 피고는 같은 상황에서 먼저 '혹시 이거 소소킹 갈 일인가?'라고 자가진단한다.`,
    executionOrder: '본 처분은 선고 즉시 마음속으로 집행된다. 피고가 불복할 경우 원고는 같은 사건을 더 억울한 제목으로 재접수할 수 있다.',
    appealNotice: '본 판결에 불복하는 자는 마음속으로 3분 이내 항소할 수 있다. 다만 항소심에서는 평소의 사소한 행동까지 확대 심리될 수 있다.',
    closingComment: '이걸로 재판까지 온 것은 과하지만, 그래서 소소킹에서는 충분히 정상 접수다.'
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
  let data = fallback({ ...c, courtroom, recordClerk, analystName }, judgeType);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName });
    const prompt = `너는 '소소킹 황당재판소'의 AI 재판부다. 목표는 실제 법률문서가 아니라, 아주 사소한 생활 분쟁을 쓸데없이 엄숙한 판결문처럼 작성해서 읽는 사람이 피식 웃게 만드는 것이다.

브랜드 해석: 소소킹은 '소소한 억울함도 왕처럼 크게 다뤄주는 곳'이다. 그러므로 사건을 큰 범죄처럼 다루지 말고, 하찮은 일을 과장된 법정 언어로 다룬다.

웃긴 톤 규칙:
- 사건 자체보다 표현이 웃겨야 한다.
- 법률풍 단어를 생활 물건에 붙여라. 예: 젓가락 권한 남용, 냉장고 평온권, 읽씹 정황증거, 치킨 다리 우선배당권, 한입 조항 위반.
- 판결은 진지한데 내용은 어이없어야 한다.
- 처분은 '사과 1회'로 끝내지 말고, 실제 행동 + 말도 안 되는 금지명령 + 재발방지 드립을 섞어라.
- 마지막 한 줄은 공유하고 싶을 정도의 짧은 punchline이어야 한다.

작성 구조:
1. 접수계 기록은 '이걸 접수해야 하나'에서 시작해 결국 엄숙하게 접수하는 흐름.
2. 쟁점은 하찮은데 이름은 거창하게.
3. 증거는 실제 증거가 아니라 '표정', '침묵', '마지막 한 조각의 부재' 같은 증거 아닌 증거.
4. 재판부 판단은 가장 길고 웃기게. 최소 7문장.
5. 주문/처분은 줄바꿈 5개 이상. 각 줄은 피고는...으로 시작하는 문장을 많이 사용.

첨부 이미지가 제공된 경우 이미지를 실제 증거처럼 단정하지 말고, 보이는 장면을 '분위기 참고자료'처럼 유머러스하게 다뤄라. 인물 신원, 민감정보, 실제 범죄 여부는 추정하지 말라.

금지: 실제 법률 자문처럼 단정하지 말 것, 욕설/혐오/성적 표현/자해/위험행위 조장 금지, 실명/연락처 생성 금지. 반드시 오락 콘텐츠임을 자연스럽게 포함할 것.

사건명: ${cleanText(c.caseTitle, 40)}
사건 경위: ${cleanText(c.caseDescription, 320)}
억울지수: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 160) || '없음'}
담당 판사: ${judgeType}
사건번호: ${cleanText(c.docketNumber, 80)}
첨부 이미지: ${geminiImage ? '있음. 이미지 감정 내용을 분위기 참고자료로 반영할 것.' : '없음'}

반드시 JSON만 출력한다. 필드는 다음을 모두 포함한다.
{
  "absurdityTitle": "사건 제목을 더 웃긴 법정식 제목으로 바꾼 제목",
  "imageAnalysis": "첨부 이미지 분석. 이미지가 없으면 빈 문자열. 이미지가 있으면 3문장 이상",
  "reception": "접수계 기록. 4문장 이상. 이걸 접수해야 하나 고민하다가 결국 엄숙하게 접수하는 내용",
  "absurdityReview": "재판까지 올 일인지 재판부가 과몰입해서 고민하는 내용. 4문장 이상",
  "keyIssues": ["거창하지만 하찮은 쟁점 1", "쟁점 2", "쟁점 3", "쟁점 4"],
  "evidenceList": ["증거 아닌 증거 1", "증거 아닌 증거 2", "증거 아닌 증거 3", "증거 아닌 증거 4", "증거 아닌 증거 5"],
  "investigation": "억울함/황당성 분석. 5문장 이상. 수치와 엉뚱한 기준을 활용",
  "plaintiffArg": "원고 측 주장. 억울하지만 웃기게. 4문장 이상",
  "defendantArg": "피고 측 변명 추정. 말은 되는데 어이없게. 4문장 이상",
  "courtOpinion": "재판부 판단. 7문장 이상. 가장 길고 웃기게",
  "verdict": "최종 판결 이유. 5문장 이상. 오락 콘텐츠임을 자연스럽게 포함",
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
      absurdityTitle: cleanText(parsed.absurdityTitle, 80) || data.absurdityTitle,
      imageAnalysis: geminiImage ? (cleanLong(parsed.imageAnalysis, 1200) || data.imageAnalysis) : '',
      reception: cleanLong(parsed.reception, 1400) || data.reception,
      absurdityReview: cleanLong(parsed.absurdityReview, 1400) || data.absurdityReview,
      keyIssues: cleanList(parsed.keyIssues, data.keyIssues, 6, 180),
      evidenceList: cleanList(parsed.evidenceList, data.evidenceList, 7, 180),
      investigation: cleanLong(parsed.investigation, 1600) || data.investigation,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 1400) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 1400) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 2200) || data.courtOpinion,
      verdict: cleanLong(parsed.verdict, 1800) || data.verdict,
      sentence: funnyDisposition(parsed.sentence, data.sentence),
      executionOrder: cleanLong(parsed.executionOrder, 900) || data.executionOrder,
      appealNotice: cleanLong(parsed.appealNotice, 700) || data.appealNotice,
      closingComment: cleanText(parsed.closingComment, 180) || data.closingComment
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
