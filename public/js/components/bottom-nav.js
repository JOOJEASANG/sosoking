/* bottom-nav.js — 핵심 게임 하단 탭 */
import { navigate } from '../router.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}

function iconHome() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12 12 3l9.75 9M4.5 10.5V20.25c0 .414.336.75.75.75H9.75v-4.5c0-.414.336-.75.75-.75h3c.414 0 .75.336.75.75v4.5h4.5a.75.75 0 0 0 .75-.75V10.5"/>');
}

function iconElection() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 3.75 14.25 8l4.75.68-3.43 3.34.81 4.73L12 14.5l-4.38 2.25.81-4.73L5 8.68 9.75 8 12 3.75Z"/>');
}

function isNavActive(navPath, currentPath) {
  return currentPath === navPath;
}

function navItems() {
  return [
    { id: 'home',     label: '홈',     path: '/',         icon: iconHome() },
    { id: 'battle',   label: '오늘게임', path: '/battle',   icon: `<span style="font-size:20px;line-height:1">⚔️</span>` },
    { id: 'republic', label: '정당',   path: '/republic', icon: `<span style="font-size:22px;line-height:1">🏛️</span>`, isCenter: true },
    { id: 'history',  label: '역사',   path: '/history',  icon: `<span style="font-size:20px;line-height:1">📚</span>` },
    { id: 'election', label: '대선',   path: '/election', icon: iconElection() },
  ];
}

export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  const items = navItems();

  el.innerHTML = `<div class="bottom-nav__inner">${items.map(item => {
    const isActive = isNavActive(item.path, path);
    return `<button class="bottom-nav__item${isActive ? ' active' : ''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="bottom-nav__icon-wrap">${item.icon}</span>
      <span class="bottom-nav__label">${item.label}</span>
    </button>`;
  }).join('')}</div>`;

  el.querySelectorAll('[data-nav-path]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.navPath)));
}

window.addEventListener('hashchange', () => renderBottomNav());
