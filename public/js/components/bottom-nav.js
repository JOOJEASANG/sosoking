/* bottom-nav.js — 모바일 하단 탭바 */
import { navigate } from '../router.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}

function iconHome() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12 12 3l9.75 9M4.5 10.5V20.25c0 .414.336.75.75.75H9.75v-4.5c0-.414.336-.75.75-.75h3c.414 0 .75.336.75.75v4.5h4.5a.75.75 0 0 0 .75-.75V10.5"/>');
}

function iconCommunity() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12c0 4.142-4.03 7.5-9 7.5a10.5 10.5 0 0 1-2.59-.32L3 21l1.82-4.22A7.05 7.05 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z"/>');
}

function iconPlus() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>', '2.5');
}

function iconStats() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-9"/>');
}

function iconGame() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5h10.5A3.75 3.75 0 0 1 21 11.25v3A3.75 3.75 0 0 1 17.25 18h-.3a2.25 2.25 0 0 1-1.8-.9l-.9-1.2h-4.5l-.9 1.2a2.25 2.25 0 0 1-1.8.9h-.3A3.75 3.75 0 0 1 3 14.25v-3A3.75 3.75 0 0 1 6.75 7.5Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 12h3m-1.5-1.5v3M15.75 11.25h.01M17.25 13.5h.01"/>');
}

function isNavActive(navPath, currentPath) {
  if (navPath.startsWith('/write')) return currentPath === '/write';
  if (navPath === '/games') return currentPath === '/games' || currentPath.startsWith('/game/');
  return currentPath === navPath;
}

function navItems() {
  return [
    { id: 'home',      label: '홈',       path: '/',                                 icon: iconHome() },
    { id: 'feed',      label: '커뮤니티', path: '/feed',                             icon: iconCommunity() },
    { id: 'write',     label: '열기',     path: '/write?type=multi&preset=judgment', icon: iconPlus(), isCenter: true },
    { id: 'hall',      label: '랭킹',     path: '/hall',                             icon: iconStats() },
    { id: 'games',     label: '게임',     path: '/games',                            icon: iconGame() },
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
    return `<button class="bottom-nav__item${isActive ? ' active' : ''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="bottom-nav__icon-wrap">${item.icon}</span>
      <span class="bottom-nav__label">${item.label}</span>
    </button>`;
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
