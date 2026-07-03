'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const CHARACTERS = [
  { id: 'minsu', name: '민수', emoji: '😂', role: '드립왕', style: '짧고 장난스럽다. ㅋㅋ를 자연스럽게 쓰며 분위기를 가볍게 만든다.', bestFor: ['funny', 'daily', 'drip', 'consult'], fallback: '아니 이 상황 뭐냐고ㅋㅋ 이건 댓글 안 달 수가 없네.' },
  { id: 'daon', name: '다온', emoji: '❤️', role: '상담러', style: '따뜻하고 부드럽다. 먼저 감정을 확인하고 조심스럽게 묻는다.', bestFor: ['consult', 'daily', 'people'], fallback: '그럴 수 있어요. 너무 크게 몰아가기보다 상황을 조금 더 보면 좋겠어요.' },
  { id: 'chulsu', name: '철수', emoji: '🧊', role: '팩폭러', style: '차분하지만 현실적인 팩트를 짧게 말한다. 공격적 표현은 피한다.', bestFor: ['vote', 'judgment', 'realistic'], fallback: '감정 빼고 보면 핵심은 이거예요. 서로 기준이 달랐던 것 같아요.' },
  { id: 'nari', name: '나리', emoji: '✨', role: '공감요정', style: '밝고 공감형이다. 분위기를 부드럽게 만든다.', bestFor: ['daily', 'consult', 'soft'], fallback: '이런 소소한 순간 은근히 오래 기억나죠. 댓글들 궁금해요.' },
  { id: 'bonggu', name: '봉구', emoji: '🐶', role: '막던짐러', style: '엉뚱하지만 선 넘지 않는 농담을 던진다.', bestFor: ['drip', 'funny'], fallback: '저라면 일단 간식 먹고 다시 생각합니다. 판단력은 당에서 나와요.' },
];

function cleanId(value, max = 80) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function cleanText(value, max = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\r\t]+/g, ' ')
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

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

function pickCharacters(post = {}, requested = [], count = 3) {
  const requestedIds = Array.isArray(requested) ? requested.map(id => cleanId(id, 40)).filter(Boolean) : [];
  const requestedSet = new Set(requestedIds);
  const safeCount = Math.max(1, Math.min(Number(count || 3), 3));
  const sourceText = [post.feedType, post.subtype, post.type, post.title, post.desc].map(v => String(v || '').toLowerCase()).join(' ');
  const scored = CHARACTERS.map(c => {
    let score = requestedSet.has(c.id) ? 100 : 0;
    c.bestFor.forEach(key => { if (sourceText.includes(key)) score += 3; });
    if (sourceText.includes('드립') && c.bestFor.includes('drip')) score += 5;
    if (sourceText.includes('상담') && c.bestFor.includes('consult')) score += 5;
    if (sourceText.includes('투표') && c.bestFor.includes('vote')) score += 5;
    return { c, score };
  }).sort((a, b) => b.score - a.score);
  return scored.slice(0, safeCount).map(item => item.c);
}

function fallbackComments(characters) {
  return characters.map(c => ({ id: c.id, text: c.fallback }));
}

async function generateComments({ post, characters }) {
  const apiKey = ANTHROPIC_API_KEY.value();
  if (!apiKey) return { source: 'fallback', comments: fallbackComments(characters) };

  const characterPrompt = characters.map(c => `- ${c.id}: ${c.name}(${c.role}) / ${c.style}`).join('\n');
  const prompt = `소소킹 게시글에 달 AI 캐릭터 댓글을 만들어줘.\n\n게시글 제목: ${cleanText(post.title, 120)}\n게시글 내용: ${cleanText(post.desc, 800)}\n글 유형: ${post.feedType || post.subtype || post.type || 'general'}\n\n캐릭터 목록:\n${characterPrompt}\n\n규칙:\n- 캐릭터당 댓글 1개\n- 댓글은 1~3문장\n- 서로 같은 말투 금지\n- 상처 주는 말, 위험한 조언, 전문 판단 단정 금지\n- 반드시 JSON만 출력\n형식: {"comments":[{"id":"minsu","text":"댓글"}]}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = parseJson(msg.content.filter(block => block.type === 'text').map(block => block.text).join(''));
    const allowed = new Set(characters.map(c => c.id));
    const comments = Array.isArray(parsed?.comments)
      ? parsed.comments.map(item => ({ id: cleanId(item.id, 40), text: cleanText(item.text, 400) })).filter(item => allowed.has(item.id) && item.text)
      : [];
    if (comments.length) return { source: 'ai', comments };
  } catch (error) {
    console.error('[ai-character-comments] fallback', error);
  }
  return { source: 'fallback', comments: fallbackComments(characters) };
}

async function loadPost(postId) {
  const safePostId = cleanId(postId);
  if (!safePostId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const ref = db.doc(`feeds/${safePostId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');
  return { ref, postId: safePostId, post };
}

async function getAutoSettings() {
  const snap = await db.doc('site_settings/aiCharacters').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    enabled: data.autoCommentsEnabled !== false,
    count: Math.max(1, Math.min(Number(data.autoCommentCount || 3), 3)),
  };
}

