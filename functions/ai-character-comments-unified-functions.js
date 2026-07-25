'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const MODEL = 'gemini-2.5-flash';

const CHARACTERS = [
  { id: 'minsu', name: '민수', emoji: '😂', role: '드립러', style: '상황의 핵심을 빨리 잡아 생활 비유와 예상 못 한 한마디로 웃긴다.' },
  { id: 'daon', name: '다온', emoji: '❤️', role: '공감러', style: '감정을 정확히 짚고 부담 없는 현실 조언과 따뜻한 유머를 섞는다.' },
  { id: 'jieun', name: '지은', emoji: '🧠', role: '분석러', style: '남들이 놓친 원인이나 기준을 짧고 똑똑하게 짚고 선명한 비유를 쓴다.' },
  { id: 'junho', name: '준호', emoji: '⚖️', role: '토론러', style: '반대편 논리와 판단 기준을 제시하고 마지막을 재치 있게 닫는다.' },
  { id: 'miyoung', name: '미영', emoji: '👵', role: '현실조언러', style: '생활 경험에서 나온 실행 가능한 행동을 사람 냄새 나는 말투로 제안한다.' },
  { id: 'cheolgu', name: '철구', emoji: '😈', role: '반전러', style: '다들 지나친 불편한 포인트를 장난스럽게 찌르고 반전 한 줄을 만든다.' },
  { id: 'haru', name: '하루', emoji: '🎨', role: '감성러', style: '글과 사진의 장면을 담백하게 읽고 신선한 표현과 잔잔한 위트를 남긴다.' },
];

const ROOM_CHARACTERS = {
  judgment: ['junho', 'jieun', 'cheolgu'],
  consult: ['daon', 'miyoung', 'haru'],
  vote: ['junho', 'jieun', 'cheolgu'],
  drip: ['minsu', 'cheolgu', 'haru'],
};

const FALLBACKS = {
  judgment: ['반복된 행동이면 실수보다 패턴을 봐야 해요. 한 번은 사정이고 세 번이면 거의 정기구독입니다.', '상대 사정도 중요하지만 내 시간까지 무료 체험판일 필요는 없죠.', '가장 불편했던 장면 하나를 기준으로 보면 판결이 훨씬 선명해질 것 같아요.'],
  consult: ['마음에 계속 남는다는 건 아직 정리할 부분이 있다는 뜻일 수 있어요. 원하는 결과부터 한 문장으로 적어보세요.', '생각이 회전목마라면 작은 행동 하나가 내리는 버튼입니다.', '정답보다 내 마음이 덜 흔들리는 방향부터 골라도 괜찮아요.'],
  vote: ['내게 불리할 때도 같은 기준을 적용할 수 있다면 꽤 튼튼한 원칙입니다.', '상황·빈도·피해 정도를 나누면 양쪽 말이 성립하는 조건이 달라져요.', '예외가 너무 많아지면 원칙이 아니라 메뉴판이 됩니다.'],
  drip: ['현실이 드립 소재를 직접 배송했는데 배송비가 감정 소모네요.', '이건 상황 설명이 아니라 이미 예능 예고편입니다.', '웃음 버튼과 한숨 버튼이 같은 자리에 있는 장면이네요.'],
};

function clean(value, max = 1200) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\r\t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
function cleanId(value, max = 180) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max); }
function parseJson(value) {
  const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}
