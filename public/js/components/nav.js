import { auth, db } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { avatarImg } from '../utils/avatar.js?v=20260630-3';

let navRenderVersion = 0;
let navAuthSyncStarted = false;
let activeRouteOverride = '';

async function loadProfile(user) {
  if (!user || user.isAnonymous) return {};
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  return snap?.exists() ? snap.data() : {};
}

function routeFromLocation() {
  const hash = location.hash || '';
  if (hash && hash !== '#') return hash;
  const path = location.pathname.replace(/\/$/, '') || '/';
  if (path === '/') return '#/';
  if (path === '/board') return '#/board';
  if (path === '/submit') return '#/submit';
  if (path === '/daily-court') return '#/daily-court';
  if (path === '/guide') return '#/guide';
  if (path === '/auth') return '#/auth';
  if (path === '/my-cases') return '#/my-cases';
  if (path.startsWith('/result/')) return '#/result/';
  if (path.startsWith('/trial/')) return '#/trial/';
  return '#/';
}

export function renderNav(activeRoute = '') {
  if (activeRoute) activeRouteOverride = activeRoute;
  const renderVersion = ++navRenderVersion;
  document.getElementById('bottom-nav')?.remove();

  const hash = activeRoute || activeRouteOverride || routeFromLocation();
  const isHome = hash === '#/' || hash === '#' || hash === '';
  const isBoard = hash.startsWith('#/board');
  const isSubmit = hash.startsWith('#/submit');
  const isDailyCourt = hash.startsWith('#/daily-court');
  const isAuth = hash.startsWith('#/auth') || hash.startsWith('#/my-cases');
  const user = auth.currentUser;
  const isLoggedIn = !!user && !user.isAnonymous;

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/" class="nav-item${isHome ? ' active' : ''}">
      <span class="nav-icon">🏠</span>
      <span class="nav-label">홈</span>
    </a>
    <a href="#/board" class="nav-item${isBoard ? ' active' : ''}">
      <span class="nav-icon">📜</span>
      <span class="nav-label">판결기록</span>
    </a>
    <a href="#/submit" class="nav-item nav-cta${isSubmit ? ' active' : ''}">
      <span class="nav-icon"><img class="nav-brand-icon" src="/icons/sosoking-192.png?v=20260729-brand-unified-1" alt="" width="25" height="25"></span>
      <span class="nav-label">접수</span>
    </a>
    <a href="#/daily-court" data-nav-key="daily-court" class="nav-item${isDailyCourt ? ' active' : ''}">
      <span class="nav-icon" aria-hidden="true">&#9878;</span>
      <span class="nav-label">오늘재판</span>
    </a>
    <a href="#/auth" class="nav-item${isAuth ? ' active' : ''}" id="nav-account-item">
      <span class="nav-icon" id="nav-account-icon">${isLoggedIn ? '●' : '👤'}</span>
      <span class="nav-label" id="nav-account-label">${isLoggedIn ? '접속 중' : '로그인'}</span>
    </a>
  `;
  document.body.appendChild(nav);

  if (isLoggedIn) {
    loadProfile(user).then(profile => {
      if (renderVersion !== navRenderVersion || auth.currentUser?.uid !== user.uid) return;
      const icon = document.getElementById('nav-account-icon');
      const label = document.getElementById('nav-account-label');
      const name = String(profile.nickname || user.displayName || '계정').slice(0, 8);
      if (icon) {
        icon.innerHTML = `<span style="position:relative;display:inline-block;line-height:0;">${avatarImg(user, profile, 24)}<span style="position:absolute;right:-1px;bottom:-1px;width:8px;height:8px;border-radius:99px;background:#27ae60;border:1.5px solid #101522;"></span></span>`;
      }
      if (label) label.textContent = name;
    }).catch(() => {});
  }
}

export function initNavAuthSync() {
  if (navAuthSyncStarted) return;
  navAuthSyncStarted = true;
  onAuthStateChanged(auth, () => renderNav(activeRouteOverride || routeFromLocation()));
}
