/* bottom-nav.js — 모바일 하단 탭바 */
import { navigate } from '../router.js';

function iconHome() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>
  </svg>`;
}

function iconFeed() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
  </svg>`;
}

function iconGame() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12h.008v.008H6.75V12zm10.5 0h.008v.008h-.008V12zM9 15.75h6m-9.75 3h13.5A2.25 2.25 0 0021 16.5v-9A2.25 2.25 0 0018.75 5.25H5.25A2.25 2.25 0 003 7.5v9a2.25 2.25 0 002.25 2.25z"/>
  </svg>`;
}

function iconHall() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/>
  </svg>`;
}

function iconAccount() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
  </svg>`;
}

const NAV_ITEMS = [
  { id: 'home',    label: '홈',   path: '/',        icon: iconHome()    },
  { id: 'feed',    label: '피드', path: '/feed',    icon: iconFeed()    },
  { id: 'game',    label: null,   path: '/sosoland', isCenter: true    },
  { id: 'hall',    label: '명예의전당', path: '/hall', icon: iconHall() },
  { id: 'account', label: '내정보', path: '/account', icon: iconAccount() },
];

export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  if (!el) return;

  const path = window.location.hash.slice(1).split('?')[0] || '/';

  el.innerHTML = `
    <div class="bottom-nav__inner">
      ${NAV_ITEMS.map(item => {
        if (item.isCenter) {
          const isActive = path === item.path;
          return `
            <div class="bottom-nav__write">
              <button class="bottom-nav__write-btn${isActive ? ' active' : ''}" data-nav-path="${item.path}" aria-label="게임">
                ${iconGame()}
                <span class="bottom-nav__center-label">게임</span>
              </button>
            </div>`;
        }
        const isActive = path === item.path;
        return `
          <button class="bottom-nav__item${isActive ? ' active' : ''}"
            data-nav-path="${item.path}"
            aria-label="${item.label}"
            aria-current="${isActive ? 'page' : 'false'}">
            ${item.icon}
            <span>${item.label}</span>
          </button>`;
      }).join('')}
    </div>
  `;

  el.querySelectorAll('[data-nav-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.navPath));
  });
}

window.addEventListener('hashchange', () => {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  el.querySelectorAll('[data-nav-path]').forEach(btn => {
    const isActive = btn.dataset.navPath === path;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
});
