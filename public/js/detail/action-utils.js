import { auth } from '../firebase.js';
import { toast } from '../components/toast.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export function currentDetailPostId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function isDetailPath() {
  return !!currentDetailPostId();
}

export function stopDetailEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

export async function ensureAnonymousActor(message = '참여에 실패했어요') {
  if (auth.currentUser) return true;
  try {
    await signInAnonymously(auth);
    return true;
  } catch {
    toast.warn(message);
    return false;
  }
}

export function markLegacyQuizResult(correct, explanation = '') {
  const resultEl = document.getElementById('quiz-result');
  if (!resultEl) return;
  resultEl.style.display = '';
  resultEl.className = `quiz-result quiz-result--${correct ? 'correct' : 'wrong'}`;
  const iconEl = resultEl.querySelector('.quiz-result__icon');
  const textEl = resultEl.querySelector('.quiz-result__text');
  const exEl = resultEl.querySelector('.quiz-result__explanation');
  if (iconEl) iconEl.textContent = correct ? '⭕' : '❌';
  if (textEl) textEl.textContent = correct ? '정답이에요!' : '오답이에요!';
  if (exEl) exEl.textContent = explanation ? `💡 ${explanation}` : '';
}

export function readImageListFromThumb(thumb) {
  const grid = thumb?.closest?.('[data-images]');
  if (!grid) return [];
  try {
    return JSON.parse(decodeURIComponent(grid.dataset.images || '%5B%5D'));
  } catch {
    return [];
  }
}
