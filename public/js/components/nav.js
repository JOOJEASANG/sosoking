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
  const isAccount = hash.startsWith('#/auth') || hash.startsWith('#/my-cases');
  const user = auth.currentUser;
  const isLoggedIn = Boolean(user && !user.isAnonymous);

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.setAttribute('aria-label', '판결소 메뉴');
  nav.innerHTML = `
    <a href="#/" class="nav-item${isHome ? ' active' : ''}"${isHome ? ' aria-current="page"' : ''}>
      <span class="nav-icon" aria-hidden="true">🏠</span>
      <span class="nav-label">홈</span>
    </a>
    <a href="#/board" class="nav-item${isBoard ? ' active' : ''}"${isBoard ? ' aria-current="page"' : ''}>
      <span class="nav-icon" aria-hidden="true">📜</span>
      <span class="nav-label">판결기록</span>
    </a>
    <a href="#/submit" class="nav-item nav-cta${isSubmit ? ' active' : ''}"${isSubmit ? ' aria-current="page"' : ''}>
      <span class="nav-icon"><img class="nav-brand-icon" src="/icons/sosoking-192.png?v=20260729-brand-unified-1" alt="" width="25" height="25"></span>
      <span class="nav-label">사건접수</span>
    </a>
    <a href="/dripso/#/" class="nav-item" aria-label="드립소로 이동">
      <span class="nav-icon nav-service-mark" aria-hidden="true">ㅋ</span>
      <span class="nav-label">드립소</span>
    </a>
    <a href="#/auth" class="nav-item${isAccount ? ' active' : ''}" id="nav-account-item"${isAccount ? ' aria-current="page"' : ''}>
      <span class="nav-icon" id="nav-account-icon" aria-hidden="true">${isLoggedIn ? '●' : '👤'}</span>
      <span class="nav-label" id="nav-account-label">내 정보</span>
    </a>
  `;
  document.body.appendChild(nav);

  if (isLoggedIn) {
    loadProfile(user).then(profile => {
      if (renderVersion !== navRenderVersion || auth.currentUser?.uid !== user.uid) return;
      const icon = document.getElementById('nav-account-icon');
      if (!icon) return;
      icon.innerHTML = `<span style="position:relative;display:inline-block;line-height:0;">${avatarImg(user, profile, 24)}<span style="position:absolute;right:-1px;bottom:-1px;width:8px;height:8px;border-radius:99px;background:#27ae60;border:1.5px solid #101522;"></span></span>`;
    }).catch(() => {});
  }
}

export function initNavAuthSync() {
  if (navAuthSyncStarted) return;
  navAuthSyncStarted = true;
  onAuthStateChanged(auth, () => renderNav(activeRouteOverride || routeFromLocation()));
}
