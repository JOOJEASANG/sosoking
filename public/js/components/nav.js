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

export function renderNav() {
  document.getElementById('bottom-nav')?.remove();
  const hash = location.hash || '#/';
  const user = auth.currentUser;
  const isAnon = !user || user.isAnonymous;
  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/" class="nav-item${hash === '#/' || hash === '#' || hash === '' ? ' active' : ''}"><span class="nav-icon">🏠</span><span class="nav-label">홈</span></a>
    <a href="#/feed" class="nav-item${hash.startsWith('#/feed') ? ' active' : ''}"><span class="nav-icon">✨</span><span class="nav-label">소소피드</span></a>
    <a href="#/predict" class="nav-item nav-cta${hash.startsWith('#/predict') ? ' active' : ''}"><span class="nav-icon">🔮</span><span class="nav-label">예측판</span></a>
    <a href="#/ranking" class="nav-item${hash === '#/ranking' ? ' active' : ''}"><span class="nav-icon">👑</span><span class="nav-label">랭킹</span></a>
    ${isAnon ? `<button class="nav-item" id="nav-anon-btn" type="button"><span class="nav-icon">⚙️</span><span class="nav-label">설정</span></button>` : `<button class="nav-item" id="nav-account-btn" type="button"><span class="nav-icon">🔓</span><span class="nav-label">계정</span></button>`}
  `;
  document.body.appendChild(nav);
  if (!isAnon) nav.querySelector('#nav-account-btn')?.addEventListener('click', async () => showAccountMenu(user, await getNickname(user.uid)));
  else nav.querySelector('#nav-anon-btn')?.addEventListener('click', showAnonMenu);
}

function showAccountMenu(user, nickname) {
  const existing = document.getElementById('account-menu-overlay');
  if (existing) { existing.remove(); return; }
  const displayName = nickname || user.displayName || user.email || '예측러';
  const emailLine = user.email ? `<div style="font-size:12px;color:var(--cream-dim);margin-top:2px;">${user.email}</div>` : '';
  const overlay = document.createElement('div');
  overlay.id = 'account-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  overlay.innerHTML = `
    <div id="account-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.5)"></div>
    <div style="position:absolute;bottom:66px;left:0;right:0;margin:0 16px;">
      <div class="card" style="padding:0;overflow:hidden;border-radius:16px;">
        <div style="padding:18px 18px 14px;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--cream-dim);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">소소킹 계정</div>
          <div style="display:flex;align-items:center;gap:12px;"><div style="width:40px;height:40px;border-radius:50%;background:rgba(79,124,255,0.15);border:1.5px solid rgba(79,124,255,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;">🔮</div><div><div id="menu-nickname" style="font-size:16px;font-weight:700;color:var(--cream);">${escHtml(displayName)}</div>${emailLine}</div></div>
        </div>
        <a href="#/history" id="account-history-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🧾</span> 내 기록</a>
        <a href="#/guide" id="account-guide-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">📖</span> 이용 안내</a>
        <button id="account-theme-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">${getTheme() === 'dark' ? '☀️' : '🌙'}</span>${getTheme() === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}</button>
        <button id="account-logout-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--red);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">🚪</span> 로그아웃</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#account-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#account-history-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#account-guide-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#account-theme-btn').addEventListener('click', () => { toggleTheme(); overlay.remove(); });
  overlay.querySelector('#account-logout-btn').addEventListener('click', async () => { overlay.remove(); _nicknameCache = null; _nicknameCacheUid = null; await logout(); renderNav(); location.hash = '#/'; });
}

function showAnonMenu() {
  const existing = document.getElementById('anon-menu-overlay');
  if (existing) { existing.remove(); return; }
  const overlay = document.createElement('div');
  overlay.id = 'anon-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  overlay.innerHTML = `<div id="anon-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.5)"></div><div style="position:absolute;bottom:66px;left:0;right:0;margin:0 16px;"><div class="card" style="padding:0;overflow:hidden;border-radius:16px;"><a href="#/history" id="anon-history-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🧾</span> 내 기록</a><a href="#/guide" id="anon-guide-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">📖</span> 이용 안내</a><button id="anon-theme-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">${getTheme() === 'dark' ? '☀️' : '🌙'}</span>${getTheme() === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}</button><a href="#/login" id="anon-login-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--gold);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🔐</span> 로그인 / 회원가입</a></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#anon-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#anon-history-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#anon-guide-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#anon-theme-btn').addEventListener('click', () => { toggleTheme(); overlay.remove(); });
  overlay.querySelector('#anon-login-btn').addEventListener('click', () => overlay.remove());
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
