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
  if (icon?.type === 'image') return `<img class="site-header__avatar-img" src="${escHtml(icon.url)}" alt="" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;border-radius:999px;display:block">`;
  if (icon?.type === 'emoji') return `<span class="site-header__avatar-emoji" aria-hidden="true" style="font-size:18px;line-height:1">${escHtml(icon.value)}</span>`;
  if (user?.photoURL) return `<img class="site-header__avatar-img" src="${escHtml(user.photoURL)}" alt="" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;border-radius:999px;display:block">`;
  return escHtml((nickname || '나')[0]);
}

function fixedIconStyle(extra = '') {
  return `display:inline-flex!important;align-items:center!important;justify-content:center!important;width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;max-width:34px!important;max-height:34px!important;padding:0!important;border-radius:12px!important;flex:0 0 34px!important;white-space:nowrap!important;${extra}`;
}

export function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  const user = appState.user;
  const dark = isDark();
  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '내 정보';
  const innerStyle = 'display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:nowrap!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;';
  const logoStyle = 'display:inline-flex!important;align-items:center!important;gap:6px!important;min-width:0!important;overflow:hidden!important;white-space:nowrap!important;flex:0 1 auto!important;';
  const logoTextStyle = 'display:inline-block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;';
  const spacerStyle = 'flex:1 1 auto!important;min-width:8px!important;';
  const loginStyle = 'display:inline-flex!important;align-items:center!important;justify-content:center!important;height:34px!important;padding:0 12px!important;border-radius:12px!important;flex:0 0 auto!important;white-space:nowrap!important;';

  el.innerHTML = `
    <div class="site-header__inner" style="${innerStyle}">
      <a href="#/" class="site-header__logo" data-logo-nav aria-label="소소킹 홈" style="${logoStyle}"><img src="/logo.svg" alt="" width="24" height="24" style="flex:0 0 24px"><span style="${logoTextStyle}">소소킹</span></a>
      <div class="site-header__spacer" style="${spacerStyle}"></div>
      <button class="site-header__icon-btn site-header__theme-btn" id="hdr-theme-btn" aria-label="${dark ? '라이트 모드로 전환' : '다크 모드로 전환'}" title="${dark ? '라이트 모드' : '다크 모드'}" style="${fixedIconStyle()}">${dark ? iconSun() : iconMoon()}</button>
      ${user ? `<button class="site-header__icon-btn site-header__avatar" id="hdr-avatar" aria-label="내 정보" title="${escHtml(nickname)}" style="${fixedIconStyle('border-radius:999px!important;overflow:hidden!important;font-weight:900!important;')}">${renderHeaderAvatar(user)}</button>` : `<button class="btn btn--primary btn--sm" id="hdr-login" style="${loginStyle}">로그인</button>`}
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
