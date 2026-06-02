import { awardPoints } from './utils/points.js';

function detailPostId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function hasText(selector) {
  const el = document.querySelector(selector);
  return !!String(el?.value || '').trim();
}

function later(fn) {
  setTimeout(() => fn().catch(() => {}), 900);
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const postId = detailPostId();

  if (target.closest('#btn-comment') && hasText('#comment-input')) {
    later(() => awardPoints('comment_create', { postId }));
    return;
  }

  if (target.closest('[data-multi-vote-idx]')) {
    const idx = target.closest('[data-multi-vote-idx]')?.dataset.multiVoteIdx || '';
    later(() => awardPoints('vote_participate', { postId, onceKey: idx }));
    return;
  }

});
