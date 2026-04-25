import { toggleTheme, getTheme } from './theme.js';
import { auth, logout, db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

let _nicknameCache = null;
let _nicknameCacheUid = null;

export function invalidateNicknameCache() {
  _nicknameCache = null; _nicknameCacheUid = null;
}

async function getNickname(uid) {
  if (_nicknameCacheUid === uid && _nicknameCache !== null) return _nicknameCache;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    _nicknameCache = snap.exists() ? (snap.data().nickname || null) : null;
    _nicknameCacheUid = uid;
  } catch { _nicknameCache = null; }
  return _nicknameCache;
}

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
           <span class="nav-label" id="nav-account-label">계정</span>
         </button>`
    }
  `;
  document.body.appendChild(nav);

  if (!isAnon) {
    nav.querySelector('#nav-account-btn')?.addEventListener('click', async () => {
      const nick = await getNickname(user.uid);
      showAccountMenu(user, nick);
    });
    // Load nickname asynchronously and update label
    getNickname(user.uid).then(nick => {
      const label = document.getElementById('nav-account-label');
      if (label && nick) label.textContent = nick;
    });
  }
}

function showAccountMenu(user, nickname) {
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
          <div style="font-size:14px;font-weight:700;color:var(--cream);margin-top:2px;">${nickname || user.displayName || user.email || '계정'}</div>
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
    _nicknameCache = null; _nicknameCacheUid = null;
    await logout();
    renderNav();
    location.hash = '#/';
  });
}
