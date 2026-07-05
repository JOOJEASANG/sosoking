'use strict';

const { randomInt } = require('crypto');
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

const CONTENT_POOLS = {
  vote: [
    { title: '배달비 4천원인데 시켜 먹는다 VS 참는다', desc: '배는 고픈데 배달비가 메뉴값처럼 느껴지는 순간입니다. 이건 지갑의 문제일까요, 행복의 문제일까요?', tags: ['토론소', 'VS', '배달비'], options: ['시켜 먹는다', '참는다'] },
    { title: '주말 약속 취소되면 아쉽다 VS 오히려 좋다', desc: '외출 준비까지 마음먹었는데 약속이 취소됐습니다. 이건 실망일까요, 자유일까요?', tags: ['토론소', '주말', '약속'], options: ['아쉽다', '오히려 좋다'] },
    { title: '카톡 답장은 바로 한다 VS 몰아서 한다', desc: '답장을 빨리 해야 예의라는 쪽과, 여유 있을 때 하는 게 낫다는 쪽이 갈립니다.', tags: ['토론소', '카톡', '관계'], options: ['바로 한다', '몰아서 한다'] },
    { title: '탕수육은 찍먹 VS 부먹', desc: '소스의 바삭함 보존과 양념의 완성도 사이에서 매번 갈리는 오래된 논쟁입니다.', tags: ['토론소', '음식', '탕수육'], options: ['찍먹', '부먹'] },
    { title: '아침 30분 더 자기 VS 여유롭게 준비하기', desc: '잠은 달콤하지만 허둥대는 아침은 위험합니다. 어느 쪽이 하루를 더 살릴까요?', tags: ['토론소', '아침', '생활'], options: ['30분 더 자기', '여유롭게 준비'] },
    { title: '영화관 팝콘은 필수 VS 없어도 된다', desc: '영화 몰입에는 팝콘이 필요하다는 쪽과, 조용히 보는 게 낫다는 쪽의 대결입니다.', tags: ['토론소', '영화', '간식'], options: ['팝콘 필수', '없어도 된다'] },
    { title: '단톡방 읽씹은 괜찮다 VS 예의 없다', desc: '바쁘면 읽고 넘어갈 수도 있다는 의견과, 최소한 반응은 해야 한다는 의견이 갈립니다.', tags: ['토론소', '단톡방', '관계'], options: ['괜찮다', '예의 없다'] },
    { title: '비 오는 날 외출 VS 집콕', desc: '빗소리를 들으며 나가는 감성과, 이불 밖은 위험하다는 본능이 맞붙습니다.', tags: ['토론소', '비오는날', '일상'], options: ['외출', '집콕'] },
    { title: '야식은 치킨 VS 라면', desc: '배고픈 밤, 바삭한 치킨과 뜨끈한 라면 중 하나만 고를 수 있다면?', tags: ['토론소', '야식', '음식'], options: ['치킨', '라면'] },
    { title: '휴가 때 계획표 필수 VS 즉흥이 최고', desc: '시간 낭비 없는 계획 여행과, 그날 기분 따라 움직이는 즉흥 여행이 갈립니다.', tags: ['토론소', '여행', '휴가'], options: ['계획표 필수', '즉흥이 최고'] },
  ],
  drip: [
    { title: '퇴근 5분 전 회의 이름 지어주세요', desc: '퇴근 5분 전에 “잠깐 회의 가능?” 메시지가 왔을 때의 감정을 한 줄로 살려주세요.', tags: ['드립소', '작명', '직장인'] },
    { title: '배달 예상시간이 계속 늘어날 때 한마디', desc: '20분이 40분이 되고 다시 55분이 됐을 때, 내 영혼이 할 법한 말을 남겨주세요.', tags: ['드립소', '배달', '한줄드립'] },
    { title: '월요일 아침 알람 별명 짓기', desc: '월요일 아침에 울리는 알람을 사람처럼 부른다면 어떤 이름이 어울릴까요?', tags: ['드립소', '월요일', '작명'] },
    { title: '냉장고 열었는데 먹을 게 없을 때 대사', desc: '분명 뭔가 있을 줄 알고 열었는데 물병만 반겨주는 순간의 한 줄을 적어주세요.', tags: ['드립소', '일상', '냉장고'] },
    { title: '카드값 알림 문자 웃기게 번역하기', desc: '카드값 알림 문자를 더 잔인하지만 웃긴 말투로 번역해주세요.', tags: ['드립소', '번역', '월급'] },
    { title: '와이파이 느릴 때 나오는 표정 이름 짓기', desc: '영상은 멈추고 로딩 동그라미만 도는 순간의 표정을 이름으로 만들어주세요.', tags: ['드립소', '와이파이', '작명'] },
    { title: '프린터가 꼭 급할 때만 안 될 때 한마디', desc: '평소엔 조용하다가 급한 출력 앞에서 멈춰버린 프린터에게 한 줄 남겨주세요.', tags: ['드립소', '프린터', '사무실'] },
    { title: '비밀번호 한 글자 틀렸을 때의 감정 이름', desc: '분명 맞게 친 것 같은데 로그인이 안 되는 순간의 감정을 작명해주세요.', tags: ['드립소', '로그인', '작명'] },
    { title: '엘리베이터 문 닫히는 순간 누가 타려고 할 때', desc: '열림 버튼을 누를지 모른 척할지 고민되는 그 0.5초를 한 줄로 표현해주세요.', tags: ['드립소', '엘리베이터', '일상'] },
    { title: '컵라면 물 붓고 젓가락 없는 걸 알았을 때', desc: '모든 준비가 끝난 줄 알았는데 젓가락이 없는 상황을 웃기게 받아쳐주세요.', tags: ['드립소', '컵라면', '위기'] },
    { title: '파일 이름 최종_진짜최종_수정본 별명 짓기', desc: '최종 파일이 계속 새끼를 치는 상황에 어울리는 이름을 지어주세요.', tags: ['드립소', '파일명', '직장인'] },
    { title: '핸드폰 배터리 1%의 마지막 유언', desc: '충전기를 찾기 전 꺼져가는 배터리가 남길 법한 마지막 말을 적어주세요.', tags: ['드립소', '배터리', '한줄드립'] },
    { title: '택배 배송완료인데 문 앞에 없을 때 한마디', desc: '알림은 배송완료인데 현관 앞은 평화로운 빈 공간일 때의 대사를 남겨주세요.', tags: ['드립소', '택배', '상황극'] },
    { title: '회의 중 마이크 켜진 줄 몰랐을 때 제목 짓기', desc: '혼잣말이 회의실 전체에 생중계된 순간을 뉴스 제목처럼 만들어주세요.', tags: ['드립소', '회의', '뉴스체'] },
    { title: '아이스 아메리카노 얼음만 남았을 때 이름', desc: '커피는 떠났고 얼음만 남은 컵의 상태를 그럴듯하게 작명해주세요.', tags: ['드립소', '커피', '작명'] },
    { title: '자동문 앞에서 문이 안 열릴 때의 존엄성', desc: '자동문이 나만 인식하지 못하는 순간을 한 줄 드립으로 살려주세요.', tags: ['드립소', '자동문', '일상'] },
    { title: '우산 안 가져온 날 비 오는 하늘에게 한마디', desc: '날씨 앱을 믿지 않은 대가를 치르는 순간, 하늘에게 할 말을 남겨주세요.', tags: ['드립소', '비', '한줄드립'] },
    { title: '치킨무 국물 쏟았을 때 사건명', desc: '식탁 위에 펼쳐진 하얀 참사를 사건명처럼 지어주세요.', tags: ['드립소', '치킨', '사건명'] },
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

function pickFromPool(preset) {
  const pool = CONTENT_POOLS[preset] || CONTENT_POOLS.drip;
  return pool[randomInt(0, pool.length)];
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
  const normalized = normalizePreset(preset);
  const data = pickFromPool(normalized);
  const isVote = normalized === 'vote';
  const label = isVote ? '토론소' : '드립소';
  const seed = `${actorId}-${Date.now()}-${randomInt(100000, 999999)}`;
  const virtualAuthor = pickVirtualAuthor(normalized, seed);
  const doc = {
    type: 'multi',
    cat: 'multi',
    subtype: normalized,
    feedType: normalized,
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
    aiPreset: normalized,
    aiActorId: actorId,
    aiContentSeed: seed,
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
  doc.aiCharacterPanel = buildAiPanel(normalized, doc);
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
