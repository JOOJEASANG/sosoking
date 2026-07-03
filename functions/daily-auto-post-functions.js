'use strict';

const { randomInt } = require('crypto');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const DAILY_PRESETS = ['judgment', 'consult', 'vote', 'drip'];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function makeRunSeed() {
  return `${Date.now()}-${randomInt(100000, 999999)}`;
}

function pickRandom(list) {
  return list[randomInt(0, list.length)];
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

async function getSettings() {
  const snap = await db.doc('site_settings/dailyAutoPost').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    enabled: data.enabled !== false,
    dailyCount: Math.max(0, Math.min(Number(data.dailyCount || 3), 3)),
  };
}

async function loadRecentTitles(limit = 20) {
  try {
    const snap = await db.collection('feeds').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(doc => clean(doc.data().title, 80)).filter(Boolean);
  } catch {
    return [];
  }
}

function fallbackContent(preset) {
  const map = {
    judgment: [
      { title: '친구가 약속 시간에 항상 10분씩 늦습니다', desc: '본인은 10분은 늦은 것도 아니라고 합니다. 여러분 기준으로 이건 용서 가능한가요?', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '약속'] },
      { title: '마지막 치킨 조각을 말없이 먹은 사람', desc: '같이 시킨 치킨의 마지막 한 조각을 아무 말 없이 먹었습니다. 이건 유죄일까요?', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '음식'] },
      { title: '단톡방 공지 읽고도 아무도 답이 없습니다', desc: '중요한 공지를 올렸는데 읽은 사람은 많은데 답이 없습니다. 이건 누구 잘못일까요?', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '단톡방'] },
      { title: '빌린 충전기를 자꾸 안 돌려주는 친구', desc: '빌려간 건 맞는데 본인은 잠깐 보관 중이라고 합니다. 이 정도면 판정이 필요합니다.', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '친구'] },
      { title: '같이 먹자고 산 과자를 혼자 거의 다 먹었습니다', desc: '상대는 맛있어서 그랬다고 합니다. 이건 귀여운 실수일까요 선 넘은 행동일까요?', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '과자'] },
    ],
    consult: [
      { title: '장바구니가 저를 부릅니다', desc: '며칠째 장바구니에서 손짓하는 물건이 있습니다. 사도 되는지 말려야 하는지 상담 부탁합니다.', topic: 'money', style: 'choice', tags: ['상담', '선택'] },
      { title: '이거 제가 너무 신경 쓰는 건가요?', desc: '별일 아닌 것 같은데 계속 머릿속에 남습니다. 공감, 현실조언, 웃긴 해결책 다 받습니다.', topic: 'daily', style: 'funny', tags: ['상담', '고민'] },
      { title: '답장을 바로 해야 마음이 편한 편입니다', desc: '상대는 여유롭게 답하는 스타일인데 저는 계속 신경 쓰입니다. 어떻게 받아들이면 좋을까요?', topic: 'people', style: 'empathy', tags: ['상담', '관계'] },
      { title: '오늘 할 일을 내일의 저에게 넘겼습니다', desc: '내일의 저는 과연 용서해줄까요? 미루는 습관을 웃기게라도 고치고 싶습니다.', topic: 'work', style: 'funny', tags: ['상담', '미루기'] },
      { title: '작은 소비인데 자꾸 마음에 걸립니다', desc: '커피 한 잔, 간식 하나도 쌓이면 크다는 걸 아는데 또 사고 싶습니다.', topic: 'money', style: 'choice', tags: ['상담', '소비'] },
    ],
    vote: [
      { title: '먼저 연락한다 vs 그냥 둔다', desc: '한동안 연락이 뜸한 친구에게 먼저 연락하는 게 좋을까요, 아니면 그냥 자연스럽게 두는 게 좋을까요?', options: ['찬성', '반대'], tags: ['토론', '관계'] },
      { title: '주말 아침 알람 맞추는 사람 이해된다?', desc: '쉬는 날에도 하루를 길게 쓰려고 알람을 맞추는 사람이 있습니다. 부지런함일까요, 너무 빡센 걸까요?', options: ['찬성', '반대'], tags: ['토론', '주말'] },
      { title: '점심 메뉴는 빨리 정하는 게 좋다?', desc: '고민이 길수록 점심시간이 줄어듭니다. 빠른 결정이 답일까요?', options: ['찬성', '반대'], tags: ['토론', '점심'] },
      { title: '메신저 답장은 빠를수록 좋다?', desc: '빠른 답장이 예의인지, 각자 속도를 존중해야 하는지 골라주세요.', options: ['찬성', '반대'], tags: ['토론', '메신저'] },
      { title: '퇴근 후 연락은 업무가 아니면 안 하는 게 맞다?', desc: '퇴근 후에도 가벼운 연락은 괜찮을까요, 아니면 완전한 개인시간일까요?', options: ['찬성', '반대'], tags: ['토론', '퇴근'] },
    ],
    drip: [
      { topic: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?', tags: ['드립', '직장인'] },
      { topic: '배달 예상 시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
      { topic: '냉장고를 열었는데 먹을 게 없을 때 나오는 한마디는?', tags: ['드립', '일상'] },
      { topic: '월급날 하루 뒤 통장을 본 사람의 반응은?', tags: ['드립', '월급'] },
      { topic: '월요일 아침 알람에게 보내는 한 줄 편지는?', tags: ['드립', '월요일'] },
    ],
  };
  return pickRandom(map[preset] || map.judgment);
}

