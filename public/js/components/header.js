/* header.js — 단순 모바일 헤더 */
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';
import { normalizeNicknameIcon } from '../utils/nickname-icon.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}
function isDark(){return document.documentElement.getAttribute('data-theme') === 'dark';}
function iconSun(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>');}
function iconMoon(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M21 15.5A8.5 8.5 0 0 1 8.5 3 8.5 8.5 0 1 0 21 15.5Z"/>');}

function renderHeaderAvatar(user) {
  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '나';
  const icon = normalizeNicknameIcon(appState.nicknameIcon);
  if (icon?.type === 'image') return `<img class="site-header__avatar-img" src="${escHtml(icon.url)}" alt="" aria-hidden="true">`;
  if (icon?.type === 'emoji') return `<span class="site-header__avatar-emoji" aria-hidden="true">${escHtml(icon.value)}</span>`;
  if (user?.photoURL) return `<img class="site-header__avatar-img" src="${escHtml(user.photoURL)}" alt="" aria-hidden="true">`;
  return escHtml((nickname || '나')[0]);
}

export function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  const user = appState.user;
  const dark = isDark();
  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '내 정보';

  el.innerHTML = `
    <div class="site-header__inner">
      <a href="#/" class="site-header__logo" data-logo-nav aria-label="소소킹 홈"><img src="/logo.svg" alt="" width="24" height="24"><span>소소킹</span></a>
      <div class="site-header__spacer"></div>
      <button class="site-header__icon-btn site-header__theme-btn" id="hdr-theme-btn" aria-label="${dark ? '라이트 모드로 전환' : '다크 모드로 전환'}" title="${dark ? '라이트 모드' : '다크 모드'}">${dark ? iconSun() : iconMoon()}</button>
      ${user ? `<button class="site-header__icon-btn site-header__avatar" id="hdr-avatar" aria-label="내 정보" title="${escHtml(nickname)}">${renderHeaderAvatar(user)}</button>` : `<button class="btn btn--primary btn--sm" id="hdr-login">로그인</button>`}
    </div>`;

  el.querySelector('[data-logo-nav]')?.addEventListener('click', e => { e.preventDefault(); navigate('/'); });
  el.querySelector('#hdr-login')?.addEventListener('click', () => navigate('/login'));
  el.querySelector('#hdr-avatar')?.addEventListener('click', () => navigate('/account'));
  el.querySelector('#hdr-theme-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    renderHeader();
  });
}
