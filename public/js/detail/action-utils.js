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

export function readImageListFromThumb(thumb) {
  const grid = thumb?.closest?.('[data-images]');
  if (!grid) return [];
  try {
    return JSON.parse(decodeURIComponent(grid.dataset.images || '%5B%5D'));
  } catch {
    return [];
  }
}
