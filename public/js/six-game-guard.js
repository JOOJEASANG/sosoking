import { navigate } from './router.js';

const ALLOWED_TYPES = new Set(['multi', 'vote', 'naming', 'initial_game', 'crazy_court', 'relay', 'acrostic']);
const REMOVED_TYPES = new Set([
  'balance', 'battle', 'challenge24', 'tournament', 'drip', 'cbattle', 'laugh',
  'ox', 'quiz', 'word_relay', 'random_battle', 'howto', 'story', 'fail', 'concern',
]);

function getHashPath() {
  return window.location.hash.slice(1) || '/';
}

function getParams(path) {
  const queryIndex = path.indexOf('?');
  if (queryIndex < 0) return new URLSearchParams();
  return new URLSearchParams(path.slice(queryIndex + 1));
}

function guardWriteType() {
  const path = getHashPath();
  if (!path.startsWith('/write')) return;
  const params = getParams(path);
  const type = params.get('type');
  if (type && !ALLOWED_TYPES.has(type)) {
    navigate('/write');
  }
}

function markRemovedTypeCards() {
  document.querySelectorAll('[data-type], [data-type-filter], [data-type-quick]').forEach(el => {
    const type = el.dataset.type || el.dataset.typeFilter || el.dataset.typeQuick;
    if (REMOVED_TYPES.has(type)) el.remove();
  });
}

function installSixGameGuard() {
  guardWriteType();
  markRemovedTypeCards();
  window.addEventListener('hashchange', () => setTimeout(() => {
    guardWriteType();
    markRemovedTypeCards();
  }, 50));
  new MutationObserver(markRemovedTypeCards).observe(document.body, { childList: true, subtree: true });
}

installSixGameGuard();
