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

  if (target.closest('#multi-naming-submit')) {
    const ok = hasText('#multi-naming-free') || [...document.querySelectorAll('.multi-name-char')].some(i => String(i.value || '').trim());
    if (ok) later(() => awardPoints('participation_create', { postId, type: 'naming' }));
    return;
  }

  if (target.closest('#multi-fill-submit') && hasText('#multi-fill-answer')) {
    later(() => awardPoints('participation_create', { postId, type: 'fill' }));
    return;
  }

  if (target.closest('#multi-acrostic-submit')) {
    const ok = [...document.querySelectorAll('.multi-acrostic-input')].every(i => String(i.value || '').trim());
    if (ok) later(() => awardPoints('participation_create', { postId, type: 'acrostic' }));
    return;
  }

  if (target.closest('#multi-relay-submit') && hasText('#multi-relay-input')) {
    later(() => awardPoints('participation_create', { postId, type: 'relay' }));
    return;
  }

  if (target.closest('#multi-quiz-submit') && hasText('#multi-quiz-answer')) {
    later(() => {
      const result = document.getElementById('multi-quiz-result');
      if (result?.classList.contains('is-correct')) {
        return awardPoints('quiz_correct', { postId });
      }
      return Promise.resolve(false);
    });
    return;
  }

  if (target.closest('[data-quiz-option]')) {
    later(() => {
      const result = document.getElementById('multi-quiz-result');
      if (result?.classList.contains('is-correct')) {
        return awardPoints('quiz_correct', { postId, onceKey: 'choice' });
      }
      return Promise.resolve(false);
    });
  }
});
