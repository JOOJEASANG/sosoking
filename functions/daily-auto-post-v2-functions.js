'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const PRESETS = ['judgment', 'consult', 'vote', 'drip'];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function clean(value, max = 1000) {
  return String(value || '').replace(/[<>]/g, '').replace(/\r/g, '').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, max);
}

function parseJson(value) {
  const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function settings() {
  const snap = await db.doc('site_settings/config').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    enabled: data.aiAutoContentEnabled === true,
    dailyCount: Math.max(0, Math.min(3, Number(data.aiAutoPostCount || 0))),
  };
}

function fallback(preset, date) {
  const seed = Number(date.replace(/-/g, '')) || 0;
  const values = {
    judgment: [
      { title: '약속 직전에 또 취소한 친구', desc: '이번 달에만 세 번째입니다. 사정은 이해하지만 제 시간도 소중한데 제가 예민한 걸까요?', tags: ['판결', '약속'] },
      { title: '단톡방에서 제 말만 답이 없어요', desc: '읽은 사람은 많은데 아무도 답하지 않았습니다. 저만 서운한 건지 단톡방에서는 흔한 일인지 궁금합니다.', tags: ['판결', '관계'] },
    ],
    consult: [
      { title: '별일 아닌데 계속 신경 쓰입니다', desc: '상대는 별뜻 없이 한 말 같은데 계속 머릿속에 남습니다. 마음을 정리하고 다음 행동을 정하고 싶어요.', tags: ['상담', '관계'], topic: 'people', style: 'realistic' },
      { title: '쉬어도 쉬는 것 같지 않아요', desc: '주말 내내 쉬었는데 월요일 생각만 하면 피곤합니다. 부담 없이 시작할 수 있는 작은 방법이 있을까요?', tags: ['상담', '휴식'], topic: 'work', style: 'soft' },
    ],
    vote: [
      { title: '메신저 답장은 확인 즉시 해야 한다?', desc: '읽었지만 여유 있을 때 답하고 싶은 사람과 바로 답을 원하는 사람 중 어느 기준이 더 합리적일까요?', tags: ['토론', '메신저'] },
      { title: '쉬는 날에도 알람을 맞춰야 한다?', desc: '하루를 길게 쓰기 위해 알람을 맞추는 것은 부지런함일까요, 휴식을 방해하는 습관일까요?', tags: ['토론', '주말'] },
    ],
    drip: [
      { title: '오늘의 드립 주제', desc: '퇴근 5분 전에 회의가 잡혔을 때 한마디는?', tags: ['드립', '직장인'] },
      { title: '오늘의 드립 주제', desc: '배달 예상 시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
    ],
  };
  const list = values[preset] || values.judgment;
  return list[seed % list.length];
}

async function generate(preset, date) {
  let apiKey = '';
  try { apiKey = String(geminiKey.value() || '').trim(); } catch {}
  if (!apiKey) return { source: 'fallback-no-key', data: fallback(preset, date) };
  const label = ({ judgment: '판결', consult: '상담', vote: '토론', drip: '드립' })[preset];
  const extra = preset === 'consult' ? ', "topic":"daily|people|work|money|vent", "style":"empathy|realistic|choice|soft|funny"' : '';
  const prompt = `소소킹 ${label} 커뮤니티에 올릴 생활 밀착형 게시글 한 개를 작성하세요.
- 실명, 정치, 선정적 소재, 전문 의료·법률 판단 제외
- 제목 60자 이내, 설명 500자 이내, 태그 2~5개
- 반복적이고 상투적인 소재를 피하기
- JSON만 출력
형식: {"title":"","desc":"","tags":[""]${extra}}`;
  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    });
    const result = await model.generateContent(prompt);
    const data = parseJson(result.response.text());
    if (data?.title && data?.desc) return { source: 'gemini', data };
  } catch (error) {
    console.error('[daily-community-post]', preset, error);
  }
  return { source: 'fallback-error', data: fallback(preset, date) };
}

function buildPost(preset, generated, date) {
  const data = generated.data || fallback(preset, date);
  const label = ({ judgment: '판결', consult: '상담', vote: '토론', drip: '드립' })[preset];
  const title = clean(data.title || `${label} AI 글`, 100);
  const desc = clean(data.desc, 1200);
  const tags = [...(Array.isArray(data.tags) ? data.tags : []), label, '소소킹']
    .map(tag => clean(tag, 20).replace(/^#/, '')).filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index).slice(0, 8);
  const modules = { comments: { enabled: true } };
  if (preset === 'judgment') modules.vote = { enabled: true, voteMode: 'judgment', question: desc, options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'].map(text => ({ text, votes: 0 })) };
  if (preset === 'vote') modules.vote = { enabled: true, voteMode: 'pros_cons', question: desc, options: ['찬성', '반대'].map(text => ({ text, votes: 0 })) };
  if (preset === 'consult') {
    const topic = ['daily', 'people', 'work', 'money', 'vent'].includes(data.topic) ? data.topic : 'daily';
    const style = ['empathy', 'realistic', 'choice', 'soft', 'funny'].includes(data.style) ? data.style : 'realistic';
    modules.consult = { enabled: true, topic, style, question: desc };
  }
  if (preset === 'drip') modules.drip = { enabled: true, prompt: desc, maxLength: 50, responseLabel: '한 줄 드립' };
  return {
    type: 'multi', cat: 'community', subtype: preset,
    feedType: preset === 'drip' ? 'drip' : preset === 'consult' ? 'consult' : 'vote',
    typeLabel: label, title, desc, tags, images: [], modules,
    authorId: 'sosoking-ai', authorName: '소소킹 AI', authorPhoto: '', authorEmail: '',
    reactions: { total: 0, like: 0, funny: 0, fire: 0, skull: 0 },
    commentCount: 0, viewCount: 0, pointsScore: 0, hidden: false,
    isAiGenerated: true, aiGeneratedDate: date, aiSource: generated.source, aiPreset: preset,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
}

async function createOne(preset, date) {
  const generated = await generate(preset, date);
  const post = buildPost(preset, generated, date);
  const ref = db.collection('feeds').doc();
  await ref.create(post);
  return { preset, postId: ref.id, title: post.title, source: generated.source };
}

async function runDaily() {
  const config = await settings();
  if (!config.enabled || config.dailyCount <= 0) return { skipped: true, reason: 'disabled' };
  const date = todayKST();
  const markerRef = db.doc(`system_jobs/daily_auto_posts_${date}`);
  const marker = await markerRef.get();
  if (marker.exists) return { skipped: true, reason: 'already-created', date };
  const seed = Number(date.replace(/-/g, '')) || 0;
  const selected = Array.from({ length: config.dailyCount }, (_, index) => PRESETS[(seed + index) % PRESETS.length]);
  const results = [];
  for (const preset of selected) results.push(await createOne(preset, date));
  await markerRef.create({ date, count: results.length, results, createdAt: FieldValue.serverTimestamp() });
  return { ok: true, date, count: results.length, results };
}

module.exports = {
  dailyAiContent: onSchedule({
    schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION,
    secrets: [geminiKey], memory: '512MiB', timeoutSeconds: 180,
  }, runDaily),
};
