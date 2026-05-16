'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';

const POST_TYPES = [
  { type: 'balance',  cat: 'golra' },
  { type: 'vote',     cat: 'golra' },
  { type: 'ox',       cat: 'golra' },
  { type: 'quiz',     cat: 'golra' },
  { type: 'naming',   cat: 'usgyo' },
  { type: 'acrostic', cat: 'usgyo' },
  { type: 'drip',     cat: 'usgyo' },
  { type: 'howto',    cat: 'malhe' },
  { type: 'story',    cat: 'malhe' },
  { type: 'concern',  cat: 'malhe' },
  { type: 'relay',    cat: 'malhe' },
];

function getTodayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getDayOfYear() {
  const [year, month, day] = getTodayKST().split('-').map(Number);
  return Math.floor((new Date(year, month - 1, day) - new Date(year, 0, 1)) / 86400000) + 1;
}

function cleanText(value, max = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function getAiSettings() {
  const snap = await db.doc('site_settings/config').get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    aiAutoContentEnabled: data.aiAutoContentEnabled !== false,
    aiDailyLimit: Math.max(0, Number(data.aiDailyLimit ?? 20)),
    aiAutoPublish: data.aiAutoPublish !== false,
  };
}

async function reserveAiUsage(kind) {
  const today = getTodayKST();
  const settings = await getAiSettings();
  if (!settings.aiAutoContentEnabled && kind === 'daily_content') {
    return { ok: false, reason: 'disabled-by-admin', settings };
  }
  if (settings.aiDailyLimit <= 0) {
    return { ok: false, reason: 'limit-zero', settings };
  }

  const ref = db.doc(`ai_usage/${today}`);
  let reserved = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const used = Number(data.total || 0);
    if (used >= settings.aiDailyLimit) return;
    reserved = true;
    tx.set(ref, {
      date: today,
      total: FieldValue.increment(1),
      [kind]: FieldValue.increment(1),
      limit: settings.aiDailyLimit,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { ok: reserved, reason: reserved ? 'reserved' : 'daily-limit-reached', settings };
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

function buildPrompt(type) {
  const common = `당신은 한국 놀이형 커뮤니티 "소소킹"의 AI 콘텐츠 운영자입니다. 정치, 종교, 혐오, 성적 내용, 위험행동, 실명 비방은 금지입니다. 반드시 JSON 객체만 반환하세요.`;
  const byType = {
    balance: '{"title":"밸런스게임 제목","desc":"상황 설명","options":[{"text":"선택지 A","votes":0},{"text":"선택지 B","votes":0}],"tags":["태그1","태그2"]}',
    vote: '{"title":"투표 제목","desc":"투표 설명","options":[{"text":"선택지1","votes":0},{"text":"선택지2","votes":0},{"text":"선택지3","votes":0}],"tags":["태그1","태그2"]}',
    ox: '{"title":"OX 퀴즈 제목","desc":"참/거짓 문제","answer":"O","explanation":"정답 해설","tags":["태그1","태그2"]}',
    quiz: '{"title":"퀴즈 제목","desc":"문제","quizMode":"multiple","options":["선택지1","선택지2","선택지3","선택지4"],"answerIdx":0,"explanation":"정답 해설","tags":["태그1","태그2"]}',
    naming: '{"title":"작명 챌린지 제목","desc":"상황 설명","tags":["태그1","태그2"]}',
    acrostic: '{"keyword":"2~4글자 키워드","desc":"삼행시 참여 설명","tags":["태그1","태그2"]}',
    drip: '{"title":"드립 배틀 제목","desc":"참여 설명","tags":["태그1","태그2"]}',
    howto: '{"title":"하우투 제목","summary":"한 줄 요약","desc":"소개","steps":["1단계","2단계","3단계"],"materials":"준비물","caution":"주의사항","tags":["태그1","태그2"]}',
    story: '{"title":"이야기 제목","desc":"3~5문장 일상 에피소드","feeling":"느낌","tags":["태그1","태그2"]}',
    concern: '{"title":"고민 제목","desc":"3~5문장 현실적인 고민","tags":["태그1","태그2"]}',
    relay: '{"title":"릴레이 제목","desc":"참여 안내","startSentence":"이어 쓰고 싶은 첫 문장","characters":"등장인물","tags":["태그1","태그2"]}',
  };
  return `${common}\n오늘 만들 콘텐츠 타입: ${type}\n아래 형식으로 재미있고 가볍게 작성하세요.\n${byType[type] || byType.concern}`;
}

function fallbackContent(type, today) {
  const seed = Number(today.replace(/-/g, '')) || Date.now();
  const pick = (arr) => arr[seed % arr.length];
  const baseTags = ['오늘의주제', '소소킹'];
  const fallback = {
    balance: { title: pick(['평생 하나만 가능하다면?', '오늘의 소소 밸런스']), desc: '가볍게 고르고 댓글로 이유를 남겨보세요.', options: [{ text: 'A 선택', votes: 0 }, { text: 'B 선택', votes: 0 }], tags: baseTags },
    vote: { title: pick(['오늘 점심 메뉴 고르기', '주말에 제일 하고 싶은 일은?']), desc: '가장 끌리는 선택지를 골라주세요.', options: [{ text: '맛있는 음식', votes: 0 }, { text: '완전 휴식', votes: 0 }, { text: '가벼운 외출', votes: 0 }], tags: baseTags },
    ox: { title: '오늘의 OX 퀴즈', desc: '아침에 물 한 잔을 마시면 하루 시작에 도움이 된다.', answer: 'O', explanation: '수분 보충은 컨디션 관리에 도움이 됩니다.', tags: baseTags },
    quiz: { title: '소소 상식 퀴즈', desc: '하루 중 가장 집중이 잘 되는 시간은 사람마다 다를까요?', quizMode: 'multiple', options: ['그렇다', '아니다', '항상 새벽이다', '항상 밤이다'], answerIdx: 0, explanation: '생활 패턴과 수면 습관에 따라 집중 시간은 달라질 수 있습니다.', tags: baseTags },
    naming: { title: '오늘 하루를 한 단어로 작명한다면?', desc: '오늘 기분이나 사건을 한 줄 제목으로 붙여보세요.', tags: baseTags },
    acrostic: { keyword: pick(['소소킹', '커피', '퇴근', '라면']), desc: '제시어로 센스 있는 삼행시를 만들어보세요.', tags: baseTags },
    drip: { title: '이 상황에 제일 어울리는 드립은?', desc: '일상에서 갑자기 분위기가 싸해진 순간을 드립으로 살려보세요.', tags: baseTags },
    howto: { title: '기분 전환을 빠르게 하는 방법', summary: '작은 행동으로 분위기 바꾸기', desc: '긴 시간이 없어도 기분을 바꿀 수 있는 방법을 공유해보세요.', steps: ['자리에서 일어나기', '물 한 잔 마시기', '짧게 산책하기'], materials: '', caution: '무리하지 마세요.', tags: baseTags },
    story: { title: '오늘의 소소한 행복', desc: '별일 아닌데 괜히 기분 좋아진 순간이 있나요? 짧게 공유해보세요.', feeling: '작은 순간도 나누면 더 재밌습니다.', tags: baseTags },
    concern: { title: '이럴 때 어떻게 하세요?', desc: '하고 싶은 일은 많은데 막상 시작이 안 되는 날이 있습니다. 여러분은 어떻게 시작하나요?', tags: baseTags },
    relay: { title: '댓글로 이어 쓰는 오늘의 이야기', desc: '한 문장씩 이어서 이야기를 완성해보세요.', startSentence: '문을 열자 생각지도 못한 쪽지가 놓여 있었다.', characters: '나, 수상한 쪽지를 남긴 사람', tags: baseTags },
  };
  return fallback[type] || fallback.concern;
}

function safeArray(value, max = 8) {
  return Array.isArray(value) ? value.slice(0, max).map(v => typeof v === 'object' ? v : String(v || '').slice(0, 80)) : [];
}

function buildFeedDoc(type, cat, content, today, source) {
  const base = {
    type,
    cat,
    authorId: 'sosoking-ai',
    authorName: source === 'ai' ? '소소킹AI 🤖' : '소소킹 운영봇',
    authorPhoto: '',
    images: [],
    tags: safeArray(content.tags, 6).map(String),
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    isAiGenerated: true,
    aiGeneratedDate: today,
    aiSource: source,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const optionList = (arr) => safeArray(arr, 6).map(o => ({ text: String(o.text || o || '').slice(0, 80), votes: Number(o.votes || 0) }));

  switch (type) {
    case 'balance':
    case 'vote':
    case 'battle':
      return { mainDoc: { ...base, title: cleanText(content.title, 100), desc: cleanText(content.desc, 1000), options: optionList(content.options) }, secretDoc: null };
    case 'ox':
      return { mainDoc: { ...base, title: cleanText(content.title, 100), desc: cleanText(content.desc, 1000) }, secretDoc: { answer: String(content.answer || 'O').toUpperCase() === 'X' ? 'X' : 'O', explanation: cleanText(content.explanation, 500) } };
    case 'quiz':
      return { mainDoc: { ...base, title: cleanText(content.title, 100), desc: cleanText(content.desc, 1000), quizMode: 'multiple', options: safeArray(content.options, 4).map(String) }, secretDoc: { quizMode: 'multiple', answerIdx: Math.max(0, Math.min(3, Number(content.answerIdx || 0))), explanation: cleanText(content.explanation, 500) } };
    case 'acrostic': {
      const keyword = cleanText(content.keyword, 12) || '소소킹';
      return { mainDoc: { ...base, title: `'${keyword}' 삼행시 도전!`, keyword, desc: cleanText(content.desc, 1000) }, secretDoc: null };
    }
    case 'howto':
      return { mainDoc: { ...base, title: cleanText(content.title, 100), summary: cleanText(content.summary, 160), desc: cleanText(content.desc, 1000), steps: safeArray(content.steps, 8).map(String), materials: cleanText(content.materials, 200), caution: cleanText(content.caution, 200) }, secretDoc: null };
    case 'story':
      return { mainDoc: { ...base, title: cleanText(content.title, 100), desc: cleanText(content.desc, 1200), feeling: cleanText(content.feeling, 300) }, secretDoc: null };
    case 'relay':
      return { mainDoc: { ...base, title: cleanText(content.title, 100), desc: cleanText(content.desc, 1000), startSentence: cleanText(content.startSentence, 200), characters: cleanText(content.characters, 200) }, secretDoc: null };
    default:
      return { mainDoc: { ...base, title: cleanText(content.title, 100), desc: cleanText(content.desc, 1000) }, secretDoc: null };
  }
}

async function generateDailyAiContent({ force = false, actorId = 'scheduler' } = {}) {
  const today = getTodayKST();
  const dayOfYear = getDayOfYear();
  const { type, cat } = POST_TYPES[dayOfYear % POST_TYPES.length];
  const markerRef = db.doc(`system_jobs/ai_content_${today}_${type}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && !force) return { skipped: true, reason: 'already-generated', docId: markerSnap.data().docId };

  let content = fallbackContent(type, today);
  let source = 'fallback';
  const usage = await reserveAiUsage('daily_content');
  if (usage.ok && process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 850,
        messages: [{ role: 'user', content: buildPrompt(type) }],
      });
      const rawText = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
      content = parseJson(rawText) || content;
      source = 'ai';
    } catch (error) {
      console.error('[ai-content] AI failed; fallback used', error);
    }
  } else {
    console.log('[ai-content] fallback used:', usage.reason || 'no-key');
  }

  const { mainDoc, secretDoc } = buildFeedDoc(type, cat, content, today, source);
  const feedRef = db.collection('feeds').doc();
  await Promise.all([
    feedRef.set(mainDoc),
    secretDoc ? feedRef.collection('secret').doc('answer').set(secretDoc) : null,
  ].filter(Boolean));

  await markerRef.set({
    date: today,
    type,
    cat,
    docId: feedRef.id,
    source,
    actorId,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, docId: feedRef.id, type, cat, source };
}

exports.dailyAiContent = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 120, secrets: ['ANTHROPIC_API_KEY'] },
  async () => { await generateDailyAiContent(); }
);

exports.generateAiContentNow = onCall(
  { region: REGION, timeoutSeconds: 120, secrets: ['ANTHROPIC_API_KEY'] },
  async (request) => {
    await assertAdmin(request.auth && request.auth.uid);
    return generateDailyAiContent({ force: request.data?.force === true, actorId: request.auth.uid });
  }
);
