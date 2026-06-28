'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_PRESETS = ['judgment', 'consult', 'vote', 'drip'];

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
    judgment: pick([
      { title: '친구가 약속 30분 전에 또 취소함', desc: '이번 달에만 세 번째입니다. 사정은 있다는데 제 시간도 소중한 거 아닌가요? 이거 제가 예민한 건지 판결 부탁합니다.', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '약속'] },
      { title: '단톡방에서 대답 안 하면 서운한가요?', desc: '읽은 사람은 많은데 아무도 답이 없습니다. 저만 괜히 민망한 건지, 단톡방 예절이 원래 이런 건지 판결 부탁합니다.', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '관계'] },
    ]),
    consult: pick([
      { title: '장바구니가 저를 부릅니다', desc: '며칠째 장바구니에서 손짓하는 물건이 있습니다. 사도 되는지 말려야 하는지 상담 부탁합니다.', topic: 'money', style: 'choice', tags: ['상담', '선택'] },
      { title: '이거 제가 너무 신경 쓰는 건가요?', desc: '별일 아닌 것 같은데 계속 머릿속에 남습니다. 공감, 현실조언, 웃긴 해결책 다 받습니다.', topic: 'daily', style: 'funny', tags: ['상담', '고민'] },
    ]),
    vote: pick([
      { title: '먼저 연락한다 vs 그냥 둔다', desc: '한동안 연락이 뜸한 친구에게 먼저 연락하는 게 좋을까요, 아니면 그냥 자연스럽게 두는 게 좋을까요?', options: ['찬성', '반대'], tags: ['토론', '관계'] },
      { title: '주말 아침 알람 맞추는 사람 이해된다?', desc: '쉬는 날에도 하루를 길게 쓰려고 알람을 맞추는 사람이 있습니다. 부지런함일까요, 주말을 너무 빡세게 쓰는 걸까요?', options: ['찬성', '반대'], tags: ['토론', '주말'] },
    ]),
    drip: pick([
      { topic: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?', tags: ['드립', '직장인'] },
      { topic: '배달 예상 시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
    ]),
  };
  return map[preset] || map.judgment;
}

const PROMPTS = {
  judgment: '소소킹 판결 게임에 올릴 사소한 생활 사건 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 글쓴이가 예민함, 상대가 선 넘음, 둘 다 문제 있음.',
  consult: '소소킹 상담 게임에 올릴 작은 고민 1개를 JSON만 출력해. 필드: title, desc, topic, style, tags. 웃기지만 선을 지키는 상담 소재.',
  vote: '소소킹 토론 게임에 올릴 찬반 주제 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 찬성, 반대.',
  drip: '소소킹 드립 게임에 올릴 드립 주제 1개를 JSON만 출력해. 필드: topic, tags. 사람들이 한 줄 드립으로 답할 수 있는 주제.',
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
      messages: [{ role: 'user', content: PROMPTS[preset] || PROMPTS.judgment }],
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
  const isJudgment = preset === 'judgment';
  const isConsult = preset === 'consult';
  const isVote = preset === 'vote';
  const isDrip = preset === 'drip';
  const typeLabel = isJudgment ? '판결' : isConsult ? '상담' : isVote ? '토론' : '드립';
  const desc = isDrip ? clean(content.topic || content.desc || content.title, 80) : cleanMultiline(content.desc, 1200);
  const post = {
    type: 'multi',
    cat: 'multi',
    subtype: preset,
    feedType: isJudgment || isVote ? 'vote' : isDrip ? 'drip' : 'collect',
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

  if (isJudgment || isVote) {
    const fallback = isJudgment ? ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'] : ['찬성', '반대'];
    const opts = Array.isArray(content.options) ? content.options.map(v => clean(typeof v === 'object' ? v.text : v, 80)).filter(Boolean).slice(0, isJudgment ? 3 : 2) : fallback;
    const safeOpts = opts.length >= 2 ? opts : fallback;
    post.modules.vote = {
      enabled: true,
      voteMode: isJudgment ? 'judgment' : 'pros_cons',
      question: desc || post.title,
      options: safeOpts.map(text => ({ text, votes: 0 })),
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

  return { post, secretDoc: null };
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
  const daySeed = Number(date.replace(/-/g, '')) || 0;
  const presets = Array.from({ length: count }, (_, index) => DAILY_PRESETS[(daySeed + index) % DAILY_PRESETS.length]);
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
