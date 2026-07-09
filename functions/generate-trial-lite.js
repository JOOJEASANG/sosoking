const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['생활증거추적팀 정침묵 수사관', '억울함 감식반 오과몰입 조사관', '소소경찰 박소소 경위'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const OBJECTS = [
  ['라면', '라면'], ['커피', '커피'], ['치킨', '치킨'], ['과자', '과자'], ['푸딩', '푸딩'], ['아이스크림', '아이스크림'], ['떡볶이', '떡볶이'], ['빵', '빵'],
  ['리모컨', '리모컨'], ['충전기', '충전기'], ['우산', '우산'], ['자리', '자리'], ['주차', '주차자리'], ['카톡', '카톡'], ['문자', '문자'], ['택배', '택배'], ['냉장고', '냉장고'],
  ['게임', '게임'], ['약속', '약속'], ['청소', '청소'], ['설거지', '설거지'], ['화장실', '화장실'], ['엘리베이터', '엘리베이터'], ['소리', '소리'], ['냄새', '냄새'], ['말', '말'], ['사진', '사진'], ['돈', '돈']
];
const PLACES = ['집', '회사', '카페', '편의점', '식당', '학교', '버스', '지하철', '엘리베이터', '주차장', '사무실', '거실', '방', '매장', '학원', '독서실', 'PC방', '공원'];
const PROMPT_LEAK = ['입력 데이터', '절대 원칙', '역할별 작성 방식', 'JSON', '필드:', 'refinedCaseTitle', 'expandedCase', 'caseTimeline', 'forensicReport', 'plaintiffArg', 'defendantArg', 'courtOpinion', '프롬프트', '지시문', '너는 소소킹'];
const EXAMPLE_CONTAMINATION = ['종이컵', '공기청정기', '비둘기', '피고견', '피고묘', '목줄', '빵가루', '벤치', '산책로'];

function cleanText(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function cleanLong(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n); }
function sanitize(v, n = 5000) {
  return cleanLong(v, n)
    .replaceAll('사이트', '기록철')
    .replaceAll('시스템', '재판부')
    .replaceAll('AI', '재판부')
    .replaceAll('프롬프트', '접수조서')
    .replaceAll('자동 생성', '작성')
    .replaceAll('사용자 입력', '접수진술');
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(a, b + 1));
}
function pickFrom(arr, seed = '') {
  let x = 0;
  const s = String(seed || Date.now());
  for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i) * (i + 1)) % 9973;
  return arr[Math.abs(x) % arr.length];
}
function pickJudge(v) { return JUDGES.includes(v) ? v : pickFrom(JUDGES, `${Date.now()}${Math.random()}`); }
function kstDateKey(d = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
function includesAny(text, arr) { return arr.some(x => text.includes(x)); }
function detectObject(text) {
  const found = OBJECTS.find(([k]) => text.includes(k));
  if (found) return found[1];
  const tokens = text.replace(/[.,!?。！？\n]/g, ' ').split(/\s+/).map(t => t.replace(/(을|를|이|가|은|는|에|에서|에게|한테|으로|로|도|만|까지|부터|하고|랑|와|과)$/g, '')).filter(t => t.length >= 2 && t.length <= 8);
  return tokens[0] || '문제의 대상';
}
function detectPlace(text) { return PLACES.find(p => text.includes(p)) || '사건 현장'; }
function actorPack(text) {
  if (includesAny(text, ['강아지', '반려견', '댕댕이', '멍멍이'])) return { actor: '반려견 피고', type: 'dog', defense: '꼬리변호인단', prosecutor: '간식권침해특별검사' };
  if (includesAny(text, ['고양이', '냥이', '길고양이'])) return { actor: '고양이 피고', type: 'cat', defense: '냥권수호 변호인단', prosecutor: '냥심분석검사' };
  if (includesAny(text, ['친구', '동료', '남편', '아내', '엄마', '아빠', '가족', '사람', '사장', '알바', '손님', '직원', '선배', '후배'])) return { actor: '생활 피고', type: 'person', defense: '그럴수도 변호인단', prosecutor: '일상질서특별검사' };
  return { actor: '상대방 측', type: 'unknown', defense: '그럴수도 변호인단', prosecutor: '일상질서특별검사' };
}
function badText(text, input) {
  const t = String(text || '');
  if (!t) return true;
  if (PROMPT_LEAK.some(p => t.includes(p))) return true;
  return EXAMPLE_CONTAMINATION.some(p => t.includes(p) && !input.includes(p));
}
function safeList(v, input, fallback, max, len) {
  const rows = Array.isArray(v) ? v.map(x => sanitize(x, len)).filter(x => !badText(x, input)).slice(0, max) : [];
  for (const f of fallback) if (rows.length < max) rows.push(f);
  return rows.slice(0, max);
}
function judgeVoice(judgeType, item) {
  const map = {
    '엄벌주의형': { tone: '본 재판부는 사소함이라는 탈을 쓴 생활질서 교란을 가볍게 보지 않는다', line: `“${item} 하나가 무너지면 하루의 질서도 같이 흔들립니다.”`, extra: '엄중주의 특별관리 대상' },
    '감성형': { tone: '원고의 마음속에 남은 서운함의 자국을 손해로 본다', line: `“상처는 작아 보여도 당사자 마음속에서는 대법정입니다.”`, extra: '감정 회복 우선 대상' },
    '현실주의형': { tone: '현실적으로는 작지만 반복되면 사람을 은근히 지치게 하는 문제라고 본다', line: `“큰일은 아닌데, 큰일 아닌 척하기엔 이미 늦었습니다.”`, extra: '현실 조정 필요 사건' },
    '과몰입형': { tone: '이 사건을 일상 우주의 균형이 삐끗한 순간으로 본다', line: `“사건은 작았으나 원고의 세계관은 잠깐 흔들렸습니다.”`, extra: '세계관 흔들림 사건' },
    '피곤형': { tone: '재판장도 이 사건이 왜 여기까지 왔는지 잠시 천장을 보았으나 결국 판단한다', line: `“별일 아닌데 별일이 됐으면, 이제 별일처럼 처리합니다.”`, extra: '재판장 피로 유발 사건' },
    '논리집착형': { tone: `${item}을 둘러싼 행위, 침묵, 표정, 사후 태도를 각각 분리해 판단한다`, line: `“사소함도 쪼개면 쟁점이 됩니다.”`, extra: '쟁점 과다 발생 사건' },
    '드립형': { tone: '재판 형식은 엄숙하게 유지하되 말의 각도는 살짝 비튼다', line: `“이 정도면 사건이 아니라 생활 예능의 증거물입니다.”`, extra: '드립 보존 가치 사건' }
  };
  return map[judgeType] || map['현실주의형'];
}
function baseFunny(c, judgeType, ai = {}) {
  const title = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const desc = sanitize(c.caseDescription || title, 1200);
  const desired = sanitize(c.desiredVerdict || '', 220);
  const input = `${title} ${desc} ${desired}`;
  const item = detectObject(input);
  const place = detectPlace(input);
  const actor = actorPack(input);
  const voice = judgeVoice(judgeType, item);
  const grievance = Math.max(1, Math.min(10, Number(c.grievanceIndex || 5)));
  const absurdScore = Math.min(99, 37 + grievance * 6 + (desc.length % 11));

  const aiTwists = safeList(ai.twists, input, [], 3, 120);
  const aiExcuses = safeList(ai.excuses, input, [], 2, 140);
  const aiPenalties = safeList(ai.penalties, input, [], 2, 150);
  const aiJudgeLine = !badText(ai.judgeLine, input) ? sanitize(ai.judgeLine, 180) : '';

  const evidenceBits = [
    `원고 진술서: “${desc.slice(0, 70)}${desc.length > 70 ? '…' : ''}”`,
    `${place} 분위기 감정 결과 억울함 농도 ${absurdScore}% 측정`,
    `사건 직후 원고의 머릿속 재생 횟수 추정 ${grievance + 3}회`,
    `${item} 관련 평정심 회복 예상 시간 ${grievance * 9}분`,
    `피고 측 반응 속도 ${Math.max(1, 11 - grievance)}초 지연 의혹`,
    ...aiTwists
  ];
  const defendantExcuses = [
    `${actor.actor} 측은 “그 정도로 커질 줄은 몰랐다”고 주장한다.`,
    `${actor.defense}은 ${item} 문제가 일상에서 흔한 오해라고 항변한다.`,
    `피고 측은 원고의 억울함 수치가 예상보다 높게 측정된 것은 인정하나 고의성은 부인한다.`,
    ...aiExcuses
  ];
  const penaltyIdeas = [
    `${actor.actor} 측은 원고 앞에서 억울함 인정 문장 1회를 낭독한다.`,
    `${item} 관련 행위 전 원고 표정 확인 의무를 3일간 이행한다.`,
    `피고 측은 “그럴 수도 있지” 발언권을 하루 1회로 제한한다.`,
    desired ? `원고가 희망한 처분인 “${desired}”을 현실 가능한 선에서 일부 반영한다.` : `원고에게 작은 간식 또는 음료로 감정 항소비용을 납부한다.`,
    ...aiPenalties
  ];

  const expandedCase = `사건개요\n${title}은 ${place}에서 발생한 ${item} 관련 생활분쟁이다. 원고는 사건 규모보다 그 순간의 어이없음, 이후에도 계속 생각나는 찝찝함, 그리고 피고 측의 온도 차이에 강한 억울함을 호소하였다.\n\n접수 내용을 검토한 결과, 본 사안은 형식상 사소하나 감정상으로는 이미 원고의 하루 일정표에 빨간 줄을 그은 사건으로 보인다. 재판부는 이를 ${voice.extra}으로 분류하고 정식 심리에 회부한다.`;
  const caseTimeline = `수사 진행 과정\n1. ${place}에서 ${item} 관련 이상 징후가 발생하였다.\n2. 원고는 최초 2.5초간 “이게 맞나?” 단계에 머물렀고, 이후 억울함이 빠르게 상승하였다.\n3. ${actor.actor} 측은 즉시 사과 또는 해명을 하지 못해 사건을 조기 종결할 기회를 놓쳤다.\n4. 수사관은 원고의 표정, 말끝, 사건 후 재언급 횟수를 종합해 생활질서 교란 가능성을 확인하였다.\n5. 본 사건은 단순 해프닝으로 덮기에는 원고 마음속 재방송이 과다하다고 판단되어 재판부로 송치되었다.`;
  const forensicReport = `수사보고서\n담당 수사관은 ${item} 자체보다 사건 이후 남은 감정의 잔열에 주목하였다. 원고의 억울함 지수는 ${grievance}/10, 현장 황당성 지수는 ${absurdScore}/100으로 산정된다.\n\n증거로는 원고 진술, 사건 직후의 침묵 길이, 피고 측의 애매한 태도, 그리고 “이걸 그냥 넘어가야 하나”라는 내적 독백이 제출되었다. 감식반은 특히 마지막 독백을 본 사건의 핵심 증거로 본다.`;
  const plaintiffArg = `원고 측 주장\n${actor.prosecutor}는 “이 사건의 본질은 ${item}이 아니라 원고의 평온한 하루가 갑자기 재판감으로 바뀐 데 있다”고 주장하였다.\n\n원고 측은 피고가 처음부터 대단한 잘못을 저질렀다고까지 말하지는 않으나, 문제를 너무 가볍게 취급한 태도 때문에 사건이 커졌다고 본다. 특히 원고가 속으로 여러 번 반박문을 작성하게 된 점은 중대한 정신적 노동으로 평가해야 한다고 주장한다.`;
  const defendantArg = `피고 측 변론\n${actor.defense}은 “이 정도 일로 법정까지 오는 것은 생활의 자연스러운 삐걱거림을 과도하게 확대한 것”이라고 항변하였다.\n\n그러나 변론 도중 피고 측은 “그냥 그런 줄 알았다”, “별생각 없었다”, “그렇게 억울한 줄 몰랐다”는 취지의 말을 반복하였고, 재판부는 바로 그 대목에서 원고의 억울함이 다시 1.7배 상승했을 가능성을 배제하기 어렵다고 보았다.\n\n피고 측 추가 변명: ${defendantExcuses.join(' / ')}`;
  const courtOpinion = `재판부 판단\n${judgeType} 재판부는 다음과 같이 판단한다. ${voice.tone}.\n\n본 재판부가 보는 핵심 쟁점은 세 가지다. 첫째, ${item} 문제가 실제로 원고의 기분을 건드렸는가. 둘째, 피고 측이 이를 너무 작게 본 것은 아닌가. 셋째, 이 사안을 웃으면서도 판결문까지 남길 정도의 황당함으로 볼 수 있는가.\n\n위 증거와 진술을 종합하면, 원고의 억울함은 단순 기분 탓이 아니라 사건 이후에도 반복 재생된 생활형 후유증에 가깝다. 따라서 재판부는 피고 측의 일부 책임을 인정한다. ${aiJudgeLine || voice.line}`;
  const sentence = `판결\n주문 1. ${actor.actor} 측은 원고가 왜 억울했는지 최소 1회 이상 진지한 얼굴로 인정한다.\n주문 2. 피고 측은 향후 ${item} 관련 상황에서 “별거 아니잖아”라는 취지의 발언을 즉시 사용하지 않는다.\n주문 3. 원고는 본 판결문을 근거로 마음속 항소심을 24시간 이내 종료하도록 노력한다.\n주문 4. ${penaltyIdeas[0]}\n주문 5. ${penaltyIdeas[1]}\n주문 6. ${penaltyIdeas[3] || penaltyIdeas[2]}\n\n본 판결은 실제 법적 효력은 없으나, 원고의 억울함을 웃음으로 정리하는 데에는 상당한 효력이 있는 것으로 본다.`;
  const closingComment = `재판장 한마디: “${(aiJudgeLine || voice.line).replace(/^재판장 한마디[:：]?\s*/g, '').replace(/[“”"]/g, '')}”`;

  return {
    refinedCaseTitle: title,
    absurdityTitle: title,
    expandedCase,
    caseTimeline,
    forensicReport,
    plaintiffArg,
    defendantArg,
    courtOpinion,
    sentence,
    closingComment,
    absurdDetails: [
      `${item} 문제가 하루의 평정심을 침범함`,
      `원고 마음속 재방송 ${grievance + 3}회 발생`,
      `${place} 현장 황당성 ${absurdScore}% 측정`,
      `피고 측 온도 차이로 사건 확대`,
      `사소한데 계속 생각나는 후유증 확인`,
      `재판장 성격상 ${voice.extra}으로 격상`,
      ...aiTwists
    ].slice(0, 12),
    evidenceBits: evidenceBits.slice(0, 8),
    defendantExcuses: defendantExcuses.slice(0, 5),
    penaltyIdeas: penaltyIdeas.slice(0, 6)
  };
}
async function loadSettings() {
  try { const s = await db.doc('site_settings/config').get(); return s.exists ? s.data() : {}; } catch { return {}; }
}
async function imageForGemini(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  const path = img?.storagePath || c?.imageStoragePath || '';
  const mimeType = cleanText(img?.mimeType, 30) || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
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
  return img && typeof img === 'object' ? {
    storagePath: cleanText(img.storagePath || c.imageStoragePath, 240),
    mimeType: cleanText(img.mimeType, 30),
    width: Number(img.width || 0),
    height: Number(img.height || 0),
    originalName: cleanText(img.originalName, 80),
    originalSize: Number(img.originalSize || 0),
    resizedSize: Number(img.resizedSize || 0)
  } : null;
}
async function aiAssist(model, c, judgeType, geminiImage) {
  const title = cleanText(c.caseTitle, 90);
  const desc = cleanText(c.caseDescription, 900);
  const desired = cleanText(c.desiredVerdict, 180);
  const prompt = `사건명: ${title}\n사건내용: ${desc}\n희망처분: ${desired || '없음'}\n재판장: ${judgeType}\n\n아래 JSON만 작성한다. 사건내용에 없는 물건, 장소, 동물, 증인을 만들지 않는다. 작성 안내문을 본문에 쓰지 않는다.\n{"twists":["웃긴 핵심 포인트 3개"],"excuses":["피고 측 황당 변명 2개"],"penalties":["구체적인 황당 처분 2개"],"judgeLine":"재판장 한마디 1개"}`;
  try {
    const parts = [{ text: prompt }];
    if (geminiImage) parts.push({ inlineData: geminiImage });
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const raw = safeJson(result.response.text());
    const text = JSON.stringify(raw);
    const input = `${title} ${desc} ${desired}`;
    if (badText(text, input)) return { data: {}, usage: result.response.usageMetadata || {} };
    return { data: raw, usage: result.response.usageMetadata || {} };
  } catch (err) {
    console.warn('ai assist skipped:', err.message || err);
    return { data: {}, usage: {} };
  }
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB', cors: true }, async request => {
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
      status: 'processing', courtStage: 'hearing', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부',
      recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      judgeType, processingStartedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete()
    });
  });

  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const geminiImage = await imageForGemini(c).catch(() => null);
  let assist = {};
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const key = geminiKey.value().trim();
    if (key) {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: modelName, generationConfig: { temperature: 1.05, topP: 0.94, topK: 40, maxOutputTokens: 1800, responseMimeType: 'application/json' } });
      const ai = await aiAssist(model, c, judgeType, geminiImage);
      assist = ai.data || {};
      totals = { requests: 1, inputTokens: ai.usage.promptTokenCount || 0, outputTokens: ai.usage.candidatesTokenCount || 0 };
    }
  } catch (err) {
    console.warn('ai setup skipped:', err.message || err);
  }

  const data = baseFunny(c, judgeType, assist);
  const caseTitle = data.refinedCaseTitle;
  const aiGenerated = !!(assist.twists || assist.excuses || assist.penalties || assist.judgeLine);
  const generationMode = aiGenerated ? 'ai-assisted-funny-engine-v11' : 'local-funny-engine-v11';

  try {
    await resultRef.set({
      userId: c.userId,
      ownerId: c.userId,
      isPublic: c.isPublic === true,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      caseTitle, originalCaseTitle: caseTitle, refinedCaseTitle: caseTitle, absurdityTitle: caseTitle,
      imageAnalysis: '', hasImageAttachment: !!geminiImage, imageAttachmentMeta: imageMeta(c), caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, defendantExcuses: data.defendantExcuses, penaltyIdeas: data.penaltyIdeas,
      grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
      reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
      aiGenerated, generationMode, resultVersion: 'funny-engine-v11', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${caseTitle}을 실제 법률 사안이 아닌 예능형 황당재판으로 판단한다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion,
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
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'funny-engine-v11', generationMode };
});
