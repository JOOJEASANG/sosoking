import { escHtml } from '../utils/helpers.js';
import { TYPE_LABELS } from './constants.js';
import { fetchSimilarPosts } from './data.js';

export function renderSimilarPosts(similar) {
  if (!similar?.length) return '';
  return `
    <div class="similar-posts__title">🎮 비슷한 놀이판</div>
    <div class="similar-posts__list">
      ${similar.map(item => `
        <div class="similar-post-card" onclick="navigate('/detail/${item.id}')">
          <span class="similar-post-card__type">${TYPE_LABELS[item.feedType] || TYPE_LABELS[item.type] || item.feedType || item.type}</span>
          <div class="similar-post-card__title">${escHtml(item.title || '')}</div>
          <div class="similar-post-card__meta">❤️${item.reactions?.total || 0} 💬${item.commentCount || 0}</div>
        </div>`).join('')}
    </div>`;
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
    const similar = await fetchSimilarPosts(post.id, post.feedType || post.type);
    if (root.dataset.similarPostsPending !== key) return;

    root.querySelectorAll('.similar-posts').forEach(area => area.remove());
    root.dataset.similarPostsRendered = '';

    if (!similar.length) return;

    const area = document.createElement('div');
    area.className = 'similar-posts';
    area.dataset.postId = key;
    area.innerHTML = renderSimilarPosts(similar);
    root.appendChild(area);
    root.dataset.similarPostsRendered = key;
  } catch {
    // Similar posts are optional.
  } finally {
    if (root.dataset.similarPostsPending === key) delete root.dataset.similarPostsPending;
  }
}