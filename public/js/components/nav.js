import { toggleTheme, getTheme } from './theme.js';
import { auth, logout } from '../firebase.js';

export function renderNav() {
  document.getElementById('bottom-nav')?.remove();

  const hash = location.hash || '#/';
  const isHome = hash === '#/' || hash === '#' || hash === '';
  const isTopics = hash.startsWith('#/topics') || hash.startsWith('#/topic/');
  const isSubmit = hash === '#/submit-topic';
  const isMy = hash === '#/my-history';
  const isLogin = hash === '#/login';
  const isDark = getTheme() !== 'light';

  const user = auth.currentUser;
  const isAnon = !user || user.isAnonymous;

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/" class="nav-item${isHome ? ' active' : ''}">
      <span class="nav-icon">🏠</span>
      <span class="nav-label">홈</span>
    </a>
    <a href="#/topics" class="nav-item${isTopics ? ' active' : ''}">
      <span class="nav-icon">⚖️</span>
      <span class="nav-label">사건 목록</span>
    </a>
    <a href="#/submit-topic" class="nav-item nav-cta${isSubmit ? ' active' : ''}">
      <span class="nav-icon">✏️</span>
      <span class="nav-label">주제 등록</span>
    </a>
    <a href="#/my-history" class="nav-item${isMy ? ' active' : ''}">
      <span class="nav-icon">📋</span>
      <span class="nav-label">내 기록</span>
    </a>
    ${isAnon
      ? `<a href="#/login" class="nav-item${isLogin ? ' active' : ''}">
           <span class="nav-icon">🔐</span>
           <span class="nav-label">로그인</span>
         </a>`
      : `<button class="nav-item" id="nav-account-btn" type="button">
           <span class="nav-icon">👤</span>
           <span class="nav-label">계정</span>
         </button>`
    }
  `;
  document.body.appendChild(nav);

  if (!isAnon) {
    nav.querySelector('#nav-account-btn')?.addEventListener('click', () => {
      showAccountMenu(user);
    });
  }
}

function showAccountMenu(user) {
  const existing = document.getElementById('account-menu-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'account-menu-overlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:1000;`;
  overlay.innerHTML = `
    <div id="account-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.4)"></div>
    <div style="position:absolute;bottom:70px;right:0;left:0;margin:0 16px;">
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:16px 18px;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;color:var(--cream-dim);">로그인됨</div>
          <div style="font-size:14px;font-weight:700;color:var(--cream);margin-top:2px;">${user.displayName || user.email || '계정'}</div>
        </div>
        <button id="account-logout-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--red);cursor:pointer;font-weight:600;">
          🚪 로그아웃
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#account-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#account-logout-btn').addEventListener('click', async () => {
    overlay.remove();
    await logout();
    renderNav();
    location.hash = '#/';
  });
}
