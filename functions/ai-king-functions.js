'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

const DAILY_LIMIT = 3;

// ── AI King config cache ──
let _aiKingConfig = null;
let _aiKingConfigFetchedAt = 0;

async function getAiKingConfig() {
  const now = Date.now();
  if (_aiKingConfig && now - _aiKingConfigFetchedAt < 60_000) return _aiKingConfig;
  const snap = await db.doc('config/ai_king').get();
  _aiKingConfig = snap.exists ? snap.data() : {};
  _aiKingConfigFetchedAt = now;
  return _aiKingConfig;
}

// ── Multi-provider AI call ──
function validBase64(str) {
  if (!str || typeof str !== 'string') return null;
  const stripped = str.includes(',') ? str.split(',')[1] : str;
  if (stripped.length > 4 * 1024 * 1024) { console.warn('[ai-king] image too large, skipping'); return null; }
  return stripped;
}

async function callAI(system, userText, imageBase64 = null, maxTokens = 400, temperature = 0.8) {
  const config = await getAiKingConfig();
  const img = validBase64(imageBase64);

  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      systemInstruction: system,
    });
    const parts = [];
    if (img) parts.push({ inlineData: { data: img, mimeType: 'image/jpeg' } });
    parts.push({ text: userText });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    });
    return result.response.text() || '';
  }

  // Default: Claude
  if (!config.claudeApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const content = [];
  if (img) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } });
  content.push({ type: 'text', text: userText });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content }],
  });
  return msg.content[0]?.text || '';
}

async function callAIWithImages(system, userText, imageA = null, imageB = null, maxTokens = 500, temperature = 0.8) {
  const config = await getAiKingConfig();
  const imgA = validBase64(imageA);
  const imgB = validBase64(imageB);

  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      systemInstruction: system,
    });
    const parts = [];
    if (imgA) parts.push({ inlineData: { data: imgA, mimeType: 'image/jpeg' } });
    if (imgB) parts.push({ inlineData: { data: imgB, mimeType: 'image/jpeg' } });
    parts.push({ text: userText });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    });
    return result.response.text() || '';
  }

  // Default: Claude
  if (!config.claudeApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const content = [];
  if (imgA) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imgA } });
  if (imgB) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imgB } });
  content.push({ type: 'text', text: userText });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content }],
  });
  return msg.content[0]?.text || '';
}

