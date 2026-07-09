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
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const JUDGE_PERSONA = {
  '엄벌주의형': '사소한 잘못도 국가 중대사처럼 엄중하게 다룬다. 말투는 단호하고 판결은 과하다. 웃음은 엄격함에서 나오게 한다.',
  '감성형': '원고의 서운함과 마음의 상처를 크게 해석한다. 말투는 진지하고 따뜻하지만 과몰입이 심하다.',
  '현실주의형': '별일 아닌 걸 알면서도 현실적인 해결책을 이상하게 진지하게 제시한다. 생활감 있는 판결을 쓴다.',
  '과몰입형': '작은 사건을 세계관 붕괴급 사태처럼 확장한다. 장면 묘사와 과장된 비유를 적극 사용한다.',
  '피곤형': '피곤한 재판장이 어이없어하면서도 끝까지 판결한다. 건조한 한숨과 현실적인 툴툴거림에서 웃음이 나오게 한다.',
  '논리집착형': '말도 안 되는 쟁점을 세밀하게 쪼개고 논리적으로 따진다. 과한 분석에서 웃음이 나오게 한다.',
  '드립형': '재판 형식은 유지하되 센스 있는 비유와 짧은 드립을 많이 쓴다. 단, 사건내용에서 벗어나지 않는다.'
};

const OBJECT_HINTS = [
  ['빵', '빵'], ['샌드위치', '샌드위치'], ['도넛', '도넛'], ['라면', '라면'], ['커피', '커피'], ['치킨', '치킨'], ['과자', '과자'], ['아이스크림', '아이스크림'], ['떡볶이', '떡볶이'],
  ['리모컨', '리모컨'], ['충전기', '충전기'], ['우산', '우산'], ['자리', '자리'], ['주차', '주차자리'], ['카톡', '카톡'], ['문자', '문자'], ['택배', '택배'], ['냉장고', '냉장고'], ['돈', '돈'],
  ['게임', '게임'], ['약속', '약속'], ['청소', '청소'], ['설거지', '설거지'], ['화장실', '화장실'], ['엘리베이터', '엘리베이터'], ['소리', '소리'], ['냄새', '냄새'], ['말', '말'], ['사진', '사진']
];
const PLACE_HINTS = ['공원', '회사', '집', '카페', '편의점', '식당', '학교', '버스', '지하철', '엘리베이터', '주차장', '놀이터', '사무실', '거실', '방', '매장', '학원', '독서실', 'PC방'];
const BORING_WORDS = ['평온', '정적', '미세한 흔적', '기록 보존 가치', '결정적 순간', '원래 상태', '단순한 배경', '생활형 증거', '본 사건은 법적으로', '방청석은 웃음을 참되'];
const FIXED_PHRASES = ['종이컵', '공기청정기', '긴급속보 자막', '방청석은 웃음을 참되', '웃음을 참되, 억울함은 참지'];

