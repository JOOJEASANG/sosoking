import { appState } from '../state.js';
import { navigate } from '../router.js';

function installIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`;
}

function notifBell() {
  const n = appState.unreadNotifications || 0;
  return `<a href="#/account?tab=notifications" class="notif-bell" title="알림">
    🔔${n > 0 ? `<span class="notif-badge">${n > 99 ? '99+' : n}</span>` : ''}
  </a>`;
}

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function sunIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
  </svg>`;
}

function moonIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
  </svg>`;
}

function themeToggleBtn() {
  const dark = isDark();
  return `<button class="theme-toggle" id="theme-toggle-btn" title="${dark ? '라이트 모드로' : '다크 모드로'}" aria-label="테마 전환">
    ${dark ? sunIcon() : moonIcon()}
  </button>`;
}

export function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;

  const user    = appState.user;
  const isAdmin = appState.isAdmin;
  const path    = window.location.hash.slice(1).split('?')[0] || '/';

  el.innerHTML = `
    <div class="site-header__inner">
      <a class="site-header__logo" href="#/" aria-label="소소킹 홈">
        <img src="/logo.svg" alt="" aria-hidden="true">
        소소킹
        <span class="site-header__logo-badge">BETA</span>
      </a>

      <div class="site-header__search">
        <div class="search-input-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
          <input class="search-input" type="search" placeholder="게시물 검색" id="header-search" autocomplete="off">
        </div>
      </div>

      <nav class="site-header__nav" aria-label="주 내비게이션">
        <a href="#/" class="${path === '/' ? 'active' : ''}">🏠 홈</a>
        <a href="#/feed" class="${path === '/feed' ? 'active' : ''}">📋 피드</a>
        <a href="#/mission" class="${path === '/mission' ? 'active' : ''}">🎯 미션</a>
        ${user
          ? `<a href="#/account" class="${path === '/account' ? 'active' : ''}">👤 내정보</a>
             <a href="#/scraps" class="${path === '/scraps' ? 'active' : ''}" title="스크랩">🔖</a>
             ${notifBell()}`
          : `<a href="#/login" class="${path === '/login' ? 'active' : ''}">로그인</a>`
        }
        ${isAdmin ? `<a href="#/admin" class="${path === '/admin' ? 'active' : ''}" style="color:var(--color-primary);font-weight:800">⚙️ 관리자</a>` : ''}
        <a href="#/write" class="nav-write ${path === '/write' ? 'active' : ''}">✏️ 만들기</a>
      </nav>

      ${themeToggleBtn()}
      ${appState.installPrompt ? `
        <button class="pwa-install-btn" id="pwa-install-btn" title="앱 설치">
          ${installIcon()}
          <span>앱 설치</span>
        </button>` : ''}

      <div class="site-header__mobile-menu">
        ${appState.installPrompt ? `
          <button class="pwa-install-btn-mobile" id="pwa-install-btn-mobile" aria-label="앱 설치" title="앱 설치">
            ${installIcon()}
            <span>앱설치</span>
          </button>` : ''}
        <button class="site-header__icon-btn" id="mobile-search-btn" aria-label="검색">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
        </button>
        ${user
          ? `<a href="#/account" class="avatar avatar--sm" aria-label="내 정보" style="text-decoration:none">${user.displayName?.[0] ?? '나'}</a>`
          : `<a href="#/login" class="btn btn--primary btn--sm">로그인</a>`
        }
      </div>
    </div>
  `;

  document.getElementById('header-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) navigate(`/feed?q=${encodeURIComponent(q)}`);
    }
  });

  document.getElementById('mobile-search-btn')?.addEventListener('click', () => {
    navigate('/feed');
  });

  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    renderHeader();
  });

  const triggerInstall = async () => {
    const prompt = appState.installPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      appState.installPrompt = null;
      renderHeader();
    }
  };
  document.getElementById('pwa-install-btn')?.addEventListener('click', triggerInstall);
  document.getElementById('pwa-install-btn-mobile')?.addEventListener('click', triggerInstall);
}