// ── Usage check with extraAiUses fallback ──
// Returns { allowed: boolean, limit: number }
async function checkUsage(userId, feature) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`ai_king_usage/${userId}_${today}_${feature}`);
  const config = await getAiKingConfig();
  const dailyLimit = config.dailyFreeLimit || DAILY_LIMIT;
  const allowed = await db.runTransaction(async (tx) => {
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${userId}`))]);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count >= dailyLimit) {
      const extra = userSnap.exists ? (userSnap.data()?.extraAiUses || 0) : 0;
      if (extra <= 0) return false;
      tx.update(db.doc(`users/${userId}`), { extraAiUses: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      return true;
    }
    tx.set(ref, { count: count + 1, userId, feature, date: today, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  return { allowed, limit: dailyLimit };
}

// ── 작성자 정보 조회 (Firestore users 우선, Auth token 보완) ──
async function getAuthorInfo(userId, authToken = {}) {
  let userData = {};
  try {
    const snap = await db.doc(`users/${userId}`).get();
    if (snap.exists) userData = snap.data() || {};
  } catch {}
  const name = (userData.nickname || userData.displayName || authToken.name || authToken.email?.split('@')[0] || '').trim().slice(0, 40) || '익명';
  return {
    authorId: userId,
    authorName: name,
    authorEmail: (authToken.email || userData.email || '').slice(0, 120),
    authorPhoto: (authToken.picture || userData.photoURL || '').slice(0, 300),
  };
}

// ── 미친판사: 7가지 판사 유형 ──
const JUDGES = [
  { id: 'lawyer',      name: '⚖️ 엄근진 법관',  desc: '대한민국 대법원 판사 스타일. 반드시 "주문: 피고인 ○○은(는) [유죄/무죄/..] 이다."로 시작. 형법·민법 조항 번호 실제처럼 인용(없어도 됨). 상황의 핵심을 법리로 딱 찌르되 딱딱하고 엄중하게. 판결 이유 한 줄. 2~3문장.' },
  { id: 'emotional',   name: '😭 감성 판사',     desc: '판결보다 감정이 먼저인 판사. 상황에서 "이 사람이 얼마나 서러웠을까"를 먼저 읽어낸다. 시적인 문장 하나 반드시 포함. 마지막 문장은 반드시 자신도 눈물이 난다는 내용. 유무죄 판결도 내리되 눈물로 시작해서 눈물로 끝. 2~3문장.' },
  { id: 'boomer',      name: '👴 꼰대 판사',     desc: '판결보다 훈계가 목적인 판사. 반드시 "내가 말이야~" 또는 "우리 때는~"으로 시작. 상황을 꼭 본인 젊은 시절과 비교하면서 요즘 것들 탓을 한 번은 함. 판결은 한 줄, 교훈이 두 줄. 2~3문장.' },
  { id: 'scientist',   name: '🔬 과학자 판사',   desc: '감정 없는 데이터 판사. 상황을 반드시 확률(예: "이 사건의 잘못 확률은 73.6%") 또는 연구결과로 시작. 없는 논문도 저자와 연도 붙여서 인용. 결론은 차갑고 단호하게. 절대 감정표현 없음. 2~3문장.' },
  { id: 'philosopher', name: '🤔 철학자 판사',   desc: '판결 대신 질문을 던지는 판사. 상황의 핵심을 꿰뚫는 철학적 질문 하나로 시작(예: "과연 치킨이란 무엇인가?"). 실존 철학자(소크라테스/니체/공자/하이데거) 한 명 인용. 결론 없이 "이상이다"로 끝내거나 더 큰 질문으로 끝. 2~3문장.' },
  { id: 'alien',       name: '👽 외계인 판사',   desc: '"[모행성 이름] 출신 판사 X-7의 판결이다."로 시작. 지구의 관습을 이해 못 하면서 엉뚱하게 본질을 찌름. "지구인들은 왜 [상황 핵심 요소]를 중요시 하는가? 당혹스럽다." 포함. 자기 행성 기준으로 유무죄 판정. 2~3문장.' },
  { id: 'crazy',       name: '🤪 돌아이 판사',   desc: '자신은 완전히 진지하다. 상황을 전혀 다른 맥락으로 해석하거나 엉뚱한 증거를 근거로 댐(예: "피고인이 어제 파란 우산을 썼다는 목격담이 있다"). 판결문 중간에 갑자기 무관한 단어나 문장 하나 끼어듬. 본인은 천재라고 확신. 2~3문장.' },
];

const JUDGE_SYSTEM = `당신은 7명의 캐릭터 판사다. 주어진 상황을 보고 각 판사가 자기 캐릭터로 판결한다.
핵심 원칙: 각 판사는 반드시 상황의 진짜 핵심을 꿰뚫어야 한다. 단순히 캐릭터 말투만 흉내내는 게 아니라, 그 캐릭터만의 시각으로 핵심을 비틀어 찌른다. 읽는 사람이 "어, 맞는 말인데?" 하면서 웃음이 나와야 한다.
절대 금지: 뻔한 말, 상황과 무관한 일반론, 너무 짧은 한 단어 판결.
반드시 아래 JSON 형식으로만 답하라. 다른 텍스트 없이 JSON만 출력:
{"verdicts":[
  {"id":"lawyer","verdict":"판결문"},
  {"id":"emotional","verdict":"판결문"},
  {"id":"boomer","verdict":"판결문"},
  {"id":"scientist","verdict":"판결문"},
  {"id":"philosopher","verdict":"판결문"},
  {"id":"alien","verdict":"판결문"},
  {"id":"crazy","verdict":"판결문"}
]}

각 판사 캐릭터 (상황의 핵심을 각자의 방식으로 찌를 것):
${JUDGES.map(j => `- ${j.id}: ${j.desc}`).join('\n')}`;

exports.aiJudge = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { situation, imageBase64 } = request.data || {};
  if (!situation || situation.trim().length < 5) {
    throw new HttpsError('invalid-argument', '상황을 5자 이상 적어주세요');
  }

  const [{ allowed, limit }, author] = await Promise.all([
    checkUsage(userId, 'judge'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 판결은 하루 ${limit}번만 가능해요`);

  let raw;
  try {
    raw = await callAI(
      JUDGE_SYSTEM,
      `다음 상황을 7명의 판사가 각자의 캐릭터로 판결해줘. 각 판사는 이 상황의 핵심을 자기 방식으로 정확히 찌를 것:\n${situation.slice(0, 500)}`,
      imageBase64,
      1600,
    );
  } catch (err) {
    console.error('[aiJudge] AI call failed:', err.message);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 판결에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  let verdicts;
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    verdicts = (parsed.verdicts || []).map(v => ({
      judgeId: v.id,
      judgeName: JUDGES.find(j => j.id === v.id)?.name || v.id,
      verdict: v.verdict || '',
    }));
  } catch {
    verdicts = JUDGES.map(j => ({ judgeId: j.id, judgeName: j.name, verdict: '이 판사는 오늘 결근했습니다. 😴' }));
  }

  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_judge',
    title: situation.slice(0, 60) + (situation.length > 60 ? '...' : ''),
    situation: situation.slice(0, 500),
    hasImage: !!imageBase64,
    verdicts,
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'golra',
  });

  return { postId: postRef.id, verdicts };
});

