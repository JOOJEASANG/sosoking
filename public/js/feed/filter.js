export const FILTER_TYPES = ['citizen_speech', 'ai_judge'];

export const TYPE_LABELS = {
  citizen_speech: '시민발언',
  ai_judge: '헌재기록',
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
  if (post.feedType === 'ai_judge' || post.type === 'ai_judge') return 'ai_judge';
  return 'citizen_speech';
}

export function getPostTypeLabel(post) {
  return TYPE_LABELS[getPostTypeKey(post)] || '시민발언';
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
    getPostTypeLabel(post),
    ...(Array.isArray(post.tags) ? post.tags : []),
  ].join(' ').toLowerCase();
  return haystack.includes(search);
}

function postDateValue(post) {
  const date = post.createdAt?.toDate?.() || post.createdAt;
  return date instanceof Date ? date.getTime() : 0;
}

export function sortScore(post, sort) {
  const reactions = Number(post.reactions?.total || 0);
  const comments = Number(post.commentCount || 0);
  const views = Number(post.viewCount || 0);
  const participation = comments + reactions;

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