function cleanText(v, n) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
}
function cleanLong(v, n) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
}
function sanitize(v, n = 5000) {
  return cleanLong(v, n)
    .replaceAll('사이트', '기록철')
    .replaceAll('시스템', '재판부')
    .replaceAll('AI', '재판부')
    .replaceAll('프롬프트', '접수조서')
    .replaceAll('자동 생성', '작성')
    .replaceAll('사용자 입력', '접수진술')
    .replaceAll('생활형 처분', '소소형량')
    .replaceAll('방청석은 웃음을 참되, 억울함은 참지 마십시오.', '')
    .replaceAll('방청석은 웃음을 참되', '')
    .replaceAll('긴급속보 자막', '속마음 알림창');
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
function pickJudge(v) {
  return JUDGES.includes(v) ? v : JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length];
}
function kstDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function list(v, fallback, max, len) {
  const rows = Array.isArray(v) ? v.map(x => sanitize(x, len)).filter(Boolean).slice(0, max) : [];
  while (rows.length < fallback.length) rows.push(fallback[rows.length]);
  return rows.slice(0, max);
}
async function loadSettings() {
  try {
    const s = await db.doc('site_settings/config').get();
    return s.exists ? s.data() : {};
  } catch {
    return {};
  }
}
function softenCaseText(text) {
  return cleanText(text, 1200)
    .replaceAll('음주운전', '술기운 의혹')
    .replaceAll('고소', '엄숙 항의')
    .replaceAll('신고', '방청석 제보')
    .replaceAll('절도', '슬쩍 실종')
    .replaceAll('사기', '말바꾸기 의혹')
    .replaceAll('폭행', '과격한 몸짓')
    .replaceAll('형사', '매우 진지한')
    .replaceAll('법원', '마음속 재판장');
}
function detectObject(text) {
  const found = OBJECT_HINTS.find(([k]) => text.includes(k));
  if (found) return found[1];
  const tokens = text
    .replace(/[.,!?。！？\n]/g, ' ')
    .split(/\s+/)
    .map(t => t.replace(/(을|를|이|가|은|는|에|에서|에게|한테|으로|로|도|만|까지|부터|하고|했던|하던)$/g, ''))
    .filter(t => t.length >= 2 && !['제가','내가','나는','저는','하고','했는데','있었는데','한눈판사이','사건','내용','접수된','다음과','같다','무슨일이','있었나요'].includes(t));
  return tokens[0] || '그 일';
}
function detectPlace(text) {
  return PLACE_HINTS.find(p => text.includes(p)) || '그 현장';
}
function detectActor(text) {
  if (/(강아지|반려견|댕댕이|멍멍이)/.test(text)) return '강아지 측';
  if (/(고양이|냥이|길고양이)/.test(text)) return '고양이 측';
  if (/(친구|동료|남편|아내|엄마|아빠|가족|사장|알바|손님|직원|선배|후배)/.test(text)) {
    const m = text.match(/친구|동료|남편|아내|엄마|아빠|가족|사장|알바|손님|직원|선배|후배/);
    return `${m?.[0] || '상대방'} 측`;
  }
  return '상대방 측';
}
function scenarioFor(c) {
  const rawTitle = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const rawDesc = cleanText(c.caseDescription, 1200) || rawTitle;
  const desc = softenCaseText(rawDesc);
  const inputText = `${rawTitle} ${rawDesc} ${desc}`;
  const item = detectObject(inputText);
  const place = detectPlace(inputText);
  const actor = detectActor(inputText);
  const seed = `${rawTitle}|${rawDesc}`;
  return { rawTitle, rawDesc, desc, inputText, item, place, actor, seed, persona: '' };
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
function judgeFallbackLine(judgeType, scene) {
  const byJudge = {
    '엄벌주의형': [`재판장 한마디: “${scene.item} 문제를 가볍게 본 순간, 일상 질서는 이미 한 칸 밀렸습니다.”`, `재판장 한마디: “작은 일이라는 말로 원고의 억울함을 덮을 수는 없습니다.”`],
    '감성형': [`재판장 한마디: “오늘 원고가 잃은 것은 ${scene.item}만이 아니라 기대하던 기분 한 조각입니다.”`, `재판장 한마디: “사소한 일도 마음에 남으면 사건이 됩니다.”`],
    '현실주의형': [`재판장 한마디: “이 사건의 해결책은 거창하지 않습니다. 인정하고, 사과하고, 비슷한 걸 하나 챙기면 됩니다.”`, `재판장 한마디: “생활 사건은 빠른 인정이 제일 싼 합의입니다.”`],
    '과몰입형': [`재판장 한마디: “${scene.place}에서 시작된 이 일은 원고 마음속에서는 이미 시즌제 드라마가 되었습니다.”`, `재판장 한마디: “사건은 작았으나, 원고의 내면에서는 조명이 켜졌습니다.”`],
    '피곤형': [`재판장 한마디: “이걸 판결하고 있는 제 자신도 놀랍지만, 원고가 억울한 건 맞습니다.”`, `재판장 한마디: “별일 아닌데 별일이 됐으니, 별일처럼 마무리합시다.”`],
    '논리집착형': [`재판장 한마디: “핵심은 ${scene.item} 자체가 아니라, 그로 인해 발생한 기대와 현실의 괴리입니다.”`, `재판장 한마디: “원고의 분노는 과장됐으나, 발생 원인은 존재합니다.”`],
    '드립형': [`재판장 한마디: “${scene.item} 하나로 여기까지 온 이상, 이제 이건 그냥 일이 아니라 콘텐츠입니다.”`, `재판장 한마디: “웃기지만 억울하고, 억울하지만 솔직히 조금 웃깁니다.”`]
  };
  return pickFrom(byJudge[judgeType] || byJudge['현실주의형'], scene.seed);
}
function fallbackFor(c, judgeType, people) {
  const s = scenarioFor(c);
  const title = s.rawTitle || '소소한 황당사건';
  const absurdDetails = [
    `${s.place}에서 ${s.item} 관련 문제가 발생함`,
    `원고의 예상과 실제 상황이 어긋남`,
    `${s.actor}의 설명 또는 태도가 사건을 더 크게 만듦`,
    `사건 직후 원고의 어이없음이 커짐`,
    `처음엔 사소했지만 말할수록 억울해지는 구조`,
    `당사자 사이의 온도 차이가 핵심 쟁점으로 떠오름`
  ];
  const evidenceBits = [
    `접수 진술: ${s.rawDesc}`,
    `핵심 대상: ${s.item}`,
    `발생 장소: ${s.place}`,
    `상대방 또는 관련 주체: ${s.actor}`,
    `사건 후 원고가 느낀 어이없음`,
    `상황을 작게 보려는 피고 측 태도`
  ];
  const defendantExcuses = [
    `${s.actor}은 상황이 이렇게 커질 줄 몰랐다고 주장한다.`,
    `${s.actor}은 당시에는 별문제가 아니라고 생각했다고 항변한다.`,
    `${s.actor}은 원고의 반응이 예상보다 컸다고 진술한다.`
  ];
  const penaltyIdeas = [
    `${s.actor}은 원고에게 사건 당시 상황을 인정한다.`,
    `${s.actor}은 같은 상황이 반복되지 않도록 재발방지 약속을 한다.`,
    `원고는 ${s.item} 관련 억울함을 공식적으로 기록철에 남긴다.`,
    `양측은 사과 또는 작은 보상으로 사건을 마무리한다.`,
    `재판부는 본 사건을 사소하지만 무시할 수 없는 생활분쟁으로 본다.`,
    `향후 유사 상황에서는 먼저 설명하고 넘어갈 것을 명한다.`
  ];
  return {
    refinedCaseTitle: title,
    absurdityTitle: title,
    expandedCase: [`사건 브리핑`, `접수된 사건내용을 바탕으로 보면, 핵심은 ${s.place}에서 벌어진 ${s.item} 관련 상황이다.`, `원고는 이 일을 단순한 해프닝으로 넘기기엔 어이없음이 컸다고 본다.`, `${s.actor}은 대수롭지 않게 생각했을 수 있으나, 바로 그 온도 차이가 사건을 키웠다.`, `재판부는 이 사건을 실제 법률문제가 아닌 소소한 억울함의 과장 재판으로 다룬다.`].join('\n'),
    caseTimeline: [`현장 재구성`, `1단계: 원고가 평소처럼 상황을 받아들이고 있었다.`, `2단계: ${s.item} 관련 예상 밖의 일이 발생했다.`, `3단계: ${s.actor}의 반응 또는 태도가 원고의 어이없음을 키웠다.`, `4단계: 원고는 이 일이 사소하지만 그냥 넘기기엔 찝찝하다고 판단했다.`, `5단계: 사건은 소소킹 황당재판소로 넘어왔다.`].join('\n'),
    forensicReport: [`증거와 정황`, ...evidenceBits, `감정 결과: 본 사안은 금액이나 규모보다 원고가 느낀 어이없음의 비중이 큰 사건으로 판단된다.`].join('\n'),
    plaintiffArg: [`원고 측 주장`, `${people.prosecutorName}: “원고는 이 상황을 이렇게 넘기겠다고 동의한 적이 없습니다.”`, `원고 측은 ${s.item} 자체보다 그 이후의 태도와 분위기가 더 억울했다고 주장한다.`, `검사는 이 사건을 사소하지만 충분히 놀림감이 될 수 있는 생활분쟁으로 본다.`].join('\n'),
    defendantArg: [`피고 측 변론`, `${people.defenderName}: “피고 측은 악의가 아니라 상황 판단의 차이라고 봅니다.”`, ...defendantExcuses].join('\n'),
    courtOpinion: [`재판부 판단`, `${judgeType} 재판부는 이 사건을 ${JUDGE_PERSONA[judgeType] || JUDGE_PERSONA['현실주의형']}의 관점에서 본다.`, `핵심은 ${s.item} 자체보다 원고와 ${s.actor} 사이의 체감 차이다.`, `재판부는 원고의 억울함이 다소 과장됐더라도, 사건으로 만들 만한 웃긴 지점은 충분하다고 판단한다.`].join('\n'),
    sentence: [`최종 판결`, `문서명: 주문 및 소소형량`, ...penaltyIdeas.map((p, i) => `${i + 1}. ${p}`)].join('\n'),
    closingComment: judgeFallbackLine(judgeType, s),
    absurdDetails,
    evidenceBits,
    defendantExcuses,
    penaltyIdeas,
    scene: s
  };
}
function normalize(raw, fb, caseTitle) {
  const keepTitle = cleanText(caseTitle || fb.refinedCaseTitle, 90) || fb.refinedCaseTitle;
  return {
    refinedCaseTitle: keepTitle,
    absurdityTitle: keepTitle,
    expandedCase: sanitize(raw.expandedCase || fb.expandedCase, 7200),
    caseTimeline: sanitize(raw.caseTimeline || fb.caseTimeline, 6200),
    forensicReport: sanitize(raw.forensicReport || fb.forensicReport, 6200),
    plaintiffArg: sanitize(raw.plaintiffArg || fb.plaintiffArg, 5200),
    defendantArg: sanitize(raw.defendantArg || fb.defendantArg, 5200),
    courtOpinion: sanitize(raw.courtOpinion || fb.courtOpinion, 5200),
    sentence: sanitize(raw.sentence || fb.sentence, 4200),
    closingComment: sanitize(raw.closingComment || fb.closingComment, 480),
    absurdDetails: list(raw.absurdDetails, fb.absurdDetails, 12, 220),
    evidenceBits: list(raw.evidenceBits, fb.evidenceBits, 8, 220),
    defendantExcuses: list(raw.defendantExcuses, fb.defendantExcuses, 5, 260),
    penaltyIdeas: list(raw.penaltyIdeas, fb.penaltyIdeas, 6, 260)
  };
}
function allResultText(data) {
  return [data.expandedCase, data.caseTimeline, data.forensicReport, data.plaintiffArg, data.defendantArg, data.courtOpinion, data.sentence, data.closingComment, ...(data.absurdDetails || []), ...(data.evidenceBits || []), ...(data.defendantExcuses || []), ...(data.penaltyIdeas || [])].join(' ');
}
function tooGeneric(data) {
  const joined = allResultText(data);
  const boringHits = BORING_WORDS.filter(w => joined.includes(w)).length;
  const fixedHits = FIXED_PHRASES.filter(w => joined.includes(w)).length;
  return boringHits >= 2 || fixedHits > 0 || joined.length < 900;
}
async function generateAi(model, c, judgeType, people, geminiImage, fb) {
  const scene = fb.scene || scenarioFor(c);
  const caseTitle = cleanText(c.caseTitle || scene.rawTitle, 90) || '소소한 황당사건';
  const persona = JUDGE_PERSONA[judgeType] || JUDGE_PERSONA['현실주의형'];
  const prompt = `너는 소소킹 황당재판소의 예능형 재판문 작성자다. 실제 법률 조언이 아니라 오락용 황당재판 결과를 JSON으로만 작성한다.

가장 중요한 원칙:
- 사용자가 직접 입력한 사건명은 절대 바꾸지 마라. refinedCaseTitle과 absurdityTitle은 반드시 아래 사건명을 그대로 사용한다.
- 사건명: ${caseTitle}
- 결과 내용은 반드시 아래 사건내용에만 근거한다. 예시용 단어, 고정 증인, 고정 문구를 끼워 넣지 마라.
- 사건내용: ${scene.rawDesc}

재판장 성격: ${judgeType}
재판장 성격 지시: ${persona}
담당자 이름: ${JSON.stringify(people)}

작성 방향:
1. '무슨 일이 있었나요?'에 적힌 사건내용을 먼저 파악하고, 그 사건에 맞는 가상 진행 과정, 공방, 증거, 판결을 새로 만든다.
2. 종이컵, 공기청정기, 비둘기, 목줄, 빵, 강아지 같은 단어는 사건내용에 실제로 있을 때만 사용한다.
3. '방청석은 웃음을 참되', '긴급속보 자막', '작았으나 사라지거나 꼬이는 순간' 같은 반복 문구를 쓰지 않는다.
4. 너무 시스템적인 문장 금지. 매번 다른 상황, 다른 표현, 다른 판결이 나오게 한다.
5. 재판장 성격이 문장 전체에 묻어나야 한다. 특히 courtOpinion, sentence, closingComment는 재판장 성격별로 다르게 쓴다.
6. 각 섹션은 설명만 하지 말고 필요하면 대사, 현장 재연, 가상 증거, 과장된 판단을 섞는다.
7. 단, 억지로 특정 단어를 끼워 넣지 말고 사건내용에서 자연스럽게 확장한다.

필드:
refinedCaseTitle, absurdityTitle, expandedCase, caseTimeline, forensicReport, plaintiffArg, defendantArg, courtOpinion, sentence, closingComment, absurdDetails(6~12개), evidenceBits(4~8개), defendantExcuses(3~5개), penaltyIdeas(4~6개).

JSON만 출력하라.`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const data = normalize(safeJson(result.response.text()), fb, caseTitle);
  const finalData = tooGeneric(data) ? normalize(fb, fb, caseTitle) : data;
  return { data: finalData, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
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
  const caseTitle = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const fb = fallbackFor(c, judgeType, people);
  const geminiImage = await imageForGemini(c).catch(err => { console.warn('image load skipped:', err.message || err); return null; });
  let data = normalize(fb, fb, caseTitle);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let generationMode = 'local-clean-ai-directed-v8';
  let aiGenerated = false;

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 1.15, topP: 0.96, topK: 48, maxOutputTokens: 7500, responseMimeType: 'application/json' }
    });
    const generated = await generateAi(model, c, judgeType, people, geminiImage, fb);
    data = generated.data;
    totals = generated.usage;
    generationMode = tooGeneric(data) ? 'local-clean-ai-directed-v8' : 'ai-clean-ai-directed-v8';
    aiGenerated = generationMode.startsWith('ai-');
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
      caseTitle: caseTitle, originalCaseTitle: caseTitle, refinedCaseTitle: caseTitle, absurdityTitle: caseTitle,
      imageAnalysis: '', hasImageAttachment: !!geminiImage, imageAttachmentMeta: imageMeta(c), caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, defendantExcuses: data.defendantExcuses, penaltyIdeas: data.penaltyIdeas,
      grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
      reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
      aiGenerated, generationMode, resultVersion: 'clean-ai-directed-v8', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${caseTitle}을 실제 법률 사안이 아닌 예능형 황당재판으로 판단한다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion,
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
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'clean-ai-directed-v8', generationMode };
});
