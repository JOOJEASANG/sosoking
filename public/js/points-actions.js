import { awardPoints, POINT_RULES } from './utils/points.js';
import { showPointPopup } from './utils/point-popup.js';

function detailPostId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function hasText(selector) {
  const el = document.querySelector(selector);
  return !!String(el?.value || '').trim();
}

function later(action, meta = {}) {
  const rule = POINT_RULES[action];
  setTimeout(async () => {
    try {
      const awarded = await awardPoints(action, meta);
      if (awarded && rule?.points) showPointPopup(rule.points);
    } catch {}
  }, 900);
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const postId = detailPostId();

  if (target.closest('#btn-comment') && hasText('#comment-input')) {
    later('comment_create', { postId });
    return;
  }

  if (target.closest('[data-multi-vote-idx]')) {
    const idx = target.closest('[data-multi-vote-idx]')?.dataset.multiVoteIdx || '';
    later('vote_participate', { postId, onceKey: idx });
    return;
  }

  const reactBtn = target.closest('.comment-react-btn');
  if (reactBtn) {
    const commentId = reactBtn.dataset.commentId || '';
    const react = reactBtn.dataset.react || '';
    later('reaction_give', { postId, onceKey: `${commentId}:${react}` });
    return;
  }

});
