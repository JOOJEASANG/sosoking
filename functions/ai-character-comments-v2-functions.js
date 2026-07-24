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
  { id: 'minsu', name: '민수', emoji: '😂', role: '드립러', style: '짧고 장난스럽지만 공격적이지 않다.' },
  { id: 'daon', name: '다온', emoji: '❤️', role: '공감러', style: '감정을 먼저 확인하고 부드럽게 제안한다.' },
  { id: 'jieun', name: '지은', emoji: '🧠', role: '분석러', style: '사실과 판단 기준을 간결하게 나눈다.' },
  { id: 'junho', name: '준호', emoji: '⚖️', role: '토론러', style: '반대 관점과 판단 기준을 차분하게 제시한다.' },
  { id: 'miyoung', name: '미영', emoji: '👵', role: '현실조언러', style: '바로 해볼 수 있는 작은 행동을 제안한다.' },
  { id: 'cheolgu', name: '철구', emoji: '😈', role: '반전러', style: '살짝 까칠하지만 선을 넘지 않고 다른 시선을 던진다.' },
  { id: 'haru', name: '하루', emoji: '🎨', role: '감성러', style: '담백하게 감정을 읽고 과장하지 않는다.' },
  { id: 'opsbot', name: '운영봇', emoji: '🤖', role: '진행자', style: '핵심 참여 포인트를 짧고 명확하게 정리한다.' },
];

const ROOM_CHARACTERS = {
  judgment: ['junho', 'jieun', 'cheolgu'],
  consult: ['daon', 'miyoung', 'haru'],
  vote: ['junho', 'jieun', 'cheolgu'],
  drip: ['minsu', 'cheolgu', 'haru'],
};

const FALLBACKS = {
  judgment: [
    '감정보다 먼저 서로 약속한 기준이 있었는지 봐야 해요. 반복된 행동인지도 판정에 중요합니다.',
    '현재 정보만 보면 사실과 기대를 나눠 볼 필요가 있어요. 상대 입장에서 빠진 장면이 있는지도 궁금합니다.',
    '“그럴 수도 있지”가 반복되면 배려 부족 쪽으로 기울죠. 가장 불편했던 장면이 핵심 같아요.',
  ],
  consult: [
    '이 일이 계속 마음에 남았던 것 같아요. 원하는 결과를 한 문장으로 적어보면 조금 선명해질 수 있어요.',
    '오늘 바로 할 수 있는 가장 작은 행동 하나만 정해보세요. 생각만 굴리는 것보다 부담이 줄어듭니다.',
    '정답보다 마음이 덜 흔들리는 방향을 먼저 살펴봐도 괜찮아요.',
  ],
  vote: [
    '찬반보다 어떤 기준을 우선하느냐의 문제 같아요. 예외를 어디까지 허용할지가 핵심입니다.',
    '상황, 빈도, 피해 정도를 나눠 보면 양쪽 주장이 성립하는 조건이 달라집니다.',
    '내게 불리한 상황에서도 같은 답을 할 수 있는지가 진짜 기준일 것 같네요.',
  ],
  drip: [
    '이건 상황 설명이 아니라 이미 예능 예고편인데요ㅋㅋ 다음 장면 자막이 필요합니다.',
    '현실이 먼저 드립 소재를 던졌네요. 웃으면 안 되는데 효과음이 들립니다.',
    '짧게 말할수록 더 아픈 주제네요. 한 줄로 끝내야 제맛입니다.',
  ],
};

function cleanId(value, max = 160) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function cleanText(value, max = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\r\t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
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

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

function roomFor(post = {}) {
  const subtype = String(post.subtype || '').toLowerCase();
  if (subtype === 'consult' || post.modules?.consult?.enabled) return 'consult';
  if (subtype === 'drip' || post.modules?.drip?.enabled) return 'drip';
  if (subtype === 'vote' || post.modules?.vote?.voteMode === 'pros_cons') return 'vote';
  return 'judgment';
}

function pickCharacters(post, requestedIds = [], count = 3) {
  const max = Math.max(1, Math.min(Number(count || 3), 3));
  const map = new Map(CHARACTERS.map(character => [character.id, character]));
  const requested = (Array.isArray(requestedIds) ? requestedIds : [])
    .map(id => map.get(cleanId(id, 40)))
    .filter(Boolean);
  if (requested.length) return requested.slice(0, max);
  return ROOM_CHARACTERS[roomFor(post)].map(id => map.get(id)).filter(Boolean).slice(0, max);
}

function fallbackComments(post, characters) {
  const room = roomFor(post);
  const subject = cleanText(post.title || post.desc || '이 이야기', 45);
  return characters.map((character, index) => ({
    id: character.id,
    text: cleanText(`${subject}: ${FALLBACKS[room][index % FALLBACKS[room].length]}`, 400),
  }));
}

function normalizeComments(raw, characters) {
  const source = Array.isArray(raw?.comments) ? raw.comments : [];
  const map = new Map(source.map(item => [cleanId(item?.id, 40), cleanText(item?.text, 400)]));
  return characters
    .map(character => ({ id: character.id, text: map.get(character.id) || '' }))
    .filter(item => item.text);
}

async function generateComments(post, characters) {
  let apiKey = '';
  try { apiKey = String(geminiKey.value() || '').trim(); } catch {}
  if (!apiKey) return { source: 'fallback-no-key', comments: fallbackComments(post, characters) };

  const room = roomFor(post);
  const prompt = `소소킹 ${room} 커뮤니티 글에 AI 캐릭터 댓글을 작성하세요.

제목: ${cleanText(post.title, 120)}
내용: ${cleanText(post.desc, 1000)}

캐릭터:
${characters.map(character => `- ${character.id}: ${character.name}(${character.role}) - ${character.style}`).join('\n')}

규칙:
- 각 댓글은 1~2문장, 180자 이내
- 서로 같은 말을 반복하지 않기
- 실명 비방, 진단, 법률·의료 단정, 혐오 표현 금지
- 사람이 쓴 댓글처럼 자연스럽게
- JSON만 출력

{"comments":[${characters.map(character => `{"id":"${character.id}","text":"댓글"}`).join(',')}]}`;

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.85,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(prompt);
    const comments = normalizeComments(parseJson(result.response.text()), characters);
    if (comments.length === characters.length) return { source: 'gemini', comments };
    if (comments.length) {
      const missing = characters.filter(character => !comments.some(item => item.id === character.id));
      return { source: 'gemini-partial', comments: [...comments, ...fallbackComments(post, missing)] };
    }
  } catch (error) {
    console.error('[ai-character-comments] Gemini failed', error);
  }
  return { source: 'fallback-error', comments: fallbackComments(post, characters) };
}

