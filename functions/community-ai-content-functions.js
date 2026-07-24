'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const PRESETS = new Set(['judgment', 'consult', 'vote', 'drip']);

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

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
}

function normalizePreset(value) {
  const preset = String(value || 'judgment').trim();
  return PRESETS.has(preset) ? preset : 'judgment';
}

function fallback(preset) {
  return ({
    judgment: { title: '약속을 반복해서 취소한 친구', desc: '이번 달에만 세 번째로 약속 직전에 취소했습니다. 사정은 있다지만 제 시간도 소중한데 제가 예민한 걸까요?', tags: ['판결', '약속'] },
    consult: { title: '별일 아닌데 계속 신경 쓰입니다', desc: '상대는 아무 뜻 없이 한 말 같은데 계속 머릿속에 남습니다. 감정을 정리하고 다음 행동을 정하고 싶어요.', tags: ['상담', '관계'], topic: 'people', style: 'realistic' },
    vote: { title: '메신저 답장은 확인 즉시 해야 한다?', desc: '읽었지만 여유 있을 때 답하고 싶은 사람과 바로 답을 원하는 사람 중 어느 기준이 더 합리적일까요?', tags: ['토론', '메신저'] },
    drip: { title: '오늘의 드립 주제', desc: '퇴근 5분 전에 회의가 잡혔을 때 한마디는?', tags: ['드립', '직장인'] },
  })[preset];
}

async function generate(preset) {
  let apiKey = '';
  try { apiKey = String(geminiKey.value() || '').trim(); } catch {}
  if (!apiKey) return { source: 'fallback-no-key', data: fallback(preset) };
  const label = ({ judgment: '판결', consult: '상담', vote: '토론', drip: '드립' })[preset];
  const format = preset === 'consult'
    ? '{"title":"","desc":"","tags":[""],"topic":"daily|people|work|money|vent","style":"empathy|realistic|choice|soft|funny"}'
    : '{"title":"","desc":"","tags":[""]}';
  const prompt = `소소킹 ${label} 커뮤니티에 올릴 생활 밀착형 게시글 하나를 작성하세요.
- 실명, 정치, 폭력, 성적 소재, 전문 의료·법률 판단 제외
- 지나치게 상투적인 소재 제외
- 제목 60자 이내, 설명 500자 이내, 태그 2~5개
- JSON만 출력
형식: ${format}`;
  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    });
    const result = await model.generateContent(prompt);
    const data = parseJson(result.response.text());
    if (data?.title && data?.desc) return { source: 'gemini', data };
  } catch (error) {
    console.error('[community-ai-content]', error);
  }
  return { source: 'fallback-error', data: fallback(preset) };
}

function buildPost(preset, generated, actorId) {
  const data = generated.data || fallback(preset);
  const label = ({ judgment: '판결', consult: '상담', vote: '토론', drip: '드립' })[preset];
  const title = clean(data.title || fallback(preset).title, 100);
  const desc = clean(data.desc || fallback(preset).desc, 1200);
  const tags = (Array.isArray(data.tags) ? data.tags : [])
    .map(tag => clean(tag, 20).replace(/^#/, '')).filter(Boolean).slice(0, 8);
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
    isAiGenerated: true, aiSource: generated.source, aiPreset: preset, aiActorId: actorId,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
}

async function createOne(preset, actorId) {
  const generated = await generate(preset);
  const post = buildPost(preset, generated, actorId);
  const ref = db.collection('feeds').doc();
  await ref.create(post);
  return { preset, postId: ref.id, title: post.title, source: generated.source };
}

const generateAiContentNow = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 120 }, async request => {
  await assertAdmin(request.auth?.uid);
  return { ok: true, ...(await createOne(normalizePreset(request.data?.preset || request.data?.type), request.auth.uid)) };
});

const generateAllAiContentNow = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300 }, async request => {
  await assertAdmin(request.auth?.uid);
  const results = [];
  for (const preset of PRESETS) results.push(await createOne(preset, request.auth.uid));
  return { ok: true, total: results.length, results };
});

module.exports = { generateAiContentNow, generateAllAiContentNow };
