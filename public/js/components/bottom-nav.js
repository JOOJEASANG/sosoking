/* bottom-nav.js — 모바일 하단 탭바 */
import { navigate } from '../router.js';
import { appState } from '../state.js';

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

function iconParty() {
  return `<span style="font-size:22px;line-height:1">🏛️</span>`;
}

function iconStats() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-9"/>');
}

function iconAccount() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>');
}

function isNavActive(navPath, currentPath) {
  if (navPath === '/write?type=multi') return currentPath === '/write';
  return currentPath === navPath;
}

const MORE_ITEMS = [
  { path: '/feed',                 emoji: '🧾', label: '피드' },
  { path: '/ranking',              emoji: '🏆', label: '랭킹' },
  { path: '/news',                 emoji: '📰', label: '소소신문' },
  { path: '/constitutional-court', emoji: '⚖️', label: '헌법재판소' },
  { path: '/congress',             emoji: '📜', label: '국회' },
  { path: '/hall',                 emoji: '🏅', label: '명예의전당' },
  { path: '/king-history',         emoji: '📖', label: '집권 역사' },
  { path: '/guide',                emoji: '💡', label: '게임 가이드' },
];

function iconMore() {
  return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>');
}

function navItems() {
  return [
    { id: 'home',     label: '홈',    path: '/',         icon: iconHome() },
    { id: 'battle',   label: '배틀',  path: '/battle',   icon: `<span style="font-size:20px;line-height:1">⚔️</span>` },
    { id: 'republic', label: '공화국', path: '/republic', icon: `<span style="font-size:22px;line-height:1">🏛️</span>`, isCenter: true },
    { id: 'election', label: '대선',  path: '/election', icon: `<span style="font-size:20px;line-height:1">👑</span>` },
    { id: 'more',     label: '더보기', path: null,        icon: iconMore(), isMore: true },
  ];
}

function openMoreSheet() {
  const existing = document.getElementById('more-sheet-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'more-sheet-overlay';
  overlay.innerHTML = `
    <div class="more-sheet__backdrop"></div>
    <div class="more-sheet" role="dialog" aria-label="전체 메뉴">
      <div class="more-sheet__handle"></div>
      <div class="more-sheet__title">전체 기능</div>
      <div class="more-sheet__grid">
        ${MORE_ITEMS.map(item => `
          <button class="more-sheet__item" data-path="${item.path}" type="button">
            <span class="more-sheet__item-emoji">${item.emoji}</span>
            <span class="more-sheet__item-label">${item.label}</span>
          </button>`).join('')}
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('more-sheet-overlay--open'));

  overlay.querySelector('.more-sheet__backdrop').addEventListener('click', () => {
    overlay.classList.remove('more-sheet-overlay--open');
    setTimeout(() => overlay.remove(), 280);
  });
  overlay.querySelectorAll('[data-path]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.path);
      overlay.classList.remove('more-sheet-overlay--open');
      setTimeout(() => overlay.remove(), 280);
    });
  });
}

export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  const items = navItems();

  el.innerHTML = `<div class="bottom-nav__inner">${items.map(item => {
    if (item.isMore) {
      return `<button class="bottom-nav__item" id="bottom-nav-more-btn" aria-label="${item.label}">
        <span class="bottom-nav__icon-wrap">${item.icon}</span>
        <span class="bottom-nav__label">${item.label}</span>
      </button>`;
    }
    const isActive = isNavActive(item.path, path);
    if (item.isCenter) {
      return `<button class="bottom-nav__item${isActive ? ' active' : ''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive ? 'page' : 'false'}">
        <span class="bottom-nav__icon-wrap">${item.icon}</span>
        <span class="bottom-nav__label">${item.label}</span>
      </button>`;
    }
    const badgeHTML = (item.badge > 0)
      ? `<span class="bottom-nav__badge">${item.badge > 99 ? '99+' : item.badge}</span>`
      : '';
    return `<button class="bottom-nav__item${isActive ? ' active' : ''}" data-nav-path="${item.path}" aria-label="${item.label}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="bottom-nav__icon-wrap">${item.icon}${badgeHTML}</span>
      <span class="bottom-nav__label">${item.label}</span>
    </button>`;
  }).join('')}</div>`;

  el.querySelectorAll('[data-nav-path]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.navPath)));
  document.getElementById('bottom-nav-more-btn')?.addEventListener('click', openMoreSheet);
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
