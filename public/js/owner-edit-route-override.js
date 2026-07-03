import { navigate } from './router.js';

function getDetailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

document.addEventListener('click', event => {
  const btn = event.target.closest?.('#btn-owner-edit');
  if (!btn) return;
  const postId = getDetailId();
  if (!postId) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  navigate(`/write?edit=${encodeURIComponent(postId)}`);
}, true);
