import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const MAX_IDLE = 1800000;
const signals = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart', 'pointerdown'];
let idleTimer = null;

setPersistence(auth, browserLocalPersistence).catch(() => {});

function clearIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}
function touchActivity() {
  clearIdleTimer();
  if (!auth.currentUser) return;
  localStorage.setItem('sosoking.staffActivity', String(Date.now()));
  idleTimer = setTimeout(closeIdleSession, MAX_IDLE + 500);
}
async function closeIdleSession() {
  if (!auth.currentUser) return clearIdleTimer();
  const last = Number(localStorage.getItem('sosoking.staffActivity') || Date.now());
  if (Date.now() - last < MAX_IDLE) return touchActivity();
  await signOut(auth).catch(() => {});
  window.location.assign('/#/');
}

signals.forEach(evt => window.addEventListener(evt, touchActivity, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) closeIdleSession(); });
onAuthStateChanged(auth, user => user ? touchActivity() : clearIdleTimer());
