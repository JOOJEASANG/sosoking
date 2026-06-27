'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_PRESETS = ['general', 'vote', 'quiz'];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function clean(value, max = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = 1200) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function tags(value, fallback = []) {
  const source = Array.isArray(value) ? value : [];
  return [...source, ...fallback]
    .map(tag => clean(tag, 20).replace(/^#/, ''))
    .filter(Boolean)
    .filter((tag, index, self) => self.indexOf(tag) === index)
    .slice(0, 8);
}

async function getSettings() {
  const snap = await db.doc('site_settings/config').get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    enabled: data.aiAutoContentEnabled !== false,
    dailyCount: Math.max(0, Math.min(10, Number(data.aiAutoPostCount ?? 3))),
  };
}

function fallbackContent(preset, date) {
  const seed = Number(date.replace(/-/g, '')) || Date.now();
  const pick = list => list[seed % list.length];
  const map = {
    general: pick([
      { title: '오늘 소소하게 웃겼던 순간 하나만 적어보자', desc: '거창한 일 아니어도 괜찮아요. 오늘 피식 웃었던 장면이나 말 한마디를 댓글로 남겨보세요.', tags: ['일상', '소소킹'] },
      { title: '요즘 은근히 자주 하는 작은 습관 있어?', desc: '남들은 별거 아니라고 해도 이상하게 계속 하게 되는 습관을 공유해봐요.', tags: ['공감', '소소킹'] },
    ]),
    vote: pick([
      { title: '오늘 저녁 메뉴 하나만 고른다면?', desc: '지금 기분 기준으로 딱 하나만 골라주세요. 이유도 댓글로 남기면 더 재밌어요.', options: ['치킨', '라면', '피자', '김밥'], tags: ['투표', '음식'] },
      { title: '쉬는 날 제일 좋은 시간대는?', desc: '하루 중 가장 마음 편한 시간을 골라주세요.', options: ['아침', '점심', '저녁', '새벽'], tags: ['투표', '일상'] },
    ]),
    quiz: pick([
      { title: '오늘의 생활 퀴즈', desc: '다음 중 보통 실온 보관이 더 어울리는 식재료는?', mode: 'multiple', noAnswer: false, options: ['토마토', '우유', '생선', '두부'], answerIdx: 0, hint: '식감과 향을 생각해보세요.', explanation: '토마토는 냉장 보관 시 향과 식감이 떨어질 수 있어 실온 보관이 권장되는 경우가 많습니다.', tags: ['퀴즈', '생활상식'] },
      { title: '정답 없는 상상 퀴즈', desc: '하루 동안 모든 사람이 말끝에 ㅋㅋ를 붙여야 한다면 가장 난감한 순간은 언제일까요?', mode: 'subjective', noAnswer: true, hint: '센스가 정답입니다.', explanation: '정답이 없는 생각 퀴즈입니다. 댓글로 자유롭게 이야기해보세요.', tags: ['퀴즈', '상상'] },
    ]),
    drip: pick([
      { topic: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?', tags: ['드립', '직장인'] },
      { topic: '배달 예상 시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
    ]),
  };
  return map[preset] || map.general;
}

const PROMPTS = {
  general: '소소킹 통합 게시판에 올릴 일반글 1개를 JSON만 출력해. 필드: title, desc, tags. 가볍고 댓글을 유도하는 일상형 내용.',
  vote: '소소킹 통합 게시판에 올릴 투표글 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 2~4개.',
  quiz: '소소킹 통합 게시판에 올릴 퀴즈글 1개를 JSON만 출력해. 필드: title, desc, mode, noAnswer, options, answer, answerIdx, hint, explanation, tags.',
  drip: '소소킹 통합 게시판에 올릴 드립 주제 1개를 JSON만 출력해. 필드: topic, tags. 사람들이 한 줄 드립으로 답할 수 있는 주제.',
};

async function makeContent(preset, date) {
  let content = fallbackContent(preset, date);
  let source = 'fallback';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { content, source };
  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: PROMPTS[preset] || PROMPTS.general }],
    });
    const parsed = parseJson(msg.content.filter(block => block.type === 'text').map(block => block.text).join(''));
    if (parsed) {
      content = parsed;
      source = 'ai';
    }
  } catch (error) {
    console.error('[daily-auto-posts] fallback', preset, error);
  }
  return { content, source };
}