// ── 미친번역사 ──
const TRANSLATE_STYLES = {
  north: { name: '🇰🇵 북한말', system: `다음 텍스트를 북한 말투로 번역하라.
핵심: 내용은 그대로, 말투만 완전히 바꾼다. 단순히 단어만 바꾸지 말고 북한 특유의 과장된 선동적 문체를 살려라.
필수 요소: "동무", "혁명동지" 중 하나 이상 사용. 평범한 내용도 "조국과 수령을 위해" 수준으로 격상시킴. 평양 방송 아나운서처럼 진지하고 장엄하게.
예시: "밥 먹었어?" → "동무, 혁명 완수를 위한 에너지 보충 작업은 완료하였는가? 조국의 미래는 동무의 끼니에 달려있다."` },
  busan: { name: '🌊 부산 사투리', system: `다음 텍스트를 부산/경상도 사투리로 번역하라.
핵심: 억양과 어미까지 완전히 바꾼다. 어색한 단어 치환이 아닌 실제 부산 사람처럼 자연스럽게.
필수 요소: 문장마다 "~가", "~나", "~데이", "~카이", "마", "아이가", "와" 중 적절한 것 사용. 부산 특유의 직설적이고 거침없는 분위기.
예시: "좀 이상한 것 같아." → "야 그거 뭔가 이상하데이, 마, 내가 볼 때는 완전 틀렸다 아이가."` },
  jolla: { name: '🌾 전라도 사투리', system: `다음 텍스트를 전라도 사투리로 번역하라.
핵심: 전라도 특유의 구수하고 정감 있는 말투를 살린다.
필수 요소: "~잉", "~제", "~여", "~랑게", "워메", "거시기", "허벌나게" 중 문장에 맞게 자연스럽게 사용. 억지로 쑤셔 넣지 말고 진짜 전라도 어르신이 하실 것 같은 말투.
예시: "오늘 진짜 힘들었어." → "워메, 오늘은 진짜 허벌나게 힘들었당게요. 이런 날이 또 있으까잉."` },
  chungcheong: { name: '🐢 충청도 사투리', system: `다음 텍스트를 충청도 사투리로 번역하라.
핵심: 느릿느릿하고 여유로운 충청도의 기질을 살린다. 급한 내용도 여유롭게.
필수 요소: "~유", "~구만유", "~겨", "~디야", "그렇죠잉" 중 자연스럽게 사용. 충청도는 맺고 끊음이 없는 게 포인트.
예시: "빨리 와!" → "아~ 올 수 있으면 오고 유, 뭐 급한 거 있겠슈, 천천히 오면 되지유 뭐~"` },
  joseon: { name: '📜 조선시대', system: `다음 텍스트를 조선시대 사극 말투로 번역하라.
핵심: 현대 내용을 조선시대 맥락으로 완전히 이식. 단순 어미 변환이 아니라 시대적 배경까지 바꾼다.
필수 요소: "~이옵나이다", "소인", "나으리/마마", "황공하옵니다" 중 적절히 사용. 현대 소품(핸드폰→서찰, 카카오톡→전서구)은 조선 버전으로 번역.
예시: "카톡 왜 안 읽어?" → "소인이 전서구를 띄운 지 사흘이 지났사온데, 어찌하여 아직 회신이 없으신 것이옵나이까. 황공하옵니다."` },
  boomer: { name: '👔 꼰대체', system: `다음 텍스트를 꼰대 아저씨 말투로 번역하라.
핵심: 짧은 내용도 장황하게 늘린다. 본론 전에 훈계가 반드시 먼저.
필수 요소: "내가 말이야~" 또는 "요즘 것들은~"으로 시작. 본인 경험담 한 줄 추가. 마지막은 교훈이나 충고. 상대방 말은 절반쯤 무시하는 뉘앙스.
예시: "배고파." → "내가 말이야, 우리 때는 밥 한 끼가 얼마나 귀했는지 알아? 요즘 것들은 배가 부른 건지 배가 고픈 건지도 모르고, 뭐든 참고 열심히 해야 되는 거야. 그리고 밥은 제때 먹어야 해."` },
  teen: { name: '🎮 급식체', system: `다음 텍스트를 요즘 10대 급식체로 번역하라.
핵심: 10대들이 실제 쓰는 표현으로 에너지 넘치게. 과하게 축약하거나 과하게 리액션.
필수 요소: "ㄹㅇ", "ㅇㅈ", "킹받음/킹받네", "갈비탕(감사)", "미쳤다", "개~(개웃김/개쩔어)" 중 2개 이상 자연스럽게 사용. 진지한 내용도 에너지 넘치게.
예시: "오늘 정말 힘들었어." → "ㄹㅇ 오늘 개힘들었음 ㅋㅋ 아니 이게 말이 됨? 진짜 킹받았는데 어케 참았냐 나 갈비탕"` },
};

