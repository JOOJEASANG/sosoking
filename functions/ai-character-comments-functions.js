'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';

const CHARACTERS = [
  {
    id: 'minsu', name: '민수', emoji: '😂', role: '드립왕',
    style: '짧고 장난스럽다. ㅋㅋ를 자연스럽게 쓰며 분위기를 가볍게 만든다.',
    bestFor: ['funny', 'daily', 'drip'],
    fallback: '아니 이 상황 뭐냐고ㅋㅋ 이건 댓글 안 달 수가 없네.',
  },
  {
    id: 'daon', name: '다온', emoji: '❤️', role: '상담러',
    style: '따뜻하고 부드럽다. 먼저 감정을 확인하고 조심스럽게 묻는다.',
    bestFor: ['worry', 'relationship', 'daily'],
    fallback: '그랬다면 마음이 꽤 복잡했겠어요. 조금 더 이야기해봐도 괜찮아요.',
  },
  {
    id: 'jieun', name: '지은', emoji: '🧠', role: '똑똑이',
    style: '논리적이고 간결하다. 원인과 선택지를 나눠서 본다.',
    bestFor: ['question', 'info', 'tech'],
    fallback: '정리하면 핵심은 두 가지로 보여요. 상황과 선택지를 나눠서 보면 더 판단하기 쉬울 것 같아요.',
  },
  {
    id: 'junho', name: '준호', emoji: '⚖️', role: '토론러',
    style: '차분하지만 약간 도전적이다. 반대 관점과 균형을 제시한다.',
    bestFor: ['vote', 'debate', 'opinion'],
    fallback: '반대로 보면 다른 해석도 가능해요. 이건 한쪽만 보고 판단하긴 조금 애매합니다.',
  },
  {
    id: 'miyoung', name: '미영', emoji: '👵', role: '인생선배',
    style: '현실적이고 따뜻하다. 짧은 경험담처럼 말한다.',
    bestFor: ['worry', 'life', 'daily'],
    fallback: '살다 보면 그런 날도 있더라. 너무 급하게 판단하지 말고 밥부터 잘 챙겨요.',
  },
  {
    id: 'cheolgu', name: '철구', emoji: '😈', role: '악동',
    style: '살짝 까칠하지만 선은 넘지 않는다. 다른 시선을 짧게 던진다.',
    bestFor: ['debate', 'funny', 'opinion'],
    fallback: '난 좀 다르게 보는데? 좋게 말하면 그럴 수 있고, 나쁘게 말하면 좀 애매하긴 해.',
  },
  {
    id: 'haru', name: '하루', emoji: '🎨', role: '감성러',
    style: '부드럽고 담백하게 감정을 표현한다. 과하게 꾸미지 않는다.',
    bestFor: ['emotion', 'daily', 'creative'],
    fallback: '이 이야기는 묘하게 오래 남네요. 작아 보여도 마음에는 꽤 크게 남는 장면 같아요.',
  },
  {
    id: 'opsbot', name: '운영봇', emoji: '🤖', role: '운영자',
    style: '짧고 명확하게 진행한다. 질문을 던져 참여를 유도한다.',
    bestFor: ['event', 'notice', 'default'],
    fallback: '이 글은 캐릭터 댓글 테스트에 잘 맞는 글이에요. 다른 분들도 가볍게 의견을 남겨보세요.',
  },
];

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

function classifyPost(post) {
  const text = `${post.title || ''} ${post.desc || ''} ${Array.isArray(post.tags) ? post.tags.join(' ') : ''}`.toLowerCase();
  if (post.feedType === 'vote' || post.modules?.vote?.enabled) return 'debate';
  if (post.feedType === 'quiz' || post.modules?.quiz?.enabled) return 'question';
  if (post.feedType === 'drip' || post.modules?.drip?.enabled) return 'funny';
  if (/고민|힘들|연애|상담|속상|회사|가족|친구/.test(text)) return 'worry';
  if (/질문|방법|왜|어떻게|오류|문제/.test(text)) return 'question';
  if (/웃긴|드립|ㅋㅋ|레전드/.test(text)) return 'funny';
  return 'daily';
}