function shouldSkipAutoPost(post) {
  if (!post || post.hidden === true) return true;
  if (post.aiCharacterCommentsDisabled === true) return true;
  if (post.aiCharacterCommented === true) return true;
  if (post.feedType === 'tournament' || post.modules?.tournament?.enabled) return true;
  return false;
}

async function writeCharacterComments({ postRef, postId, post, characters, source, comments, actorId = 'auto' }) {
  const batch = db.batch();
  const now = Date.now();
  const written = [];
  comments.forEach(item => {
    const character = CHARACTERS.find(c => c.id === item.id);
    if (!character) return;
    const commentRef = postRef.collection('comments').doc();
    const doc = {
      text: item.text,
      authorId: `ai-${character.id}`,
      authorName: `${character.emoji} ${character.name} AI`,
      authorPhoto: '',
      authorEmail: '',
      isAiCharacter: true,
      aiCharacterId: character.id,
      aiCharacterRole: character.role,
      aiGenerated: true,
      reactions: { total: 0 },
      reactedWith: {},
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(commentRef, doc);
    written.push({ id: commentRef.id, characterId: character.id, authorName: doc.authorName, text: doc.text });
  });
  if (!written.length) return [];
  batch.update(postRef, {
    commentCount: FieldValue.increment(written.length),
    aiCharacterCommented: true,
    aiCharacterCommentedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`system_jobs/ai_character_comments_${postId}_${now}`), {
    postId,
    postTitle: cleanText(post.title, 160),
    characterIds: characters.map(c => c.id),
    count: written.length,
    source,
    actorId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return written;
}

exports.getAiCharacterSettings = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const settings = await getAutoSettings();
  return { ok: true, settings };
});

exports.saveAiCharacterSettings = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const data = request.data || {};
  const patch = {
    autoCommentsEnabled: data.autoCommentsEnabled !== false,
    autoCommentCount: Math.max(1, Math.min(Number(data.autoCommentCount || 3), 3)),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  };
  await db.doc('site_settings/aiCharacters').set(patch, { merge: true });
  return { ok: true, settings: { enabled: patch.autoCommentsEnabled, count: patch.autoCommentCount } };
});

exports.generateAiCharacterCommentsTest = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB', secrets: [ANTHROPIC_API_KEY] }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const { postId, characterIds, count, dryRun } = request.data || {};
  const { ref: postRef, postId: safePostId, post } = await loadPost(postId);
  const characters = pickCharacters(post, characterIds, count);
  const generated = await generateComments({ post, characters });
  if (dryRun === true) return { ok: true, dryRun: true, postId: safePostId, source: generated.source, comments: generated.comments };
  const written = await writeCharacterComments({ postRef, postId: safePostId, post, characters, source: generated.source, comments: generated.comments, actorId: request.auth.uid });
  if (!written.length) throw new HttpsError('internal', '생성된 댓글이 없습니다.');
  return { ok: true, postId: safePostId, source: generated.source, comments: written };
});

exports.onCreateAiCharacterComments = onDocumentCreated({
  document: 'feeds/{postId}',
  region: REGION,
  timeoutSeconds: 120,
  memory: '512MiB',
  secrets: [ANTHROPIC_API_KEY],
}, async event => {
  const post = event.data?.data() || null;
  const postId = cleanId(event.params.postId);
  if (!postId || shouldSkipAutoPost(post)) return;
  const settings = await getAutoSettings();
  if (!settings.enabled) return;

  const markerRef = db.doc(`system_jobs/ai_character_auto_marker_${postId}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return;
  await markerRef.set({ postId, status: 'started', startedAt: FieldValue.serverTimestamp() }, { merge: true });

  const postRef = db.doc(`feeds/${postId}`);
  const characters = pickCharacters(post, [], settings.count);
  const generated = await generateComments({ post, characters });
  const written = await writeCharacterComments({
    postRef,
    postId,
    post,
    characters,
    source: generated.source,
    comments: generated.comments,
    actorId: post.isAiGenerated === true ? 'auto-ai-post' : 'auto-user-post',
  });

  await markerRef.set({
    postId,
    status: written.length ? 'completed' : 'empty',
    count: written.length,
    characterIds: written.map(item => item.characterId),
    completedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
});