exports.aiTranslate = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { text, style, imageBase64 } = request.data || {};
  if (!text || text.trim().length < 2) {
    throw new HttpsError('invalid-argument', '번역할 텍스트를 입력해주세요');
  }
  const styleData = TRANSLATE_STYLES[style];
  if (!styleData) throw new HttpsError('invalid-argument', '번역 스타일을 선택해주세요');

  const [{ allowed, limit }, author] = await Promise.all([
    checkUsage(userId, 'translate'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 번역은 하루 ${limit}번만 가능해요`);

  const userText = imageBase64
    ? `이미지에 있는 텍스트와 함께 다음 내용을 번역해줘. 단순 단어 치환이 아니라 그 말투 특유의 문화와 감각까지 살려라:\n${text.slice(0, 500)}`
    : `다음을 번역해줘. 단순 단어 치환이 아니라 그 말투 특유의 문화와 감각까지 살려라:\n${text.slice(0, 500)}`;

  let translated;
  try {
    translated = await callAI(styleData.system, userText, imageBase64, 600);
  } catch (err) {
    console.error('[aiTranslate] AI call failed:', err.message);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 번역에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_translate',
    title: `${styleData.name} 번역: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`,
    originalText: text.slice(0, 500),
    style,
    styleName: styleData.name,
    translated,
    hasImage: !!imageBase64,
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'usgyo',
  });

  return { postId: postRef.id, translated, styleName: styleData.name };
});

// ── AI궁합 ──
exports.aiMatch = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { itemA, itemB, imageA, imageB } = request.data || {};
  if (!itemA || !itemB || itemA.trim().length < 1 || itemB.trim().length < 1) {
    throw new HttpsError('invalid-argument', '두 가지를 모두 입력해주세요');
  }

  const [{ allowed, limit }, author] = await Promise.all([
    checkUsage(userId, 'match'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 궁합은 하루 ${limit}번만 가능해요`);

  const system = `당신은 세상 모든 것의 궁합을 꿰뚫어보는 AI 점쟁이다.
핵심 원칙: 점수와 이유가 읽는 사람을 "어, 이거 맞는 말인데?" 하게 만들어야 한다. 뻔한 분석 금지. 두 대상에서 남들이 보지 못한 공통점이나 충돌 지점을 정확히 찾아내라.
score는 0~100 사이 숫자 (너무 자주 50, 77, 88 등 라운드 숫자 쓰지 말 것).
grade는 점수에 맞게 창의적으로 (예: "천생연분💕", "찰떡궁합🎯", "억지로 붙인 사이😬", "최악의조합💥", "운명적악연🔥", "뭔가이상한궁합🤔" 등).
reason: 두 대상이 왜 이 점수인지 핵심을 찌르는 이유. 진지하게 쓰되 읽으면 웃기게. 2~3문장.
chemistry: 둘이 만나면 실제로 벌어질 일을 구체적이고 생생하게. 1~2문장.
advice: 한 줄 조언. 진지한 척하면서 황당하거나 찌르는 말.
반드시 JSON 형식으로만 답하라:
{"score": 숫자, "grade": "등급", "reason": "이유", "chemistry": "케미", "advice": "조언"}`;

  let matchResult;
  try {
    const raw = await callAIWithImages(
      system,
      `"${itemA.slice(0, 100)}"와 "${itemB.slice(0, 100)}"의 궁합을 봐줘. 뻔한 분석 말고 이 둘만의 진짜 핵심을 찔러라.`,
      imageA,
      imageB,
      600,
      0.9,
    );
    matchResult = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    matchResult = {
      score: Math.floor(Math.random() * 101),
      grade: '신비로운궁합🔮',
      reason: 'AI 점쟁이가 너무 충격받아서 말을 잃었습니다.',
      chemistry: '세상에 이런 조합이 있다니...',
      advice: '그냥 해보세요. 뭔가 일어날 겁니다.',
    };
  }

  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_match',
    title: `${itemA} 💘 ${itemB} 궁합 결과`,
    itemA: itemA.slice(0, 100),
    itemB: itemB.slice(0, 100),
    hasImageA: !!imageA,
    hasImageB: !!imageB,
    matchResult,
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'golra',
  });

  return { postId: postRef.id, matchResult };
});

