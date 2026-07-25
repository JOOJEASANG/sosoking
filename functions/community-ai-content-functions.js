'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const PRESETS = new Set(['judgment', 'consult', 'vote', 'drip']);

const PRESET_GUIDANCE = {
  judgment: '누가 더 잘못했는지 의견이 갈릴 만한 현실적인 생활 갈등을 만든다. 양쪽 사정이 모두 조금씩 이해되게 하고, 디테일 하나로 몰입과 재미를 만든다.',
  consult: '실제로 주변에 있을 법한 고민을 구체적인 장면으로 쓴다. 감정은 진짜 같아야 하며, 너무 무겁지 않은 주제에는 자기객관화가 느껴지는 가벼운 유머를 섞는다.',
  vote: '정답이 뻔하지 않고 댓글에서 논쟁할 기준이 있는 주제를 만든다. 찬반 모두 한마디 할 거리가 있도록 예외 상황이나 현실적 조건을 넣는다.',
  drip: '누구나 장면이 바로 떠오르면서도 뻔하지 않은 상황을 제시한다. 짧고 선명하며 여러 방향의 재치 있는 답이 나올 여지를 남긴다.',
};

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
  const prompt = `한국 온라인 커뮤니티에서 실제 사람이 올린 것처럼 자연스럽고 몰입되는 소소킹 ${label} 게시글 하나를 작성하세요.

주제 방향:
${PRESET_GUIDANCE[preset]}

품질 기준:
- 첫 문장부터 상황이 그려지도록 장소, 대화, 횟수, 금액, 시간 같은 구체적인 디테일을 1~2개 사용
- 뻔한 질문을 반복하지 말고, 댓글을 달고 싶게 만드는 갈등·반전·공감 포인트를 하나 넣기
- 똑똑하고 관찰력이 느껴지지만 작위적이거나 교훈적으로 쓰지 않기
- 실제 한국인이 쓰는 자연스러운 구어체로 작성하고 AI 안내문·기사체·과한 설명체 금지
- 재밌고 유쾌한 말맛을 살리되 고민이나 민감한 상황을 조롱하지 않기
- 제목은 호기심이 생기게 60자 이내, 본문은 120~500자, 태그 2~5개
- 실명, 정치 선동, 폭력 조장, 성적 소재, 혐오, 전문 의료·법률 단정 제외
- JSON만 출력
형식: ${format}`;
  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 768 },
      },
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
