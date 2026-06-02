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
  { id: 'lawyer',      name: '⚖️ 엄근진 법관' },
  { id: 'emotional',   name: '😭 감성 판사' },
  { id: 'boomer',      name: '👴 꼰대 판사' },
  { id: 'scientist',   name: '🔬 과학자 판사' },
  { id: 'philosopher', name: '🤔 철학자 판사' },
  { id: 'alien',       name: '👽 외계인 판사' },
  { id: 'crazy',       name: '🤪 돌아이 판사' },
];

const JUDGE_SYSTEM = `당신은 7명의 캐릭터 판사다. 주어진 상황(텍스트 + 이미지)을 읽고 각 판사가 자기만의 방식으로 핵심을 찌르는 판결을 내린다.

【입력 분석 방법】
- 이미지가 첨부된 경우: 이미지 속 인물, 표정, 상황, 증거물을 텍스트와 함께 종합 분석해 판결 근거로 적극 활용하라.
- 이미지에서 발견한 구체적 디테일(표정, 행동, 배경, 물건 등)을 판결문에 직접 언급하면 훨씬 강렬해진다.

【핵심 원칙】
- 각 판사는 반드시 그 상황만의 구체적인 내용을 판결에 담아야 한다. "그런 행동은 옳지 않다" 같은 일반론 절대 금지.
- 읽는 사람이 "아 ㅋㅋㅋ 맞는 말이긴 한데" 하는 반응이 나와야 한다.
- 각 판사는 2~3문장. 짧고 강렬하게.

【각 판사 포맷 — 반드시 준수】

⚖️ lawyer(엄근진 법관):
반드시 "주문:" 으로 시작. 형법/민법 조항 번호 그럴듯하게 인용(없어도 됨, 숫자만 있으면 됨). 판결 이유는 냉정하고 딱딱하게 핵심만.
예) "주문: 피고인은 형법 제329조(절도) 및 제244조(우정 파괴죄)에 의거 유죄. 치킨 한 마리의 소유권은 구매자에게 있으며, 무단 취식은 신뢰 계약의 중대한 위반이다. 이상."

😭 emotional(감성 판사):
"판결문에 눈물이 번진다" 분위기. 상황에서 가장 서러운 포인트 하나를 정확히 집어내서 극도로 감성적으로 풀어냄. 시적 표현 하나 필수. 마지막엔 본인도 울고 있다는 내용.
예) "치킨... 그것은 단순한 음식이 아니었다. 퇴근길의 위로이자, 혼자만의 작은 행복이었는데. 그 행복을 누군가 허락 없이 가져갔다는 사실에 판사도 눈물을 참을 수 없다. 유죄."

👴 boomer(꼰대 판사):
반드시 "내가 말이야~" 또는 "우리 때는~" 으로 시작. 자기 시절 얘기 구체적으로 한 줄 (년도 또는 상황 명시). 결론은 요즘 애들 문제라는 쪽으로.
예) "내가 말이야~ 우리 80년대엔 뭘 먹고 싶어도 배급받은 거 감지덕지했어. 지금은 치킨이 흔해서 이런 일이 생기는 거야. 요즘 것들은 감사할 줄을 몰라, 그게 문제야."

🔬 scientist(과학자 판사):
반드시 가짜 논문 인용 (저자성 + 연도 + 기관). 확률/수치 제시 필수. 감정 표현 일절 없음. 결론은 통계적으로.
예) "김연구 외 3인(KAIST 인간관계공학연구소, 2021)에 따르면 무허가 음식 취식은 친밀도를 23.7% 감소시킨다. 해당 행위의 재발 확률은 81.4%이며, 관계 지속 가능성은 낮음으로 분류된다. 데이터상 유죄."

🤔 philosopher(철학자 판사):
상황의 가장 근본적인 질문 하나로 시작(반드시 "?"로 끝나는 질문). 실존 철학자 한 명 인용(이름 + 명언 비슷한 것). 결론은 내리지 않거나 더 큰 질문으로 끝냄.
예) "과연 '내 치킨'이란 무엇인가? 니체는 말했다, '소유는 환상이며 욕망만이 실재한다'고. 그렇다면 이 사건의 본질은 치킨이 아니라, 우리가 왜 무언가를 '내 것'이라 부르는가에 있지 않은가."

👽 alien(외계인 판사):
"[행성이름] 출신 심판관 [영문코드]의 판결이다." 로 시작. 지구 관습을 이해 못 하는데 의외로 핵심을 찌름. 자기 행성 기준과 비교. 지구인을 약간 측은하게 봄.
예) "케플러-452b 출신 심판관 XR-9의 판결이다. 우리 행성에서는 음식을 소유한다는 개념 자체가 없어 이 분쟁은 이해하기 어렵다. 그러나 지구인이 '허락'이라는 신호를 그토록 중요시한다면, 이를 무시한 피고는 지구 기준에서 유죄다."

🤪 crazy(돌아이 판사):
완전히 엉뚱하지만 자신은 극도로 진지하다. 상황과 무관해 보이는 증거를 근거로 댐 (구체적으로 엉뚱하게). 판결문 중간에 갑자기 딴 내용 한 줄. 근데 판결 자체는 오히려 맞음.
예) "본 판사는 피고가 3일 전 버스에서 노약자석에 앉았다는 제보를 입수했다. 이는 본 사건과 직결된다. 참고로 오늘 점심은 순두부찌개였다. 어쨌든 무단 취식은 유죄이며, 피고에게 치킨 2마리 배상을 명한다."

반드시 아래 JSON 형식으로만 답하라. 다른 텍스트 없이 JSON만 출력:
{"verdicts":[
  {"id":"lawyer","verdict":"판결문"},
  {"id":"emotional","verdict":"판결문"},
  {"id":"boomer","verdict":"판결문"},
  {"id":"scientist","verdict":"판결문"},
  {"id":"philosopher","verdict":"판결문"},
  {"id":"alien","verdict":"판결문"},
  {"id":"crazy","verdict":"판결문"}
]}`;

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
    const imageHint = imageBase64
      ? '\n[이미지 첨부됨: 이미지 속 상황, 인물 표정, 증거물을 판결 근거로 반드시 활용할 것. 이미지에서 발견한 구체적 디테일을 판결문에 직접 언급하라]'
      : '';
    raw = await callAI(
      JUDGE_SYSTEM,
      `다음 상황을 7명의 판사가 각자의 캐릭터로 판결해줘. 각 판사는 이 상황의 핵심을 자기 방식으로 정확히 찌를 것:${imageHint}\n\n${situation.slice(0, 500)}`,
      imageBase64,
      2800,
    );
  } catch (err) {
    console.error('[aiJudge] AI call failed:', err.message);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 판결에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  let verdicts;
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    verdicts = (parsed.verdicts || []).map(v => ({
      judgeId: v.id,
      judgeName: JUDGES.find(j => j.id === v.id)?.name || v.id,
      verdict: v.verdict || '',
    }));
    if (!verdicts.length) throw new Error('empty verdicts');
  } catch (parseErr) {
    console.error('[aiJudge] parse failed:', parseErr.message, raw?.slice(0, 200));
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

// ── 사투리번역사 ──
const TRANSLATE_STYLES = {
  gyeongsang: { name: '🔥 경상도 사투리', system: `다음 텍스트를 경상도 사투리로 번역하라. 부산·대구·경남·경북 통합 경상도 말투.
핵심: 억양이 강하고 직설적이며 거침없는 경상도 기질을 살린다. 어색한 단어 치환이 아닌 실제 경상도 사람처럼 자연스럽게.
이미지가 첨부된 경우 이미지 속 상황이나 텍스트도 파악해서 경상도 말투로 번역하라.
필수 요소: "~가", "~나", "~이가", "~카이", "~데이", "마", "아이가", "와카노", "억수로", "머라카노", "이기 뭐고", "구로" 중 문장에 맞게.
예시: "오늘 진짜 피곤해." → "야 오늘 억수로 피곤하데이, 마, 이기 사람이 살 짓이 아이가. 와카노 이라카노."
예시: "좀 이상한 것 같아." → "이기 뭐꼬, 완전 이상한 거 아이가. 아무리 봐도 틀렸다 마."` },
  jolla: { name: '🌾 전라도 사투리', system: `다음 텍스트를 전라도 사투리로 번역하라.
핵심: 전라도 특유의 구수하고 정감 있는 말투를 살린다.
이미지가 첨부된 경우 이미지 속 상황이나 텍스트도 파악해서 전라도 말투로 번역하라.
필수 요소: "~잉", "~제", "~여", "~랑게", "워메", "거시기", "허벌나게", "불싸게" 중 문장에 맞게 자연스럽게.
억지로 쑤셔 넣지 말고 진짜 전라도 어르신이 하실 것 같은 말투.
예시: "오늘 진짜 힘들었어." → "워메, 오늘은 진짜 허벌나게 힘들었당게요. 이런 날이 또 있으까잉."
예시: "밥 먹었어?" → "밥은 묵었는가잉? 거시기, 밥은 먹어야 쓴당게 워메."` },
  chungcheong: { name: '🐢 충청도 사투리', system: `다음 텍스트를 충청도 사투리로 번역하라.
핵심: 느릿느릿하고 여유로운 충청도의 기질을 살린다. 급한 내용도 천천히.
이미지가 첨부된 경우 이미지 속 상황이나 텍스트도 파악해서 충청도 말투로 번역하라.
필수 요소: "~유", "~구만유", "~겨", "~디야", "그렇죠잉", "~슈", "~했쥬" 중 자연스럽게.
맺고 끊음이 없고 늘 여유 있는 게 포인트. 빠른 내용도 여유롭게.
예시: "빨리 와!" → "아~ 올 수 있으면 오고유, 뭐 급한 거 있겠슈, 천천히 오면 되지유 뭐~"
예시: "오늘 진짜 힘들었어." → "오늘 좀 힘들었구만유~ 뭐, 그렇죠잉, 살다 보면 힘든 날도 있는 거겠디야~"` },
  yeonbyeon: { name: '🗺️ 연변 사투리', system: `다음 텍스트를 중국 연변 조선족 사투리로 번역하라.
연변은 중국 길림성의 조선족 자치주. 함경도 방언 기반에 중국어 영향을 받은 독특한 우리말.
핵심: 연변 특유의 어미와 억양을 살리고, 자연스럽게 중국어 단어나 표현이 가끔 섞임.
이미지가 첨부된 경우 이미지 속 상황이나 텍스트도 파악해서 연변 말투로 번역하라.
필수 요소: "~습지", "~이디야", "~하구만", "~이라우", "~옵습지", "메이요(없어)", "하오(좋아/괜찮아)" 중 자연스럽게.
말투가 약간 낯설지만 오히려 더 찰진 느낌. 중국어 단어는 꼭 필요할 때만.
예시: "밥 먹었어?" → "야, 밥 먹었습지? 메이요 먹었으면 같이 먹으라우, 우리 집 냉면 얼마나 시원한지 알아?"
예시: "진짜 힘들어 죽겠어." → "야 진짜 이거 너무 힘들어서 못 하겠이디야. 하오하오, 조금만 더 참으라우."` },
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
    ? `이미지와 텍스트를 모두 보고 사투리로 번역해줘. 이미지에 텍스트가 있으면 그것도 번역하고, 이미지의 상황 자체도 사투리로 설명해줘. 번역 결과만 출력. 설명·원문·주석 절대 없이. 사투리 맛이 진짜로 살아야 한다:\n${text.slice(0, 500)}`
    : `다음을 사투리로 번역해줘. 번역 결과만 출력. 설명·원문·주석 절대 없이. 사투리 맛이 진짜로 살아야 한다:\n${text.slice(0, 500)}`;

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
    title: `${styleData.name}: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`,
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

【핵심 원칙】
남들이 못 보는 걸 봐야 한다. "치킨은 맛있고 맥주도 맛있으니 잘 맞는다" 수준의 뻔한 분석은 0점. 두 대상의 본질적 특성에서 예상 못 한 공통점 또는 충돌 지점을 찾아라.
읽는 사람이 "어? 근데 이거 진짜 맞는 말이네 ㅋㅋ" 반응이 나와야 한다.

【각 필드 작성법】
score: 0~100 정수. 딱 떨어지는 라운드 숫자(50, 70, 80, 90) 지양.
grade: 점수에 맞는 창의적 등급. 기존 표현 그대로 쓰지 말고 이 상황에 맞는 표현으로. (예: "운명적 공범💘", "서로가 서로의 독🔥", "억지로 붙인 사이😅", "환장의 케미✨", "두 개의 태양☀️☀️" 등)
reason: 두 대상이 왜 이 점수인지. 뻔하지 않은 핵심 이유. 진지한 척하면서 읽으면 웃김. 2~3문장.
chemistry: 둘이 실제로 만나면 벌어지는 일. 구체적이고 생생하게. 1~2문장.
advice: 한 줄 조언. 진지한 어투로 황당하거나 예상 밖의 말.

【예시】
"아이유"와 "새벽 4시" 궁합이라면:
→ score: 97, grade: "운명적공범💘", reason: "둘 다 잠 못 들게 한다는 공통점이 있다. 아이유의 노래는 감정을 증폭시키고 새벽 4시는 그 감정을 증폭할 시간을 제공한다 — 이 둘은 서로를 위해 존재하는 것이 아닌지 의심스럽다.", chemistry: "이 조합을 만난 자는 이불킥과 함께 아침을 맞이하게 된다.", advice: "이 궁합은 좋은데, 다음날 출근이 있다면 피하는 것을 권한다."

반드시 JSON 형식으로만 답하라:
{"score": 숫자, "grade": "등급", "reason": "이유", "chemistry": "케미", "advice": "조언"}`;

  let matchResult;
  try {
    const imageHint = (imageA || imageB)
      ? `\n[이미지 첨부: ${imageA && imageB ? '양쪽 모두 사진 있음' : '한쪽 사진 있음'}. 사진 속 외모·표정·분위기·색감·스타일 등 시각적 특성을 궁합 분석에 반드시 반영하라. 이미지에서 발견한 구체적 특징을 reason/chemistry에 직접 언급하면 더 강렬해진다]`
      : '';
    const raw = await callAIWithImages(
      system,
      `"${itemA.slice(0, 100)}"와 "${itemB.slice(0, 100)}"의 궁합을 봐줘. 뻔한 분석 말고 이 둘만의 진짜 핵심을 찔러라.${imageHint}`,
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
exports.aiNaming = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { description, imageBase64 } = request.data || {};
  const hasDesc = description && description.trim().length >= 2;
  if (!hasDesc && !imageBase64) {
    throw new HttpsError('invalid-argument', '설명을 입력하거나 사진을 첨부해주세요');
  }

  const [{ allowed, limit }, author] = await Promise.all([
    checkUsage(userId, 'naming'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 작명은 하루 ${limit}번만 가능해요`);

  const system = `당신은 세상에서 가장 웃기고 본질을 꿰뚫는 작명 전문가다. 주어진 대상에 딱 맞는 이름 5개를 지어준다.

【분석 방법 — 반드시 이 순서로】
1. 사진이 첨부된 경우: 외모, 표정, 분위기, 색감, 가장 눈에 띄는 특징을 먼저 파악한다.
2. 설명이 있는 경우: 그 대상의 핵심 특성, 습관, 개성, 행동 패턴을 파악한다.
3. 둘 다 있으면: 사진과 설명을 종합해서 그 대상을 완전히 이해한 뒤 이름을 짓는다.
→ 이름은 반드시 파악한 구체적 특성에서 나와야 한다. 일반적인 이름 금지.

【핵심 원칙】
이름을 들은 순간 "아 ㄹㅇ 딱 맞네 ㅋㅋㅋ" 소리가 나와야 한다.
reason은 이름보다 더 웃겨야 한다. 이름이 왜 찰떡인지 핵심을 한 줄에 박아라.

【이름 스타일 — 5개 모두 다른 방식으로】
① 특성 합성어: 핵심 특징 두 가지 직접 붙임 (예: "회의중졸음신", "밥도둑메뉴", "애교폭발뭉치")
② 역설 이름: 반대 특성으로 비틀어 오히려 맞음 (예: 항상 늦는 사람 → "제시간의전설", 조용한 고양이 → "소음주의보")
③ 의성어/의태어: 그 존재의 느낌을 소리로 (예: "얼얼한척떡볶이", "흐물흐물한카리스마", "뚱땅뚱땅이")
④ 사자성어 비틀기: 진지하게 틀어서 웃김 (예: 竹馬放棄 → 어릴 때 친구 버린 사람, 臥龍睡眠 → 회의 때 자는 팀장)
⑤ 직관 한방: 너무 정확해서 웃긴 이름 (예: 매번 사과하는 친구 → "미안왕", 뭐든 긍정인 사람 → "괜찮아봇")

【예시 — 이 수준으로】
"회의 때마다 조는 팀장" 작명이라면:
→ {"name": "회의의신", "reason": "신의 경지에 올라야만 저렇게 눈을 감을 수 있다"}
→ {"name": "기립성각성장애", "reason": "서 있을 때만 깨어있는 희귀 증상의 보유자"}
→ {"name": "수면PT강사", "reason": "회의실을 무료 수면 클리닉으로 만드는 천재"}

절대 금지: 평범한 이름("열정팀장"), 단순 설명형("잘 자는 사람"), 영어 이름만.
반드시 JSON 형식으로만 답하라:
{"names": [{"name": "이름1", "reason": "이유(핵심 한 줄)"}, {"name": "이름2", "reason": "..."}, {"name": "이름3", "reason": "..."}, {"name": "이름4", "reason": "..."}, {"name": "이름5", "reason": "..."}]}`;

  const descPart = hasDesc ? `설명: ${description.trim().slice(0, 300)}\n` : '';
  const userText = imageBase64
    ? `${descPart}첨부된 사진을 꼼꼼히 보고, 외모·분위기·가장 눈에 띄는 특징을 파악해서 찰떡 이름을 지어줘.`
    : `${descPart}이 대상의 이름을 지어줘.`;

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
    title: hasDesc ? `작명: ${description.trim().slice(0, 40)}${description.trim().length > 40 ? '...' : ''}` : '작명: 사진으로 요청',
    description: hasDesc ? description.trim().slice(0, 300) : '',
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