async function settings() {
  const snap = await db.doc('site_settings/aiCharacters').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    enabled: data.autoCommentsEnabled === true,
    count: Math.max(1, Math.min(Number(data.autoCommentCount || 2), 3)),
  };
}

async function loadPost(postId) {
  const id = cleanId(postId);
  if (!id) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const ref = db.doc(`feeds/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.hidden === true || post.type !== 'multi') throw new HttpsError('failed-precondition', '처리할 수 없는 게시글입니다.');
  return { ref, postId: id, post };
}

async function writeComments({ postRef, postId, characters, generated, actorId, replaceExisting = false }) {
  const oldSnap = replaceExisting
    ? await postRef.collection('comments').where('isAiCharacter', '==', true).limit(20).get()
    : { docs: [] };
  const batch = db.batch();
  oldSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
  const now = Date.now();
  const written = [];
  for (const item of generated.comments) {
    const character = CHARACTERS.find(candidate => candidate.id === item.id);
    if (!character || !item.text) continue;
    const ref = postRef.collection('comments').doc();
    const data = {
      text: cleanText(item.text, 400),
      authorId: `ai-${character.id}`,
      authorName: `${character.emoji} ${character.name} AI`,
      authorPhoto: '',
      authorEmail: '',
      isAiCharacter: true,
      aiCharacterId: character.id,
      aiCharacterRole: character.role,
      aiGenerated: true,
      aiSource: generated.source,
      reactions: { total: 0 },
      reactedWith: {},
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(ref, data);
    written.push({ id: ref.id, characterId: character.id, authorName: data.authorName, text: data.text });
  }
  if (!written.length) return [];
  batch.update(postRef, {
    aiCharacterCommented: true,
    aiCharacterCommentedAt: FieldValue.serverTimestamp(),
    aiCharacterCommentSource: generated.source,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`system_jobs/ai_character_comments_${postId}_${now}`), {
    postId,
    characterIds: written.map(item => item.characterId),
    count: written.length,
    source: generated.source,
    actorId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return written;
}

async function claimMarker(postId) {
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

exports.getAiCharacterSettings = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertAdmin(request.auth?.uid);
  return { ok: true, settings: await settings() };
});

exports.saveAiCharacterSettings = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertAdmin(request.auth?.uid);
  const patch = {
    autoCommentsEnabled: request.data?.autoCommentsEnabled === true,
    autoCommentCount: Math.max(1, Math.min(Number(request.data?.autoCommentCount || 2), 3)),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  };
  await db.doc('site_settings/aiCharacters').set(patch, { merge: true });
  return { ok: true, settings: { enabled: patch.autoCommentsEnabled, count: patch.autoCommentCount } };
});

exports.generateAiCharacterCommentsTest = onCall({
  region: REGION, secrets: [geminiKey], timeoutSeconds: 120, memory: '512MiB',
}, async request => {
  await assertAdmin(request.auth?.uid);
  const { ref, postId, post } = await loadPost(request.data?.postId);
  const characters = pickCharacters(post, request.data?.characterIds, request.data?.count);
  const generated = await generateComments(post, characters);
  if (request.data?.dryRun === true) return { ok: true, dryRun: true, postId, source: generated.source, comments: generated.comments };
  const comments = await writeComments({
    postRef: ref, postId, characters, generated,
    actorId: request.auth.uid, replaceExisting: request.data?.replaceExisting !== false,
  });
  return { ok: true, postId, source: generated.source, comments };
});

exports.onCreateAiCharacterComments = onDocumentCreated({
  document: 'feeds/{postId}',
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 120,
  memory: '512MiB',
}, async event => {
  const post = event.data?.data() || null;
  const postId = cleanId(event.params.postId);
  if (!postId || !post || post.hidden === true || post.type !== 'multi' || post.aiCharacterCommentsDisabled === true || post.aiCharacterCommented === true) return;
  const config = await settings();
  if (!config.enabled) return;
  const marker = await claimMarker(postId);
  if (!marker.claimed) return;
  try {
    const postRef = db.doc(`feeds/${postId}`);
    const characters = pickCharacters(post, [], config.count);
    const generated = await generateComments(post, characters);
    const written = await writeComments({
      postRef, postId, characters, generated,
      actorId: post.isAiGenerated === true ? 'auto-ai-post' : 'auto-user-post',
    });
    await marker.ref.set({
      status: 'completed', count: written.length, source: generated.source,
      characterIds: written.map(item => item.characterId), completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('[ai-character-comments] trigger failed', error);
    await marker.ref.set({ status: 'failed', error: cleanText(error?.message, 300), failedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
});
