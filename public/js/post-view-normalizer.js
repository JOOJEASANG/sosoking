import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

function getDetailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getVisitorId() {
  const key = 'sosoking-view-visitor-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function makeVisitId(postId) {
  const uid = auth.currentUser?.uid || getVisitorId();
  return `${postId}_${todayKey()}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function updateViewText(delta) {
  if (!delta) return;
  document.querySelectorAll('.detail-meta span').forEach(span => {
    const text = span.textContent || '';
    const match = text.match(/^조회\s+(\d+)/);
    if (!match) return;
    const next = Math.max(0, Number(match[1]) + delta);
    span.textContent = `조회 ${next}`;
  });
}

async function normalizeView() {
  const postId = getDetailId();
  if (!postId) return;
  const sessionKey = `sosoking-view-normalized:${makeVisitId(postId)}`;
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');

  try {
    const fn = httpsCallable(functions, 'normalizePostView');
    const result = await fn({
      postId,
      visitorId: getVisitorId(),
      dayKey: todayKey(),
      visitId: makeVisitId(postId),
    });
    if (result.data && result.data.counted === false) updateViewText(-1);
  } catch (error) {
    console.warn('[post-view-normalizer] failed', error);
    sessionStorage.removeItem(sessionKey);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(normalizeView, 500);
}

window.addEventListener('hashchange', schedule);
setTimeout(schedule, 700);
