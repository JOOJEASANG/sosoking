/* bottom-nav.js — 모바일 하단 탭바 */
import { navigate } from '../router.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}
function iconHome(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6"/>');}
function iconFeed(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M4 6.5h16M4 12h16M4 17.5h16"/>');}
function iconPlus(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15M4.5 12h15"/>','2.2');}
function iconGame(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M7 10h4M9 8v4M15.5 9.5h.01M18 12h.01M14 13.5h.01M16.5 15h.01"/><path stroke-linecap="round" stroke-linejoin="round" d="M5.5 6.5h13a3 3 0 0 1 3 3v5.5a3 3 0 0 1-3 3h-1.1a2 2 0 0 1-1.42-.59l-1.39-1.41H9.4L8.01 17.41A2 2 0 0 1 6.6 18H5.5a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3Z"/>');}
function iconAccount(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 7a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 21a7.5 7.5 0 0 1 15 0"/>');}

function isNavActive(navPath, currentPath) {
  if (navPath === '/sosoland') return currentPath === '/sosoland' || currentPath.startsWith('/game/');
  if (navPath === '/write?type=multi') return currentPath === '/write';
  return currentPath === navPath;
}

function navItems() {
  return [
    { id:'home', label:'홈', path:'/', icon:iconHome() },
    { id:'feed', label:'피드', path:'/feed', icon:iconFeed() },
    { id:'write', label:'작성', path:'/write?type=multi', icon:iconPlus(), isCenter:true },
    { id:'game', label:'게임', path:'/sosoland', icon:iconGame() },
    { id:'account', label:'내정보', path:'/account', icon:iconAccount() },
  ];
}

export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  const items = navItems();
  el.innerHTML = `<div class="bottom-nav__inner">${items.map(item => {
    const isActive = isNavActive(item.path, path);
    if (item.isCenter) return `<div class="bottom-nav__write"><button class="bottom-nav__write-btn${isActive?' active':''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive?'page':'false'}">${item.icon}</button></div>`;
    return `<button class="bottom-nav__item${isActive?' active':''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive?'page':'false'}">${item.icon}<span>${item.label}</span></button>`;
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