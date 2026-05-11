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

const LIFE_COURT_JUDGE_PERSONAS = {
  '엄벌주의형': '당신은 엄벌주의형 AI 판사입니다. 아주 사소한 생활사건도 중대한 판례처럼 엄숙하게 다루되, 내용은 과장되어 웃기게 만드세요. 판결 이유는 법원 문서처럼 무겁게 시작하고, 화해 미션은 터무니없이 엄격하지만 현실적으로 따라 할 수 있는 수준으로 제시하세요.',
  '감성형': '당신은 감성형 AI 판사입니다. 원고 측과 피고 측 모두의 서운함을 깊이 공감하고, 웃기지만 따뜻한 화해 중심 판결을 내리세요. 판결문에는 가벼운 감정 표현을 섞어도 좋습니다.',
  '현실주의형': '당신은 현실주의형 AI 판사입니다. 사건을 냉정하게 보고, 누가 더 현실적으로 말이 되는지 짧고 단호하게 판단하세요. 어른스럽고 실용적인 화해 미션을 제시하세요.',
  '과몰입형': '당신은 과몰입형 AI 판사입니다. 치킨 한 조각, 카톡 한 줄도 인류사적 사건처럼 거창하게 표현하세요. 단, 판결은 생활법정 오락용임을 잊지 말고 유쾌하게 마무리하세요.',
  '피곤형': '당신은 피곤형 AI 판사입니다. 빨리 선고하고 퇴근하고 싶은 듯 짧고 무심하지만 웃긴 판결을 내리세요. 단, 누가 왜 더 설득력 있었는지는 분명히 밝혀야 합니다.',
  '논리집착형': '당신은 논리집착형 AI 판사입니다. 설득력, 공감도, 생활상식, 드립력을 점수처럼 분석하세요. 숫자를 좋아하지만 너무 길게 쓰지 말고 재미있게 판결하세요.',
  '드립형': '당신은 드립형 AI 판사입니다. 판결문은 진지한 문체로 시작하지만 중간에 절묘한 생활 드립을 섞으세요. 마지막 한 줄은 공유하고 싶을 만큼 짧고 웃기게 끝내세요.',
};

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

function lifeCaseNumber() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `생활 ${year}-소소-${num}호`;
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

async function checkFunctionRateLimit(userId, action, maxCount, windowSeconds) {
  const ref = db.doc(`rate_limits/${userId}`);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const timestamps = (data[action] || []).filter(ts => ts > now - windowMs);
    if (timestamps.length >= maxCount) throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    tx.set(ref, { [action]: [...timestamps, now] }, { merge: true });
  });
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

function buildVerdictPrompt(session, completeRounds, caseNo) {
  const judgeType = session.judgeType || '현실주의형';
  const persona = LIFE_COURT_JUDGE_PERSONAS[judgeType] || LIFE_COURT_JUDGE_PERSONAS['현실주의형'];
  const roundsText = completeRounds.map((r, i) => {
    return `[제${i + 1}심리]\n원고 측 진술: ${r.plaintiff || ''}\n피고 측 해명: ${r.defendant || ''}`;
  }).join('\n\n');

  return `${persona}

당신은 "소소킹 생활법정"의 AI 판사입니다. 아래 생활사건 기록을 보고 실제 법률 판단이 아닌 오락용 판결문을 작성하세요.

사건번호: ${caseNo}
사건명: ${session.topicTitle}
사건 요약: ${session.topicSummary || ''}
카테고리: ${session.category || '생활'}
원고 측 기본 입장: ${session.plaintiffPosition || ''}
피고 측 기본 입장: ${session.defendantPosition || ''}

사건 심리 기록:
${roundsText}

반드시 아래 JSON만 출력하세요. 설명, 코드블록, JSON 밖 문장은 금지합니다.
{
  "winnerRole": "plaintiff 또는 defendant 또는 draw",
  "resultTitle": "20자 이내 판결 제목",
  "summary": "80자 이내 판결 요약",
  "reason": "300자 이내 판결 이유. 웃기지만 양쪽 입장을 모두 언급",
  "plaintiffScore": 0,
  "defendantScore": 0,
  "quote": "오늘의 명대사 1문장",
  "mission": "패자 또는 양쪽이 수행할 가벼운 화해 미션 1개"
}

판결 기준:
- '토론', '배틀', 'A팀', 'B팀', '심판', '판정'이라는 단어를 쓰지 말 것
- '원고 측', '피고 측', '사건 심리', '판결', 'AI 판사' 표현 사용
- 실제 법률 조언처럼 쓰지 말 것
- 정치, 혐오, 성적 내용, 실명 비방 금지
- 원고와 피고 모두 납득할 수 있게 판결
- 너무 진지하지 말고 공유하고 싶은 생활법정 게임 결과처럼 작성
- 점수는 0~100 정수이며, winnerRole과 점수 우위가 일치해야 함. draw면 두 점수 차이는 3점 이하`;
}

