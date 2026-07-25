/* sidebar.js — PC 좌측 사이드바 (≥1024px) */
import { auth, signOut } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';
import { canOfferInstall, requestPwaInstall } from '../pwa-install.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}

function iconHome(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6"/>');}
function iconCommunity(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12c0 4.142-4.03 7.5-9 7.5a10.5 10.5 0 0 1-2.59-.32L3 21l1.82-4.22A7.05 7.05 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z"/>');}
function iconStats(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-9"/>');}
function iconScraps(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/>');}
function iconAdmin(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a8 8 0 0 0 .1-1 8 8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.7-1L15 5.5h-4L10.7 8a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0-.1 1 8 8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"/>');}
function iconWrite(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15M4.5 12h15"/>','2');}
function iconSun(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>');}
function iconMoon(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M21 15.5A8.5 8.5 0 0 1 8.5 3 8.5 8.5 0 1 0 21 15.5Z"/>');}
function iconInstall(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/>');}

function isDark(){return document.documentElement.getAttribute('data-theme')==='dark';}
function isNavActive(navPath, currentPath){ return currentPath===navPath; }

function renderNavItem(item, currentPath) {
  const active = isNavActive(item.path, currentPath);
  const badgeHTML = (item.badge > 0) ? `<span class="sidebar__nav-badge">${item.badge > 99 ? '99+' : item.badge}</span>` : '';
  const cls = ['sidebar__nav-item', active ? 'active' : '', item.isAdmin ? 'sidebar__nav-item--admin' : ''].filter(Boolean).join(' ');
  return `<a href="#${item.path}" class="${cls}" aria-current="${active ? 'page' : 'false'}" data-nav="${item.path}">${item.icon}<span>${item.label}</span>${badgeHTML}</a>`;
}

export function renderSidebar() {
  const el = document.getElementById('site-sidebar');
  if (!el) return;

  const user    = appState.user;
  const isAdmin = appState.isAdmin;
  const path    = window.location.hash.slice(1).split('?')[0] || '/';
  const dark    = isDark();

  const MAIN_NAV = [
    { label: '홈',       path: '/',      icon: iconHome() },
    { label: '커뮤니티', path: '/feed',  icon: iconCommunity() },
    { label: '글쓰기',   path: '/write', icon: iconWrite() },
    { label: '랭킹',     path: '/hall',  icon: iconStats() },
  ];

  const PERSONAL_NAV = user ? [
    { label: '스크랩', path: '/scraps', icon: iconScraps() },
  ] : [];

  const ADMIN_NAV = isAdmin ? [
    { label: '관리 패널', path: '/admin', icon: iconAdmin(), isAdmin: true },
  ] : [];

  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '사용자';
  const avatarLetter = escHtml((nickname || '나')[0]);
  const avatarInner = user?.photoURL ? `<img src="${escHtml(user.photoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : avatarLetter;
  const accountMeta = isAdmin ? '관리자 계정' : (user?.email ? escHtml(user.email) : '내 정보 보기');
  const showInstall = canOfferInstall();

  el.innerHTML = `
    <div class="sidebar__logo"><a href="#/" class="sidebar__brand" aria-label="소소킹 홈" data-nav="/"><img src="/logo.svg" alt="" width="28" height="28"><span class="sidebar__brand-name">소소킹</span></a></div>
    <nav class="sidebar__nav" aria-label="주 내비게이션">
      ${MAIN_NAV.map(i => renderNavItem(i, path)).join('')}
      ${PERSONAL_NAV.length > 0 ? `<div class="sidebar__nav-divider"></div>${PERSONAL_NAV.map(i => renderNavItem(i, path)).join('')}` : ''}
      ${ADMIN_NAV.length > 0 ? `<div class="sidebar__nav-divider"></div>${ADMIN_NAV.map(i => renderNavItem(i, path)).join('')}` : ''}
    </nav>
    <div class="sidebar__spacer"></div>
    <div class="sidebar__footer-panel">
      <div class="sidebar__actions" aria-label="화면 설정">
        <button class="sidebar__nav-item sidebar__nav-item--button" id="sb-theme-btn" type="button">${dark ? iconSun() : iconMoon()}<span>${dark ? '라이트 모드' : '다크 모드'}</span></button>
        ${showInstall ? `<button class="sidebar__nav-item sidebar__nav-item--button" id="sb-install-btn" type="button">${iconInstall()}<span>앱 설치</span></button>` : ''}
      </div>
      ${user ? `
        <div class="sidebar__user-wrap">
          <button class="sidebar__user sidebar__profile-btn" id="sb-profile-btn" type="button" aria-label="내 정보 열기">
            <span class="sidebar__user-avatar">${avatarInner}</span>
            <span class="sidebar__user-info">
              <span class="sidebar__user-name">${escHtml(nickname)}</span>
              <span class="sidebar__user-role">${accountMeta}</span>
            </span>
          </button>
          <button class="sidebar__logout-btn" id="sb-logout-btn" type="button">${svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M15 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3M10 12h10m0 0-3-3m3 3-3 3"/>')}<span>로그아웃</span></button>
        </div>` : `<a href="#/login" class="sidebar__login-btn">로그인 / 가입</a>`}
    </div>
  `;

  el.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', event => {
    event.preventDefault();
    navigate(a.dataset.nav || '/');
  }));

  document.getElementById('sb-profile-btn')?.addEventListener('click', () => navigate('/account'));
  document.getElementById('sb-theme-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    renderSidebar();
  });
  document.getElementById('sb-install-btn')?.addEventListener('click', async event => {
    await requestPwaInstall({ button: event.currentTarget });
  });
  document.getElementById('sb-logout-btn')?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('[sidebar logout]', error);
    }
  });
}
