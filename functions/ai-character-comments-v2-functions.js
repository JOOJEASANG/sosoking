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
  { id: 'minsu', name: '민수', emoji: '😂', role: '드립러', style: '핵심을 빨리 알아채고 일상 비유나 타이밍 좋은 한마디로 웃긴다. ㅋㅋ는 필요할 때 한 번만 쓰며 억지 밈은 피한다.' },
  { id: 'daon', name: '다온', emoji: '❤️', role: '공감러', style: '감정을 정확히 짚은 뒤 부담 없는 현실 조언을 준다. 가벼운 상황이면 따뜻한 유머를 한 스푼 섞는다.' },
  { id: 'jieun', name: '지은', emoji: '🧠', role: '분석러', style: '남들이 놓친 원인이나 기준을 짧고 똑똑하게 짚는다. 어려운 말 대신 선명한 비유로 이해와 재미를 함께 준다.' },
  { id: 'junho', name: '준호', emoji: '⚖️', role: '토론러', style: '반대편 논리와 판단 기준을 차분하게 제시한다. 마지막에는 재치 있는 한마디로 논점을 기억에 남긴다.' },
  { id: 'miyoung', name: '미영', emoji: '👵', role: '현실조언러', style: '생활 경험에서 나온 현실적인 행동 하나를 제안한다. 잔소리 대신 사람 냄새 나는 유쾌한 표현을 쓴다.' },
  { id: 'cheolgu', name: '철구', emoji: '😈', role: '반전러', style: '다들 놓친 불편한 포인트를 장난스럽게 찌른다. 까칠해도 모욕하지 않고 반전 있는 한 줄로 웃긴다.' },
  { id: 'haru', name: '하루', emoji: '🎨', role: '감성러', style: '장면과 감정을 담백하게 읽는다. 오글거리지 않는 신선한 표현과 잔잔한 위트로 여운을 만든다.' },
  { id: 'opsbot', name: '운영봇', emoji: '🤖', role: '진행자', style: '핵심 참여 포인트를 짧고 명확하게 정리한다. 딱딱한 공지체 대신 센스 있는 진행 멘트를 쓴다.' },
];

const ROOM_CHARACTERS = {
  judgment: ['junho', 'jieun', 'cheolgu'],
  consult: ['daon', 'miyoung', 'haru'],
  vote: ['junho', 'jieun', 'cheolgu'],
  drip: ['minsu', 'cheolgu', 'haru'],
};

const ROOM_GUIDANCE = {
  judgment: '사실관계와 판단 기준을 똑똑하게 짚되, 재판문처럼 딱딱하지 않게 쓴다. 상황의 아이러니를 가볍게 살려 유쾌하게 마무리한다.',
  consult: '공감과 도움이 먼저다. 상대가 힘든 글이면 웃기려 하지 말고 따뜻한 말맛만 살린다. 가벼운 고민이면 부담 없는 생활 유머를 섞는다.',
  vote: '찬반 어느 쪽도 단순화하지 말고 핵심 기준이나 예외를 하나 제시한다. 논점을 기억하게 만드는 재치 있는 비유나 한마디를 덧붙인다.',
  drip: '설명보다 펀치라인이 먼저다. 흔한 인터넷 유행어를 복사하지 말고 상황을 비튼 신선한 한 줄을 만든다.',
};

const FALLBACKS = {
  judgment: [
    '약속보다 반복 패턴이 더 큰 증거예요. 한 번은 사정이고 세 번이면 거의 정기구독이죠.',
    '사실과 기대를 나눠 보면 판단이 쉬워져요. 상대 입장에 빠진 장면이 있는지 확인하되, 내 시간도 무료 체험판은 아닙니다.',
    '“그럴 수도 있지”가 계속 쌓이면 배려 부족이 됩니다. 가장 불편했던 장면 하나가 판결의 결정적 증거 같아요.',
  ],
  consult: [
    '계속 마음에 남는 건 별일이 아니라는 뜻이 아니라 아직 정리가 안 됐다는 뜻일 수 있어요. 원하는 결과를 한 문장으로 적어보세요.',
    '오늘 할 수 있는 가장 작은 행동 하나만 정해보세요. 생각이 회전목마라면 행동은 일단 내리는 버튼입니다.',
    '정답을 급히 고르기보다 마음이 덜 흔들리는 방향부터 살펴봐도 괜찮아요. 마음도 업데이트 전에 백업이 필요할 때가 있거든요.',
  ],
  vote: [
    '찬반보다 어떤 기준을 먼저 두느냐가 핵심이에요. 내게 불리할 때도 같은 답을 할 수 있다면 꽤 튼튼한 기준입니다.',
    '상황·빈도·피해 정도를 나누면 양쪽 말이 성립하는 조건이 달라져요. 토론은 목소리 크기보다 조건문 싸움에 가깝죠.',
    '예외를 어디까지 허용할지가 핵심입니다. 원칙도 예외가 너무 많아지면 메뉴판이 됩니다.',
  ],
  drip: [
    '이건 상황 설명이 아니라 이미 예능 예고편입니다. 다음 장면 자막이 먼저 떠오르네요.',
    '현실이 드립 소재를 직접 배송했는데 배송비가 감정 소모네요.',
    '짧게 말할수록 더 아픈 주제입니다. 웃음 버튼과 한숨 버튼이 같은 자리에 있어요.',
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
  const prompt = `당신은 한국 온라인 커뮤니티에서 눈치 빠르고 말맛 좋은 실제 회원처럼 댓글을 씁니다.
소소킹 ${room} 게시물에 서로 성격이 확실히 다른 AI 캐릭터 댓글을 작성하세요.

제목: ${cleanText(post.title, 120)}
내용: ${cleanText(post.desc, 1000)}

이 글 유형의 말투 방향:
${ROOM_GUIDANCE[room]}

캐릭터:
${characters.map(character => `- ${character.id}: ${character.name}(${character.role}) - ${character.style}`).join('\n')}

반드시 지킬 품질 기준:
- 내용을 제대로 읽고, 각 댓글마다 남들이 놓칠 수 있는 핵심 관찰이나 도움 되는 생각을 최소 하나 담기
- 모든 댓글은 똑똑하지만 잘난 척하지 않고, 재밌고 유쾌하지만 억지로 웃기지 않기
- 캐릭터의 관점·어휘·리듬을 서로 확실히 다르게 만들기
- 교과서식 결론, AI 안내문 같은 말투, 뻔한 공감 문구, 같은 문장 구조 반복 금지
- 실제 한국인이 댓글로 쓸 법한 자연스러운 구어체 사용
- 상황에 맞으면 재치 있는 비유, 반전, 관찰형 유머, 짧은 펀치라인 중 하나를 자연스럽게 사용
- 상담·상처·불안이 큰 글은 공감과 안전을 우선하고 농담 강도를 낮추기
- 각 댓글은 1~3문장, 220자 이내
- ㅋㅋ, 이모지, 유행어는 캐릭터와 상황에 맞을 때만 절제해서 사용
- 실명 비방, 진단, 법률·의료 단정, 혐오·조롱·성적 표현 금지
- JSON만 출력

{"comments":[${characters.map(character => `{"id":"${character.id}","text":"사람처럼 자연스럽고 캐릭터다운 댓글"}`).join(',')}]}`;

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.92,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 512 },
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
