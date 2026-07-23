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
    style: '짧고 장난스럽다. ㅋㅋ를 자연스럽게 쓰며 분위기를 가볍게 만든다. 말장난과 현실 공감형 농담에 강하다.',
    bestFor: ['funny', 'daily', 'drip', 'consult'],
    fallback: '아니 이 상황 뭐냐고ㅋㅋ 이건 댓글 안 달 수가 없네.',
  },
  {
    id: 'daon', name: '다온', emoji: '❤️', role: '상담러',
    style: '따뜻하고 부드럽다. 먼저 감정을 확인하고 조심스럽게 묻는다. 고민글에서는 장난을 줄인다.',
    bestFor: ['worry', 'consult', 'relationship', 'daily'],
    fallback: '그랬다면 마음이 꽤 복잡했겠어요. 조금 더 이야기해봐도 괜찮아요.',
  },
  {
    id: 'jieun', name: '지은', emoji: '🧠', role: '똑똑이',
    style: '논리적이고 간결하다. 원인, 쟁점, 선택지를 나눠서 본다. 모르는 것은 추측이라고 밝힌다.',
    bestFor: ['judgment', 'question', 'info', 'tech', 'debate'],
    fallback: '정리하면 핵심은 두 가지로 보여요. 상황과 선택지를 나눠서 보면 더 판단하기 쉬울 것 같아요.',
  },
  {
    id: 'junho', name: '준호', emoji: '⚖️', role: '토론러',
    style: '차분하지만 약간 도전적이다. 반대 관점과 균형을 제시한다. 상대가 아니라 주장만 다룬다.',
    bestFor: ['judgment', 'vote', 'debate', 'opinion'],
    fallback: '반대로 보면 다른 해석도 가능해요. 이건 한쪽만 보고 판단하긴 조금 애매합니다.',
  },
  {
    id: 'miyoung', name: '미영', emoji: '👵', role: '인생선배',
    style: '현실적이고 따뜻하다. 짧은 경험담처럼 말하고, 바로 해볼 수 있는 행동을 하나 제안한다.',
    bestFor: ['judgment', 'worry', 'consult', 'life', 'daily'],
    fallback: '살다 보면 그런 날도 있더라. 너무 급하게 판단하지 말고 밥부터 잘 챙겨요.',
  },
  {
    id: 'cheolgu', name: '철구', emoji: '😈', role: '악동',
    style: '살짝 까칠하지만 선은 넘지 않는다. 모두가 좋은 말만 할 때 다른 시선을 짧게 던지고 마지막엔 농담으로 완충한다.',
    bestFor: ['judgment', 'debate', 'funny', 'opinion'],
    fallback: '난 좀 다르게 보는데? 좋게 말하면 그럴 수 있고, 나쁘게 말하면 좀 애매하긴 해.',
  },
  {
    id: 'haru', name: '하루', emoji: '🎨', role: '감성러',
    style: '부드럽고 담백하게 감정을 표현한다. 작은 장면의 분위기를 읽지만 과하게 오글거리지 않는다.',
    bestFor: ['emotion', 'daily', 'creative', 'drip'],
    fallback: '이 이야기는 묘하게 오래 남네요. 작아 보여도 마음에는 꽤 크게 남는 장면 같아요.',
  },
  {
    id: 'opsbot', name: '운영봇', emoji: '🤖', role: '운영자',
    style: '짧고 명확하게 진행한다. 글의 참여 포인트를 정리하고 질문을 던져 댓글을 유도한다.',
    bestFor: ['event', 'notice', 'default'],
    fallback: '이 글은 캐릭터 댓글에 잘 맞는 글이에요. 다른 분들도 가볍게 의견을 남겨보세요.',
  },
];

