const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TYPES = [
  {
    type: '미친작명소', badge: '📸', tag: '미친작명소',
    titles: [
      '이 사진 제목 누가 제일 미쳤나요?',
      '오늘의 미친 작명 배틀',
      '작명 센스 폭발 챌린지',
      '사진 보고 제목부터 떠오른 사람?',
      '댓글 제목학원 말고 미친작명소',
      '이 장면에 딱 맞는 제목은?',
      '사진 한 장으로 웃겨보기',
      '작명왕은 누구인가요?'
    ],
    questions: [
      '이 사진에 제일 어울리는 작명은?',
      '댓글로 가장 미친 제목을 남겨주세요.',
      '가장 센스 있는 제목은 무엇일까요?',
      '이 장면을 한 줄 제목으로 만들면?',
      '제목만 보고도 웃긴 작명은?',
      '오늘의 작명왕은 누가 될까요?'
    ],
    prompts: [
      '사진 한 장을 보고 떠오르는 제목을 댓글로 남겨보세요. 제일 웃긴 작명은 추천을 많이 받아 위로 올라갑니다.',
      '상황을 너무 진지하게 보지 말고, 일부러 과장해서 제목을 붙여보세요. 미친작명소는 센스 싸움입니다.',
      '짧고 강한 제목일수록 좋습니다. 웃긴 제목, 황당한 제목, 묘하게 찰떡인 제목을 댓글로 남겨주세요.',
      '이 사진을 밈처럼 만든다면 어떤 제목이 가장 잘 어울릴까요? 댓글 추천으로 작명 순위를 정해보세요.',
      '제목 하나로 분위기를 바꿔보는 작명 놀이입니다. 가장 웃긴 제목에 느낌 추천을 눌러주세요.',
      '사진 속 상황을 상상해서 한 줄 제목을 만들어보세요. 작명 1위에 도전해보세요.'
    ],
    options: ['댓글로 작명', '웃긴 제목 추천', '센스 작명', '미친 제목']
  },
  {
    type: '밸런스게임', badge: '⚖️', tag: '밸런스게임',
    titles: [
      '평생 하나만 고른다면?',
      '오늘의 선택 밸런스',
      '은근히 갈리는 소소 밸런스',
      '이 선택은 진짜 어렵다',
      '둘 중 하나만 가능하다면?',
      '취향 갈리는 선택지',
      '사소하지만 진심인 밸런스',
      '친구랑 하면 갈릴 질문'
    ],
    questions: [
      '당신의 선택은?',
      '둘 중 더 참기 힘든 쪽은?',
      '하나만 고른다면 어느 쪽인가요?',
      '이 상황에서 더 끌리는 선택은?',
      '댓글로 이유까지 남겨볼까요?',
      '친구에게 물어봐도 갈릴 선택은?'
    ],
    prompts: [
      '가볍게 고르고 댓글로 이유를 남겨보세요. 생각보다 취향이 갈릴 수 있습니다.',
      '정답은 없습니다. 선택만 해도 은근히 갈리는 오늘의 밸런스게임입니다.',
      '둘 다 애매해도 하나만 골라보세요. 댓글로 이유를 남기면 더 재밌습니다.',
      '사소하지만 막상 고르려면 고민되는 질문입니다. 당신의 기준을 알려주세요.',
      '가족, 친구, 직장 동료에게 물어보면 답이 다를 수 있는 밸런스 주제입니다.',
      '오늘의 밸런스는 가볍게 웃고 넘기는 용도입니다. 선택 후 이유를 남겨보세요.'
    ],
    options: ['A 선택', 'B 선택', '둘 다 가능', '댓글로 다른 선택']
  },
  {
    type: '정답 퀴즈', badge: '✅', tag: '퀴즈',
    titles: [
      '오늘의 소소 퀴즈',
      '알면 은근 뿌듯한 퀴즈',
      '찍어도 재밌는 4지선다',
      '상식인 듯 아닌 듯 퀴즈',
      '가볍게 풀어보는 퀴즈',
      '댓글로 정답 토론해보기',
      '맞히면 기분 좋은 문제',
      '오늘의 두뇌 워밍업'
    ],
    questions: [
      '정답은 무엇일까요?',
      '가장 그럴듯한 답을 골라보세요.',
      '당신이 생각하는 답은?',
      '찍는다면 몇 번인가요?',
      '댓글로 풀이를 남겨볼까요?',
      '정답을 알고 있다면 힌트를 남겨주세요.'
    ],
    prompts: [
      '정답을 고르고 댓글로 이유를 적어보세요. 쉬워 보여도 은근히 헷갈릴 수 있습니다.',
      '가볍게 풀 수 있는 오늘의 퀴즈입니다. 자신 있는 선택지를 골라보세요.',
      '정답을 몰라도 괜찮습니다. 가장 그럴듯한 답을 고르고 댓글로 추리해보세요.',
      '오늘의 소소 퀴즈입니다. 맞히면 기분 좋고 틀려도 댓글에서 배우면 됩니다.',
      '친구에게 물어봐도 재밌을 만한 문제입니다. 답을 고르고 이유를 남겨주세요.',
      '퀴즈는 가볍게 즐기는 용도입니다. 정답 토론은 댓글에서 이어가보세요.'
    ],
    options: ['1번', '2번', '3번', '4번']
  },
  {
    type: '정보공유', badge: '🔗', tag: '정보공유',
    titles: [
      '오늘 알아두면 좋은 정보',
      '소소하지만 유용한 정보 공유',
      '나만 알기 아까운 꿀팁',
      '저장해두면 좋은 정보',
      '생활에 도움 되는 한 가지',
      '오늘의 유용한 사이트/정보',
      '몰랐으면 손해 볼 수도 있는 팁',
      '댓글로 더해가는 정보 모음'
    ],
    questions: [
      '이 정보가 도움이 됐나요?',
      '이런 정보 자주 보고 싶나요?',
      '댓글로 추가 정보가 있을까요?',
      '저장해둘 만한 정보인가요?',
      '누구에게 알려주고 싶은 정보인가요?',
      '실제로 써본 경험이 있나요?'
    ],
    prompts: [
      '생활에 도움 되는 정보나 유용한 사이트를 댓글로 함께 추천해주세요.',
      '알아두면 좋은 정보를 모아보는 소소킹 정보공유 글입니다. 관련 팁이 있으면 댓글로 더해주세요.',
      '나중에 다시 볼 만한 정보가 있다면 댓글에 링크나 요약을 남겨주세요.',
      '작은 팁 하나가 시간을 아껴줄 수 있습니다. 알고 있는 유용한 정보를 공유해주세요.',
      '사이트, 도구, 생활 팁, 공부 팁 모두 좋습니다. 도움이 된 정보를 댓글로 나눠주세요.',
      '정보공유는 댓글이 쌓일수록 더 유용해집니다. 추가 팁을 자유롭게 남겨주세요.'
    ],
    options: ['도움 됨', '나중에 볼래요', '이미 알고 있음', '댓글로 추가 정보']
  },
  {
    type: '릴레이소설', badge: '📚', tag: '릴레이소설',
    titles: [
      '첫 문장으로 시작하는 릴레이소설',
      '누구든 이어 쓰는 오늘의 이야기',
      '댓글로 이어가는 즉흥 소설',
      '다음 장면은 당신 차례',
      '장르가 댓글로 바뀌는 소설',
      '한 줄씩 이어 쓰는 이야기',
      '갑자기 시작된 이상한 사건',
      '오늘의 막장 릴레이 소설'
    ],
    questions: [
      '다음 장면은 어떻게 이어질까요?',
      '이야기를 어떤 방향으로 끌고 갈까요?',
      '다음 댓글은 반전일까요?',
      '주인공은 어떤 선택을 할까요?',
      '이 이야기는 어떤 장르가 어울릴까요?',
      '누가 다음 문장을 이어갈까요?'
    ],
    prompts: [
      '첫 문장: 문을 열자 전혀 예상하지 못한 장면이 펼쳐졌다. 댓글로 다음 장면을 이어주세요.',
      '이야기의 장르는 댓글 참여에 따라 바뀝니다. 자유롭게 이어 써보세요.',
      '주인공은 아직 아무것도 모릅니다. 댓글로 사건을 만들고 다음 사람이 이어가게 해주세요.',
      '한 줄만 남겨도 좋습니다. 개그, 반전, 감동, 공포 중 어떤 방향이든 가능합니다.',
      '앞 댓글의 흐름을 받아도 되고, 갑자기 막장 전개로 틀어도 됩니다. 릴레이니까 가능합니다.',
      '오늘의 이야기는 모두가 공동 작가입니다. 다음 장면을 댓글로 이어주세요.'
    ],
    options: ['개그로 간다', '반전으로 간다', '감동으로 간다', '공포로 간다']
  },
  {
    type: '역할극방', badge: '🎭', tag: '역할극',
    titles: [
      '오늘의 즉흥 역할극방',
      '캐릭터 골라 이어가는 상황극',
      '댓글로 완성하는 역할극',
      '대사 한 줄로 참여하기',
      '등장인물은 댓글에서 추가',
      '상황극 시작합니다',
      '오늘의 캐릭터 놀이',
      '역할 정하고 바로 입장'
    ],
    questions: [
      '어떤 역할로 참여할까요?',
      '다음 대사는 누가 이어갈까요?',
      '이 상황에서 당신의 캐릭터는?',
      '등장인물을 새로 추가할까요?',
      '주인공 편인가요, 빌런 편인가요?',
      '댓글로 어떤 역할을 맡고 싶나요?'
    ],
    prompts: [
      '상황: 갑자기 열린 회의실 문, 모두가 동시에 조용해졌다. 원하는 역할을 정하고 댓글로 대사를 이어가세요.',
      '등장인물은 자유롭게 추가 가능합니다. 역할을 정하고 한 줄 대사를 남겨보세요.',
      '역할극은 길게 쓰지 않아도 됩니다. 캐릭터 이름과 대사 한 줄이면 충분합니다.',
      '주인공, 친구, 수상한 사람, 갑자기 나타난 인물까지 자유롭게 참여할 수 있습니다.',
      '이 상황극은 댓글로 흘러갑니다. 앞 사람의 대사를 받아서 자연스럽게 이어보세요.',
      '원하는 역할을 직접 만들고 입장해보세요. 예상 못 한 캐릭터가 나올수록 재밌습니다.'
    ],
    options: ['주인공', '친구', '수상한 사람', '직접 역할 입력']
  },
  {
    type: '영상 리액션', badge: '🎬', tag: '영상',
    titles: [
      '이 영상 한 줄 리액션 남기기',
      '오늘의 영상 반응방',
      '짧은 영상 보고 한마디',
      '댓글 리액션 모으기',
      '영상 느낌을 한 줄로',
      '다시 보고 싶은 장면은?',
      '이 장면 킹받나요 웃긴가요?',
      '영상 리액션 배틀'
    ],
    questions: [
      '이 영상 느낌은?',
      '한 줄로 요약하면?',
      '가장 먼저 든 생각은?',
      '다시 보고 싶은가요?',
      '공감되는 포인트가 있나요?',
      '댓글 리액션 중 뭐가 제일 웃긴가요?'
    ],
    prompts: [
      '재밌게 본 영상이나 짧은 클립을 떠올리며 한 줄 리액션을 남겨보세요.',
      '가장 공감되는 리액션을 댓글로 추천해주세요.',
      '영상은 길게 설명하지 않아도 됩니다. 느낌을 한 줄로 남기면 충분합니다.',
      '웃긴 장면, 공감 장면, 킹받는 장면을 댓글로 짧게 반응해보세요.',
      '좋아하는 영상이 있다면 어떤 포인트가 좋았는지 한 줄로 남겨주세요.',
      '오늘의 영상 리액션방입니다. 댓글로 가장 찰진 반응을 남겨보세요.'
    ],
    options: ['웃김', '공감됨', '킹받음', '다시 보고 싶음']
  },
  {
    type: '소소토론', badge: '💬', tag: '토론',
    titles: [
      '사소하지만 은근 갈리는 주제',
      '오늘의 소소토론',
      '정답 없는 가벼운 논쟁',
      '이건 선 넘은 걸까요?',
      '친구랑 말하면 길어질 주제',
      '댓글로 의견 갈리는 문제',
      '가볍게 의견 나누기',
      '소소하지만 진심인 토론'
    ],
    questions: [
      '당신은 어느 쪽인가요?',
      '이건 선 넘은 걸까요?',
      '가능한 일인가요, 불가능한 일인가요?',
      '상황에 따라 달라질까요?',
      '댓글로 이유를 남긴다면?',
      '다른 사람은 어떻게 생각할까요?'
    ],
    prompts: [
      '정답 없는 사소한 주제입니다. 선택하고 댓글로 이유를 남겨보세요.',
      '가볍게 의견을 나누되 서로 존중해주세요.',
      '이런 주제는 사람마다 기준이 다릅니다. 당신의 기준을 댓글로 알려주세요.',
      '친구와 이야기하면 은근히 길어지는 소소한 토론 주제입니다.',
      '찬반이 갈릴 수 있지만 싸우자는 글은 아닙니다. 이유를 중심으로 이야기해보세요.',
      '생각보다 의견이 갈릴 수 있습니다. 선택 후 한 줄 이유를 남겨보세요.'
    ],
    options: ['완전 가능', '조금 애매', '절대 불가', '상황에 따라']
  }
];

function dayKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return formatter.format(date);
}

function pick(list, index, salt = 0) {
  return list[(index + salt) % list.length];
}

function voteMap(options) {
  return Object.fromEntries(options.map(option => [option.replace(/[.~*/[\]]/g, '_'), 0]));
}

async function isDailySeedEnabled() {
  const snap = await db.collection('site_settings').doc('config').get();
  const data = snap.exists ? snap.data() : {};
  return data.dailySeedEnabled !== false;
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const adminSnap = await db.collection('admins').doc(uid).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

function buildPost(item, dateKey, index, typeIndex = 0) {
  const dayNumber = Number(dateKey.replace(/-/g, '')) || 0;
  const salt = dayNumber + typeIndex * 3;
  const title = `${pick(item.titles, index, salt)} · ${dateKey}`;
  const content = `${pick(item.prompts, index, salt)}\n\n이 글은 소소킹 운영팀이 오늘의 참여 주제로 자동 등록한 샘플 피드입니다.`;
  const question = pick(item.questions, index, salt);
  const options = item.options;
  return {
    type: item.type,
    badge: item.badge,
    title,
    content,
    summary: content.slice(0, 180),
    question,
    options,
    votes: voteMap(options),
    voteTotal: 0,
    tags: [item.tag, '오늘의주제', '운영팀'],
    views: 0,
    likes: 0,
    comments: 0,
    status: 'published',
    source: 'system_seed',
    authorId: 'system',
    authorName: '소소킹 운영팀',
    imageUrl: '',
    mediaType: 'none',
    linkUrl: '',
    linkTitle: '',
    linkSummary: '',
    linkSource: '',
    embedUrl: '',
    thumbnailUrl: '',
    topComment: '',
    seedKey: `${dateKey}:${item.type}:${index}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now() + (typeIndex * 10) + index,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function createDailySeedPosts({ force = false } = {}) {
  const enabled = await isDailySeedEnabled();
  if (!enabled && !force) return { skipped: true, reason: 'disabled-by-admin', enabled };

  const today = dayKey();
  const markerRef = db.collection('system_jobs').doc(`daily_seed_${today}`);
  const marker = await markerRef.get();
  if (marker.exists) return { skipped: true, reason: 'already-created', date: today, enabled };

  const batch = db.batch();
  let count = 0;
  TYPES.forEach((item, typeIndex) => {
    for (let i = 0; i < 2; i += 1) {
      const ref = db.collection('soso_feed_posts').doc();
      batch.set(ref, buildPost(item, today, i, typeIndex));
      count += 1;
    }
  });
  batch.set(markerRef, {
    date: today,
    count,
    status: 'done',
    enabled,
    templateVersion: 2,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  });
  await batch.commit();
  return { ok: true, date: today, count, enabled, templateVersion: 2 };
}

exports.createDailySeedPosts = onSchedule({
  schedule: 'every day 09:10',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  memory: '256MiB',
  timeoutSeconds: 60
}, async () => {
  const result = await createDailySeedPosts();
  console.log('daily seed result', result);
});

exports.runDailySeedPostsNow = onCall({ region: 'asia-northeast3' }, async (request) => {
  await assertAdmin(request.auth && request.auth.uid);
  return createDailySeedPosts({ force: true });
});

exports.getDailySeedStatus = onCall({ region: 'asia-northeast3' }, async (request) => {
  await assertAdmin(request.auth && request.auth.uid);
  const enabled = await isDailySeedEnabled();
  const today = dayKey();
  const marker = await db.collection('system_jobs').doc(`daily_seed_${today}`).get();
  return {
    enabled,
    today,
    createdToday: marker.exists,
    marker: marker.exists ? marker.data() : null,
    dailyCount: TYPES.length * 2,
    templateVersion: 2
  };
});