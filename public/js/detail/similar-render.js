import { escHtml, formatTime } from '../utils/helpers.js';
import { navigate } from '../router.js';
import { fetchSimilarPosts } from './data.js';

const TYPE_META = {
  judgment: { label: '판결', icon: '⚖️' },
  consult: { label: '상담', icon: '💬' },
  vote: { label: '토론', icon: '🗳️' },
  drip: { label: '드립', icon: '😂' },
};

function subtypeOf(post) {
  if (TYPE_META[post?.subtype]) return post.subtype;
  if (post?.modules?.consult?.enabled) return 'consult';
  if (post?.modules?.drip?.enabled) return 'drip';
  if (post?.modules?.vote?.voteMode === 'pros_cons') return 'vote';
  return 'judgment';
}

function typeMeta(post) {
  return TYPE_META[subtypeOf(post)] || TYPE_META.judgment;
}

export function renderSimilarPosts(similar, currentPost) {
  if (!similar?.length) return '';
  const currentType = subtypeOf(currentPost);
  const currentMeta = TYPE_META[currentType] || TYPE_META.judgment;
  return `
    <section class="detail-post-list" aria-label="댓글 아래 글 목록">
      <header class="detail-post-list__header">
        <strong>${currentMeta.icon} ${currentMeta.label} 최신 글</strong>
        <button type="button" data-detail-list-more>전체보기</button>
      </header>
      <div class="detail-post-list__rows">
        ${similar.map(item => {
          const meta = typeMeta(item);
          const created = formatTime(item.createdAt?.toDate?.() || item.createdAt);
          return `
            <button type="button" class="detail-post-row" data-detail-post="${escHtml(item.id)}">
              <span class="detail-post-row__type">${meta.icon} ${meta.label}</span>
              <span class="detail-post-row__title">${escHtml(item.title || '제목 없음')}</span>
              <span class="detail-post-row__meta">${created} · 댓글 ${Number(item.commentCount || 0)} · 조회 ${Number(item.viewCount || 0)}</span>
            </button>`;
        }).join('')}
      </div>
    </section>`;
}

function getSimilarKey(post) {
  return String(post?.id || '').trim();
}

function findSimilarRoot(rootSelector) {
  return document.querySelector(rootSelector)
    || document.querySelector('[data-detail-root]')
    || document.querySelector('[style*="max-width:720px"]');
}

export async function appendSimilarPosts(post, rootSelector = '[data-detail-root]') {
  const key = getSimilarKey(post);
  if (!key) return;

  const root = findSimilarRoot(rootSelector);
  if (!root) return;

  if (root.dataset.similarPostsPending === key || root.dataset.similarPostsRendered === key) return;
  root.dataset.similarPostsPending = key;

  try {
    const currentType = subtypeOf(post);
    const similar = await fetchSimilarPosts(post.id, currentType);
    if (root.dataset.similarPostsPending !== key) return;

    root.querySelectorAll('.similar-posts, .detail-post-list').forEach(area => area.remove());
    root.dataset.similarPostsRendered = '';

    if (!similar.length) return;

    const area = document.createElement('div');
    area.className = 'similar-posts';
    area.dataset.postId = key;
    area.innerHTML = renderSimilarPosts(similar, post);
    root.appendChild(area);

    area.querySelectorAll('[data-detail-post]').forEach(button => {
      button.addEventListener('click', () => navigate(`/detail/${button.dataset.detailPost}`));
    });
    area.querySelector('[data-detail-list-more]')?.addEventListener('click', () => {
      navigate(`/feed?type=${encodeURIComponent(currentType)}`);
    });

    root.dataset.similarPostsRendered = key;
  } catch (error) {
    console.warn('[detail post list]', error);
  } finally {
    if (root.dataset.similarPostsPending === key) delete root.dataset.similarPostsPending;
  }
}