import { auth, db } from '../firebase.js';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

export const FALLBACK_FEED_ITEMS = [
  { id:'sample-office-chat', type:'생각 갈림', badge:'💬', title:'퇴근 후 단톡방 업무 지시, 어디까지 이해 가능?', summary:'회사 단톡방이 퇴근 후에도 계속 울릴 때 사람들은 어디까지 참을 수 있을까요?', question:'이 상황에서 제일 가까운 생각은?', options:['급한 일이면 가능','다음날 해도 된다','계속되면 선 넘음','읽씹한다'], stats:{ views:12840, likes:932, comments:214 }, topComment:'한두 번은 괜찮은데 반복되면 퇴근이 퇴근이 아님.', tags:['직장','단톡방','퇴근'], source:'sample' },
  { id:'sample-title-school', type:'사진 제목학원', badge:'📸', title:'이 사진 제목 뭐가 제일 웃김?', summary:'평범한 사진도 제목 하나로 웃긴 글이 됩니다. AI 후보와 유저 드립이 붙는 참여형 글입니다.', question:'이 장면에 제일 어울리는 제목은?', options:['월요일 아침 내 표정','회의 끝난 줄 알았는데','퇴근 1분 전 부장님','오늘도 참았다'], stats:{ views:23620, likes:1840, comments:356 }, topComment:'퇴근 1분 전 부장님은 너무 현실이라 웃프다.', tags:['웃긴사진','제목학원','드립'], source:'sample' },
  { id:'sample-late-friend', type:'소소한 논쟁', badge:'🤔', title:'친구가 매번 늦는데 사과는 잘한다면?', summary:'사과는 하지만 계속 반복되는 지각. 사람들은 이해할까요, 거리 둘까요?', question:'당신이라면 어떻게 할까요?', options:['계속 봐준다','한 번 제대로 말한다','슬슬 거리 둔다','이미 손절이다'], stats:{ views:9870, likes:715, comments:168 }, topComment:'사과보다 중요한 건 다음에 안 늦는 거라고 봄.', tags:['친구','인간관계','공감'], source:'sample' },
  { id:'sample-restaurant-kid', type:'생활 매너', badge:'🍽️', title:'식당에서 아이가 계속 뛰어다닐 때, 누가 말해야 할까?', summary:'부모가 먼저 제지해야 할지, 가게도 말해야 할지 은근히 의견이 갈리는 생활 이슈입니다.', question:'가장 맞는 생각은?', options:['부모가 먼저','가게도 말해야 함','상황 봐야 함','애라서 어쩔 수 없음'], stats:{ views:15420, likes:1104, comments:287 }, topComment:'애가 문제가 아니라 방치하는 어른이 문제인 경우가 많음.', tags:['식당','매너','육아'], source:'sample' }
];

const BADGE_BY_TYPE = {
  '사진/짤': '📸',
  '짧은 글': '✍️',
  '질문': '❓',
  '사진 제목학원': '📸',
  '생각 갈림': '💬',
  '소소한 논쟁': '🤔',
  '생활 매너': '🍽️'
};

function clean(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function normalizePost(id, data = {}) {
  const type = clean(data.type || '짧은 글', 30);
  const options = Array.isArray(data.options) ? data.options.map(v => clean(v, 40)).filter(Boolean).slice(0, 4) : [];
  const tags = Array.isArray(data.tags) ? data.tags.map(v => clean(v, 18).replace(/^#/, '')).filter(Boolean).slice(0, 6) : [];
  return {
    id,
    type,
    badge: data.badge || BADGE_BY_TYPE[type] || '✨',
    title: clean(data.title || '제목 없는 소소피드', 90),
    summary: clean(data.summary || data.content || '', 220),
    question: clean(data.question || '사람들은 어떻게 생각할까요?', 90),
    options: options.length ? options : ['공감한다', '조금 애매하다', '반대한다', '댓글로 말한다'],
    stats: {
      views: Number(data.views || 0),
      likes: Number(data.likes || 0),
      comments: Number(data.comments || 0)
    },
    topComment: clean(data.topComment || '아직 인기 한 줄이 없습니다.', 120),
    tags: tags.length ? tags : ['소소피드'],
    imageUrl: clean(data.imageUrl || '', 500),
    authorId: data.authorId || null,
    status: data.status || 'published',
    source: data.source || 'user',
    createdAtMs: Number(data.createdAtMs || Date.now())
  };
}

export async function getFeedPosts({ topOnly = false, pageSize = 20 } = {}) {
  try {
    const base = collection(db, 'soso_feed_posts');
    const q = topOnly
      ? query(base, where('status', '==', 'published'), orderBy('views', 'desc'), limit(pageSize))
      : query(base, where('status', '==', 'published'), orderBy('createdAtMs', 'desc'), limit(pageSize));
    const snap = await getDocs(q);
    const posts = snap.docs.map(doc => normalizePost(doc.id, doc.data()));
    return posts.length ? posts : FALLBACK_FEED_ITEMS;
  } catch (error) {
    console.warn('소소피드 불러오기 실패:', error.code || error.message);
    return FALLBACK_FEED_ITEMS;
  }
}

export async function createFeedPost(input = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 후 글을 올릴 수 있습니다.');
  const type = clean(input.type || '짧은 글', 30);
  const title = clean(input.title, 90);
  const content = clean(input.content, 1200);
  const question = clean(input.question, 90);
  const options = (Array.isArray(input.options) ? input.options : []).map(v => clean(v, 40)).filter(Boolean).slice(0, 4);
  const tags = (Array.isArray(input.tags) ? input.tags : []).map(v => clean(v, 18).replace(/^#/, '')).filter(Boolean).slice(0, 6);
  if (title.length < 4) throw new Error('제목을 4자 이상 입력해주세요.');
  if (content.length < 5) throw new Error('본문 또는 상황 설명을 5자 이상 입력해주세요.');
  const payload = {
    type,
    badge: BADGE_BY_TYPE[type] || '✨',
    title,
    content,
    summary: clean(content, 180),
    question: question || '사람들은 어떻게 생각할까요?',
    options: options.length >= 2 ? options : ['공감한다', '애매하다', '반대한다', '댓글로 말한다'],
    tags: tags.length ? tags : ['소소피드'],
    views: 0,
    likes: 0,
    comments: 0,
    status: 'published',
    source: user.isAnonymous ? 'anonymous_user' : 'user',
    authorId: user.uid,
    authorName: user.isAnonymous ? '익명 예측러' : (user.displayName || user.email || '소소킹 유저'),
    imageUrl: clean(input.imageUrl || '', 500),
    topComment: '',
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'soso_feed_posts'), payload);
  return { id: ref.id, ...normalizePost(ref.id, payload) };
}
