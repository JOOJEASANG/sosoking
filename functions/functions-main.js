const baseFunctions = require('./index.js');
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');

const DEFAULT_CASE_CATEGORIES = ['카톡', '연애', '음식', '정산', '직장', '생활', '친구', '기타'];
const FALLBACK_CASES = [
  {
    title: '카톡 읽씹 무죄 사건',
    summary: '읽었으면 바로 답해야 한다 vs 답장은 마음의 준비가 필요하다',
    plaintiffPosition: '읽었으면 바로 답장하는 게 기본 예의입니다',
    defendantPosition: '읽었다고 바로 답할 의무까지 생기는 건 아닙니다',
    category: '카톡',
  },
  {
    title: '치킨 마지막 조각 선취 사건',
    summary: '마지막 조각은 나눠야 한다 vs 먼저 집은 사람이 임자다',
    plaintiffPosition: '마지막 조각은 눈치 보고 공평하게 나눠야 합니다',
    defendantPosition: '먹고 싶으면 먼저 집었어야 합니다',
    category: '음식',
  },
  {
    title: '더치페이 100원 단위 정산 사건',
    summary: '100원까지 정산해야 한다 vs 그 정도는 넘어가야 한다',
    plaintiffPosition: '금액이 작아도 정확한 정산이 깔끔합니다',
    defendantPosition: '100원 단위까지 따지면 인간미가 없습니다',
    category: '정산',
  },
];

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeCaseTopic(raw, categories = DEFAULT_CASE_CATEGORIES) {
  const fallback = pick(FALLBACK_CASES);
  const data = raw && typeof raw === 'object' ? raw : fallback;
  const category = categories.includes(data.category) ? data.category : (categories.includes(fallback.category) ? fallback.category : categories[0] || '생활');
  const title = cleanText(data.title || fallback.title, 30);
  const summary = cleanText(data.summary || fallback.summary, 60);
  const plaintiffPosition = cleanText(data.plaintiffPosition || fallback.plaintiffPosition, 100);
  const defendantPosition = cleanText(data.defendantPosition || fallback.defendantPosition, 100);

  return {
    title: title.endsWith('사건') ? title : `${title} 사건`.slice(0, 30),
    summary,
    plaintiffPosition,
    defendantPosition,
    category,
  };
}