function buildPost(preset, content, date, source) {
  const isGeneral = preset === 'general';
  const isVote = preset === 'vote';
  const isQuiz = preset === 'quiz';
  const isDrip = preset === 'drip';
  const typeLabel = isGeneral ? '일반글' : isVote ? '투표' : isQuiz ? '퀴즈' : '드립';
  const subtype = isGeneral ? 'collect' : preset;
  const desc = isDrip ? clean(content.topic || content.desc || content.title, 80) : cleanMultiline(content.desc, 1200);
  const post = {
    type: 'multi',
    cat: 'multi',
    subtype,
    feedType: isGeneral ? 'collect' : preset,
    typeLabel,
    title: isDrip ? '오늘의 드립 주제' : clean(content.title || `${typeLabel} AI 글`, 100),
    desc,
    tags: tags(content.tags, [typeLabel, '소소킹']),
    images: [],
    modules: { comments: { enabled: true } },
    anonymous: false,
    anonymousMode: '',
    authorId: 'sosoking-ai',
    authorName: source === 'ai' ? '소소킹AI 🤖' : '소소킹 운영봇',
    authorPhoto: '',
    authorEmail: '',
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    pointsScore: 0,
    isAiGenerated: true,
    aiGeneratedDate: date,
    aiSource: source,
    aiPreset: preset,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  let secretDoc = null;

  if (isGeneral) {
    post.modules.collect = { enabled: true, kind: 'text', label: '일반글', caption: desc };
  }

  if (isVote) {
    const opts = Array.isArray(content.options) ? content.options.map(v => clean(typeof v === 'object' ? v.text : v, 80)).filter(Boolean).slice(0, 8) : ['찬성', '반대'];
    post.modules.vote = { enabled: true, question: desc || post.title, options: opts.length >= 2 ? opts.map(text => ({ text, votes: 0 })) : [{ text: '찬성', votes: 0 }, { text: '반대', votes: 0 }] };
  }

  if (isDrip) {
    post.modules.drip = { enabled: true, prompt: desc, maxLength: 50, responseLabel: '한 줄 드립' };
  }

  if (isQuiz) {
    const mode = content.mode === 'subjective' ? 'subjective' : 'multiple';
    const noAnswer = content.noAnswer === true;
    const opts = Array.isArray(content.options) ? content.options.map(v => clean(typeof v === 'object' ? v.text : v, 80)).filter(Boolean).slice(0, 6) : ['맞다', '아니다'];
    const safeOpts = opts.length >= 2 ? opts : ['맞다', '아니다'];
    const answerIdx = Math.max(0, Math.min(Number(content.answerIdx || 0), safeOpts.length - 1));
    const answer = clean(content.answer || safeOpts[answerIdx], 120);
    post.modules.quiz = {
      enabled: true,
      mode,
      noAnswer,
      question: desc,
      hint: clean(content.hint, 100),
      explanation: noAnswer ? clean(content.explanation || '정답이 없는 퀴즈입니다. 댓글로 이야기해보세요.', 500) : clean(content.explanation, 500),
    };
    if (mode === 'multiple') post.modules.quiz.options = safeOpts.map(text => ({ text }));
    if (!noAnswer) {
      if (mode === 'multiple') post.modules.quiz.correctIndex = answerIdx;
      else post.modules.quiz.answer = answer;
      secretDoc = {
        quizMode: mode,
        mode,
        answer: mode === 'subjective' ? answer : safeOpts[answerIdx],
        answerIdx: mode === 'multiple' ? answerIdx : null,
        correctIndex: mode === 'multiple' ? answerIdx : null,
        explanation: clean(content.explanation, 500),
        correctCount: 0,
        firstCorrect: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
    }
  }

  return { post, secretDoc };
}

async function createOne(preset, date) {
  const { content, source } = await makeContent(preset, date);
  const { post, secretDoc } = buildPost(preset, content, date, source);
  const ref = db.collection('feeds').doc();
  await Promise.all([
    ref.set(post),
    secretDoc ? ref.collection('secret').doc('answer').set(secretDoc) : null,
  ].filter(Boolean));
  return { preset, docId: ref.id, title: post.title, source };
}

async function dailyAutoPostJob() {
  const settings = await getSettings();
  if (!settings.enabled || settings.dailyCount <= 0) return { skipped: true, reason: 'disabled' };

  const date = todayKST();
  const markerRef = db.doc(`system_jobs/daily_auto_posts_${date}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return { skipped: true, reason: 'already-created', date };

  const count = Math.min(settings.dailyCount || 3, 3);
  const presets = DAILY_PRESETS.slice(0, count);
  const results = [];
  for (const preset of presets) {
    results.push(await createOne(preset, date));
  }
  await markerRef.set({ date, count: results.length, results, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, date, count: results.length, results };
}

module.exports = {
  dailyAiContent: onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '512MiB', timeoutSeconds: 180 }, async () => dailyAutoPostJob()),
};
