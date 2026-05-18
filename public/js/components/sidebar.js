/* sidebar.js — PC 좌측 사이드바 (≥1024px) */
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

/* ── 아이콘 (Heroicons outline) ── */
function iconHome() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>
  </svg>`;
}

function iconFeed() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
  </svg>`;
}

function iconMission() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`;
}

function iconHall() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/>
  </svg>`;
}

function iconScraps() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
  </svg>`;
}

function iconAdmin() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>`;
}

function iconWrite() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
  </svg>`;
}

function iconBell() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
  </svg>`;
}

function iconSun() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/>
  </svg>`;
}

function iconMoon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>
  </svg>`;
}

function iconInstall() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
  </svg>`;
}

/* ── 유틸 ── */
function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/* ── 렌더 ── */
export function renderSidebar() {
  const el = document.getElementById('site-sidebar');
  if (!el) return;

  const user    = appState.user;
  const isAdmin = appState.isAdmin;
  const path    = window.location.hash.slice(1).split('?')[0] || '/';
  const dark    = isDark();
  const unread  = appState.unreadNotifications || 0;

  const NAV_ITEMS = isAdmin ? [
    { label: '관리자', path: '/admin', icon: iconAdmin() },
  ] : [
    { label: '홈',          path: '/',        icon: iconHome()    },
    { label: '탐색',        path: '/feed',    icon: iconFeed()    },
    { label: '미션',        path: '/mission', icon: iconMission() },
    { label: '명예의 전당', path: '/hall',    icon: iconHall()    },
    ...(user ? [{ label: '스크랩', path: '/scraps',  icon: iconScraps()  }] : []),
  ];

  const navHTML = NAV_ITEMS.map(item => `
    <a href="#${item.path}"
       class="sidebar__nav-item${path === item.path ? ' active' : ''}"
       aria-current="${path === item.path ? 'page' : 'false'}"
       data-nav="${item.path}">
      ${item.icon}
      <span>${item.label}</span>
    </a>`).join('');

  const userSection = user
    ? `<div class="sidebar__user">
        <div class="sidebar__user-avatar" id="sb-avatar"
             title="${escHtml(user.displayName || '내 정보')}"
             role="button" tabindex="0" aria-label="내 정보">
          ${escHtml((user.displayName || '나')[0])}
        </div>
        <span class="sidebar__user-name" id="sb-username">
          ${escHtml(user.displayName || user.email || '사용자')}
        </span>
        ${!isAdmin ? `<a href="#/account?tab=notifications" class="sidebar__icon-btn" title="알림" aria-label="알림">
          ${iconBell()}
          ${unread > 0 ? `<span class="sidebar__badge">${unread > 99 ? '99+' : unread}</span>` : ''}
        </a>` : ''}
      </div>`
    : `<a href="#/login" class="sidebar__login-btn">로그인 / 가입</a>`;

  el.innerHTML = `
    <div class="sidebar__logo">
      <a href="#/" class="sidebar__brand" aria-label="소소킹 홈" data-nav="${isAdmin ? '/admin' : '/'}">
        <img src="/logo.svg" alt="" width="28" height="28">
        <span class="sidebar__brand-name">소소킹</span>
      </a>
    </div>

    <nav class="sidebar__nav" aria-label="주 내비게이션">
      ${navHTML}
    </nav>

    ${!isAdmin ? `<div class="sidebar__write">
      <button class="sidebar__write-btn" id="sb-write-btn" aria-label="새 글 만들기">
        ${iconWrite()}
        <span>놀이판 만들기</span>
      </button>
    </div>` : ''}

    <div class="sidebar__bottom">
      ${userSection}
      <div class="sidebar__footer-utils">
        <button class="sidebar__util-btn" id="sb-theme-btn"
          aria-label="${dark ? '라이트 모드로 전환' : '다크 모드로 전환'}">
          ${dark ? iconSun() : iconMoon()}
          <span>${dark ? '라이트 모드' : '다크 모드'}</span>
        </button>
        ${appState.installPrompt && !isAdmin ? `
        <button class="sidebar__util-btn" id="sb-pwa-btn" aria-label="앱 설치">
          ${iconInstall()}
          <span>앱 설치</span>
        </button>` : ''}
      </div>
    </div>
  `;

  /* ── 이벤트 ── */
  el.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.nav);
    });
  });

  document.getElementById('sb-write-btn')?.addEventListener('click', () => navigate('/write'));
  document.getElementById('sb-avatar')?.addEventListener('click',   () => !isAdmin && navigate('/account'));
  document.getElementById('sb-username')?.addEventListener('click', () => !isAdmin && navigate('/account'));

  document.getElementById('sb-theme-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    renderSidebar();
  });

  document.getElementById('sb-pwa-btn')?.addEventListener('click', async () => {
    const prompt = appState.installPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      appState.installPrompt = null;
      renderSidebar();
    }
  });
}

/* ── 라우트 변경 시 활성 상태 업데이트 ── */
window.addEventListener('hashchange', () => {
  const el = document.getElementById('site-sidebar');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  el.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === path);
    link.setAttribute('aria-current', link.dataset.nav === path ? 'page' : 'false');
  });
});