'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();

const POST_TYPES = [
  { type: 'balance',  cat: 'golra' },
  { type: 'vote',     cat: 'golra' },
  { type: 'battle',   cat: 'golra' },
  { type: 'ox',       cat: 'golra' },
  { type: 'quiz',     cat: 'golra' },
  { type: 'naming',   cat: 'usgyo' },
  { type: 'acrostic', cat: 'usgyo' },
  { type: 'cbattle',  cat: 'usgyo' },
  { type: 'laugh',    cat: 'usgyo' },
  { type: 'drip',     cat: 'usgyo' },
  { type: 'howto',    cat: 'malhe' },
  { type: 'story',    cat: 'malhe' },
  { type: 'fail',     cat: 'malhe' },
  { type: 'concern',  cat: 'malhe' },
  { type: 'relay',    cat: 'malhe' },
];

function getTodayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getDayOfYear() {
  const [year, month, day] = getTodayKST().split('-').map(Number);
  return Math.floor((new Date(year, month - 1, day) - new Date(year, 0, 1)) / 86400000) + 1;
}

function buildPrompt(type) {
  const base = `당신은 한국 커뮤니티 사이트 "소소킹"의 AI 콘텐츠 작성자입니다.
소소킹은 일상의 소소한 주제로 유쾌하고 가볍게 소통하는 공간입니다.
반드시 유효한 JSON 객체만 반환하세요. 마크다운 코드블록(\`\`\`), 설명 텍스트, 추가 주석 없이 JSON만 출력하세요.
한국어로 작성하며, 재미있고 친근하고 공감 가는 내용으로 만들어주세요.`;

  const prompts = {
    balance: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "밸런스게임 제목 (흥미롭고 일상적인 주제)",
  "desc": "간단한 설명이나 상황 설명 (1-2문장)",
  "options": [
    {"text": "선택지 A", "votes": 0},
    {"text": "선택지 B", "votes": 0}
  ],
  "tags": ["태그1", "태그2"]
}

예시 주제: 치킨 vs 피자, 여름 vs 겨울, 야행성 vs 아침형 인간 등 일상에서 쉽게 공감할 수 있는 밸런스게임을 만들어주세요.`,

    vote: `${base}

다음 형식의 JSON을 반환하세요 (선택지는 3-4개):
{
  "title": "투표 제목 (가볍고 재미있는 주제)",
  "desc": "투표 배경 설명 (1-2문장)",
  "options": [
    {"text": "선택지1", "votes": 0},
    {"text": "선택지2", "votes": 0},
    {"text": "선택지3", "votes": 0}
  ],
  "tags": ["태그1", "태그2"]
}

예시 주제: 주말에 뭐 할지, 점심 메뉴 고르기, 소소한 취향 조사 등 커뮤니티 투표로 즐길 수 있는 주제를 만들어주세요.`,

    battle: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "배틀 제목 (재치 있는 VS 대결)",
  "desc": "배틀 상황 설명 (1-2문장)",
  "options": [
    {"text": "A팀 또는 선택지", "votes": 0},
    {"text": "B팀 또는 선택지", "votes": 0}
  ],
  "tags": ["태그1", "태그2"]
}

재미있는 vs 배틀 형식으로 팀을 나눠 의견 대결을 펼칠 수 있는 주제를 만들어주세요. 예: 짜장 vs 짬뽕, 인트로버트 vs 엑스트로버트 등.`,

    ox: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "OX 퀴즈 제목",
  "desc": "퀴즈 문제 설명 (1-2문장, 참/거짓 판별 가능한 문장)",
  "answer": "O",
  "explanation": "정답 해설 (왜 O 또는 X인지 설명, 2-3문장)",
  "tags": ["태그1", "태그2"]
}

answer는 반드시 "O" 또는 "X" 중 하나여야 합니다.
일상 상식, 흥미로운 사실, 생활 정보에서 참/거짓 퀴즈를 만들어주세요.`,

    quiz: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "퀴즈 제목",
  "desc": "퀴즈 문제 (1-2문장)",
  "quizMode": "multiple",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "answerIdx": 0,
  "explanation": "정답 해설 (2-3문장, 왜 이 답인지 설명)",
  "tags": ["태그1", "태그2"]
}

answerIdx는 0-3 사이의 정수 (정답 선택지의 인덱스)입니다.
상식, 과학, 역사, 문화 등 가볍게 즐길 수 있는 4지선다 퀴즈를 만들어주세요.`,

    naming: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "작명 챌린지 제목 (상황이나 사진 설명 포함)",
  "desc": "작명 챌린지 내용 설명 (어떤 상황에 제목을 붙이는 것인지, 2-3문장)",
  "tags": ["태그1", "태그2"]
}

재미있는 상황, 밈이 될 법한 장면, 웃긴 순간 등에 창의적인 제목을 붙이는 챌린지를 만들어주세요.`,

    acrostic: `${base}

