export const FILTER_TYPES = ['judgment', 'consult', 'vote', 'drip'];

export const TYPE_LABELS = {
  all: '전체',
  judgment: '판결',
  consult: '상담',
  vote: '토론',
  drip: '드립',

  // 예전 데이터 호환: 화면에는 4게임 이름으로만 보이게 매핑합니다.
  collect: '판결',
  collection: '판결',
  general: '판결',
  multi: '판결',
  anonymous: '판결',
  crazy_court: '판결',
  balance: '토론',
  battle: '토론',
  ox: '토론',
  cbattle: '드립',
  quiz: '상담',
  initial_game: '상담',
  fill: '판결',
  naming: '판결',
  acrostic: '판결',
  relay: '판결',
  tournament: '판결',
};

export const SORT_LABELS = {
  latest: '최신순',
  popular: '인기순',
  comments: '댓글순',
  views: '조회순',
  participation: '참여순',
};

export function normalizeFeedSort(sort) {
  return SORT_LABELS[sort] ? sort : 'latest';
}

export function getPostTypeKey(post) {
  const modules = post.modules || {};
  if (post.subtype === 'judgment' || modules.vote?.voteMode === 'judgment') return 'judgment';
  if (post.subtype === 'consult' || modules.consult?.enabled || modules.quiz?.enabled || post.type === 'quiz' || post.type === 'initial_game') return 'consult';
  if (post.subtype === 'drip' || post.feedType === 'drip' || modules.drip?.enabled || post.type === 'drip' || post.type === 'cbattle') return 'drip';
  if (post.subtype === 'vote' || post.feedType === 'vote' || modules.vote?.enabled || modules.vote?.ox || post.type === 'vote' || post.type === 'crazy_court' || post.type === 'ox' || post.type === 'battle' || post.type === 'balance') return 'vote';
  if (post.subtype && TYPE_LABELS[post.subtype]) return post.subtype;
  return 'judgment';
}

export function isTournamentPost() {
  return false;
}

export function getPostTypeLabel(post) {
  return TYPE_LABELS[getPostTypeKey(post)] || '게임';
}

export function postMatchesType(post, type) {
  if (!type) return true;
  return getPostTypeKey(post) === type;
}

export function postMatchesSearch(post, rawSearch) {
  const search = String(rawSearch || '').trim().toLowerCase();
  if (!search) return true;
  const haystack = [
    post.title,
    post.desc,
    post.authorName,
    post.anonymous ? '익명 판결' : '',
    getPostTypeLabel(post),
    post.modules?.consult?.topicLabel,
    post.modules?.consult?.styleLabel,
    post.modules?.drip?.prompt,
    post.modules?.vote?.question,
    ...(Array.isArray(post.tags) ? post.tags : []),
  ].join(' ').toLowerCase();
  return haystack.includes(search);
}

function postDateValue(post) {
  const date = post.createdAt?.toDate?.() || post.createdAt;
  return date instanceof Date ? date.getTime() : 0;
}

function multiCount(post, key) {
  const direct = Number(post[`${key}Count`] || 0);
  if (direct) return direct;
  return Number(post.modules?.[key]?.count || 0);
}

export function sortScore(post, sort) {
  const reactions = Number(post.reactions?.total || 0);
  const comments = Number(post.commentCount || 0);
  const views = Number(post.viewCount || 0);
  const participation = comments + reactions + multiCount(post, 'vote') + multiCount(post, 'consult') + multiCount(post, 'drip') + multiCount(post, 'naming') + multiCount(post, 'fill');

  if (sort === 'popular') return reactions * 3 + comments * 2 + views * 0.2 + participation;
  if (sort === 'comments') return comments;
  if (sort === 'views') return views;
  if (sort === 'participation') return participation;
  return postDateValue(post);
}

export function sortFeedPosts(posts, sort) {
  return posts.sort((a, b) => {
    const diff = sortScore(b, sort) - sortScore(a, sort);
    if (diff) return diff;
    return postDateValue(b) - postDateValue(a);
  });
}
