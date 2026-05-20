/* sidebar.js — PC 좌측 사이드바 (≥1024px) */
import { auth, signOut } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">
    ${path}
  </svg>`;
}

function iconHome() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6"/>');
}

function iconFeed() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M4 6.5h16M4 12h16M4 17.5h16"/>');
}

function iconGame() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M7 10h4M9 8v4M15.5 9.5h.01M18 12h.01M14 13.5h.01M16.5 15h.01"/><path stroke-linecap="round" stroke-linejoin="round" d="M5.5 6.5h13a3 3 0 0 1 3 3v5.5a3 3 0 0 1-3 3h-1.1a2 2 0 0 1-1.42-.59l-1.39-1.41H9.4L8.01 17.41A2 2 0 0 1 6.6 18H5.5a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3Z"/>');
}

function iconHall() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 6H4.5A2.5 2.5 0 0 0 7 10M17 6h2.5A2.5 2.5 0 0 1 17 10"/>');
}

function iconScraps() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/>');
}

function iconAdmin() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a8 8 0 0 0 .1-1 8 8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.7-1L15 5.5h-4L10.7 8a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0-.1 1 8 8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"/>');
}

function iconWrite() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15M4.5 12h15"/>', '2');
}

function iconBell() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M15 17H9m9-2v-4a6 6 0 1 0-12 0v4l-2 2h16l-2-2ZM10 20a2 2 0 0 0 4 0"/>');
}

function iconSun() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>');
}

function iconMoon() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M21 15.5A8.5 8.5 0 0 1 8.5 3 8.5 8.5 0 1 0 21 15.5Z"/>');
}

function iconInstall() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/>');
}

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
}

function isNavActive(navPath, currentPath) {
  return currentPath === navPath || (navPath === '/sosoland' && currentPath.startsWith('/game/'));
}

function showIOSInstallGuide() {
  const prev = document.getElementById('ios-install-tip');
  if (prev) { prev.remove(); return; }

  const tip = document.createElement('div');
  tip.id = 'ios-install-tip';
  tip.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:10000;width:min(320px,calc(100vw - 32px));background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.2);text-align:center;font-size:13px;line-height:1.65';
  tip.innerHTML = `
    <div style="font-size:24px;margin-bottom:8px">📲</div>
    <div style="font-weight:800;color:var(--color-text-primary);margin-bottom:6px">홈 화면에 추가하기</div>
    <div style="color:var(--color-text-secondary)">
      Safari 하단 <b>공유 버튼 ⬆</b> 탭 후<br><b>"홈 화면에 추가"</b>를 선택하세요
    </div>
    <button id="ios-tip-close" style="margin-top:14px;padding:7px 24px;background:var(--color-primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer">확인</button>
  `;
  document.body.appendChild(tip);
  document.getElementById('ios-tip-close')?.addEventListener('click', () => tip.remove());
  setTimeout(() => tip.remove(), 10000);
}

export function renderSidebar() {
  const el = document.getElementById('site-sidebar');
  if (!el) return;

  const user = appState.user;
  const isAdmin = appState.isAdmin;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  const dark = isDark();
  const unread = appState.unreadNotifications || 0;

  const NAV_ITEMS = isAdmin ? [
    { label: '관리자', path: '/admin', icon: iconAdmin() },
  ] : [
    { label: '홈', path: '/', icon: iconHome() },
    { label: '피드', path: '/feed', icon: iconFeed() },
    { label: '게임', path: '/sosoland', icon: iconGame() },
    { label: '명예의 전당', path: '/hall', icon: iconHall() },
    ...(user ? [{ label: '스크랩', path: '/scraps', icon: iconScraps() }] : []),
  ];

  const navHTML = NAV_ITEMS.map(item => {
    const active = isNavActive(item.path, path);
    return `
      <a href="#${item.path}"
         class="sidebar__nav-item${active ? ' active' : ''}"
         aria-current="${active ? 'page' : 'false'}"
         data-nav="${item.path}">
        ${item.icon}
        <span>${item.label}</span>
      </a>`;
  }).join('');

  const userSection = user
    ? `<div class="sidebar__user-wrap">
        <div class="sidebar__user">
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
        </div>
        <button class="sidebar__logout-btn" id="sb-logout-btn" title="로그아웃" aria-label="로그아웃">
          ${svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M15 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3M10 12h10m0 0-3-3m3 3-3 3"/>')}
          <span>로그아웃</span>
        </button>
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
      <button class="sidebar__write-btn" id="sb-write-btn" aria-label="피드 만들기">
        ${iconWrite()}
        <span>피드 만들기</span>
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
        ${(appState.installPrompt || isIOS()) && !isAdmin && !isStandalone() ? `
        <button class="sidebar__util-btn" id="sb-pwa-btn" aria-label="앱 설치">
          ${iconInstall()}
          <span>앱 설치</span>
        </button>` : ''}
      </div>
    </div>
  `;

  el.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.nav);
    });
  });

  document.getElementById('sb-write-btn')?.addEventListener('click', () => navigate('/write'));
  document.getElementById('sb-avatar')?.addEventListener('click', () => !isAdmin && navigate('/account'));
  document.getElementById('sb-username')?.addEventListener('click', () => !isAdmin && navigate('/account'));

  document.getElementById('sb-logout-btn')?.addEventListener('click', async () => {
    await signOut(auth);
    navigate('/');
  });

  document.getElementById('sb-theme-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    renderSidebar();
  });

  document.getElementById('sb-pwa-btn')?.addEventListener('click', async () => {
    const prompt = appState.installPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        appState.installPrompt = null;
        renderSidebar();
      }
    } else {
      showIOSInstallGuide();
    }
  });
}

window.addEventListener('hashchange', () => {
  const el = document.getElementById('site-sidebar');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  el.querySelectorAll('[data-nav]').forEach(link => {
    const active = isNavActive(link.dataset.nav, path);
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
});
