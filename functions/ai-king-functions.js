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
async function callAI(system, userText, imageBase64 = null, maxTokens = 400) {
  const config = await getAiKingConfig();

  if (config.activeModel === 'gemini') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      systemInstruction: system,
    });
    const parts = [];
    if (imageBase64) {
      parts.push({ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } });
    }
    parts.push({ text: userText });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens },
    });
    return result.response.text() || '';
  }

  // Default: Claude
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const content = [];
  if (imageBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } });
  }
  content.push({ type: 'text', text: userText });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });
  return msg.content[0]?.text || '';
}

async function callAIWithImages(system, userText, imageA = null, imageB = null, maxTokens = 500) {
  const config = await getAiKingConfig();

  if (config.activeModel === 'gemini') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      systemInstruction: system,
    });
    const parts = [];
    if (imageA) parts.push({ inlineData: { data: imageA, mimeType: 'image/jpeg' } });
    if (imageB) parts.push({ inlineData: { data: imageB, mimeType: 'image/jpeg' } });
    parts.push({ text: userText });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens },
    });
    return result.response.text() || '';
  }

  // Default: Claude
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const content = [];
  if (imageA) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageA } });
  if (imageB) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB } });
  content.push({ type: 'text', text: userText });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });
  return msg.content[0]?.text || '';
}

