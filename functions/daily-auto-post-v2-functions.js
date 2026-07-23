'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const MODEL = 'gemini-2.5-flash';
const PRESETS = ['judgment', 'consult', 'vote', 'drip'];

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
  return [...(Array.isArray(value) ? value : []), ...fallback]
    .map(tag => clean(tag, 20).replace(/^#/, ''))
    .filter(Boolean)
    .filter((tag, index, self) => self.indexOf(tag) === index)
    .slice(0, 8);
}

async function getSettings() {
  const snap = await db.doc('site_settings/config').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    enabled: data.aiAutoContentEnabled !== false,
    dailyCount: Math.max(0, Math.min(3, Number(data.aiAutoPostCount ?? 3))),
  };
}

function fallbackContent(preset, date) {
  const seed = Number(String(date).replace(/-/g, '')) || Date.now();
  const pick = list => list[seed % list.length];
  const content = {
    judgment: [
      { title: '친구가 약속 30분 전에 또 취소함', desc: '이번 달에만 세 번째입니다. 사정은 있다는데 제 시간도 소중한 거 아닌가요? 가볍게 판결 부탁합니다.', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '약속'] },
      { title: '단톡방에서 대답 안 하면 서운한가요?', desc: '읽은 사람은 많은데 아무도 답이 없습니다. 저만 괜히 민망한 건지 단톡방 예절이 원래 이런 건지 궁금합니다.', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '관계'] },
      { title: '공용 냉장고에 이름 안 쓴 음료, 마셔도 되나요?', desc: '며칠째 그대로 있는 음료를 누군가 마셨습니다. 방치한 사람이 문제인지 마신 사람이 문제인지 판결해주세요.', options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'], tags: ['판결', '직장'] },
    ],
    consult: [
      { title: '장바구니가 저를 부릅니다', desc: '며칠째 장바구니에서 손짓하는 물건이 있습니다. 사도 되는지 말려야 하는지 상담 부탁합니다.', topic: 'money', style: 'choice', tags: ['상담', '선택'] },
      { title: '별일 아닌데 계속 신경 쓰입니다', desc: '상대는 아무 뜻 없이 한 말 같은데 계속 머릿속에 남습니다. 공감과 현실적인 조언을 모두 듣고 싶어요.', topic: 'people', style: 'realistic', tags: ['상담', '관계'] },
      { title: '쉬어도 쉬는 것 같지 않아요', desc: '주말 내내 쉬었는데 월요일을 생각하면 벌써 피곤합니다. 부담 없이 해볼 수 있는 작은 방법이 있을까요?', topic: 'work', style: 'soft', tags: ['상담', '휴식'] },
    ],
    vote: [
      { title: '먼저 연락한다 vs 그냥 둔다', desc: '한동안 연락이 뜸한 친구에게 먼저 연락하는 게 좋을까요, 아니면 자연스럽게 두는 게 좋을까요?', options: ['먼저 연락한다', '그냥 둔다'], tags: ['토론', '관계'] },
      { title: '주말 아침에도 알람을 맞춰야 한다?', desc: '쉬는 날을 길게 쓰기 위해 알람을 맞추는 것은 부지런함일까요, 휴식 방해일까요?', options: ['알람을 맞춘다', '자연스럽게 일어난다'], tags: ['토론', '주말'] },
      { title: '메신저 답장은 확인 즉시 해야 한다?', desc: '읽었지만 나중에 답하고 싶은 사람과 바로 답을 원하는 사람 중 어느 쪽 기준이 더 합리적일까요?', options: ['확인하면 바로 답한다', '여유 있을 때 답한다'], tags: ['토론', '메신저'] },
    ],
    drip: [
      { topic: '퇴근 5분 전에 회의가 잡혔을 때 한마디는?', tags: ['드립', '직장인'] },
      { topic: '배달 예상 시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
      { topic: '알람 다섯 개를 끄고 다시 눈을 감은 사람의 명대사는?', tags: ['드립', '아침'] },
    ],
  };
  return pick(content[preset] || content.judgment);
}

const PROMPTS = {
  judgment: '소소킹 판결 게시글에 올릴 사소한 생활 사건 1개를 JSON으로 작성하세요. 필드: title, desc, options, tags. options는 서로 겹치지 않는 3개 판정 선택지입니다.',
  consult: '소소킹 상담 게시글에 올릴 현실적인 작은 고민 1개를 JSON으로 작성하세요. 필드: title, desc, topic, style, tags. 과도하게 무겁거나 전문 치료가 필요한 소재는 피하세요.',
  vote: '소소킹 토론 게시글에 올릴 생활 밀착형 양자택일 주제 1개를 JSON으로 작성하세요. 필드: title, desc, options, tags. options는 명확한 2개 선택지입니다.',
  drip: '소소킹 드립 게시글에 올릴 한 줄 드립 주제 1개를 JSON으로 작성하세요. 필드: topic, tags. 사람들이 바로 한 줄로 받아칠 수 있는 구체적인 상황이어야 합니다.',
};

