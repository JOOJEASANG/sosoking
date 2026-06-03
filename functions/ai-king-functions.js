'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

const DAILY_LIMIT = 3;

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

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

async function callAI(system, userText, imageBase64 = null, maxTokens = 400, temperature = 0.8, jsonMode = false) {
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
    const genConfig = { maxOutputTokens: maxTokens, temperature };
    if (jsonMode) genConfig.responseMimeType = 'application/json';
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: genConfig,
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

async function callAIWithImages(system, userText, imageA = null, imageB = null, maxTokens = 500, temperature = 0.8, jsonMode = false) {
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
    const genConfig = { maxOutputTokens: maxTokens, temperature };
    if (jsonMode) genConfig.responseMimeType = 'application/json';
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: genConfig,
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

// ── JSON 문자열 내 실제 줄바꿈 이스케이프 ──
function sanitizeJson(str) {
  let inString = false, escaped = false, out = '';
  for (const ch of str) {
    if (escaped) { escaped = false; out += ch; continue; }
    if (ch === '\\' && inString) { escaped = true; out += ch; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString && (ch === '\n' || ch === '\r')) { out += '\\n'; continue; }
    out += ch;
  }
  return out;
}

function parseJson(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
  return JSON.parse(sanitizeJson(match ? match[0] : cleaned));
}

// ── Usage check with extraAiUses fallback ──
// Returns { allowed: boolean, limit: number }
async function checkUsage(userId, feature) {
  const today = kstToday();
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

const JUDGE_DESC = {
  lawyer:      `⚖️ lawyer(엄근진 법관):\n반드시 "주문:" 으로 시작. 형법/민법 조항 번호 그럴듯하게 인용. 판결 이유는 냉정하고 딱딱하게 핵심만.\n예) "주문: 피고인은 형법 제329조에 의거 유죄. 치킨 한 마리의 소유권은 구매자에게 있으며, 무단 취식은 신뢰 계약의 중대한 위반이다. 이상."`,
  emotional:   `😭 emotional(감성 판사):\n상황에서 가장 서러운 포인트 하나를 정확히 집어내서 극도로 감성적으로 풀어냄. 시적 표현 하나 필수. 마지막엔 본인도 울고 있다는 내용.\n예) "치킨... 그것은 단순한 음식이 아니었다. 퇴근길의 위로이자, 혼자만의 작은 행복이었는데. 그 행복을 누군가 허락 없이 가져갔다는 사실에 판사도 눈물을 참을 수 없다. 유죄."`,
  boomer:      `👴 boomer(꼰대 판사):\n반드시 "내가 말이야~" 또는 "우리 때는~" 으로 시작. 자기 시절 얘기 구체적으로 한 줄. 결론은 요즘 애들 문제라는 쪽으로.\n예) "내가 말이야~ 우리 80년대엔 배급받은 거 감지덕지했어. 지금은 치킨이 흔해서 이런 일이 생기는 거야. 요즘 것들은 감사할 줄을 몰라."`,
  scientist:   `🔬 scientist(과학자 판사):\n반드시 가짜 논문 인용 (저자명 + 연도 + 기관). 확률/수치 제시 필수. 감정 표현 없음. 결론은 통계적으로.\n예) "김연구 외 3인(KAIST, 2021)에 따르면 무허가 취식은 친밀도를 23.7% 감소시킨다. 재발 확률 81.4%. 데이터상 유죄."`,
  philosopher: `🤔 philosopher(철학자 판사):\n상황의 근본적인 질문 하나로 시작(반드시 "?"로 끝). 실존 철학자 한 명 인용. 결론은 내리지 않거나 더 큰 질문으로 끝냄.\n예) "과연 '내 치킨'이란 무엇인가? 니체는 말했다, '소유는 환상이며 욕망만이 실재한다'고. 그렇다면 이 사건의 본질은 우리가 왜 무언가를 '내 것'이라 부르는가에 있지 않은가."`,
  alien:       `👽 alien(외계인 판사):\n"[행성이름] 출신 심판관 [영문코드]의 판결이다." 로 시작. 지구 관습을 이해 못 하는데 의외로 핵심을 찌름. 지구인을 측은하게 봄.\n예) "케플러-452b 출신 심판관 XR-9의 판결이다. 우리 행성엔 소유 개념이 없어 이 분쟁은 이해하기 어렵다. 그러나 지구인이 '허락'을 그토록 중요시한다면, 이를 무시한 피고는 지구 기준에서 유죄다."`,
  crazy:       `🤪 crazy(돌아이 판사):\n완전히 엉뚱하지만 자신은 극도로 진지하다. 상황과 무관해 보이는 엉뚱한 증거를 근거로 댐. 판결문 중간에 갑자기 딴 내용 한 줄. 근데 판결 자체는 오히려 맞음.\n예) "본 판사는 피고가 3일 전 버스 노약자석에 앉았다는 제보를 입수했다. 이는 본 사건과 직결된다. 참고로 오늘 점심은 순두부찌개였다. 어쨌든 무단 취식은 유죄이며, 치킨 2마리 배상을 명한다."`,
};

function buildJudgeSystem(selectedJudges) {
  const descs = selectedJudges.map(j => JUDGE_DESC[j.id]).filter(Boolean).join('\n\n');
  const jsonFormat = selectedJudges.map(j => `  {"id":"${j.id}","verdict":"판결문"}`).join(',\n');
  return `당신은 개성 넘치는 캐릭터 판사다. 주어진 상황(텍스트 + 이미지)을 읽고 담당 판사가 자기만의 방식으로 핵심을 찌르는 판결을 내린다.

【입력 분석 — 이것이 가장 중요하다】
사용자가 직접 쓴 내용에서 반드시 아래 중 하나 이상을 판결에 직접 인용하라:
- 구체적 인물/상황/장소/숫자/날짜/물건 이름
- 이미지에서 발견한 표정, 배경, 텍스트, 옷차림 등 시각적 디테일
- 사용자 글 속 감정 키워드 (억울, 황당, 분노, 슬픔 등)
→ 판결문에 이 요소가 없으면 실패. 일반론("그런 행동은 나쁘다") 금지.

【웃음 코드】
- 판결이 맞는 말인데 예상 밖의 각도여야 한다 — 읽는 사람이 "어? 근데 그 말도 맞네 ㅋㅋ"
- 과장하되 틀리지 않는다. 사용자 상황을 꿰뚫으면서 웃긴 것.
- 2~3문장. 짧고 강렬하게. 길면 안 읽는다.
- 예시 표현을 그대로 쓰지 마라 — 상황에 맞는 새 표현을 만들어라.

【담당 판사 캐릭터】

${descs}

반드시 아래 JSON 형식으로만 답하라. 다른 텍스트 없이 JSON만 출력:
{"verdicts":[
${jsonFormat}
]}`;
}

exports.aiJudge = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { situation, imageBase64, selectedJudges: reqJudges } = request.data || {};
  if (!situation || situation.trim().length < 5) {
    throw new HttpsError('invalid-argument', '상황을 5자 이상 적어주세요');
  }

  // 선택된 판사 검증 (최대 3명), 없으면 랜덤 3명
  const validIds = (Array.isArray(reqJudges) ? reqJudges : [])
    .filter(id => JUDGES.some(j => j.id === id))
    .slice(0, 3);
  const activeJudges = validIds.length > 0
    ? validIds.map(id => JUDGES.find(j => j.id === id))
    : [...JUDGES].sort(() => Math.random() - 0.5).slice(0, 3);

  const [{ allowed, limit }, author] = await Promise.all([
    checkUsage(userId, 'judge'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 판결은 하루 ${limit}번만 가능해요`);

  let raw;
  try {
    const imageHint = imageBase64
      ? '\n[이미지 첨부됨: 표정·배경·텍스트·옷차림 등 구체적 시각 요소를 판결문에 직접 인용하라]'
      : '';
    raw = await callAI(
      buildJudgeSystem(activeJudges),
      `아래 상황에서 구체적인 인물·행동·물건·감정을 반드시 판결문에 언급하며 판결하라:${imageHint}\n\n${situation.slice(0, 500)}`,
      imageBase64,
      1400,
      0.95,
      true,
    );
  } catch (err) {
    console.error('[aiJudge] AI call failed:', err.message);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 판결에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  let verdicts;
  try {
    const parsed = parseJson(raw);
    verdicts = (parsed.verdicts || []).map(v => ({
      judgeId: v.id,
      judgeName: JUDGES.find(j => j.id === v.id)?.name || v.id,
      verdict: v.verdict || '',
    }));
    if (!verdicts.length) throw new Error('empty verdicts');
  } catch (parseErr) {
    console.error('[aiJudge] parse failed:', parseErr.message, raw?.slice(0, 300));
    verdicts = activeJudges.map(j => ({ judgeId: j.id, judgeName: j.name, verdict: '이 판사는 오늘 결근했습니다. 😴' }));
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
    ? `이미지와 텍스트를 모두 보고 그 지역 사람이 실제로 이 상황에서 말하듯 사투리로 번역해줘. 이미지에 텍스트가 있으면 같이 번역. 단어만 사투리로 바꾸지 말고 말투·어투·감정까지 그 지역 사람처럼. 번역 결과만 출력. 원문·설명·주석 없이:\n${text.slice(0, 500)}`
    : `다음을 그 지역 사람이 실제로 이 상황에서 말하듯 사투리로 번역해줘. 단어만 치환하지 말고 말투·리듬·감정까지 살려라. 번역 결과만 출력. 원문·설명·주석 없이:\n${text.slice(0, 500)}`;

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

【분석 핵심 — 이게 전부다】
이 두 대상에서만 나올 수 있는 연결고리를 찾아라. 다른 조합에도 쓸 수 있는 분석은 0점.
"치킨과 맥주는 맛있으니 잘 맞는다" → 실격. "야식과 후회는 항상 함께 온다" → 합격.
사진이 첨부된 경우: 외모·표정·분위기·색감 등 시각적 특징을 reason과 chemistry에 직접 인용하라.

【각 필드】
score: 0~100 정수. 라운드 숫자(50·60·70·80·90) 금지. 23, 67, 84, 91 같은 숫자로.
grade: 이 조합만을 위한 창의적 등급명+이모지. 예시와 똑같이 쓰지 마라.
reason: 이 둘만의 본질적 공통점 또는 충돌. 진지한 척하면서 읽으면 웃기는 2~3문장.
chemistry: 둘이 만나면 실제로 벌어지는 장면. "~하게 된다" 형태. 구체적일수록 웃기다.
advice: 한 줄. 진지한 어투로 황당하거나 뜻밖의 말.

【금지 표현】예시와 동일한 표현, "이 조합은~", "서로~", 무난한 조언.

반드시 JSON만 출력. 다른 텍스트 없이:
{"score": 숫자, "grade": "등급", "reason": "이유", "chemistry": "케미", "advice": "조언"}`;

  let raw = '';
  let matchResult;
  try {
    const imageHint = (imageA || imageB)
      ? `\n[이미지 첨부: ${imageA && imageB ? '양쪽 사진 있음' : '한쪽 사진 있음'} — 사진 속 외모·표정·분위기를 reason/chemistry에 직접 인용]`
      : '';
    raw = await callAIWithImages(
      system,
      `"${itemA.slice(0, 100)}"와 "${itemB.slice(0, 100)}"의 궁합. 이 둘에서만 나올 수 있는 핵심을 찔러라.${imageHint}`,
      imageA,
      imageB,
      700,
      0.95,
      true,
    );
    matchResult = parseJson(raw);
  } catch (err) {
    console.error('[aiMatch] failed:', err.message, raw.slice(0, 200));
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

【분석 — 반드시 이 순서로】
1. 사진 첨부 시: 표정·눈빛·색감·체형·분위기·가장 눈에 띄는 특징 하나를 먼저 집어라.
2. 설명 있으면: 핵심 습관·행동 패턴·개성 하나를 집어라.
3. 이름은 집어낸 그 특징에서 직접 나와야 한다. 일반론 이름 금지.

【5개 이름 — 완전히 다른 방식으로, 겹치는 방식 금지】
① 특성 합성어 (예: "회의중졸음신" — 특징 두 개 붙이기)
② 역설 비틀기 (예: 항상 늦는 사람 → "제시간의전설")
③ 의성어·의태어 (예: "흐물흐물카리스마", "뚱땅뚱땅이")
④ 한자·사자성어 패러디 (예: 臥龍睡眠 — 회의 때 자는 팀장)
⑤ 한방 직관 (예: "미안왕", "괜찮아봇" — 너무 정확해서 웃김)

【reason — 이름보다 reason이 더 웃겨야 한다】
왜 찰떡인지 핵심을 한 줄. 진지하게 쓰되 읽으면 웃긴다.

금지: 예시와 동일한 이름, 평범한 이름, 단순 설명형, 영어만.
반드시 JSON만 출력:
{"names": [{"name": "이름1", "reason": "이유"}, {"name": "이름2", "reason": "이유"}, {"name": "이름3", "reason": "이유"}, {"name": "이름4", "reason": "이유"}, {"name": "이름5", "reason": "이유"}]}`;

  const descPart = hasDesc ? `대상 설명: ${description.trim().slice(0, 300)}\n` : '';
  const userText = imageBase64
    ? `${descPart}첨부된 사진에서 가장 눈에 띄는 특징 하나를 집어내서 거기서 출발하는 찰떡 이름 5개.`
    : `${descPart}이 대상의 핵심 특성에서 출발하는 찰떡 이름 5개.`;

  let names;
  try {
    const raw = await callAI(system, userText, imageBase64, 800, 1.0, true);
    const parsed = parseJson(raw);
    names = (parsed.names || []).filter(n => n.name);
    if (names.length === 0) throw new Error('empty names');
  } catch (err) {
    console.error('[aiNaming] failed:', err.message);
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
  const today = kstToday();
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
