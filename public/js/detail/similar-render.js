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
          <span class="similar-post-card__type">${TYPE_LABELS[item.type] || item.type}</span>
          <div class="similar-post-card__title">${escHtml(item.title || '')}</div>
          <div class="similar-post-card__meta">❤️${item.reactions?.total || 0} 💬${item.commentCount || 0}</div>
        </div>`).join('')}
    </div>`;
}

export async function appendSimilarPosts(post, rootSelector = '[style*="max-width:720px"]') {
  try {
    const similar = await fetchSimilarPosts(post.id, post.type);
    if (!similar.length) return;
    const area = document.createElement('div');
    area.className = 'similar-posts';
    area.innerHTML = renderSimilarPosts(similar);
    document.querySelector(rootSelector)?.appendChild(area);
  } catch {
    // Similar posts are optional.
  }
}
