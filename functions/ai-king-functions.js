'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

if (!getApps().length) initializeApp();
const db = getFirestore();
const anthropicKey = defineSecret('ANTHROPIC_API_KEY');

const DAILY_LIMIT = 3;

async function checkUsage(userId, feature) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`ai_king_usage/${userId}_${today}_${feature}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count >= DAILY_LIMIT) return false;
    tx.set(ref, { count: count + 1, userId, feature, date: today, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}

function makeImageContent(base64) {
  if (!base64) return null;
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } };
}

async function callClaude(anthropic, system, userText, imageBase64 = null, maxTokens = 400) {
  const content = [];
  if (imageBase64) content.push(makeImageContent(imageBase64));
  content.push({ type: 'text', text: userText });
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });
  return msg.content[0]?.text || '';
}

// ── 미친판사: 7가지 판사 유형 ──
const JUDGES = [
  {
    id: 'lawyer',
    name: '⚖️ 엄근진 법관',
    system: '당신은 대한민국 대법원 판사다. 황당한 상황도 형법·민법 조항을 인용하며 딱딱하게 판결한다. "제○조", "피고인", "주문" 같은 법률 용어를 꼭 써라. 2~3문장으로 짧고 엄중하게.',
  },
  {
    id: 'emotional',
    name: '😭 감성 판사',
    system: '당신은 모든 것에 눈물을 흘리는 감성 과잉 판사다. 피고도 원고도 불쌍하다. 판결보다 감정이 앞선다. 시적인 표현을 써라. 마지막엔 항상 눈물. 2~3문장.',
  },
  {
    id: 'boomer',
    name: '👴 꼰대 판사',
    system: '당신은 "내가 젊을 때는..."으로 시작하는 꼰대 판사다. 요즘 세대를 이해 못 한다. "라떼는~", "우리 때는~", "요즘 것들은~" 표현 필수. 교훈으로 끝냄. 2~3문장.',
  },
  {
    id: 'scientist',
    name: '🔬 과학자 판사',
    system: '당신은 데이터와 통계로만 판결하는 과학자 판사다. 감정 없이 숫자와 확률로 분석한다. 없는 논문이나 연구도 인용한다. 2~3문장.',
  },
  {
    id: 'philosopher',
    name: '🤔 철학자 판사',
    system: '당신은 소크라테스·니체·공자를 인용하며 뜬구름 잡는 철학자 판사다. 명확한 결론은 없다. 모든 것에 반문하며 오히려 질문으로 끝낸다. 2~3문장.',
  },
  {
    id: 'alien',
    name: '👽 외계인 판사',
    system: '당신은 지구에 온 외계인 판사다. 인간의 감정과 행동이 이해 안 된다. "지구인들은 왜..."를 반복한다. 비교 대상이 엉뚱하다. 2~3문장.',
  },
  {
    id: 'crazy',
    name: '🤪 돌아이 판사',
    system: '당신은 완전히 예측불가능한 돌아이 판사다. 논리 없음, 엉뚱하지만 자신은 매우 진지하다. 갑자기 전혀 다른 주제로 샌다. 2~3문장.',
  },
];

exports.aiJudge = onCall({
  region: 'asia-northeast3',
  secrets: [anthropicKey],
  timeoutSeconds: 90,
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

  const anthropic = new Anthropic({ apiKey: anthropicKey.value() });
  const userText = `다음 상황을 판결해줘:\n${situation.slice(0, 500)}`;

  const verdicts = [];
  for (const judge of JUDGES) {
    try {
      const verdict = await callClaude(anthropic, judge.system, userText, imageBase64, 300);
      verdicts.push({ judgeId: judge.id, judgeName: judge.name, verdict });
    } catch {
      verdicts.push({ judgeId: judge.id, judgeName: judge.name, verdict: '이 판사는 오늘 결근했습니다. 😴' });
    }
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
  secrets: [anthropicKey],
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

  const anthropic = new Anthropic({ apiKey: anthropicKey.value() });
  const userText = imageBase64
    ? `이미지에 있는 텍스트와 함께 다음 내용을 번역해줘:\n${text.slice(0, 500)}`
    : `다음을 번역해줘:\n${text.slice(0, 500)}`;

  const translated = await callClaude(anthropic, styleData.system, userText, imageBase64, 500);

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
  secrets: [anthropicKey],
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

  const anthropic = new Anthropic({ apiKey: anthropicKey.value() });

  const system = `당신은 세상 모든 것의 궁합을 보는 AI 점쟁이다. 사람, 음식, 물건, 동물 뭐든 궁합을 본다. 반드시 JSON 형식으로만 답하라:
{"score": 숫자(0~100), "grade": "등급(예:천생연분💕/찰떡궁합🎯/그냥저냥😐/최악의조합💥)", "reason": "궁합 이유(웃기고 황당하게 2~3문장)", "chemistry": "둘이 만나면 생기는 일(재미있고 구체적으로 1~2문장)", "advice": "조언(웃기게 한 문장)"}`;

  const content = [];
  if (imageA) content.push(makeImageContent(imageA));
  if (imageB) content.push(makeImageContent(imageB));
  content.push({ type: 'text', text: `"${itemA.slice(0, 100)}"와 "${itemB.slice(0, 100)}"의 궁합을 봐줘` });

  let matchResult;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content }],
    });
    const raw = msg.content[0]?.text || '{}';
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
  secrets: [anthropicKey],
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { description, category, imageBase64 } = request.data || {};
  if (!description || description.trim().length < 2) {
    throw new HttpsError('invalid-argument', '설명을 입력해주세요');
  }

  const allowed = await checkUsage(userId, 'naming');
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 작명은 하루 ${DAILY_LIMIT}번만 가능해요`);

  const anthropic = new Anthropic({ apiKey: anthropicKey.value() });
  const catLabel = NAME_CATEGORIES[category] || '기타';

  const system = `당신은 세상에서 가장 웃기고 창의적인 작명 전문가다. 요청받은 것의 이름을 5개 지어준다.
이름은 웃기지만 그럴듯해야 한다. 너무 평범하면 안 된다. 듣는 순간 "ㅋㅋㅋ 맞네" 소리가 나와야 한다.
반드시 JSON 형식으로만 답하라:
{"names": [{"name": "이름1", "reason": "이유(한 줄, 웃기게)"}, {"name": "이름2", "reason": "..."}, {"name": "이름3", "reason": "..."}, {"name": "이름4", "reason": "..."}, {"name": "이름5", "reason": "..."}]}`;

  const userText = `카테고리: ${catLabel}\n설명: ${description.slice(0, 300)}\n이 이름을 지어줘.`;

  let names;
  try {
    const raw = await callClaude(anthropic, system, userText, imageBase64, 600);
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
    title: `${catLabel} 작명: ${description.slice(0, 40)}${description.length > 40 ? '...' : ''}`,
    description: description.slice(0, 300),
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
exports.getAiKingUsage = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) return { judge: 0, translate: 0, match: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const features = ['judge', 'translate', 'match'];
  const snaps = await Promise.all(
    features.map(f => db.doc(`ai_king_usage/${userId}_${today}_${f}`).get())
  );
  const result = {};
  features.forEach((f, i) => { result[f] = snaps[i].exists ? (snaps[i].data().count || 0) : 0; });
  return result;
});
