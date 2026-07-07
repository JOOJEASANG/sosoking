import { auth } from '../firebase.js?v=20260707-12';
import { onAuthStateChanged, signOut, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { showToast } from './toast.js?v=20260630-3';

const LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart', 'pointerdown'];
let timer = null;
let initialized = false;

function realUser() {
  return auth.currentUser && !auth.currentUser.isAnonymous;
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function resetTimer() {
  clearTimer();
  if (!realUser()) return;
  localStorage.setItem('sosoking.lastActivity', String(Date.now()));
  timer = setTimeout(autoLogout, LIMIT_MS + 500);
}

async function autoLogout() {
  const last = Number(localStorage.getItem('sosoking.lastActivity') || Date.now());
  const idle = Date.now() - last;
  if (!realUser()) return clearTimer();
  if (idle < LIMIT_MS) return resetTimer();
  try {
    await signOut(auth);
    await signInAnonymously(auth).catch(() => {});
    showToast('30분 이상 사용이 없어 자동 로그아웃되었습니다.', 'info');
    if (location.hash.startsWith('#/my-cases') || location.hash.startsWith('#/auth')) {
      location.hash = '#/';
    }
  } finally {
    clearTimer();
  }
}

export function initSessionTimeout() {
  if (initialized) return;
  initialized = true;
  ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) autoLogout();
  });
  onAuthStateChanged(auth, user => {
    if (user && !user.isAnonymous) resetTimer();
    else clearTimer();
  });
}
