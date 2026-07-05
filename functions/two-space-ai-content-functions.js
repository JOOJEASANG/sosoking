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

const VIRTUAL_AUTHORS = {
  vote: [
    { id: 'virtual-debate-001', name: '논쟁구경꾼' },
    { id: 'virtual-debate-002', name: '선택장애온사람' },
    { id: 'virtual-debate-003', name: '반반무많이' },
    { id: 'virtual-debate-004', name: '한표던지고감' },
  ],
  drip: [
    { id: 'virtual-drip-001', name: '드립수집가' },
    { id: 'virtual-drip-002', name: '웃참실패자' },
    { id: 'virtual-drip-003', name: '퇴근5분전' },
    { id: 'virtual-drip-004', name: '댓글장인연습생' },
  ],
};

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
  if (['vote', 'debate', 'discussion', 'ox', 'day_room', 'day'].includes(key)) return 'vote';
  if (['drip', 'cbattle', 'ended_room', 'ended', 'naming', 'translation'].includes(key)) return 'drip';
  return PRESETS.includes(key) ? key : 'drip';
}

function pickVirtualAuthor(preset, seed = '') {
  const pool = VIRTUAL_AUTHORS[preset] || VIRTUAL_AUTHORS.drip;
  const basis = `${todayKST()}-${preset}-${seed}`;
  let hash = 0;
  for (let i = 0; i < basis.length; i += 1) hash = (hash * 31 + basis.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
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
      { id: 'rebel', name: '반항아', emoji: '😤', role: '삐딱한 반대충', stance: '일단 반대쪽부터 봄', lines: ['다들 행복을 말하지만 저는 지갑의 표정을 먼저 봅니다.'], punchline: '저는 일단 반대합니다. 이유는 결제창이 알고 있습니다.' },
      { id: 'bothsides', name: '갈팡러', emoji: '🤔', role: '양쪽 다 맞는 중립러', stance: '둘 다 그럴듯함', lines: ['시켜 먹으면 행복하고, 참으면 통장이 웃습니다. 양쪽이 다 너무 설득력 있습니다.'], punchline: '제 결론은 명확합니다. 오늘도 결론을 보류하겠습니다.' },
      { id: 'fact', name: '팩폭러', emoji: '🧊', role: '핵심 요약러', stance: '핵심만 정리', lines: ['핵심은 하나입니다. 지금 배고픔이 내일 후회보다 센가입니다.'], punchline: '이건 배달비 문제가 아니라 후회비 문제입니다.' },
    ] : [
      { id: 'jujup', name: '주접러', emoji: '😍', role: '호들갑 칭찬러', stance: '소재를 크게 띄움', lines: ['퇴근 5분 전 회의라니, 이건 직장인 세계관 최종 보스입니다.'], punchline: '이 상황은 그냥 지나가면 드립 예의가 아닙니다.' },
      { id: 'madcap', name: '광기러', emoji: '🤪', role: '이상한 상상러', stance: '세계관 확장', lines: ['잠깐 회의는 사실 퇴근을 잡아먹는 포켓몬입니다.'], punchline: '현실이 오늘 퇴근 버튼을 잘못 눌렀습니다.' },
      { id: 'ajae', name: '아재봇', emoji: '🧓', role: '썰렁 개그 담당', stance: '일부러 낡은 말장난', lines: ['회의가 길어지면 회의감도 길어집니다.'], punchline: '이건 회의가 아니라 회의감입니다.' },
    ],
    bestLines: isVote ? ['이건 배달비 문제가 아니라 후회비 문제입니다.', '제 결론은 명확합니다. 오늘도 결론을 보류하겠습니다.'] : ['현실이 오늘 퇴근 버튼을 잘못 눌렀습니다.', '이건 회의가 아니라 회의감입니다.'],
    commentPrompt: isVote ? '투표하고 한 줄 이유를 남겨주세요.' : '더 웃긴 이름이나 한 줄 드립을 댓글로 남겨주세요.',
    model: 'fallback',
    generatedAt: FieldValue.serverTimestamp(),
  };
}

function buildDoc(preset, actorId) {
  const data = sample(preset);
  const isVote = preset === 'vote';
  const label = isVote ? '토론소' : '드립소';
  const virtualAuthor = pickVirtualAuthor(preset, actorId);
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
    authorId: virtualAuthor.id,
    authorName: virtualAuthor.name,
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
    aiVirtualAuthor: true,
    aiHostId: 'opsbot',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (isVote) {
    const options = Array.isArray(data.options) && data.options.length >= 2 ? data.options : ['왼쪽', '오른쪽'];
    doc.modules.vote = { enabled: true, voteMode: 'pros_cons', question: doc.desc, options: options.slice(0, 2).map(text => ({ text, votes: 0 })) };
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
  return { ok: true, preset: normalized, typeLabel: doc.typeLabel, docId: ref.id, title: doc.title, authorName: doc.authorName, path: `/detail/${ref.id}`, source: 'two-space-community' };
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
