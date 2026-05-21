/* header.js — 모바일 전용 상단 헤더 (PC에서는 CSS로 숨김) */
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';
import { normalizeNicknameIcon } from '../utils/nickname-icon.js';

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
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
function iconInstall() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
  </svg>`;
}

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
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

function iconBell() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
  </svg>`;
}

function renderThemeButton(dark) {
  return `
    <button class="site-header__icon-btn site-header__theme-btn" id="hdr-theme-btn"
      aria-label="${dark ? '라이트 모드로 전환' : '다크 모드로 전환'}"
      title="${dark ? '라이트 모드' : '다크 모드'}">
      ${dark ? iconSun() : iconMoon()}
    </button>`;
}

function renderHeaderAvatar(user) {
  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '나';
  const icon = normalizeNicknameIcon(appState.nicknameIcon);
  if (icon?.type === 'image') {
    return `<img class="site-header__avatar-img" src="${escHtml(icon.url)}" alt="" aria-hidden="true">`;
  }
  if (icon?.type === 'emoji') {
    return `<span class="site-header__avatar-emoji" aria-hidden="true">${escHtml(icon.value)}</span>`;
  }
  if (user?.photoURL) {
    return `<img class="site-header__avatar-img" src="${escHtml(user.photoURL)}" alt="" aria-hidden="true">`;
  }
  return escHtml((nickname || '나')[0]);
}

export function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;

  const user   = appState.user;
  const dark   = isDark();
  const unread = appState.unreadNotifications || 0;
  const hasNickIcon = !!normalizeNicknameIcon(appState.nicknameIcon) || !!user?.photoURL;
  const themeButton = renderThemeButton(dark);

  el.innerHTML = `
    <div class="site-header__inner">
      <a href="#/" class="site-header__logo" data-logo-nav aria-label="소소킹 홈">
        <img src="/logo.svg" alt="" width="24" height="24">
        <span>소소킹</span>
      </a>

      <div class="site-header__spacer"></div>

      <div class="site-header__actions">
        ${(appState.installPrompt || isIOS()) && !isStandalone() ? `
        <button class="site-header__install-btn" id="hdr-install-btn" aria-label="앱 설치">
          ${iconInstall()}<span>앱 설치</span>
        </button>` : ''}

        ${user ? `
          <a href="#/account?tab=notifications"
             class="site-header__icon-btn notif-bell"
             style="position:relative"
             aria-label="알림${unread > 0 ? ` (${unread}개 읽지 않음)` : ''}">
            ${iconBell()}
            ${unread > 0 ? `<span class="notif-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          </a>
          ${themeButton}
          <button class="site-header__icon-btn site-header__avatar ${hasNickIcon ? 'site-header__avatar--icon' : ''}" id="hdr-avatar"
            aria-label="내 정보"
            title="${escHtml(appState.nickname || user.displayName || '내 정보')}">
            ${renderHeaderAvatar(user)}
          </button>
        ` : `
          ${themeButton}
          <a href="#/login" class="btn btn--primary btn--sm">로그인</a>
        `}
      </div>
    </div>
  `;

  el.querySelector('[data-logo-nav]')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  document.getElementById('hdr-theme-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    renderHeader();
  });

  document.getElementById('hdr-avatar')?.addEventListener('click', () => navigate('/account'));

  document.getElementById('hdr-install-btn')?.addEventListener('click', async () => {
    const prompt = appState.installPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        appState.installPrompt = null;
        renderHeader();
      }
    } else {
      showIOSInstallGuide();
    }
  });
}