function roomFor(post = {}) {
  const subtype = String(post.subtype || '').toLowerCase();
  if (subtype === 'consult' || post.modules?.consult?.enabled) return 'consult';
  if (subtype === 'drip' || post.modules?.drip?.enabled) return 'drip';
  if (subtype === 'vote' || post.modules?.vote?.voteMode === 'pros_cons') return 'vote';
  return 'judgment';
}
function charactersFor(post, count = 3) {
  const map = new Map(CHARACTERS.map(item => [item.id, item]));
  return ROOM_CHARACTERS[roomFor(post)].slice(0, Math.max(1, Math.min(Number(count || 3), 3))).map(id => map.get(id)).filter(Boolean);
}
async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}
async function settings() {
  const [globalSnap, characterSnap] = await Promise.all([
    db.doc('config/ai').get().catch(() => null),
    db.doc('site_settings/aiCharacters').get().catch(() => null),
  ]);
  const global = globalSnap?.exists ? globalSnap.data() || {} : {};
  const character = characterSnap?.exists ? characterSnap.data() || {} : {};
  return {
    enabled: global.enabled !== false,
    count: Math.max(1, Math.min(Number(character.autoCommentCount || 3), 3)),
  };
}
function fallback(post, characters) {
  const room = roomFor(post);
  return characters.map((character, index) => ({ id: character.id, text: FALLBACKS[room][index % FALLBACKS[room].length] }));
}
function imageUrls(post = {}) {
  return (Array.isArray(post.images) ? post.images : []).map(String).filter(value => {
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com'; } catch { return false; }
  }).slice(0, 3);
}
async function imageParts(post) {
  const parts = [];
  let total = 0;
  for (const url of imageUrls(post)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) continue;
      let mimeType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 4 * 1024 * 1024 || total + buffer.length > 8 * 1024 * 1024) continue;
      total += buffer.length;
      parts.push({ inlineData: { mimeType, data: buffer.toString('base64') } });
    } catch {} finally { clearTimeout(timer); }
  }
  return parts;
}
async function generate(post, characters) {
  let key = '';
  try { key = String(geminiKey.value() || '').trim(); } catch {}
  if (!key) return { source: 'fallback-no-key', imageCount: 0, comments: fallback(post, characters) };
  const images = await imageParts(post);
  const room = roomFor(post);
  const prompt = `한국 온라인 커뮤니티에서 실제 회원처럼 자연스럽고 아주 재치 있게 댓글을 작성하세요.\n\n유형: ${room}\n제목: ${clean(post.title, 120)}\n내용: ${clean(post.desc, 1200)}\n첨부 이미지: ${images.length ? `${images.length}장 제공됨` : '없음'}\n\n캐릭터:\n${characters.map(c => `- ${c.id}: ${c.name}(${c.role}) — ${c.style}`).join('\n')}\n\n규칙:\n- 글과 사진을 정확히 읽고 각 댓글에 구체적인 관찰을 하나 이상 넣기\n- 세 댓글이 같은 말을 반복하지 말고 관찰·반전·현실조언·펀치라인을 나눠 맡기\n- 최소 한 댓글은 예상 못 한 비유나 문장 끝 반전으로 확실한 웃음 포인트 만들기\n- 사진이 있으면 최소 한 댓글은 실제로 보이는 요소와 본문을 연결하기\n- 사진에 없는 내용, 신원, 나이, 민감한 특성을 추측하지 않기\n- 상담이나 상처가 큰 글은 사람을 웃음거리로 만들지 않기\n- AI 안내문, 교과서 말투, 범용 공감 문구, 낡은 밈 금지\n- 각 댓글 1~3문장, 220자 이내\n- JSON만 출력\n\n{"comments":[${characters.map(c => `{"id":"${c.id}","text":"댓글"}`).join(',')}]}`;
  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: MODEL, generationConfig: { responseMimeType: 'application/json', temperature: 1.0, topP: 0.96, thinkingConfig: { thinkingBudget: 768 } } });
    const result = await model.generateContent([prompt, ...images]);
    const parsed = parseJson(result.response.text());
    const source = Array.isArray(parsed?.comments) ? parsed.comments : [];
    const byId = new Map(source.map(item => [cleanId(item?.id, 40), clean(item?.text, 400)]));
    const comments = characters.map(character => ({ id: character.id, text: byId.get(character.id) || '' })).filter(item => item.text);
    if (comments.length === characters.length) return { source: images.length ? 'gemini-vision' : 'gemini', imageCount: images.length, comments };
  } catch (error) { console.error('[ai-comments-unified] Gemini failed', error); }
  return { source: 'fallback-error', imageCount: 0, comments: fallback(post, characters) };
}
async function write(postRef, postId, generated, replaceExisting = false) {
  if (replaceExisting) {
    const old = await postRef.collection('comments').where('isAiCharacter', '==', true).limit(20).get();
    if (!old.empty) {
      const remove = db.batch();
      old.docs.forEach(docSnap => remove.delete(docSnap.ref));
      await remove.commit();
    }
  }
  const batch = db.batch();
  const now = Date.now();
  generated.comments.forEach((item, index) => {
    const character = CHARACTERS.find(candidate => candidate.id === item.id);
    if (!character || !item.text) return;
    const ref = postRef.collection('comments').doc();
    batch.set(ref, {
      text: clean(item.text, 400), authorId: `ai-${character.id}`, authorName: `${character.emoji} ${character.name} AI`, authorPhoto: '', authorEmail: '',
      isAiCharacter: true, aiCharacterId: character.id, aiCharacterRole: character.role, aiGenerated: true, aiSource: generated.source,
      aiImageAware: generated.imageCount > 0, aiImageCount: generated.imageCount, aiPanelOrder: index + 1,
      reactions: { total: 0 }, reactedWith: {}, createdAt: FieldValue.serverTimestamp(), createdAtMs: now + index, updatedAt: FieldValue.serverTimestamp(),
    });
  });
  batch.update(postRef, {
    aiCharacterCommented: true, aiCharacterCommentedAt: FieldValue.serverTimestamp(), aiCharacterCommentSource: generated.source,
    aiCharacterImageAware: generated.imageCount > 0, aiCharacterImageCount: generated.imageCount, updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return generated.comments.length;
}
async function claim(postId) {
  const ref = db.doc(`system_jobs/ai_character_auto_marker_${postId}`);
  const now = Date.now();
  const claimed = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    if (data.status === 'completed') return false;
    if (data.status === 'started' && now - Number(data.startedAtMs || 0) < 10 * 60 * 1000) return false;
    tx.set(ref, { postId, status: 'started', startedAtMs: now, startedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  return { ref, claimed };
}
async function processPost(postId, post, { replaceExisting = false, skipClaim = false } = {}) {
  if (!postId || !post || post.hidden === true || post.type !== 'multi' || post.aiCharacterCommentsDisabled === true) return { ok: false, reason: 'ineligible' };
  const config = await settings();
  if (!config.enabled) return { ok: false, reason: 'disabled' };
  let marker = null;
  if (!skipClaim) {
    marker = await claim(postId);
    if (!marker.claimed) return { ok: false, reason: 'already-claimed' };
  }
  try {
    const characters = charactersFor(post, config.count);
    const generated = await generate(post, characters);
    const count = await write(db.doc(`feeds/${postId}`), postId, generated, replaceExisting);
    if (marker?.ref) await marker.ref.set({ status: 'completed', count, source: generated.source, imageCount: generated.imageCount, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, postId, count, source: generated.source, imageCount: generated.imageCount };
  } catch (error) {
    if (marker?.ref) await marker.ref.set({ status: 'failed', error: clean(error?.message, 300), failedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
}

exports.onCreateAiCharacterCommentsUnified = onDocumentCreated({ document: 'feeds/{postId}', region: REGION, secrets: [geminiKey], timeoutSeconds: 120, memory: '512MiB' }, async event => {
  const postId = cleanId(event.params.postId);
  const post = event.data?.data() || null;
  if (post?.aiCharacterCommented === true) return;
  await processPost(postId, post);
});

exports.generateLatestAiCharacterComments = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 120, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth?.uid);
  const requestedId = cleanId(request.data?.postId);
  let docSnap = null;
  if (requestedId) docSnap = await db.doc(`feeds/${requestedId}`).get();
  else {
    const recent = await db.collection('feeds').orderBy('createdAt', 'desc').limit(20).get();
    docSnap = recent.docs.find(item => {
      const post = item.data() || {};
      return post.type === 'multi' && post.hidden !== true;
    }) || null;
  }
  if (!docSnap?.exists) throw new HttpsError('not-found', '처리할 게시글을 찾지 못했습니다.');
  return processPost(docSnap.id, docSnap.data() || {}, { replaceExisting: true, skipClaim: true });
});