다음 형식의 JSON을 반환하세요:
{
  "keyword": "삼행시 키워드 (2-4글자 단어)",
  "desc": "삼행시 도전 설명 및 참여 유도 멘트 (2-3문장)",
  "tags": ["태그1", "태그2"]
}

title은 자동으로 생성됩니다. keyword는 삼행시 짓기에 재미있는 단어로, 일상어, 음식, 계절, 감정 등 다양한 주제에서 골라주세요. 예: 소소킹, 치킨, 커피, 행복 등.`,

    cbattle: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "댓글배틀 제목",
  "desc": "배틀 주제 설명 (1-2문장)",
  "howto": "참여 방법 안내 (댓글로 어떻게 참여하는지, 2-3문장)",
  "tags": ["태그1", "태그2"]
}

댓글 배틀 형식으로, 서로 재치 있는 답변을 주고받을 수 있는 주제를 만들어주세요. 예: 최고의 인생 음식 배틀, 최악의 경험 공유 배틀 등.`,

    laugh: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "웃음 챌린지 제목",
  "desc": "웃음 챌린지 내용 (어떤 웃긴 상황이나 도전인지, 2-3문장)",
  "difficulty": "normal",
  "tags": ["태그1", "태그2"]
}

difficulty는 "easy", "normal", "hard", "extreme" 중 하나입니다.
참여자들이 웃음을 참거나 웃긴 상황에 대응하는 챌린지를 만들어주세요.`,

    drip: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "드립 배틀 제목 (재치 있는 말장난 주제)",
  "desc": "드립 주제 설명 및 참여 유도 (2-3문장, 어떤 드립을 치는 자리인지 설명)",
  "tags": ["태그1", "태그2"]
}

댓글로 드립을 치며 유쾌하게 참여할 수 있는 주제를 만들어주세요. 언어유희, 상황 드립, 말장난 등 재치 있는 드립 배틀이 벌어질 수 있는 판을 만들어주세요.`,

    howto: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "하우투 제목 (어떻게 하는지 명확하게)",
  "summary": "한 줄 요약 (이 하우투가 어떤 도움을 주는지)",
  "desc": "전체 소개 설명 (2-3문장)",
  "steps": ["1단계 설명", "2단계 설명", "3단계 설명"],
  "materials": "필요한 재료나 준비물 (없으면 빈 문자열)",
  "caution": "주의사항 (없으면 빈 문자열)",
  "tags": ["태그1", "태그2"]
}

생활 꿀팁, 요리, 청소, 정리정돈, 시간 관리 등 실생활에 바로 적용할 수 있는 실용적인 하우투를 만들어주세요.`,

    story: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "이야기 제목",
  "desc": "짧은 에피소드나 경험담 (3-5문장, 공감 가는 일상 에피소드)",
  "feeling": "이 이야기에서 느끼는 감정 또는 교훈 (1-2문장)",
  "tags": ["태그1", "태그2"]
}

출퇴근, 식당, 편의점, 가족, 친구 등 일상에서 일어날 법한 소소하지만 공감 가는 에피소드를 만들어주세요.`,

    fail: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "실패 에피소드 제목 (재미있게)",
  "desc": "실패 경험 이야기 (3-5문장, 웃프지만 공감 가는 실패담)",
  "lesson": "이 실패에서 얻은 교훈 (1-2문장)",
  "redo": "다시 한다면 어떻게 할지 (1-2문장)",
  "tags": ["태그1", "태그2"]
}

요리 실패, 약속 실수, 직장 실수, 생활 속 황당한 실패 등 웃으며 공감할 수 있는 실패담을 만들어주세요.`,

    concern: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "고민 상담 제목 (공감 가는 고민)",
  "desc": "고민 내용 (3-5문장, 구체적이고 현실적인 일상 고민)",
  "tags": ["태그1", "태그2"]
}

직장, 인간관계, 연애, 가족, 취미 등 일상에서 누구나 한 번쯤 겪을 수 있는 소소한 고민을 만들어주세요. 댓글로 조언을 나눌 수 있는 주제여야 합니다.`,

    relay: `${base}

다음 형식의 JSON을 반환하세요:
{
  "title": "릴레이 글쓰기 제목",
  "desc": "릴레이 글쓰기 소개 및 참여 안내 (2-3문장)",
  "startSentence": "첫 문장 (릴레이를 시작하는 흥미로운 첫 문장, 이어 쓰고 싶게 만드는 문장)",
  "characters": "등장인물 소개 (있는 경우, 없으면 빈 문자열)",
  "tags": ["태그1", "태그2"]
}

독자들이 댓글로 다음 이야기를 이어 쓸 수 있도록 흥미로운 첫 문장과 상황을 만들어주세요. 개그, 판타지, 일상, 반전 등 다양한 장르 중 하나를 선택해 시작하세요.`,
  };

  return prompts[type] || prompts.concern;
}

