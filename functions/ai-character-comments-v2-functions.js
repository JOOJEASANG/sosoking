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
  { id: 'minsu', name: '민수', emoji: '😂', role: '드립왕', style: '짧고 장난스럽다. ㅋㅋ를 자연스럽게 쓰고 현실 공감형 농담을 한다.' },
  { id: 'daon', name: '다온', emoji: '❤️', role: '상담러', style: '따뜻하고 부드럽다. 감정을 먼저 확인하고 조심스럽게 제안한다.' },
  { id: 'jieun', name: '지은', emoji: '🧠', role: '분석러', style: '논리적이고 간결하다. 사실, 쟁점, 선택지를 나눠서 본다.' },
  { id: 'junho', name: '준호', emoji: '⚖️', role: '토론러', style: '차분하지만 약간 도전적이다. 반대 관점과 판단 기준을 제시한다.' },
  { id: 'miyoung', name: '미영', emoji: '👵', role: '인생선배', style: '현실적이고 따뜻하다. 바로 해볼 수 있는 작은 행동을 하나 제안한다.' },
  { id: 'cheolgu', name: '철구', emoji: '😈', role: '악동', style: '살짝 까칠하지만 선은 넘지 않는다. 다른 시선을 던지고 농담으로 완충한다.' },
  { id: 'haru', name: '하루', emoji: '🎨', role: '감성러', style: '부드럽고 담백하다. 장면의 감정을 읽되 과하게 오글거리지 않는다.' },
  { id: 'opsbot', name: '운영봇', emoji: '🤖', role: '진행자', style: '짧고 명확하다. 참여 포인트를 정리하고 질문을 던진다.' },
];