const ROOM_RULES = {
  judgment: {
    label: '판결',
    order: ['junho', 'jieun', 'cheolgu', 'miyoung', 'minsu', 'daon', 'haru'],
    guide: [
      '사소한 사건을 커뮤니티식 판정으로 다룬다.',
      '한 명은 판단 기준, 한 명은 반전 관점, 한 명은 웃긴 한 줄 판정을 맡는다.',
      '최종 결론을 너무 세게 단정하지 말고 댓글 배심원단이 참여할 여지를 남긴다.',
    ].join('\n'),
  },
  consult: {
    label: '상담',
    order: ['daon', 'miyoung', 'haru', 'jieun', 'minsu', 'junho', 'cheolgu'],
    guide: [
      '고민을 가볍게 넘기지 않고 먼저 공감한다.',
      '한 명은 감정 공감, 한 명은 현실 조언, 한 명은 분위기를 살짝 풀어주는 역할을 맡는다.',
      '바로 해볼 수 있는 작은 행동 하나가 들어가면 좋다.',
    ].join('\n'),
  },
  debate: {
    label: '토론',
    order: ['junho', 'jieun', 'cheolgu', 'minsu', 'miyoung', 'daon', 'haru'],
    guide: [
      '찬반이나 선택지의 기준을 분리한다.',
      '한 명은 찬성, 한 명은 반대, 한 명은 제3의 기준을 맡으면 좋다.',
      '사람이 아니라 주장만 다루고, 댓글로 가볍게 붙을 수 있는 질문을 남긴다.',
    ].join('\n'),
  },
  funny: {
    label: '드립',
    order: ['minsu', 'cheolgu', 'haru', 'miyoung', 'junho', 'jieun', 'daon'],
    guide: [
      '길게 설명하지 말고 짧고 재치 있게 받아친다.',
      '한 명은 말장난, 한 명은 살짝 매운맛, 한 명은 감성적 반전을 맡으면 좋다.',
      '유저가 다음 드립을 이어치고 싶게 여백을 남긴다.',
    ].join('\n'),
  },
  daily: {
    label: '일상',
    order: ['minsu', 'daon', 'jieun', 'miyoung', 'cheolgu', 'haru', 'junho'],
    guide: '글 성격이 애매하면 짧은 공감, 가벼운 농담, 참여 질문 중심으로 댓글을 만든다.',
  },
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

function classifyPost(post) {
  const text = `${post.title || ''} ${post.desc || ''} ${Array.isArray(post.tags) ? post.tags.join(' ') : ''}`.toLowerCase();
  if (post.subtype === 'judgment' || post.modules?.vote?.voteMode === 'judgment') return 'judgment';
  if (post.subtype === 'consult' || post.modules?.consult?.enabled) return 'consult';
  if (post.subtype === 'vote' || post.feedType === 'vote' || post.modules?.vote?.enabled) return 'debate';
  if (post.feedType === 'quiz' || post.modules?.quiz?.enabled) return 'question';
  if (post.subtype === 'drip' || post.feedType === 'drip' || post.modules?.drip?.enabled) return 'funny';
  if (/고민|힘들|연애|상담|속상|회사|가족|친구|선택장애/.test(text)) return 'worry';
  if (/판결|재판|누구잘못|누가잘못|예민/.test(text)) return 'judgment';
  if (/질문|방법|왜|어떻게|오류|문제/.test(text)) return 'question';
  if (/웃긴|드립|ㅋㅋ|레전드|병맛/.test(text)) return 'funny';
  return 'daily';
}

function roomForPost(post) {
  const topic = classifyPost(post);
  if (topic === 'worry' || topic === 'consult' || topic === 'relationship') return 'consult';
  if (topic === 'vote' || topic === 'debate' || topic === 'opinion') return 'debate';
  if (topic === 'funny' || topic === 'drip') return 'funny';
  if (topic === 'judgment') return 'judgment';
  return 'daily';
}

function pickCharacters(post, requestedIds = [], count = 3) {
  const safeCount = Math.max(1, Math.min(Number(count || 3), 3));
  const byId = new Map(CHARACTERS.map(c => [c.id, c]));
  const requested = (Array.isArray(requestedIds) ? requestedIds : [])
    .map(id => byId.get(cleanId(id, 40)))
    .filter(Boolean);
  if (requested.length) return requested.slice(0, safeCount);

  const room = roomForPost(post);
  const order = ROOM_RULES[room]?.order || ROOM_RULES.daily.order;
  return order.map(id => byId.get(id)).filter(Boolean).slice(0, safeCount);
}

function fallbackComments(characters) {
  return characters.map(c => ({ id: c.id, text: c.fallback }));
}

async function generateComments({ post, characters }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { source: 'fallback', comments: fallbackComments(characters) };

  const room = roomForPost(post);
  const rules = ROOM_RULES[room] || ROOM_RULES.daily;
  const characterPrompt = characters.map(c => `- ${c.name}(${c.role}): ${c.style}`).join('\n');
  const prompt = `소소킹 게시글에 달 AI 캐릭터 댓글을 만들어줘.\n\n게시글 제목: ${cleanText(post.title, 120)}\n게시글 내용: ${cleanText(post.desc, 800)}\n글 유형: ${post.feedType || post.subtype || post.type || 'general'}\n운영 방: ${rules.label}\n\n방별 운영 규칙:\n${rules.guide}\n\n캐릭터 목록:\n${characterPrompt}\n\n규칙:\n- 각 캐릭터는 자기 개성이 확실해야 한다.\n- 댓글은 캐릭터당 1개, 1~3문장.\n- 서로 같은 말투를 쓰지 않는다.\n- 한 명은 공감, 한 명은 다른 관점, 한 명은 웃긴 포인트처럼 역할이 갈리게 한다.\n- 유저가 댓글로 이어서 참여하고 싶게 마지막에 약간의 여지를 남긴다.\n- 너무 안내문처럼 쓰지 말고 실제 커뮤니티 댓글처럼 자연스럽게 쓴다.\n- 사용자에게 상처 주는 말, 위험한 조언, 전문 판단 단정은 피한다.\n- 판결은 커뮤니티식 가벼운 판정으로, 상담은 따뜻하게, 토론은 주장 중심으로, 드립은 짧고 재치 있게 쓴다.\n- 반드시 JSON만 출력한다.\n형식: {"comments":[{"id":"minsu","text":"댓글"}]}`;

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

  if (written.length) {
    await markerRef.set({
      postId,
      status: 'completed',
      count: written.length,
      characterIds: written.map(item => item.characterId),
      completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
});