// ── AI작명소 ──
const NAME_CATEGORIES = {
  person:  '사람 별명/닉네임',
  food:    '음식/메뉴 이름',
  pet:     '반려동물 이름',
  team:    '팀/모임 이름',
  product: '물건/제품 이름',
  other:   '기타',
};

exports.aiNaming = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { description, category, imageBase64 } = request.data || {};
  const hasDesc = description && description.trim().length >= 2;
  if (!hasDesc && !imageBase64) {
    throw new HttpsError('invalid-argument', '설명을 입력하거나 사진을 첨부해주세요');
  }

  const [{ allowed, limit }, author] = await Promise.all([
    checkUsage(userId, 'naming'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 작명은 하루 ${limit}번만 가능해요`);

  const catLabel = NAME_CATEGORIES[category] || '기타';

  const system = `당신은 세상에서 가장 웃기고 본질을 꿰뚫는 작명 전문가다. 요청받은 것의 이름을 5개 지어준다.
핵심 원칙: 이름 하나하나가 그 대상의 핵심 특성을 콕 집어야 한다. 듣는 순간 "ㄹㅇ 딱 맞네 ㅋㅋ" 소리가 저절로 나와야 한다.
이름 스타일 다양하게 (5개 중 최소 2개 이상 다른 스타일):
- 특성 그대로 합성어: 특징 두 가지를 합침 (예: "회의탈주왕", "밥도둑메뉴")
- 역설적 이름: 반대 특성으로 비틈 (예: 매운 음식에 "순한맛의꿈")
- 의성어/의태어 활용 (예: "쭈뼛쭈뼛신입")
- 사자성어 비틀기 또는 한자 섞기
- 그냥 직관적으로 너무 정확한 이름
이유(reason)는 이름보다 더 웃겨야 한다. 이름을 설명하는 게 아니라 그 이름이 왜 찰떡인지 핵심을 한 줄로.
절대 금지: 평범한 이름, 설명적인 이름(예: "귀여운강아지"), 영어 이름만 쓰기.
반드시 JSON 형식으로만 답하라:
{"names": [{"name": "이름1", "reason": "이유(한 줄, 핵심 찌르게)"}, {"name": "이름2", "reason": "..."}, {"name": "이름3", "reason": "..."}, {"name": "이름4", "reason": "..."}, {"name": "이름5", "reason": "..."}]}`;

  const descPart = hasDesc ? `설명: ${description.trim().slice(0, 300)}\n` : '';
  const userText = imageBase64
    ? `카테고리: ${catLabel}\n${descPart}첨부된 사진을 보고 이름을 지어줘.`
    : `카테고리: ${catLabel}\n${descPart}이 이름을 지어줘.`;

  let names;
  try {
    const raw = await callAI(system, userText, imageBase64, 600, 1.0);
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    names = (parsed.names || []).filter(n => n.name);
    if (names.length === 0) throw new Error('empty names');
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    names = [
      { name: '이름짓기실패킹', reason: 'AI가 충격받아서 말문이 막혔습니다' },
      { name: '무명의존재', reason: '이름 없이도 살 수 있습니다' },
      { name: '그냥그거', reason: '설명이 필요 없는 이름' },
    ];
  }

  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_naming',
    title: hasDesc ? `${catLabel} 작명: ${description.trim().slice(0, 40)}${description.trim().length > 40 ? '...' : ''}` : `${catLabel} 작명: 사진으로 요청`,
    description: hasDesc ? description.trim().slice(0, 300) : '',
    category: catLabel,
    names,
    hasImage: !!imageBase64,
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'usgyo',
  });

  return { postId: postRef.id, names };
});

// ── getAiKingUsage ──
exports.getAiKingUsage = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) return { judge: 0, translate: 0, match: 0, naming: 0, extraUses: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const features = ['judge', 'translate', 'match', 'naming'];
  const [snaps, userSnap] = await Promise.all([
    Promise.all(features.map(f => db.doc(`ai_king_usage/${userId}_${today}_${f}`).get())),
    db.doc(`users/${userId}`).get(),
  ]);
  const result = {};
  features.forEach((f, i) => { result[f] = snaps[i].exists ? (snaps[i].data().count || 0) : 0; });
  result.extraUses = userSnap.exists ? (userSnap.data()?.extraAiUses || 0) : 0;
  return result;
});

// ── saveAiKingConfig (admin only) ──
exports.saveAiKingConfig = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const adminSnap = await db.doc(`admins/${uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자만 접근 가능해요');

  const data = request.data || {};
  const FIELDS = ['activeModel', 'claudeApiKey', 'claudeModel', 'geminiApiKey', 'geminiModel', 'openaiApiKey', 'openaiModel', 'pointsPerUse', 'dailyFreeLimit', 'monthlyCap'];

  const update = {};
  for (const field of FIELDS) {
    if (data[field] !== undefined && data[field] !== null) {
      const val = data[field];
      // Skip masked values (API keys shown as ●●●●●)
      if (typeof val === 'string' && val.startsWith('●')) continue;
      update[field] = val;
    }
  }

  if (Object.keys(update).length === 0) {
    return { success: true, updated: [] };
  }

  update.updatedAt = FieldValue.serverTimestamp();
  update.updatedBy = uid;

  await db.doc('config/ai_king').set(update, { merge: true });

  // Invalidate cache
  _aiKingConfig = null;
  _aiKingConfigFetchedAt = 0;

  return { success: true, updated: Object.keys(update).filter(k => k !== 'updatedAt' && k !== 'updatedBy') };
});

// ── purchaseAiExtraUse ──
exports.purchaseAiExtraUse = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const quantity = Math.min(Math.max(Math.floor(Number(request.data?.quantity) || 1), 1), 10);
  const config = await getAiKingConfig();
  const pointsPerUse = config.pointsPerUse || 100;
  const totalCost = pointsPerUse * quantity;

  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '사용자를 찾을 수 없어요');

    const currentPoints = userSnap.data()?.points || 0;
    if (currentPoints < totalCost) {
      throw new HttpsError(
        'failed-precondition',
        `포인트가 부족해요. 현재 ${currentPoints}포인트 / 필요 ${totalCost}포인트`,
      );
    }

    tx.update(userRef, {
      points: FieldValue.increment(-totalCost),
      extraAiUses: FieldValue.increment(quantity),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, quantity, pointsUsed: totalCost };
});
