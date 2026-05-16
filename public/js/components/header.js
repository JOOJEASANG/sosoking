import { appState } from '../state.js';
import { navigate } from '../router.js';

function notifBell() {
  const n = appState.unreadNotifications || 0;
  return `<a href="#/account?tab=notifications" class="notif-bell" title="알림">
    🔔${n > 0 ? `<span class="notif-badge">${n > 99 ? '99+' : n}</span>` : ''}
  </a>`;
}

export function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;

  const user = appState.user;
  const isAdmin = appState.isAdmin;
  const path = window.location.hash.slice(1).split('?')[0] || '/';

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
          <input class="search-input" type="search" placeholder="게시물, 태그 검색" id="header-search" autocomplete="off">
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

      <div class="site-header__mobile-menu">
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
}