function pickCharacters(post, requestedIds = [], count = 3) {
  const safeCount = Math.max(1, Math.min(Number(count || 3), 3));
  const byId = new Map(CHARACTERS.map(c => [c.id, c]));
  const requested = (Array.isArray(requestedIds) ? requestedIds : [])
    .map(id => byId.get(cleanId(id, 40)))
    .filter(Boolean);
  if (requested.length) return requested.slice(0, safeCount);

  const topic = classifyPost(post);
  const scored = CHARACTERS
    .filter(c => c.id !== 'opsbot')
    .map(c => ({ c, score: c.bestFor.includes(topic) ? 10 : c.bestFor.includes('daily') ? 4 : 1 }));
  scored.sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
  return scored.slice(0, safeCount).map(item => item.c);
}

function fallbackComments(characters) {
  return characters.map(c => ({ id: c.id, text: c.fallback }));
}

async function generateComments({ post, characters }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { source: 'fallback', comments: fallbackComments(characters) };

  const characterPrompt = characters.map(c => `- ${c.name}(${c.role}): ${c.style}`).join('\n');
  const prompt = `소소킹 게시글에 달 AI 캐릭터 댓글을 만들어줘.\n\n게시글 제목: ${cleanText(post.title, 120)}\n게시글 내용: ${cleanText(post.desc, 800)}\n글 유형: ${post.feedType || post.type || 'general'}\n\n캐릭터 목록:\n${characterPrompt}\n\n규칙:\n- 각 캐릭터는 자기 개성이 확실해야 한다.\n- 댓글은 캐릭터당 1개, 1~3문장.\n- 서로 같은 말투를 쓰지 않는다.\n- 욕설, 무례한 표현, 위험한 조언은 피한다.\n- 반드시 JSON만 출력한다.\n형식: {"comments":[{"id":"minsu","text":"댓글"}]}`;

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
      ? parsed.comments
          .map(item => ({ id: cleanId(item.id, 40), text: cleanText(item.text, 400) }))
          .filter(item => allowed.has(item.id) && item.text)
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
    count: Math.max(1, Math.min(Number(data.autoCommentCount || 2), 3)),
  };
}

function shouldSkipAutoPost(post) {
  if (!post || post.hidden === true) return true;
  if (post.isAiGenerated === true || post.authorId === 'sosoking-ai') return true;
  if (post.aiCharacterCommentsDisabled === true) return true;
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
      authorName: `${character.emoji} ${character.name}`,
      authorPhoto: '',
      isAiCharacter: true,
      aiCharacterId: character.id,
      aiCharacterRole: character.role,
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
  const logRef = db.doc(`system_jobs/ai_character_comments_${postId}_${now}`);
  batch.set(logRef, {
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

exports.generateAiCharacterCommentsTest = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const { postId, characterIds, count, dryRun } = request.data || {};
  const { ref: postRef, postId: safePostId, post } = await loadPost(postId);
  const characters = pickCharacters(post, characterIds, count);
  const generated = await generateComments({ post, characters });

  if (dryRun === true) {
    return { ok: true, dryRun: true, postId: safePostId, source: generated.source, comments: generated.comments };
  }

  const written = await writeCharacterComments({
    postRef,
    postId: safePostId,
    post,
    characters,
    source: generated.source,
    comments: generated.comments,
    actorId: request.auth.uid,
  });
  if (!written.length) throw new HttpsError('internal', '생성된 댓글이 없습니다.');
  return { ok: true, postId: safePostId, source: generated.source, comments: written };
});

exports.onCreateAiCharacterComments = onDocumentCreated({
  document: 'feeds/{postId}',
  region: REGION,
  timeoutSeconds: 120,
  memory: '512MiB',
}, async event => {
  const post = event.data?.data() || null;
  const postId = cleanId(event.params.postId);
  if (!postId || shouldSkipAutoPost(post)) return;

  const settings = await getAutoSettings();
  if (!settings.enabled) return;

  const markerRef = db.doc(`system_jobs/ai_character_auto_marker_${postId}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return;
  await markerRef.set({ postId, createdAt: FieldValue.serverTimestamp() }, { merge: true });

  const postRef = db.doc(`feeds/${postId}`);
  const characters = pickCharacters(post, [], settings.count);
  const generated = await generateComments({ post, characters });
  await writeCharacterComments({
    postRef,
    postId,
    post,
    characters,
    source: generated.source,
    comments: generated.comments,
    actorId: 'auto',
  });
});
