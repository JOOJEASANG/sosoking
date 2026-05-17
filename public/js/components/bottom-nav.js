/* bottom-nav.js — 모바일 하단 탭바 (5개 항목) */
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

function iconWrite() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
  </svg>`;
}

function iconMission() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`;
}

function iconAccount() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
  </svg>`;
}

const NAV_ITEMS = [
  { id: 'home',    label: '홈',   path: '/',        icon: iconHome()    },
  { id: 'feed',    label: '탐색', path: '/feed',    icon: iconFeed()    },
  { id: 'write',   label: null,   path: '/write',   isCenter: true      },
  { id: 'mission', label: '미션', path: '/mission', icon: iconMission() },
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
          return `
            <div class="bottom-nav__write">
              <button class="bottom-nav__write-btn" data-nav-path="/write" aria-label="놀이판 만들기">
                ${iconWrite()}
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

  /* ── 이벤트 ── */
  el.querySelectorAll('[data-nav-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.navPath));
  });
}

/* ── 라우트 변경 시 활성 상태 업데이트 ── */
window.addEventListener('hashchange', () => {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  el.querySelectorAll('.bottom-nav__item').forEach(btn => {
    const isActive = btn.dataset.navPath === path;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
});