const PROMPTS = {
  judgment: '소소킹 판결방에 올릴 사소한 생활 사건 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 글쓴이가 예민함, 상대가 선 넘음, 둘 다 문제 있음.',
  consult: '소소킹 상담 게시글에 올릴 작은 고민 1개를 JSON만 출력해. 필드: title, desc, topic, style, tags. 웃기지만 선을 지키는 상담 소재.',
  vote: '소소킹 토론방에 올릴 찬반 주제 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 찬성, 반대.',
  drip: '소소킹 드립방에 올릴 드립 주제 1개를 JSON만 출력해. 필드: topic, tags. 사람들이 한 줄 드립으로 답할 수 있는 주제.',
};

async function makeContent(preset, date, runSeed) {
  let content = fallbackContent(preset);
  let source = 'fallback';
  const apiKey = ANTHROPIC_API_KEY.value();
  if (!apiKey) return { content, source, reason: 'no-key' };
  try {
    const recentTitles = await loadRecentTitles(20);
    const prompt = `${PROMPTS[preset] || PROMPTS.judgment}\n\n중복 방지 규칙:\n- 아래 최근 제목과 같은 소재, 같은 제목, 같은 상황을 절대 쓰지 마.\n- 같은 날짜에도 매번 새로운 상황과 표현을 써.\n- 랜덤 시드: ${runSeed}\n- 오늘 날짜: ${date}\n최근 제목: ${recentTitles.length ? recentTitles.join(' / ') : '없음'}`;
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.9,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = parseJson(msg.content.filter(block => block.type === 'text').map(block => block.text).join(''));
    if (parsed) { content = parsed; source = 'ai'; }
  } catch (error) {
    console.error('[daily-auto-posts] fallback', preset, error);
  }
  return { content, source, reason: source === 'ai' ? 'ai-ok' : 'ai-fallback' };
}

function buildPost(preset, content, date, source, runSeed) {
  const isJudgment = preset === 'judgment';
  const isConsult = preset === 'consult';
  const isVote = preset === 'vote';
  const isDrip = preset === 'drip';
  const title = isDrip ? '오늘의 드립 주제' : clean(content.title || '오늘의 소소 주제', 100);
  const desc = cleanMultiline(isDrip ? (content.topic || content.desc || '') : (content.desc || ''), 1200);
  const post = {
    type: 'multi',
    cat: 'multi',
    subtype: isJudgment ? 'judgment' : preset,
    feedType: isVote ? 'vote' : isDrip ? 'drip' : 'collect',
    typeLabel: isJudgment ? '판결방' : isConsult ? '병맛상담' : isVote ? '토론방' : '드립방',
    title,
    desc,
    tags: Array.isArray(content.tags) ? content.tags.map(v => clean(v, 20)).filter(Boolean).slice(0, 8) : ['소소킹'],
    images: [],
    modules: { comments: { enabled: true } },
    deadline: { enabled: false, mode: 'none', status: 'open' },
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
    aiRunSeed: runSeed,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (isJudgment || isVote) {
    const fallback = isJudgment ? ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'] : ['찬성', '반대'];
    const rawOptions = Array.isArray(content.options) ? content.options : fallback;
    const options = rawOptions.map(v => clean(typeof v === 'object' ? v.text : v, 80)).filter(Boolean).slice(0, isJudgment ? 3 : 2);
    post.modules.vote = {
      enabled: true,
      voteMode: isJudgment ? 'judgment' : 'pros_cons',
      question: desc || post.title,
      options: (options.length >= 2 ? options : fallback).map(text => ({ text, votes: 0 })),
    };
  }

  if (isConsult) {
    const topic = clean(content.topic || 'daily', 40);
    const style = clean(content.style || 'funny', 40);
    post.modules.consult = {
      enabled: true,
      topic,
      topicLabel: ({ daily: '일상', people: '관계', work: '직장/학교', money: '소비/선택', vent: '하소연' })[topic] || '일상',
      style,
      styleLabel: ({ empathy: '공감', realistic: '현실조언', choice: '선택도움', soft: '순한맛', funny: '웃긴해결' })[style] || '웃긴해결',
      question: desc,
    };
  }

  if (isDrip) {
    post.modules.drip = { enabled: true, prompt: desc, maxLength: 50, responseLabel: '한 줄 드립' };
  }

  return post;
}

async function createOne(preset, date) {
  const runSeed = makeRunSeed();
  const { content, source, reason } = await makeContent(preset, date, runSeed);
  const post = buildPost(preset, content, date, source, runSeed);
  const ref = db.collection('feeds').doc();
  await ref.set(post);
  return { preset, docId: ref.id, title: post.title, source, reason, runSeed };
}

async function dailyAutoPostJob() {
  const settings = await getSettings();
  if (!settings.enabled || settings.dailyCount <= 0) return { skipped: true, reason: 'disabled' };
  const date = todayKST();
  const markerRef = db.doc(`system_jobs/daily_auto_posts_${date}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return { skipped: true, reason: 'already-created', date };

  const count = Math.min(settings.dailyCount || 3, 3);
  const daySeed = Number(date.replace(/-/g, '')) || 0;
  const presets = Array.from({ length: count }, (_, index) => DAILY_PRESETS[(daySeed + index) % DAILY_PRESETS.length]);
  const results = [];
  for (const preset of presets) results.push(await createOne(preset, date));
  await markerRef.set({ date, count: results.length, results, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, date, count: results.length, results };
}

module.exports = {
  dailyAiContent: onSchedule({
    schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '512MiB', timeoutSeconds: 180,
    secrets: [ANTHROPIC_API_KEY],
  }, async () => dailyAutoPostJob()),
};
