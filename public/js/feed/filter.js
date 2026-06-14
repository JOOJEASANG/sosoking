export const FILTER_TYPES = ['citizen_speech', 'ai_judge', 'tournament', 'collect', 'vote', 'quiz', 'drip'];

export const TYPE_LABELS = {
  citizen_speech: '시민발언',
  ai_judge: '헌재기록',
  tournament: '대결방',
  collect: '일반방',
  collection: '일반방',
  general: '일반방',
  multi: '일반방',
  vote: '토론방',
  ox: '토론방',
  fill: '빈칸',
  naming: '작명',
  drip: '드립방',
  cbattle: '드립방',
  acrostic: '행시',
  relay: '릴레이',
  quiz: '퀴즈방',
  anonymous: '일반방',
  initial_game: '퀴즈방',
  crazy_court: '토론방',
  balance: '토론방',
  battle: '토론방',
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
  if (post.feedType === 'citizen_speech' || post.type === 'citizen_speech' || post.subtype === 'citizen_speech') return 'citizen_speech';
  if (post.feedType === 'ai_judge' || post.type === 'ai_judge') return 'ai_judge';
  if (post.feedType === 'tournament' || post.subtype === 'tournament' || post.modules?.tournament?.enabled) return 'tournament';
  if (post.feedType === 'collect' || post.subtype === 'collect' || post.modules?.collect?.enabled) return 'collect';
  if (post.subtype === 'ox') return 'vote';
  if (post.subtype === 'anonymous') return 'collect';
  if (post.modules?.fill?.enabled) return 'fill';
  if (post.modules?.vote?.enabled || post.modules?.vote?.ox || post.type === 'vote' || post.type === 'crazy_court' || post.type === 'ox') return 'vote';
  if (post.modules?.naming?.enabled || post.type === 'naming') return 'naming';
  if (post.modules?.acrostic?.enabled || post.type === 'acrostic') return 'acrostic';
  if (post.modules?.relay?.enabled || post.type === 'relay') return 'relay';
  if (post.modules?.quiz?.enabled || post.type === 'quiz' || post.type === 'initial_game') return 'quiz';
  if (post.modules?.drip?.enabled || post.subtype === 'drip') return 'drip';
  if (post.subtype && TYPE_LABELS[post.subtype]) return post.subtype;
  if (post.type === 'multi') return 'collect';
  return post.type || 'collect';
}

export function getPostTypeLabel(post) {
  return TYPE_LABELS[getPostTypeKey(post)] || TYPE_LABELS[post.type] || '소소글';
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
    post.anonymous ? '익명 일반방' : '',
    getPostTypeLabel(post),
    post.modules?.collect?.label,
    post.modules?.collect?.caption,
    post.modules?.collect?.url,
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
  const participation = comments + reactions + multiCount(post, 'naming') + multiCount(post, 'acrostic') + multiCount(post, 'relay') + multiCount(post, 'fill');

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