function extractJson(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function getCategories() {
  try {
    const snap = await db.collection('categories').orderBy('order', 'asc').get();
    const list = snap.docs.map(d => d.data().name).filter(Boolean);
    return list.length ? list : DEFAULT_CASE_CATEGORIES;
  } catch {
    return DEFAULT_CASE_CATEGORIES;
  }
}

async function assertAdmin(uid) {
  if (!uid) throw new Error('인증 필요');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new Error('관리자 권한 필요');
}

async function validateBannedWords(...texts) {
  const settingsSnap = await db.doc('site_settings/config').get();
  const bannedWords = settingsSnap.exists ? (settingsSnap.data().bannedWords || []) : [];
  if (!bannedWords.length) return;
  const joined = texts.join(' ').toLowerCase();
  const hit = bannedWords.find(w => w && joined.includes(String(w).toLowerCase()));
  if (hit) throw new Error('사용할 수 없는 표현이 포함되어 있습니다');
}

function buildCasePrompt({ category, mood, categories }) {
  const categoryLine = category && category !== '랜덤' ? `카테고리: ${category}` : `카테고리 후보: ${categories.join(', ')}`;
  const moodLine = mood ? `분위기: ${mood}` : '분위기: 웃기지만 누구나 공감 가능한 생활 분쟁';
  return `당신은 소소킹 생활법정의 사건 접수 AI입니다.
찬반 토론 주제가 아니라, 사람들이 원고와 피고로 나뉘어 웃기게 겨룰 수 있는 "생활 사건" 1개를 만드세요.

${categoryLine}
${moodLine}

반드시 아래 JSON만 출력하세요. 설명, 코드블록, 따옴표 밖 문장은 금지합니다.
{
  "title": "30자 이내, 반드시 ~사건으로 끝나는 사건명",
  "summary": "60자 이내, 원고 입장 vs 피고 입장이 한눈에 보이는 사건 요약",
  "plaintiffPosition": "100자 이내, 원고가 억울해할 만한 주장",
  "defendantPosition": "100자 이내, 피고도 나름 말이 되는 반론",
  "category": "카테고리 후보 중 하나"
}

생성 규칙:
- 정치, 종교, 혐오, 성적 내용, 실명 비방, 범죄 미화 금지
- 실제 법률 사건처럼 무겁게 만들지 말고 생활 속 사소한 갈등으로 만들 것
- "A팀/B팀", "찬성/반대", "토론"이라는 단어 금지
- 원고와 피고가 모두 억울하거나 그럴듯해야 함
- 예: 카톡 읽씹 무죄 사건, 치킨 마지막 조각 선취 사건, 더치페이 100원 정산 사건`;
}

async function generateCaseTopicWithGemini({ category = '랜덤', mood = '' } = {}) {
  const categories = await getCategories();
  const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const result = await model.generateContent(buildCasePrompt({ category, mood, categories }));
  const parsed = extractJson(result.response.text());
  return normalizeCaseTopic(parsed, categories);
}

async function createCaseTopicDoc(topic, extra = {}) {
  await validateBannedWords(topic.title, topic.summary, topic.plaintiffPosition, topic.defendantPosition);
  const ref = await db.collection('topics').add({
    title: topic.title,
    summary: topic.summary,
    plaintiffPosition: topic.plaintiffPosition,
    defendantPosition: topic.defendantPosition,
    category: topic.category,
    status: extra.status || 'active',
    isOfficial: extra.isOfficial ?? false,
    source: extra.source || 'manual',
    playCount: 0,
    votesA: 0,
    votesB: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...(extra.submittedBy ? { submittedBy: extra.submittedBy } : {}),
  });
  return ref.id;
}

const submitTopic = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');

  const title = cleanText(request.data?.title, 30);
  const plaintiffPosition = cleanText(request.data?.plaintiffPosition, 100);
  const defendantPosition = cleanText(request.data?.defendantPosition, 100);
  const categories = await getCategories();
  const category = categories.includes(request.data?.category) ? request.data.category : (categories[0] || '생활');

  if (title.length < 4) throw new Error('사건명이 너무 짧습니다');
  if (plaintiffPosition.length < 5) throw new Error('원고 입장을 5자 이상 입력해주세요');
  if (defendantPosition.length < 5) throw new Error('피고 입장을 5자 이상 입력해주세요');

  let summary = cleanText(request.data?.summary, 60);
  if (!summary) {
    summary = cleanText(`${plaintiffPosition.replace(/[.!?。]$/,'')} vs ${defendantPosition.replace(/[.!?。]$/,'')}`, 60);
  }

  const topic = normalizeCaseTopic({ title, summary, plaintiffPosition, defendantPosition, category }, categories);
  const topicId = await createCaseTopicDoc(topic, { source: 'user_case_submit', submittedBy: userId, isOfficial: false, status: 'active' });
  return { topicId, topic };
});

const generateCaseTopic = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const topic = await generateCaseTopicWithGemini({
    category: cleanText(request.data?.category || '랜덤', 20),
    mood: cleanText(request.data?.mood || '', 40),
  });
  return { topic };
});

const createAiCaseTopic = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const topic = await generateCaseTopicWithGemini({
    category: cleanText(request.data?.category || '랜덤', 20),
    mood: cleanText(request.data?.mood || '', 40),
  });
  const topicId = await createCaseTopicDoc(topic, { source: 'ai_case_generation', isOfficial: true, status: 'active' });
  return { topicId, topic };
});

const generateDailyCaseTopics = onSchedule({
  schedule: 'every day 09:00',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  secrets: [geminiKey],
  timeoutSeconds: 120,
}, async () => {
  const settingsSnap = await db.doc('site_settings/config').get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (!(settings.autoCaseTopicEnabled ?? false)) return;

  const count = Math.max(1, Math.min(Number(settings.dailyAutoCaseTopicCount || 1), 5));
  for (let i = 0; i < count; i++) {
    const topic = await generateCaseTopicWithGemini({ category: settings.autoCaseTopicCategory || '랜덤', mood: settings.autoCaseTopicMood || '' });
    await createCaseTopicDoc(topic, { source: 'scheduled_ai_case_generation', isOfficial: true, status: 'active' });
  }
});

module.exports = {
  ...baseFunctions,
  submitTopic,
  generateCaseTopic,
  createAiCaseTopic,
  generateDailyCaseTopics,
};