async function makeContent(preset, date) {
  let content = fallbackContent(preset, date);
  let source = 'fallback';
  let apiKey = '';
  try { apiKey = String(geminiKey.value() || '').trim(); } catch {}
  if (!apiKey) return { content, source: 'fallback-no-key' };

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const prompt = `${PROMPTS[preset] || PROMPTS.judgment}\n오늘 날짜는 ${date}입니다. 이미 본 듯한 상투적인 제목, 치킨 마지막 조각, 민트초코 같은 반복 소재를 피하고 구체적인 생활 장면을 사용하세요. JSON 이외의 텍스트는 출력하지 마세요.`;
    const result = await model.generateContent(prompt);
    const parsed = parseJson(result.response.text());
    if (parsed) {
      content = parsed;
      source = 'gemini';
    }
  } catch (error) {
    console.error('[daily-auto-post-v2] fallback', preset, error);
    source = 'fallback-error';
  }
  return { content, source };
}

function buildPost(preset, content, date, source) {
  const isJudgment = preset === 'judgment';
  const isConsult = preset === 'consult';
  const isVote = preset === 'vote';
  const isDrip = preset === 'drip';
  const typeLabel = isJudgment ? '판결' : isConsult ? '상담' : isVote ? '토론' : '드립';
  const desc = isDrip ? clean(content.topic || content.desc || content.title, 100) : cleanMultiline(content.desc, 1200);
  const post = {
    type: 'multi',
    cat: 'multi',
    subtype: preset,
    feedType: isJudgment || isVote ? 'vote' : isDrip ? 'drip' : 'collect',
    typeLabel,
    title: isDrip ? clean(content.title || '오늘의 드립 주제', 100) : clean(content.title || `${typeLabel} AI 글`, 100),
    desc,
    tags: tags(content.tags, [typeLabel, '소소킹']),
    images: [],
    modules: { comments: { enabled: true } },
    anonymous: false,
    anonymousMode: '',
    authorId: 'sosoking-ai',
    authorName: source === 'gemini' ? '소소킹AI 🤖' : '소소킹 운영봇',
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
    const limit = isJudgment ? 3 : 2;
    const values = Array.isArray(content.options)
      ? content.options.map(value => clean(typeof value === 'object' ? value.text : value, 80)).filter(Boolean).slice(0, limit)
      : [];
    const safeOptions = values.length === limit ? values : fallback;
    post.modules.vote = {
      enabled: true,
      voteMode: isJudgment ? 'judgment' : 'pros_cons',
      question: desc || post.title,
      options: safeOptions.map(text => ({ text, votes: 0 })),
    };
  }

  if (isConsult) {
    const topic = clean(content.topic || 'daily', 40);
    const style = clean(content.style || 'realistic', 40);
    post.modules.consult = {
      enabled: true,
      topic,
      topicLabel: ({ daily: '일상', people: '관계', work: '직장/학교', money: '소비/선택', vent: '하소연' })[topic] || '일상',
      style,
      styleLabel: ({ empathy: '공감', realistic: '현실조언', choice: '선택도움', soft: '순한맛', funny: '웃긴해결' })[style] || '현실조언',
      question: desc,
    };
  }

  if (isDrip) {
    post.modules.drip = { enabled: true, prompt: desc, maxLength: 50, responseLabel: '한 줄 드립' };
  }
  return post;
}

async function createOne(preset, date) {
  const { content, source } = await makeContent(preset, date);
  const post = buildPost(preset, content, date, source);
  const ref = db.collection('feeds').doc();
  await ref.set(post);
  return { preset, docId: ref.id, title: post.title, source };
}

async function dailyAutoPostJob() {
  const config = await getSettings();
  if (!config.enabled || config.dailyCount <= 0) return { skipped: true, reason: 'disabled' };

  const date = todayKST();
  const markerRef = db.doc(`system_jobs/daily_auto_posts_${date}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return { skipped: true, reason: 'already-created', date };

  const daySeed = Number(date.replace(/-/g, '')) || 0;
  const selected = Array.from({ length: config.dailyCount }, (_, index) => PRESETS[(daySeed + index) % PRESETS.length]);
  const results = [];
  for (const preset of selected) results.push(await createOne(preset, date));
  await markerRef.set({ date, count: results.length, results, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, date, count: results.length, results };
}

module.exports = {
  dailyAiContent: onSchedule({
    schedule: '0 9 * * *',
    timeZone: 'Asia/Seoul',
    region: REGION,
    secrets: [geminiKey],
    memory: '512MiB',
    timeoutSeconds: 180,
  }, async () => dailyAutoPostJob()),
};