function parseContent(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function buildFeedDoc(type, cat, content, today) {
  const base = {
    type,
    cat,
    authorId:    'sosoking-ai',
    authorName:  '소소킹AI 🤖',
    authorPhoto: '',
    images:      [],
    tags:        Array.isArray(content.tags) ? content.tags : [],
    reactions:   { total: 0 },
    commentCount: 0,
    viewCount:    0,
    isAiGenerated:   true,
    aiGeneratedDate: today,
    createdAt:   FieldValue.serverTimestamp(),
  };

  const optionList = (arr) =>
    Array.isArray(arr) ? arr.map(o => ({ text: String(o.text || o || ''), votes: 0 })) : [];

  switch (type) {
    case 'balance':
    case 'vote':
    case 'battle':
      return {
        mainDoc: { ...base, title: content.title || '', desc: content.desc || '', options: optionList(content.options) },
        secretDoc: null,
      };

    case 'ox':
      return {
        mainDoc:   { ...base, title: content.title || '', desc: content.desc || '' },
        secretDoc: { answer: content.answer || '', explanation: content.explanation || '' },
      };

    case 'quiz':
      return {
        mainDoc: { ...base, title: content.title || '', desc: content.desc || '', quizMode: 'multiple', options: Array.isArray(content.options) ? content.options : [] },
        secretDoc: { quizMode: 'multiple', answerIdx: typeof content.answerIdx === 'number' ? content.answerIdx : 0, explanation: content.explanation || '' },
      };

    case 'acrostic': {
      const keyword = content.keyword || '';
      return {
        mainDoc:   { ...base, title: `'${keyword}' 삼행시 도전!`, keyword, desc: content.desc || '' },
        secretDoc: null,
      };
    }

    case 'cbattle':
      return {
        mainDoc:   { ...base, title: content.title || '', desc: content.desc || '', howto: content.howto || '' },
        secretDoc: null,
      };

    case 'laugh': {
      const validDifficulties = ['easy', 'normal', 'hard', 'extreme'];
      return {
        mainDoc: { ...base, title: content.title || '', desc: content.desc || '', difficulty: validDifficulties.includes(content.difficulty) ? content.difficulty : 'normal' },
        secretDoc: null,
      };
    }

    case 'howto':
      return {
        mainDoc: { ...base, title: content.title || '', summary: content.summary || '', desc: content.desc || '', steps: Array.isArray(content.steps) ? content.steps : [], materials: content.materials || '', caution: content.caution || '' },
        secretDoc: null,
      };

    case 'story':
      return {
        mainDoc:   { ...base, title: content.title || '', desc: content.desc || '', feeling: content.feeling || '' },
        secretDoc: null,
      };

    case 'fail':
      return {
        mainDoc:   { ...base, title: content.title || '', desc: content.desc || '', lesson: content.lesson || '', redo: content.redo || '' },
        secretDoc: null,
      };

    case 'relay':
      return {
        mainDoc:   { ...base, title: content.title || '', desc: content.desc || '', startSentence: content.startSentence || '', characters: content.characters || '' },
        secretDoc: null,
      };

    default: // naming, drip, concern + any unknown
      return {
        mainDoc:   { ...base, title: content.title || '', desc: content.desc || '' },
        secretDoc: null,
      };
  }
}

async function generateDailyAiContent() {
  const today     = getTodayKST();
  const dayOfYear = getDayOfYear();
  const { type, cat } = POST_TYPES[dayOfYear % 15];

  console.log(`[ai-content] date=${today} type=${type} cat=${cat}`);

  const markerRef  = db.collection('system_jobs').doc(`ai_content_${today}_${type}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) {
    console.log(`[ai-content] Already generated for date=${today} type=${type}, skipping.`);
    return;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: buildPrompt(type) }],
  });

  const rawText = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
  console.log(`[ai-content] response (type=${type}):`, rawText.slice(0, 200));

  const content               = parseContent(rawText);
  const { mainDoc, secretDoc } = buildFeedDoc(type, cat, content, today);

  const feedRef = db.collection('feeds').doc();

  await Promise.all([
    feedRef.set(mainDoc),
    secretDoc ? feedRef.collection('secret').doc('answer').set(secretDoc) : null,
  ].filter(Boolean));

  await markerRef.set({ date: today, type, cat, docId: feedRef.id, createdAt: FieldValue.serverTimestamp() });

  console.log(`[ai-content] saved feeds/${feedRef.id} type=${type}`);
  return feedRef.id;
}

exports.dailyAiContent = onSchedule(
  {
    schedule:       '0 9 * * *',
    timeZone:       'Asia/Seoul',
    region:         'asia-northeast3',
    memory:         '256MiB',
    timeoutSeconds: 120,
    secrets:        ['ANTHROPIC_API_KEY'],
  },
  async () => {
    try {
      await generateDailyAiContent();
    } catch (err) {
      console.error('[ai-content] Error:', err);
      throw err;
    }
  }
);
