const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TYPES = [
  {
    type: '미친작명소', badge: '📸', tag: '미친작명소',
    titles: ['이 사진 제목 누가 제일 미쳤나요?', '오늘의 미친 작명 배틀'],
    questions: ['이 사진에 제일 어울리는 작명은?', '댓글로 가장 미친 제목을 남겨주세요.'],
    prompts: ['사진 한 장을 보고 떠오르는 제목을 댓글로 남겨보세요.', '제일 웃긴 작명은 추천을 많이 받아 위로 올라갑니다.'],
    options: ['댓글로 작명', '웃긴 제목 추천', '센스 작명', '미친 제목']
  },
  {
    type: '밸런스게임', badge: '⚖️', tag: '밸런스게임',
    titles: ['평생 하나만 고른다면?', '오늘의 선택 밸런스'],
    questions: ['당신의 선택은?', '둘 중 더 참기 힘든 쪽은?'],
    prompts: ['가볍게 고르고 댓글로 이유를 남겨보세요.', '선택만 해도 은근히 갈리는 소소한 밸런스게임입니다.'],
    options: ['A 선택', 'B 선택', '둘 다 가능', '댓글로 다른 선택']
  },
  {
    type: '정답 퀴즈', badge: '✅', tag: '퀴즈',
    titles: ['오늘의 소소 퀴즈', '알면 은근 뿌듯한 퀴즈'],
    questions: ['정답은 무엇일까요?', '가장 그럴듯한 답을 골라보세요.'],
    prompts: ['정답을 고르고 댓글로 이유를 적어보세요.', '가볍게 풀 수 있는 오늘의 퀴즈입니다.'],
    options: ['1번', '2번', '3번', '4번']
  },
  {
    type: '정보공유', badge: '🔗', tag: '정보공유',
    titles: ['오늘 알아두면 좋은 정보', '소소하지만 유용한 정보 공유'],
    questions: ['이 정보가 도움이 됐나요?', '이런 정보 자주 보고 싶나요?'],
    prompts: ['생활에 도움 되는 정보나 유용한 사이트를 댓글로 함께 추천해주세요.', '알아두면 좋은 정보를 모아보는 소소킹 정보공유 글입니다.'],
    options: ['도움 됨', '나중에 볼래요', '이미 알고 있음', '댓글로 추가 정보']
  },
  {
    type: '릴레이소설', badge: '📚', tag: '릴레이소설',
    titles: ['첫 문장으로 시작하는 릴레이소설', '누구든 이어 쓰는 오늘의 이야기'],
    questions: ['다음 장면은 어떻게 이어질까요?', '이야기를 어떤 방향으로 끌고 갈까요?'],
    prompts: ['첫 문장: 문을 열자 전혀 예상하지 못한 장면이 펼쳐졌다. 댓글로 다음 장면을 이어주세요.', '이야기의 장르는 댓글 참여에 따라 바뀝니다. 자유롭게 이어 써보세요.'],
    options: ['개그로 간다', '반전으로 간다', '감동으로 간다', '공포로 간다']
  },
  {
    type: '역할극방', badge: '🎭', tag: '역할극',
    titles: ['오늘의 즉흥 역할극방', '캐릭터 골라 이어가는 상황극'],
    questions: ['어떤 역할로 참여할까요?', '다음 대사는 누가 이어갈까요?'],
    prompts: ['상황: 갑자기 열린 회의실 문, 모두가 동시에 조용해졌다. 원하는 역할을 정하고 댓글로 대사를 이어가세요.', '등장인물은 자유롭게 추가 가능합니다. 역할을 정하고 한 줄 대사를 남겨보세요.'],
    options: ['주인공', '친구', '수상한 사람', '직접 역할 입력']
  },
  {
    type: '영상 리액션', badge: '🎬', tag: '영상',
    titles: ['이 영상 한 줄 리액션 남기기', '오늘의 영상 반응방'],
    questions: ['이 영상 느낌은?', '한 줄로 요약하면?'],
    prompts: ['재밌게 본 영상이나 짧은 클립을 떠올리며 한 줄 리액션을 남겨보세요.', '가장 공감되는 리액션을 댓글로 추천해주세요.'],
    options: ['웃김', '공감됨', '킹받음', '다시 보고 싶음']
  },
  {
    type: '소소토론', badge: '💬', tag: '토론',
    titles: ['사소하지만 은근 갈리는 주제', '오늘의 소소토론'],
    questions: ['당신은 어느 쪽인가요?', '이건 선 넘은 걸까요?'],
    prompts: ['정답 없는 사소한 주제입니다. 선택하고 댓글로 이유를 남겨보세요.', '가볍게 의견을 나누되 서로 존중해주세요.'],
    options: ['완전 가능', '조금 애매', '절대 불가', '상황에 따라']
  }
];

function dayKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return formatter.format(date);
}

function pick(list, index) {
  return list[index % list.length];
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

function buildPost(item, dateKey, index) {
  const title = `${pick(item.titles, index)} · ${dateKey}`;
  const content = `${pick(item.prompts, index)}\n\n이 글은 소소킹 운영팀이 오늘의 참여 주제로 자동 등록한 샘플 피드입니다.`;
  const question = pick(item.questions, index);
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
    createdAtMs: Date.now() + index,
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
  TYPES.forEach(item => {
    for (let i = 0; i < 2; i += 1) {
      const ref = db.collection('soso_feed_posts').doc();
      batch.set(ref, buildPost(item, today, i));
      count += 1;
    }
  });
  batch.set(markerRef, {
    date: today,
    count,
    status: 'done',
    enabled,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  });
  await batch.commit();
  return { ok: true, date: today, count, enabled };
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
    dailyCount: TYPES.length * 2
  };
});
