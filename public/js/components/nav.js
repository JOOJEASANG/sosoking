import { auth, db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { avatarImg } from '../utils/avatar.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

async function loadProfile(user) {
  if (!user || user.isAnonymous) return {};
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  return snap?.exists() ? snap.data() : {};
}

export function renderNav() {
  document.getElementById('bottom-nav')?.remove();

  const hash = location.hash || '#/';
  const isHome = hash === '#/' || hash === '#' || hash === '';
  const isBoard = hash.startsWith('#/board');
  const isSubmit = hash.startsWith('#/submit');
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
      <span class="nav-icon">🔥</span>
      <span class="nav-label">게시판</span>
    </a>
    <a href="#/submit" class="nav-item nav-cta${isSubmit ? ' active' : ''}">
      <span class="nav-icon">⚖️</span>
      <span class="nav-label">접수</span>
    </a>
    <a href="${isLoggedIn ? '#/my-cases' : '#/auth'}" class="nav-item${isAuth ? ' active' : ''}" id="nav-account-item">
      <span class="nav-icon" id="nav-account-icon">${isLoggedIn ? '●' : '👤'}</span>
      <span class="nav-label" id="nav-account-label">${isLoggedIn ? '접속 중' : '로그인'}</span>
    </a>
  `;
  document.body.appendChild(nav);

  if (isLoggedIn) {
    loadProfile(user).then(profile => {
      const icon = document.getElementById('nav-account-icon');
      const label = document.getElementById('nav-account-label');
      const name = profile.nickname || user.displayName || '계정';
      if (icon) {
        icon.innerHTML = `<span style="position:relative;display:inline-block;line-height:0;">${avatarImg(user, profile, 24)}<span style="position:absolute;right:-1px;bottom:-1px;width:8px;height:8px;border-radius:99px;background:#27ae60;border:1.5px solid #101522;"></span></span>`;
      }
      if (label) label.textContent = escapeHtml(name).replace(/&amp;/g, '&').slice(0, 8);
    });
  }
}