function normalizeVerdict(raw, session, caseNo) {
  const data = raw && typeof raw === 'object' ? raw : {};
  let winnerRole = ['plaintiff', 'defendant', 'draw'].includes(data.winnerRole) ? data.winnerRole : null;
  let plaintiffScore = Number.isFinite(Number(data.plaintiffScore)) ? Math.max(0, Math.min(100, Math.round(Number(data.plaintiffScore)))) : 50;
  let defendantScore = Number.isFinite(Number(data.defendantScore)) ? Math.max(0, Math.min(100, Math.round(Number(data.defendantScore)))) : 50;

  if (!winnerRole) {
    if (plaintiffScore === defendantScore) winnerRole = 'draw';
    else winnerRole = plaintiffScore > defendantScore ? 'plaintiff' : 'defendant';
  }
  if (winnerRole === 'plaintiff' && plaintiffScore <= defendantScore) plaintiffScore = Math.min(100, defendantScore + 3);
  if (winnerRole === 'defendant' && defendantScore <= plaintiffScore) defendantScore = Math.min(100, plaintiffScore + 3);
  if (winnerRole === 'draw' && Math.abs(plaintiffScore - defendantScore) > 3) defendantScore = plaintiffScore;

  const winner = winnerRole === 'plaintiff' ? 'A' : winnerRole === 'defendant' ? 'B' : 'draw';
  const winnerLabel = winnerRole === 'plaintiff' ? '원고 측 일부 승소' : winnerRole === 'defendant' ? '피고 측 일부 승소' : '쌍방 화해 권고';
  const resultTitle = cleanText(data.resultTitle || winnerLabel, 24);
  const reason = cleanText(data.reason || '양쪽 모두 할 말은 있으나, 생활법정은 더 그럴듯하고 덜 민망한 쪽의 손을 들어줍니다.', 360);
  const summary = cleanText(data.summary || `${session.topicTitle || '생활사건'}에 대한 오락용 판결입니다.`, 100);
  const quote = cleanText(data.quote || '사소한 사건일수록 물어보는 한마디가 판결을 바꿉니다.', 100);
  const mission = cleanText(data.mission || '서로에게 10초씩 설명할 시간을 주고, 다음에는 먼저 물어보기.', 140);

  return {
    caseNumber: caseNo,
    judgeType: session.judgeType || '현실주의형',
    winner,
    winnerRole,
    winnerLabel,
    winnerName: winnerLabel,
    resultTitle,
    title: resultTitle,
    summary,
    reason,
    quote,
    line: quote,
    mission,
    plaintiffScore,
    defendantScore,
    scoreA: plaintiffScore,
    scoreB: defendantScore,
    scores: {
      plaintiff: plaintiffScore,
      defendant: defendantScore,
      A: plaintiffScore,
      B: defendantScore,
    },
    disclaimer: '이 판결은 소소킹 생활법정의 오락용 AI 판결이며 실제 법적 효력이 없습니다.',
  };
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

const requestVerdict = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  const { sessionId } = request.data || {};
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  if (!sessionId) throw new Error('세션 정보가 없습니다');

  await checkFunctionRateLimit(userId, 'requestVerdict', 10, 86400);

  const sessionRef = db.doc(`debate_sessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error('세션 없음');
  const session = sessionSnap.data();

  const plaintiffTeam = session.plaintiffTeam || [];
  const defendantTeam = session.defendantTeam || [];
  const isParticipant = session.plaintiff?.userId === userId || session.defendant?.userId === userId || plaintiffTeam.some(m => m.userId === userId) || defendantTeam.some(m => m.userId === userId);
  if (!isParticipant) throw new Error('참가자가 아닙니다');
  if (['judging', 'completed'].includes(session.status)) return { ok: true };

  const completeRounds = (session.rounds || []).filter(r => r && r.plaintiff && r.defendant);
  if (!completeRounds.length) throw new Error('한 번 이상 사건 심리를 마친 뒤 판결을 요청할 수 있습니다');

  if (session.status === 'active' && session.mode !== 'ai') {
    await sessionRef.update({ status: 'verdict_requested', verdictRequestedBy: userId });
    return { ok: true, waiting: true };
  }

  if (session.status === 'verdict_requested' && session.verdictRequestedBy === userId) {
    throw new Error('이미 판결을 요청하셨습니다. 상대방의 동의를 기다려주세요.');
  }

  const previousStatus = session.status;
  await sessionRef.update({ status: 'judging', verdictRequestedBy: null });

  try {
    const caseNo = lifeCaseNumber();
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(buildVerdictPrompt(session, completeRounds, caseNo));
    const parsed = extractJson(result.response.text());
    const verdict = normalizeVerdict(parsed, session, caseNo);

    await sessionRef.update({
      status: 'completed',
      verdict,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, verdict };
  } catch (err) {
    await sessionRef.update({ status: previousStatus || 'ready_for_verdict', verdictRequestedBy: null }).catch(() => {});
    throw new Error(err.message || 'AI 판결 생성에 실패했습니다');
  }
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
  requestVerdict,
  generateCaseTopic,
  createAiCaseTopic,
  generateDailyCaseTopics,
};
