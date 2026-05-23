/* bottom-nav.js — 모바일 하단 탭바 */
import { navigate } from '../router.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}

function iconHome() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12 12 3l9.75 9M4.5 10.5V20.25c0 .414.336.75.75.75H9.75v-4.5c0-.414.336-.75.75-.75h3c.414 0 .75.336.75.75v4.5h4.5a.75.75 0 0 0 .75-.75V10.5"/>');
}

function iconFeed() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>');
}

function iconPlus() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>', '2.5');
}

function iconGame() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"/>');
}

function iconAccount() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>');
}

function isNavActive(navPath, currentPath) {
  if (navPath === '/sosoland') return currentPath === '/sosoland' || currentPath.startsWith('/game/');
  if (navPath === '/write?type=multi') return currentPath === '/write';
  return currentPath === navPath;
}

function navItems() {
  return [
    { id: 'home',    label: '홈',    path: '/',              icon: iconHome() },
    { id: 'feed',    label: '피드',  path: '/feed',          icon: iconFeed() },
    { id: 'write',   label: '작성',  path: '/write?type=multi', icon: iconPlus(), isCenter: true },
    { id: 'game',    label: '게임',  path: '/sosoland',      icon: iconGame() },
    { id: 'account', label: '내정보', path: '/account',      icon: iconAccount() },
  ];
}

export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  const items = navItems();
  el.innerHTML = `<div class="bottom-nav__inner">${items.map(item => {
    const isActive = isNavActive(item.path, path);
    if (item.isCenter) {
      return `<div class="bottom-nav__write"><button class="bottom-nav__write-btn${isActive ? ' active' : ''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive ? 'page' : 'false'}">${item.icon}</button></div>`;
    }
    return `<button class="bottom-nav__item${isActive ? ' active' : ''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive ? 'page' : 'false'}"><span class="bottom-nav__icon-wrap">${item.icon}</span><span class="bottom-nav__label">${item.label}</span></button>`;
  }).join('')}</div>`;
  el.querySelectorAll('[data-nav-path]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.navPath)));
}

window.addEventListener('hashchange', () => {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  el.querySelectorAll('[data-nav-path]').forEach(btn => {
    const isActive = isNavActive(btn.dataset.navPath, path);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
});