const ROOMS = {
  judgment: {
    label: '판결',
    order: ['junho', 'jieun', 'cheolgu'],
    guide: '판단 기준, 확인되지 않은 상대 입장, 가벼운 한 줄 판정을 서로 겹치지 않게 맡는다.',
  },
  consult: {
    label: '상담',
    order: ['daon', 'miyoung', 'haru'],
    guide: '감정 공감, 현실적인 작은 행동, 마음을 정리하는 관점을 서로 겹치지 않게 맡는다.',
  },
  debate: {
    label: '토론',
    order: ['junho', 'jieun', 'cheolgu'],
    guide: '찬성 논리, 반대 논리, 조건에 따른 제3의 기준을 분리하고 사람 대신 주장만 다룬다.',
  },
  funny: {
    label: '드립',
    order: ['minsu', 'cheolgu', 'haru'],
    guide: '말장난, 살짝 매운맛, 감성적 반전을 각각 맡고 한두 문장 안에 끝낸다.',
  },
  play: {
    label: '게임',
    order: ['minsu', 'jieun', 'opsbot'],
    guide: '정답을 직접 노출하지 말고 힌트, 도전 욕구, 참여 질문을 서로 다르게 제시한다.',
  },
  daily: {
    label: '일상',
    order: ['minsu', 'daon', 'jieun'],
    guide: '짧은 공감, 가벼운 농담, 다른 사람의 경험을 묻는 질문을 나눠 맡는다.',
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

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

function classifyRoom(post = {}) {
  const type = String(post.subtype || post.feedType || post.type || '').toLowerCase();
  const text = `${post.title || ''} ${post.desc || ''} ${(post.tags || []).join?.(' ') || ''}`.toLowerCase();
  if (['judgment', 'verdict', 'court', 'crazy_court'].includes(type) || post.modules?.vote?.voteMode === 'judgment') return 'judgment';
  if (['consult', 'advice', 'worry'].includes(type) || post.modules?.consult?.enabled) return 'consult';
  if (['vote', 'debate', 'discussion', 'ox'].includes(type) || post.modules?.vote?.enabled) return 'debate';
  if (['drip', 'funny', 'cbattle'].includes(type) || post.modules?.drip?.enabled) return 'funny';
  if (['quiz', 'initial_game', 'naming', 'relay', 'acrostic'].includes(type) || post.modules?.quiz?.enabled) return 'play';
  if (/판결|재판|누구\s*잘못|누가\s*잘못|예민/.test(text)) return 'judgment';
  if (/고민|힘들|연애|상담|속상|회사|가족|친구|선택장애/.test(text)) return 'consult';
  if (/토론|찬성|반대|투표/.test(text)) return 'debate';
  if (/웃긴|드립|ㅋㅋ|레전드|병맛/.test(text)) return 'funny';
  if (/퀴즈|초성|삼행시|릴레이|작명/.test(text)) return 'play';
  return 'daily';
}

function pickCharacters(post, requestedIds = [], count = 3) {
  const safeCount = Math.max(1, Math.min(Number(count || 3), 3));
  const byId = new Map(CHARACTERS.map(character => [character.id, character]));
  const requested = (Array.isArray(requestedIds) ? requestedIds : [])
    .map(id => byId.get(cleanId(id, 40)))
    .filter(Boolean);
  if (requested.length) return requested.slice(0, safeCount);
  const room = classifyRoom(post);
  return ROOMS[room].order.map(id => byId.get(id)).filter(Boolean).slice(0, safeCount);
}

function subject(post) {
  return cleanText(post.title || post.desc || post.body || post.startSentence || post.keyword || '이 이야기', 46);
}

function options(post) {
  const source = post.modules?.vote?.options || post.options || [];
  return (Array.isArray(source) ? source : [])
    .map(item => cleanText(typeof item === 'object' ? item.text : item, 40))
    .filter(Boolean)
    .slice(0, 6);
}

const FALLBACKS = {
  judgment: {
    junho: ['{s}에서 먼저 볼 건 감정보다 서로 약속한 기준이에요. 어디부터 선을 넘었다고 보는지 궁금합니다.', '이 사건은 {s} 자체보다 반복 여부와 사전 설명이 판정 포인트예요. 한 번의 실수인지 습관인지에 따라 표가 갈릴 듯합니다.'],
    jieun: ['현재 정보만 보면 사실, 기대, 감정을 나눠 봐야 해요. {s}에서 확인되지 않은 상대 입장이 하나 더 있어 보입니다.', '{s}의 핵심은 행동 뒤에 사과나 조율 시도가 있었는지예요. 그 부분이 판정을 크게 바꿀 것 같습니다.'],
    cheolgu: ['{s}라… 둘 다 억울하겠지만 배려를 깜빡한 쪽은 벌점 좀 받아야겠는데요?ㅋㅋ', '“그럴 수도 있지” 카드를 반복해서 쓰면 유죄 쪽으로 기웁니다. {s}에서 제일 찔리는 장면부터 봅시다.'],
  },
  consult: {
    daon: ['{s} 때문에 마음이 계속 걸렸던 것 같아요. 내가 원하는 결과를 한 문장으로 적어보면 조금 선명해질 수 있어요.', '{s}를 혼자 오래 생각하면 작은 일도 더 무거워져요. 먼저 내 감정이 서운함인지 불안함인지 구분해보면 어떨까요?'],
    miyoung: ['{s} 같은 고민은 머릿속에서만 굴리면 답이 안 나오더라. 오늘 할 수 있는 가장 작은 행동 하나만 정해봐요.', '감당할 수 있는 손해와 얻고 싶은 걸 따로 적어보세요. {s}도 그렇게 보면 의외로 답이 빨리 보여요.'],
    haru: ['제목은 {s}. 이 고민이 자꾸 마음에 남는 데는 이유가 있을 거예요. 그 마음을 틀렸다고 하지 말고 잠깐 그대로 인정해줘도 괜찮습니다.', '지금은 정답보다 마음이 덜 흔들리는 방향이 먼저일 수 있어요. {s}를 떠올렸을 때 몸이 편해지는 선택도 살펴보세요.'],
  },
  debate: {
    junho: ['{s}는 찬반보다 어떤 기준을 우선하느냐의 문제 같아요. 편의와 배려 중 무엇을 더 크게 볼지부터 정해야 합니다.', '찬성은 효율, 반대는 관계 비용을 말할 것 같네요. {s}에서 예외를 어디까지 허용할지가 승부처입니다.'],
    jieun: ['게시글은 {s}. 이 주제를 판단하려면 상황, 빈도, 피해 정도를 따로 봐야 합니다. 한 사례를 일반 규칙으로 만들 수 있는지도 쟁점이에요.', '양쪽 주장이 모두 성립하려면 적용 조건이 달라야 해요. {s}가 언제 맞고 언제 틀리는지 사례를 붙여보면 좋겠습니다.'],
    cheolgu: ['원칙만 외치면 쉬운데 내 일이 되면 표가 바뀌죠ㅋㅋ {s}에서 본인에게 불리해도 같은 선택을 할 수 있는지가 진짜 기준 아닐까요?', '{s}는 말로는 다들 멋있게 답하지만 현실에서는 계산기부터 켤 주제네요. 조건 하나만 바뀌어도 의견이 뒤집힐 듯합니다.'],
  },
  funny: {
    minsu: ['{s}? 이건 상황 설명이 아니라 이미 예능 예고편인데요ㅋㅋ 다음 장면 자막부터 필요합니다.', '{s}에서 웃으면 안 되는데 머릿속 효과음이 먼저 재생됐습니다ㅋㅋ 후속편 주세요.'],
    cheolgu: ['{s}라니 현실이 드립 소재를 직접 납품했네요. 작가 누구냐 진짜ㅋㅋ', '이 정도면 {s}가 아니라 인생이 몰래카메라 중입니다. 카메라 위치부터 찾으세요ㅋㅋ'],
    haru: ['{s}를 한 줄로 줄이면 “웃기려고 한 건 아닌데 웃겨진 하루”네요. 묘하게 공감돼서 더 웃깁니다.', '오늘의 장면 제목은 {s}, 장르는 생활 코미디로 하겠습니다. 엔딩만큼은 평화롭길 바라요.'],
  },
  play: {
    minsu: ['{s} 이건 못 참죠ㅋㅋ 정답 아는 사람도 일단 모르는 척 한 번 고민해봅시다.', '{s} 난이도 은근한데요? 첫 느낌대로 갔다가 함정 밟을 것 같은 예감ㅋㅋ'],
    jieun: ['{s}는 제목과 제시된 단서의 공통점을 먼저 찾으면 범위가 줄어들 것 같아요. 정답 공개 전까지 힌트 한 단계만 더 생각해봅시다.', '정답을 바로 찍기보다 {s}에서 반복되는 글자나 조건을 분리해보세요. 의외로 규칙이 단순할 수 있습니다.'],
    opsbot: ['{s} 도전 시작! 정답이나 참여작은 댓글로 남기고 다른 사람의 답에는 스포일러를 피해주세요.', '{s} 참여할 사람 모여주세요. 첫 답이 완벽하지 않아도 이어서 다듬는 재미가 있습니다.'],
  },
  daily: {
    minsu: ['{s} 이런 게 은근 하루 종일 생각난다니까요ㅋㅋ 비슷한 경험 있는 사람 출석 체크 갑시다.', '{s}는 소소한데 공감 버튼은 크게 눌러야 하는 이야기네요ㅋㅋ'],
    daon: ['{s}를 공유해줘서 고마워요. 별것 아닌 것 같아도 누군가에게는 딱 필요한 공감이 될 수 있어요.', '이런 일상의 장면이 의외로 마음에 오래 남기도 해요. {s}에서 가장 기억에 남은 순간은 무엇이었나요?'],
    jieun: ['{s}는 사소해 보여도 사람마다 반응이 꽤 다를 주제예요. 상황이 달라지면 선택도 어떻게 바뀌는지 궁금합니다.', '핵심을 줄이면 {s}에 대한 생활 기준 차이 같아요. 경험이 모이면 패턴이 보일 것 같습니다.'],
  },
};

function fallbackText(character, post, room) {
  const display = `“${subject(post)}”`;
  const templates = FALLBACKS[room]?.[character.id] || [
    `${display}를 ${character.role} 시선으로 보면 또 다른 포인트가 보여요. 여러분 생각도 궁금합니다.`,
    `${character.name}의 한마디: ${display}, 이건 다른 사람 경험도 들어봐야겠네요.`,
  ];
  const seed = stableHash(`${room}|${character.id}|${post.title || ''}|${post.desc || ''}|${options(post).join('|')}`);
  return cleanText(templates[seed % templates.length].replaceAll('{s}', display), 400);
}

function fallbackComments(post, characters) {
  const room = classifyRoom(post);
  return characters.map(character => ({ id: character.id, text: fallbackText(character, post, room), source: 'fallback' }));
}

function signature(text) {
  return cleanText(text, 400).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function normalizeAiComments(raw, post, characters) {
  const allowed = new Set(characters.map(character => character.id));
  const byId = new Map();
  const seen = new Set();
  const items = Array.isArray(raw?.comments) ? raw.comments : [];
  for (const item of items) {
    const id = cleanId(item?.id, 40);
    const text = cleanText(item?.text, 400);
    const sig = signature(text);
    if (!allowed.has(id) || !text || !sig || seen.has(sig) || byId.has(id)) continue;
    seen.add(sig);
    byId.set(id, { id, text, source: 'gemini' });
  }
  const fallback = new Map(fallbackComments(post, characters).map(item => [item.id, item]));
  const comments = characters.map(character => byId.get(character.id) || fallback.get(character.id));
  return { comments, aiCount: comments.filter(item => item.source === 'gemini').length };
}

function postContext(post) {
  const lines = [
    `제목: ${cleanText(post.title, 120) || '(없음)'}`,
    `내용: ${cleanText(post.desc || post.body, 900) || '(없음)'}`,
    `type: ${cleanText(post.type, 40) || '-'}`,
    `subtype: ${cleanText(post.subtype, 40) || '-'}`,
    `feedType: ${cleanText(post.feedType, 40) || '-'}`,
    `표시 유형: ${cleanText(post.typeLabel, 40) || '-'}`,
  ];
  const opts = options(post);
  if (opts.length) lines.push(`선택지: ${opts.join(' / ')}`);
  if (post.hint) lines.push(`힌트: ${cleanText(post.hint, 100)}`);
  if (post.initials) lines.push(`초성: ${cleanText(post.initials, 30)}`);
  if (post.keyword) lines.push(`제시어: ${cleanText(post.keyword, 30)}`);
  if (post.startSentence) lines.push(`시작 문장: ${cleanText(post.startSentence, 180)}`);
  if (post.modules?.consult?.enabled) lines.push(`상담 방식: ${cleanText(post.modules.consult.styleLabel || post.modules.consult.style, 50)}`);
  if (post.modules?.drip?.enabled) lines.push(`드립 주제: ${cleanText(post.modules.drip.prompt, 160)}`);
  return lines.join('\n');
}

async function generateComments(post, characters) {
  let apiKey = '';
  try { apiKey = String(geminiKey.value() || '').trim(); } catch {}
  if (!apiKey) return { source: 'fallback-no-key', comments: fallbackComments(post, characters).map(({ id, text }) => ({ id, text })) };

  const room = classifyRoom(post);
  const characterLines = characters.map((character, index) => (
    `${index + 1}. id=${character.id}, 이름=${character.name}, 역할=${character.role}, 말투=${character.style}`
  )).join('\n');
  const exactShape = { comments: characters.map(character => ({ id: character.id, text: `${character.name}의 댓글` })) };
  const prompt = `소소킹 커뮤니티의 ${ROOMS[room].label} 게시글에 캐릭터 댓글을 작성하세요.

[게시글]
${postContext(post)}

[캐릭터]
${characterLines}

[공간 규칙]
${ROOMS[room].guide}

[필수 규칙]
- 각 캐릭터가 정확히 1개씩, 위 id와 순서대로 댓글을 씁니다.
- 댓글마다 게시글의 구체적인 단어나 상황을 하나 이상 언급합니다.
- 같은 결론, 같은 첫 문장, 같은 말투를 반복하지 않습니다.
- 실제 한국어 커뮤니티 댓글처럼 1~3문장으로 자연스럽게 씁니다.
- 안내문, 홍보문, 모욕, 혐오, 위험한 조언, 의료·법률적 단정은 금지합니다.
- JSON 이외의 텍스트와 코드블록은 출력하지 않습니다.

[출력 형식]
${JSON.stringify(exactShape)}`;

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
    const result = await model.generateContent(prompt);
    const normalized = normalizeAiComments(parseJson(result.response.text()), post, characters);
    if (normalized.aiCount > 0) {
      return {
        source: normalized.aiCount === characters.length ? 'gemini' : 'gemini-partial',
        comments: normalized.comments.map(({ id, text }) => ({ id, text })),
      };
    }
  } catch (error) {
    console.error('[ai-character-comments-v2] fallback', error);
  }
  return { source: 'fallback-error', comments: fallbackComments(post, characters).map(({ id, text }) => ({ id, text })) };
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

async function settings() {
  const snap = await db.doc('site_settings/aiCharacters').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    enabled: data.autoCommentsEnabled !== false,
    count: Math.max(1, Math.min(Number(data.autoCommentCount || 3), 3)),
  };
}

function shouldSkip(post) {
  return !post || post.hidden === true || post.aiCharacterCommentsDisabled === true || post.aiCharacterCommented === true || post.feedType === 'tournament' || post.modules?.tournament?.enabled;
}

async function writeComments({ postRef, postId, post, characters, generated, actorId, replaceExisting = false }) {
  const oldSnap = replaceExisting
    ? await postRef.collection('comments').where('isAiCharacter', '==', true).limit(50).get()
    : { docs: [] };
  const batch = db.batch();
  oldSnap.docs.forEach(doc => batch.delete(doc.ref));

  const now = Date.now();
  const written = [];
  generated.comments.forEach(item => {
    const character = CHARACTERS.find(candidate => candidate.id === item.id);
    if (!character || !item.text) return;
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
  });
  if (!written.length) return [];

  const delta = written.length - oldSnap.docs.length;
  batch.update(postRef, {
    commentCount: FieldValue.increment(delta),
    aiCharacterCommented: true,
    aiCharacterCommentedAt: FieldValue.serverTimestamp(),
    aiCharacterCommentSource: generated.source,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`system_jobs/ai_character_comments_${postId}_${now}`), {
    postId,
    postTitle: cleanText(post.title, 160),
    room: classifyRoom(post),
    characterIds: written.map(item => item.characterId),
    count: written.length,
    replacedCount: oldSnap.docs.length,
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
  const claimed = await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    if (data.status === 'completed') return false;
    if (data.status === 'started' && now - Number(data.startedAtMs || 0) < 10 * 60 * 1000) return false;
    transaction.set(ref, { postId, status: 'started', startedAtMs: now, startedAt: FieldValue.serverTimestamp() }, { merge: true });
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

exports.generateAiCharacterCommentsTest = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 120, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth?.uid);
  const { postId, characterIds, count, dryRun } = request.data || {};
  const { ref, postId: safePostId, post } = await loadPost(postId);
  const characters = pickCharacters(post, characterIds, count);
  const generated = await generateComments(post, characters);
  if (dryRun === true) return { ok: true, dryRun: true, postId: safePostId, source: generated.source, comments: generated.comments };
  const comments = await writeComments({
    postRef: ref,
    postId: safePostId,
    post,
    characters,
    generated,
    actorId: request.auth.uid,
    replaceExisting: request.data?.replaceExisting !== false,
  });
  return { ok: true, postId: safePostId, source: generated.source, comments };
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
  if (!postId || shouldSkip(post)) return;
  const config = await settings();
  if (!config.enabled) return;

  const marker = await claimMarker(postId);
  if (!marker.claimed) return;
  try {
    const postRef = db.doc(`feeds/${postId}`);
    const characters = pickCharacters(post, [], config.count);
    const generated = await generateComments(post, characters);
    const written = await writeComments({
      postRef,
      postId,
      post,
      characters,
      generated,
      actorId: post.isAiGenerated === true ? 'auto-ai-post' : 'auto-user-post',
    });
    await marker.ref.set({
      status: 'completed',
      count: written.length,
      source: generated.source,
      characterIds: written.map(item => item.characterId),
      completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('[ai-character-comments-v2] trigger failed', error);
    await marker.ref.set({ status: 'failed', error: cleanText(error?.message, 300), failedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
});
