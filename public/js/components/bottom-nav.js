import { navigate } from '../router.js';

const NAV_ITEMS = [
  {
    id: 'home', label: '홈', path: '/',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
  },
  {
    id: 'feed', label: '피드', path: '/feed',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>`,
  },
  { id: 'write', label: '만들기', path: '/write', isCenter: true },
  {
    id: 'mission', label: '미션', path: '/mission',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  },
  {
    id: 'account', label: '내정보', path: '/account',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`,
  },
];

export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  if (!el) return;

  const path = window.location.hash.slice(1).split('?')[0] || '/';

  el.innerHTML = `
    <div class="bottom-nav__inner">
      ${NAV_ITEMS.map(item => {
        if (item.isCenter) {
          return `
            <div class="bottom-nav__write">
              <button class="bottom-nav__write-btn" onclick="navigate('/write')" aria-label="만들기">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              </button>
            </div>`;
        }
        return `
          <button class="bottom-nav__item ${path === item.path ? 'active' : ''}"
            onclick="navigate('${item.path}')" aria-label="${item.label}">
            ${item.icon}
            <span>${item.label}</span>
          </button>`;
      }).join('')}
    </div>
  `;
}