// ── Usage check with extraAiUses fallback ──
async function checkUsage(userId, feature) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`ai_king_usage/${userId}_${today}_${feature}`);
  return db.runTransaction(async (tx) => {
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${userId}`))]);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count >= DAILY_LIMIT) {
      const extra = userSnap.exists ? (userSnap.data()?.extraAiUses || 0) : 0;
      if (extra <= 0) return false;
      tx.update(db.doc(`users/${userId}`), { extraAiUses: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      return true;
    }
    tx.set(ref, { count: count + 1, userId, feature, date: today, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}

// ── 미친판사: 7가지 판사 유형 ──
const JUDGES = [
  { id: 'lawyer',      name: '⚖️ 엄근진 법관',  desc: '대한민국 대법원 판사. 형법·민법 조항 인용, "제○조" "피고인" "주문" 필수. 딱딱하고 엄중하게 2~3문장.' },
  { id: 'emotional',   name: '😭 감성 판사',     desc: '모든 것에 눈물 흘리는 감성 과잉 판사. 시적 표현 필수, 마지막엔 항상 눈물. 2~3문장.' },
  { id: 'boomer',      name: '👴 꼰대 판사',     desc: '"라떼는~" "우리 때는~" "요즘 것들은~" 표현 필수 꼰대 판사. 교훈으로 끝냄. 2~3문장.' },
  { id: 'scientist',   name: '🔬 과학자 판사',   desc: '데이터·통계·확률로만 판결. 없는 논문도 인용. 감정 없음. 2~3문장.' },
  { id: 'philosopher', name: '🤔 철학자 판사',   desc: '소크라테스·니체·공자 인용하며 뜬구름 잡음. 결론 없이 질문으로 끝. 2~3문장.' },
  { id: 'alien',       name: '👽 외계인 판사',   desc: '"지구인들은 왜..." 반복하는 외계인. 비교 대상 엉뚱함. 2~3문장.' },
  { id: 'crazy',       name: '🤪 돌아이 판사',   desc: '예측불가능하고 엉뚱하지만 자신은 매우 진지. 갑자기 딴 주제로 샘. 2~3문장.' },
];

const JUDGE_SYSTEM = `당신은 7명의 서로 다른 캐릭터 판사다. 주어진 상황에 대해 각 판사가 자신의 캐릭터에 맞게 판결을 내린다.
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

각 판사 캐릭터:
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

  const allowed = await checkUsage(userId, 'judge');
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 판결은 하루 ${DAILY_LIMIT}번만 가능해요`);

  const raw = await callAI(
    JUDGE_SYSTEM,
    `다음 상황을 7명의 판사가 각자 판결해줘:\n${situation.slice(0, 500)}`,
    imageBase64,
    1400,
  );

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
    authorId: userId,
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
  north: { name: '🇰🇵 북한말', system: '다음 텍스트를 북한 말투로 번역하라. "동무", "혁명동지", "위대한 령도자", "조국" 등을 자연스럽게 섞어라. 평양 방송 아나운서 스타일. 원문 내용을 유지하되 말투만 바꿔라.' },
  busan: { name: '🌊 부산 사투리', system: '다음 텍스트를 부산/경상도 사투리로 번역하라. "~가", "~나", "~데이", "~카이", "와", "뭐꼬", "마", "아이가" 등을 실제처럼 써라. 원문 내용을 유지하되 사투리로만 바꿔라.' },
  jolla: { name: '🌾 전라도 사투리', system: '다음 텍스트를 전라도 사투리로 번역하라. "~잉", "~제", "~여", "~랑게", "거시기", "거그서", "워메", "허벌나게" 등을 실제처럼 써라. 원문 내용을 유지하되 사투리로만 바꿔라.' },
  chungcheong: { name: '🐢 충청도 사투리', system: '다음 텍스트를 충청도 사투리로 번역하라. "~유", "~구만", "~겨", "~디야", "~허유" 등을 써라. 느릿느릿하고 여유로운 충청도 특유의 분위기를 살려라. 원문 내용을 유지하되 사투리로만 바꿔라.' },
  joseon: { name: '📜 조선시대', system: '다음 텍스트를 조선시대 사극 말투로 번역하라. "~이오", "~하옵나이다", "아뢰옵기를", "소인", "나으리", "~하였사옵니다", "황공하옵니다" 등을 써라. 원문 내용을 유지하되 말투만 바꿔라.' },
  boomer: { name: '👔 꼰대체', system: '다음 텍스트를 꼰대 아저씨 말투로 번역하라. "내가 말이야~", "요즘 것들은~", "우리 때는~", "그게 아니고~", "내 경험상~"으로 시작하고 교훈으로 끝낸다. 원문 내용을 유지하되 꼰대스럽게 바꿔라.' },
  teen: { name: '🎮 급식체', system: '다음 텍스트를 요즘 10대 급식체로 번역하라. "ㄹㅇ", "ㅇㅈ", "레게노", "킹받음", "갈비탕(감사)", "ㅈㄴ", "미쳤다", "개추" 등 실제 표현을 자연스럽게 써라. 원문 내용을 유지하되 말투만 바꿔라.' },
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

  const allowed = await checkUsage(userId, 'translate');
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 번역은 하루 ${DAILY_LIMIT}번만 가능해요`);

  const userText = imageBase64
    ? `이미지에 있는 텍스트와 함께 다음 내용을 번역해줘:\n${text.slice(0, 500)}`
    : `다음을 번역해줘:\n${text.slice(0, 500)}`;

  const translated = await callAI(styleData.system, userText, imageBase64, 500);

  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_translate',
    title: `${styleData.name} 번역: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`,
    originalText: text.slice(0, 500),
    style,
    styleName: styleData.name,
    translated,
    hasImage: !!imageBase64,
    authorId: userId,
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

  const allowed = await checkUsage(userId, 'match');
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 궁합은 하루 ${DAILY_LIMIT}번만 가능해요`);

  const system = `당신은 세상 모든 것의 궁합을 보는 AI 점쟁이다. 사람, 음식, 물건, 동물 뭐든 궁합을 본다. 반드시 JSON 형식으로만 답하라:
{"score": 숫자(0~100), "grade": "등급(예:천생연분💕/찰떡궁합🎯/그냥저냥😐/최악의조합💥)", "reason": "궁합 이유(웃기고 황당하게 2~3문장)", "chemistry": "둘이 만나면 생기는 일(재미있고 구체적으로 1~2문장)", "advice": "조언(웃기게 한 문장)"}`;

  let matchResult;
  try {
    const raw = await callAIWithImages(
      system,
      `"${itemA.slice(0, 100)}"와 "${itemB.slice(0, 100)}"의 궁합을 봐줘`,
      imageA,
      imageB,
      500,
    );
    matchResult = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
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
    authorId: userId,
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

  const allowed = await checkUsage(userId, 'naming');
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 작명은 하루 ${DAILY_LIMIT}번만 가능해요`);

  const catLabel = NAME_CATEGORIES[category] || '기타';

  const system = `당신은 세상에서 가장 웃기고 창의적인 작명 전문가다. 요청받은 것의 이름을 5개 지어준다.
이름은 웃기지만 그럴듯해야 한다. 너무 평범하면 안 된다. 듣는 순간 "ㅋㅋㅋ 맞네" 소리가 나와야 한다.
반드시 JSON 형식으로만 답하라:
{"names": [{"name": "이름1", "reason": "이유(한 줄, 웃기게)"}, {"name": "이름2", "reason": "..."}, {"name": "이름3", "reason": "..."}, {"name": "이름4", "reason": "..."}, {"name": "이름5", "reason": "..."}]}`;

  const descPart = hasDesc ? `설명: ${description.trim().slice(0, 300)}\n` : '';
  const userText = imageBase64
    ? `카테고리: ${catLabel}\n${descPart}첨부된 사진을 보고 이름을 지어줘.`
    : `카테고리: ${catLabel}\n${descPart}이 이름을 지어줘.`;

  let names;
  try {
    const raw = await callAI(system, userText, imageBase64, 600);
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    names = parsed.names || [];
  } catch {
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
    authorId: userId,
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
  const FIELDS = ['activeModel', 'claudeApiKey', 'claudeModel', 'geminiApiKey', 'geminiModel', 'openaiApiKey', 'openaiModel', 'pointsPerUse'];

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
