/* bottom-nav.js — 소소킹 모바일 하단 탭 */
import { navigate } from '../router.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}

function iconHome() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12 12 3l9.75 9M4.5 10.5V20.25c0 .414.336.75.75.75H9.75v-4.5c0-.414.336-.75.75-.75h3c.414 0 .75.336.75.75v4.5h4.5a.75.75 0 0 0 .75-.75V10.5"/>');
}

function isActive(navPath, currentPath) {
  if (navPath === '/playground') return currentPath.startsWith('/playground');
  if (navPath === '/materials') return currentPath === '/materials' || currentPath.startsWith('/material/');
  return currentPath === navPath;
}

function navItems() {
  return [
    { id: 'home', label: '홈', path: '/', icon: iconHome() },
    { id: 'materials', label: '자료', path: '/materials', icon: '<span style="font-size:19px;line-height:1">📚</span>' },
    { id: 'playground', label: 'AI킹', path: '/playground', icon: '<span style="font-size:24px;line-height:1">🤖</span>' },
    { id: 'debates', label: '토론', path: '/debates', icon: '<span style="font-size:19px;line-height:1">💬</span>' },
    { id: 'account', label: '내정보', path: '/account', icon: '<span style="font-size:19px;line-height:1">👤</span>' },
  ];
}

export function renderBottomNav() {
  const element = document.getElementById('bottom-nav');
  if (!element) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  element.innerHTML = `<div class="bottom-nav__inner">${navItems().map(item => {
    const active = isActive(item.path, path);
    return `<button class="bottom-nav__item${active ? ' active' : ''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${active ? 'page' : 'false'}"><span class="bottom-nav__icon-wrap">${item.icon}</span><span class="bottom-nav__label">${item.label}</span></button>`;
  }).join('')}</div>`;
  element.querySelectorAll('[data-nav-path]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.navPath)));
}

window.addEventListener('hashchange', renderBottomNav);
