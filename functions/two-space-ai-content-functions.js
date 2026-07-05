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

const CHARACTER_META = {
  jujup: { id: 'jujup', name: '주접러', emoji: '😍', role: '호들갑 칭찬러' },
  rebel: { id: 'rebel', name: '반항아', emoji: '😤', role: '삐딱한 반대충' },
  bothsides: { id: 'bothsides', name: '갈팡러', emoji: '🤔', role: '양쪽 다 맞는 중립러' },
  fact: { id: 'fact', name: '팩폭러', emoji: '🧊', role: '핵심 요약러' },
  madcap: { id: 'madcap', name: '광기러', emoji: '🤪', role: '이상한 상상러' },
  conspiracy: { id: 'conspiracy', name: '음모론자', emoji: '👁️', role: '과몰입 추리러' },
  ajae: { id: 'ajae', name: '아재봇', emoji: '🧓', role: '썰렁 개그 담당' },
  overreact: { id: 'overreact', name: '과몰입러', emoji: '🎭', role: '대서사 담당' },
};
const DEBATE_LEFT = ['rebel', 'fact', 'conspiracy', 'ajae'];
const DEBATE_RIGHT = ['jujup', 'bothsides', 'madcap', 'overreact'];
const DRIP_ORDER = ['jujup', 'madcap', 'ajae', 'overreact'];

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

function character(id, extras = {}) {
  return { ...CHARACTER_META[id], ...extras };
}

function debateCharacter(id, team, target, opponent, replyTo) {
  const teamName = team === 'left' ? '왼쪽팀' : '오른쪽팀';
  const lines = {
    jujup: [`${target} 이거 그냥 지나가면 예의가 아닙니다. 선택지에서 이미 주인공 냄새가 납니다.`, `${replyTo} 말도 이해는 하는데, 이건 의심보다 박수가 먼저 나와야 합니다.`, `${teamName} 입장에서는 ${target}가 댓글창을 더 살립니다.`],
    rebel: [`저는 ${target} 쪽입니다. 다들 ${opponent}로 빨리 가려는 게 더 수상합니다.`, `처음 기준을 잘못 잡으면 계속 끌려갑니다. 저는 ${target} 쪽 뒤끝이 덜하다고 봅니다.`, `${replyTo}가 분위기를 말해도 저는 결제창과 후회를 먼저 봅니다.`],
    bothsides: [`저는 ${target} 쪽인데 말하면서도 ${opponent}가 계속 고개를 듭니다.`, `${replyTo} 말도 맞습니다. 그런데 ${target}에는 설명하기 어려운 생활의 맛이 있습니다.`, `둘 다 들으니까 더 모르겠지만 오늘은 흔들리면서 ${target}입니다.`],
    fact: [`감정 빼고 보면 ${target} 쪽 기준이 더 선명합니다.`, `${replyTo} 말처럼 분위기도 중요하지만 선택 후 손해가 덜 남는 쪽을 봐야 합니다.`, `핵심은 지금의 기분이 아니라 나중의 후회입니다.`],
    madcap: [`${target}로 가는 순간 장르가 바뀝니다. 갑자기 일상이 예고편 톤이 됩니다.`, `${replyTo}는 현실을 봤지만 저는 세계관을 봤습니다.`, `이건 평범한 VS가 아니라 현실이 선택지 버튼을 잘못 눌러 열린 포털입니다.`],
    conspiracy: [`저는 ${target} 뒤의 생활 패턴을 봤습니다. 이건 우연이 아닙니다.`, `${opponent}가 너무 그럴듯해 보이는 순간이 오히려 함정입니다.`, `${replyTo}가 세계관을 봤다면 저는 작전을 봤습니다. 이건 습관 세력 간 전쟁입니다.`],
    ajae: [`저는 ${target}에 한 표 올립니다. 표가 아니라 표정 관리입니다.`, `${opponent}도 좋지만 너무 뜨거우면 국밥도 식습니다.`, `${replyTo}가 크게 갔으니 저는 짧게 갑니다. ${target}입니다.`],
    overreact: [`이건 단순히 ${target}를 고르는 장면이 아닙니다. 주인공이 결심하는 컷입니다.`, `${replyTo} 말까지 들어오니까 이 토론은 이미 클라이맥스입니다.`, `${opponent}는 안정적인 조연이고, ${target}는 음악 깔리는 선택지입니다.`],
  };
  const punchline = {
    jujup: `${target}는 선택이 아니라 축제입니다. 지금 박수 치면서 눌러야 합니다.`,
    rebel: `저는 일단 ${target}. 반대부터 해야 토론소가 열립니다.`,
    bothsides: `제 결론은 ${target}입니다. 물론 3초 뒤에 바뀔 수 있습니다.`,
    fact: `정리하면 ${target}. 이건 기분 문제가 아니라 후회 관리입니다.`,
    madcap: `${target} 누르는 순간 현실이 오늘 업데이트를 잘못 눌렀습니다.`,
    conspiracy: `${target}는 선택지가 아닙니다. 생활 질서 회복 작전입니다.`,
    ajae: `${target}로 가야 합니다. 선택은 짧고 후회는 깁니다.`,
    overreact: `${target}. 이 장면은 엔딩 크레딧 올라갈 때 박수 나옵니다.`,
  };
  return character(id, { team, targetOption: target, replyTo, stance: `${target} 편 · ${CHARACTER_META[id].role}`, lines: lines[id], punchline: punchline[id] });
}

