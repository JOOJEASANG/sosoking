'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const PRESETS = ['vote', 'drip'];
const HTTPS_ERROR_CODES = new Set([
  'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found',
  'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition',
  'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable',
  'data-loss', 'unauthenticated',
]);

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function clean(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function normalizePreset(value) {
  const key = String(value || 'drip').trim();
  if (['vote', 'debate', 'discussion', 'ox', 'day_room', 'day', 'judgment', 'court'].includes(key)) return 'vote';
  if (['drip', 'cbattle', 'ended_room', 'ended', 'consult', 'quiz', 'advice', 'naming', 'translation'].includes(key)) return 'drip';
  return PRESETS.includes(key) ? key : 'drip';
}

function rethrowCallableError(error, scope) {
  const code = String(error && error.code || '').replace(/^functions\//, '');
  if (HTTPS_ERROR_CODES.has(code)) {
    throw new HttpsError(code, error.message || '요청을 처리하지 못했습니다.');
  }
  console.error(`[${scope}]`, error);
  throw new HttpsError('internal', error && error.message ? error.message : '소소킹 AI 데이터 생성 중 오류가 발생했습니다.');
}

async function assertAdmin(request) {
  const auth = request.auth || {};
  const uid = auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const token = auth.token || {};
  if (token.admin === true || token.owner === true) return uid;
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한을 확인하지 못했습니다. admins 문서 또는 관리자 claim을 확인하세요.');
  return uid;
}

function sample(preset) {
  if (preset === 'vote') return {
    title: '배달비 4천원인데 시켜 먹는다 VS 참는다',
    desc: '배는 고픈데 배달비가 메뉴값처럼 느껴지는 순간입니다. 이건 지갑의 문제일까요, 행복의 문제일까요?',
    tags: ['토론소', 'VS', '배달비'],
    options: ['시켜 먹는다', '참는다'],
  };
  return {
    title: '이 상황 이름 지어주세요',
    desc: '퇴근 5분 전에 “잠깐 회의 가능?” 메시지가 왔을 때의 감정을 한 줄로 살려주세요.',
    tags: ['드립소', '작명', '직장인'],
  };
}

function buildAiPanel(preset, doc) {
  const isVote = preset === 'vote';
  return {
    enabled: true,
    status: 'fallback',
    kind: isVote ? 'vote' : 'drip',
    headline: isVote ? '운영봇이 토론소를 열었습니다' : '운영봇이 드립소를 열었습니다',
    imageRead: '',
    imageCountAnalyzed: 0,
    host: {
      id: 'opsbot',
      name: '운영봇',
      emoji: '🤖',
      role: '사회자',
      opening: isVote ? `오늘의 토론소 안건은 “${doc.title}”입니다.` : `오늘의 드립소 소재는 “${doc.title}”입니다.`,
      summary: isVote ? '사소하지만 은근히 갈릴 만한 VS 주제입니다.' : '짧게 받을수록 더 웃긴 소재입니다.',
      question: isVote ? '어느 쪽인지 투표하고 이유를 한 줄로 남겨주세요.' : '이 상황을 더 웃긴 한 줄로 받아쳐주세요.',
    },
    characters: isVote ? [
      { id: 'junho', name: '준호', emoji: '🗳️', role: '토론러', stance: 'VS 구도 정리', lines: ['이건 돈을 아끼는 문제가 아니라 만족도를 어디에 두느냐의 문제입니다.'], punchline: '토론소는 사소할수록 더 치열합니다.' },
      { id: 'jieun', name: '지은', emoji: '🧠', role: '똑똑이', stance: '현실 분석', lines: ['가격보다 중요한 건 후회 확률입니다. 먹고 후회할지, 안 먹고 후회할지부터 봐야 합니다.'], punchline: '이건 소비가 아니라 후회 관리입니다.' },
      { id: 'cheolgu', name: '철구', emoji: '😈', role: '매운맛', stance: '허점 찌르기', lines: ['참는다고 내일 부자가 되진 않는데, 시키면 오늘은 행복할 수 있습니다.'], punchline: '지갑은 울고 배는 박수칠 안건입니다.' },
    ] : [
      { id: 'minsu', name: '민수', emoji: '😂', role: '드립왕', stance: '커뮤식 한 줄', lines: ['퇴근 5분 전 회의는 사실상 현대인의 매복 공격입니다.'], punchline: '이건 회의가 아니라 퇴근길 검문소입니다.' },
      { id: 'cheolgu', name: '철구', emoji: '😈', role: '매운맛', stance: '현실 찌르기', lines: ['잠깐이라고 한 사람 중에 진짜 잠깐인 사람 거의 못 봤습니다.'], punchline: '잠깐 회의 = 오늘 저녁 압수.' },
      { id: 'jieun', name: '지은', emoji: '🧠', role: '똑똑이', stance: '상황 분석', lines: ['웃음 포인트는 ‘잠깐’이라는 말과 현실 시간의 괴리입니다.'], punchline: '단어는 잠깐인데 피해는 장기전입니다.' },
    ],
    bestLines: isVote ? ['지갑은 울고 배는 박수칠 안건입니다.', '이건 소비가 아니라 후회 관리입니다.'] : ['잠깐 회의 = 오늘 저녁 압수.', '이건 회의가 아니라 퇴근길 검문소입니다.'],
    commentPrompt: isVote ? '투표하고 한 줄 이유를 남겨주세요.' : '더 웃긴 이름이나 한 줄 드립을 댓글로 남겨주세요.',
    model: 'fallback',
    generatedAt: FieldValue.serverTimestamp(),
  };
}

function buildDoc(preset, actorId) {
  const data = sample(preset);
  const isVote = preset === 'vote';
  const label = isVote ? '토론소' : '드립소';
  const doc = {
    type: 'multi',
    cat: 'multi',
    subtype: preset,
    feedType: preset,
    typeLabel: label,
    title: clean(data.title, 100),
    desc: clean(data.desc, 1200),
    tags: Array.isArray(data.tags) ? data.tags.map(tag => clean(tag, 20)).filter(Boolean).slice(0, 8) : [label, '소소킹'],
    images: [],
    modules: { comments: { enabled: true } },
    anonymous: false,
    anonymousMode: '',
    authorId: 'sosoking-ai',
    authorName: '소소킹 운영봇',
    authorPhoto: '',
    authorEmail: '',
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    pointsScore: 0,
    isAiGenerated: true,
    aiGeneratedDate: todayKST(),
    aiSource: 'two-space-community',
    aiPreset: preset,
    aiActorId: actorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (isVote) {
    const options = Array.isArray(data.options) && data.options.length >= 2 ? data.options : ['찬성', '반대'];
    doc.modules.vote = { enabled: true, voteMode: 'pros_cons', question: doc.desc, options: options.slice(0, 4).map(text => ({ text, votes: 0 })) };
  } else {
    doc.modules.drip = { enabled: true, prompt: doc.desc, maxLength: 50, responseLabel: '한 줄 드립' };
  }
  doc.aiCharacterPanel = buildAiPanel(preset, doc);
  return doc;
}

async function createOne(preset, actorId) {
  const normalized = normalizePreset(preset);
  const ref = db.collection('feeds').doc();
  const doc = buildDoc(normalized, actorId);
  await ref.set(doc);
  return { ok: true, preset: normalized, typeLabel: doc.typeLabel, docId: ref.id, title: doc.title, path: `/detail/${ref.id}`, source: 'two-space-community' };
}

exports.generateAiContentNow = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  try {
    const uid = await assertAdmin(request);
    return await createOne(request.data && (request.data.preset || request.data.type), uid);
  } catch (error) {
    rethrowCallableError(error, 'generateAiContentNow');
  }
});

exports.generateAllAiContentNow = onCall({ region: REGION, timeoutSeconds: 300 }, async request => {
  try {
    const uid = await assertAdmin(request);
    const results = [];
    for (const preset of PRESETS) results.push(await createOne(preset, uid));
    return { ok: true, total: results.length, results };
  } catch (error) {
    rethrowCallableError(error, 'generateAllAiContentNow');
  }
});
