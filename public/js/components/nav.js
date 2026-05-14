import { toggleTheme, getTheme } from './theme.js';
import { auth, logout, db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

let _nicknameCache = null;
let _nicknameCacheUid = null;
export function invalidateNicknameCache() { _nicknameCache = null; _nicknameCacheUid = null; }

async function getNickname(uid) {
  if (_nicknameCacheUid === uid && _nicknameCache !== null) return _nicknameCache;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    _nicknameCache = snap.exists() ? (snap.data().nickname || null) : null;
    _nicknameCacheUid = uid;
  } catch { _nicknameCache = null; }
  return _nicknameCache;
}

function injectNavStyle() {
  if (document.getElementById('sosoking-cartoon-nav-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-cartoon-nav-style';
  style.textContent = `
    #bottom-nav{height:66px;padding:6px 7px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,.92)!important;border-top:3px solid #1b2250!important;box-shadow:0 -8px 0 rgba(27,34,80,.08),0 -18px 50px rgba(55,90,170,.16);gap:5px;backdrop-filter:blur(14px);}
    #bottom-nav .nav-item{border:2px solid transparent;border-radius:18px;color:#5e6678!important;font-weight:1000;background:transparent;min-width:0;}
    #bottom-nav .nav-item.active{background:#ffe85c!important;color:#1b2250!important;border-color:#1b2250!important;box-shadow:3px 3px 0 #1b2250;transform:translate(-1px,-1px);}
    #bottom-nav .nav-item.nav-cta{background:linear-gradient(135deg,#ff7a59,#ff5c8a)!important;color:#fff!important;border-color:#1b2250!important;box-shadow:3px 3px 0 #1b2250;}
    #bottom-nav .nav-item.nav-cta.active{background:linear-gradient(135deg,#7c5cff,#4f7cff)!important;color:#fff!important;}
    #bottom-nav .nav-icon{font-size:20px;line-height:1;filter:drop-shadow(0 1px 0 rgba(255,255,255,.5));}
    #bottom-nav .nav-label{font-size:10px;font-weight:1000;letter-spacing:-.02em;}
    [data-theme="dark"] #bottom-nav{background:rgba(16,23,34,.94)!important;border-top-color:#ffe85c!important;box-shadow:0 -18px 50px rgba(0,0,0,.35)}
    [data-theme="dark"] #bottom-nav .nav-item{color:#a8b3c7!important}
    [data-theme="dark"] #bottom-nav .nav-item.active{background:#ffe85c!important;color:#1b2250!important;border-color:#1b2250!important}
  `;
  document.head.appendChild(style);
}

export function renderNav() {
  injectNavStyle();
  document.getElementById('bottom-nav')?.remove();
  const hash = location.hash || '#/';
  const user = auth.currentUser;
  const isAnon = !user || user.isAnonymous;
  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/" class="nav-item${hash === '#/' || hash === '#' || hash === '' ? ' active' : ''}"><span class="nav-icon">🏠</span><span class="nav-label">홈</span></a>
    <a href="#/feed" class="nav-item${hash === '#/feed' || (hash.startsWith('#/feed/') && !['#/feed/new', '#/feed/top'].includes(hash)) ? ' active' : ''}"><span class="nav-icon">✨</span><span class="nav-label">피드</span></a>
    <a href="#/games" class="nav-item${hash === '#/games' ? ' active' : ''}"><span class="nav-icon">🎮</span><span class="nav-label">게임</span></a>
    <a href="#/feed/new" class="nav-item nav-cta${hash === '#/feed/new' ? ' active' : ''}"><span class="nav-icon">➕</span><span class="nav-label">만들기</span></a>
    <a href="#/feed/top" class="nav-item${hash === '#/feed/top' ? ' active' : ''}"><span class="nav-icon">🔥</span><span class="nav-label">인기</span></a>
    ${isAnon ? `<button class="nav-item" id="nav-anon-btn" type="button"><span class="nav-icon">👤</span><span class="nav-label">계정</span></button>` : `<button class="nav-item${hash === '#/account' ? ' active' : ''}" id="nav-account-btn" type="button"><span class="nav-icon">👤</span><span class="nav-label">계정</span></button>`}
  `;
  document.body.appendChild(nav);
  if (!isAnon) nav.querySelector('#nav-account-btn')?.addEventListener('click', async () => showAccountMenu(user, await getNickname(user.uid)));
  else nav.querySelector('#nav-anon-btn')?.addEventListener('click', showAnonMenu);
}

function showAccountMenu(user, nickname) {
  const existing = document.getElementById('account-menu-overlay');
  if (existing) { existing.remove(); return; }
  const displayName = nickname || user.displayName || user.email || '소소러';
  const emailLine = user.email ? `<div style="font-size:12px;color:var(--cream-dim);margin-top:2px;">${escHtml(user.email)}</div>` : '';
  const overlay = document.createElement('div');
  overlay.id = 'account-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  overlay.innerHTML = `
    <div id="account-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.5)"></div>
    <div style="position:absolute;bottom:74px;left:0;right:0;margin:0 16px;">
      <div class="card" style="padding:0;overflow:hidden;border-radius:22px;">
        <div style="padding:18px 18px 14px;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--cream-dim);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">소소킹 계정</div>
          <div style="display:flex;align-items:center;gap:12px;"><div style="width:42px;height:42px;border-radius:16px;background:#ffe85c;border:2px solid #1b2250;display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div><div><div id="menu-nickname" style="font-size:16px;font-weight:900;color:var(--cream);">${escHtml(displayName)}</div>${emailLine}</div></div>
        </div>
        <a href="#/account" id="account-profile-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">⚙️</span> 내정보 수정</a>
        <a href="#/games" id="account-games-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🎮</span> 게임 메뉴</a>
        <a href="#/feed" id="account-feed-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">✨</span> 소소피드</a>
        <a href="#/guide" id="account-guide-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">📖</span> 이용 안내</a>
        <button id="account-theme-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">${getTheme() === 'dark' ? '☀️' : '🌙'}</span>${getTheme() === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}</button>
        <button id="account-logout-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--red);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">🚪</span> 로그아웃</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#account-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => overlay.remove()));
  overlay.querySelector('#account-theme-btn').addEventListener('click', () => { toggleTheme(); overlay.remove(); });
  overlay.querySelector('#account-logout-btn').addEventListener('click', async () => { overlay.remove(); _nicknameCache = null; _nicknameCacheUid = null; await logout(); renderNav(); location.hash = '#/'; });
}

function showAnonMenu() {
  const existing = document.getElementById('anon-menu-overlay');
  if (existing) { existing.remove(); return; }
  const overlay = document.createElement('div');
  overlay.id = 'anon-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  overlay.innerHTML = `<div id="anon-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.5)"></div><div style="position:absolute;bottom:74px;left:0;right:0;margin:0 16px;"><div class="card" style="padding:0;overflow:hidden;border-radius:22px;"><a href="#/games" id="anon-games-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🎮</span> 게임 메뉴</a><a href="#/feed" id="anon-feed-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">✨</span> 소소피드</a><a href="#/guide" id="anon-guide-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">📖</span> 이용 안내</a><button id="anon-theme-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">${getTheme() === 'dark' ? '☀️' : '🌙'}</span>${getTheme() === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}</button><a href="#/login" id="anon-login-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--gold);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🔐</span> 로그인 / 회원가입</a></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#anon-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => overlay.remove()));
  overlay.querySelector('#anon-theme-btn').addEventListener('click', () => { toggleTheme(); overlay.remove(); });
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