function buildDebateCharacters(options) {
  const left = options[0] || '왼쪽 선택지';
  const right = options[1] || '오른쪽 선택지';
  return [
    ...DEBATE_LEFT.map((id, index) => debateCharacter(id, 'left', left, right, CHARACTER_META[DEBATE_RIGHT[index]].name)),
    ...DEBATE_RIGHT.map((id, index) => debateCharacter(id, 'right', right, left, CHARACTER_META[DEBATE_LEFT[index]].name)),
  ];
}

function buildDripCharacters() {
  return DRIP_ORDER.map(id => {
    const presets = {
      jujup: { replyTo: '', stance: '소재를 크게 띄움', lines: ['이 소재는 그냥 지나가면 드립 예의가 아닙니다.', '제목부터 이미 댓글러들 입장권입니다.', '한 줄만 잘 붙이면 바로 저장감입니다.'], punchline: '이 상황은 그냥 지나가면 예의가 아닙니다.' },
      madcap: { replyTo: '주접러', stance: '세계관 확장', lines: ['이건 현실이 잠깐 서버 오류 낸 장면입니다.', '주접러가 박수 치는 사이 저는 세계관 설정집을 열었습니다.', '상황이 아니라 다음 시즌 예고편에 가깝습니다.'], punchline: '현실이 오늘 업데이트를 잘못 눌렀습니다.' },
      ajae: { replyTo: '광기러', stance: '짧은 말장난', lines: ['드립은 짧아야 제맛입니다. 길면 국밥도 식습니다.', '광기러님 세계관은 큰데 저는 한 숟갈만 얹겠습니다.', '이 소재는 웃기려고 한 게 아니라 웃기게 태어났습니다.'], punchline: '이건 드립이 아니라 드립커피처럼 천천히 내려온 웃음입니다.' },
      overreact: { replyTo: '아재봇', stance: '영화처럼 키움', lines: ['이건 그냥 상황이 아니라 3부작의 시작입니다.', '아재봇이 분위기를 얼렸고 이제 제가 배경음악을 깔겠습니다.', '지금은 웃지만 2화부터 장르가 바뀔 수 있습니다.'], punchline: '이 장면, 엔딩 크레딧 올라갈 때 박수 나옵니다.' },
    }[id];
    return character(id, { team: 'drip', targetOption: '', ...presets });
  });
}

function buildAiPanel(preset, doc) {
  const isVote = preset === 'vote';
  const options = isVote ? (doc.modules?.vote?.options || []).map(item => item.text).filter(Boolean).slice(0, 2) : [];
  return {
    enabled: true,
    status: 'fallback',
    kind: isVote ? 'vote' : 'drip',
    headline: isVote ? '운영봇이 랜덤 4대4 토론소를 열었습니다' : '운영봇이 드립소를 열었습니다',
    imageRead: '',
    imageCountAnalyzed: 0,
    host: {
      id: 'opsbot',
      name: '운영봇',
      emoji: '🤖',
      role: '사회자',
      opening: isVote ? `오늘의 토론소 안건은 “${doc.title}”입니다. 캐릭터 8명이 4대4로 나눠 붙습니다.` : `오늘의 드립소 소재는 “${doc.title}”입니다.`,
      summary: isVote ? `${options.join(' VS ')} 구도로 의견이 갈릴 수 있습니다.` : '짧게 받을수록 더 웃긴 소재입니다.',
      question: isVote ? '어느 쪽인지 투표하고 이유를 한 줄로 남겨주세요.' : '이 상황을 더 웃긴 한 줄로 받아쳐주세요.',
    },
    characters: isVote ? buildDebateCharacters(options) : buildDripCharacters(),
    bestLines: isVote ? ['이건 기분 문제가 아니라 후회 관리입니다.', '선택지가 아니라 생활 질서 회복 작전입니다.'] : ['현실이 오늘 업데이트를 잘못 눌렀습니다.', '이 상황은 그냥 지나가면 예의가 아닙니다.'],
    commentPrompt: isVote ? '투표하고 어느 팀 말이 더 웃겼는지도 댓글로 남겨주세요.' : '더 웃긴 이름이나 한 줄 드립을 댓글로 남겨주세요.',
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
