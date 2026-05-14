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
  if (document.getElementById('sosoking-premium-game-nav-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-premium-game-nav-style';
  style.textContent = `
    #bottom-nav{
      position:fixed!important;left:50%!important;right:auto!important;bottom:10px!important;
      width:min(640px,calc(100vw - 20px))!important;max-width:calc(100vw - 20px)!important;transform:translateX(-50%)!important;
      height:70px!important;padding:7px!important;gap:0!important;z-index:300!important;
      display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;
      border:1px solid rgba(255,255,255,.42)!important;border-radius:26px!important;
      background:linear-gradient(135deg,rgba(255,255,255,.88),rgba(245,248,255,.74))!important;
      box-shadow:0 18px 55px rgba(24,34,70,.18),0 3px 0 rgba(255,255,255,.78) inset!important;
      backdrop-filter:blur(22px) saturate(1.35)!important;-webkit-backdrop-filter:blur(22px) saturate(1.35)!important;
      overflow:visible!important;box-sizing:border-box!important;
    }
    #bottom-nav:before{content:'';position:absolute;inset:-1px;border-radius:27px;pointer-events:none;background:linear-gradient(135deg,rgba(255,232,92,.55),rgba(255,122,89,.20),rgba(124,92,255,.38));z-index:-1;filter:blur(10px);opacity:.65;}
    #bottom-nav .nav-item{position:relative;width:100%!important;min-width:0;height:56px;padding:7px 2px 6px!important;margin:0!important;border:0!important;border-radius:20px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;background:transparent!important;color:#737b8f!important;text-decoration:none!important;font-weight:900!important;transition:transform .18s ease,background .18s ease,color .18s ease,box-shadow .18s ease!important;-webkit-tap-highlight-color:transparent;box-sizing:border-box!important;appearance:none!important;-webkit-appearance:none!important;}
    #bottom-nav .nav-item:hover{transform:translateY(-1px);}
    #bottom-nav .nav-item.active{background:linear-gradient(135deg,#ffffff,#fff7d7)!important;color:#171e3b!important;box-shadow:0 10px 28px rgba(255,122,89,.18),0 0 0 1px rgba(255,122,89,.20) inset!important;transform:translateY(-3px)!important;}
    #bottom-nav .nav-item.active:after{content:'';position:absolute;left:50%;bottom:5px;width:18px;height:3px;border-radius:999px;transform:translateX(-50%);background:linear-gradient(90deg,#ff7a59,#7c5cff);}
    #bottom-nav .nav-item.nav-cta{height:62px;margin-top:-12px!important;border-radius:24px!important;color:#fff!important;background:linear-gradient(135deg,#ff7a59 0%,#ff5c8a 45%,#7c5cff 100%)!important;box-shadow:0 14px 34px rgba(255,92,138,.34),0 0 0 1px rgba(255,255,255,.35) inset!important;}
    #bottom-nav .nav-item.nav-cta:before{content:'';position:absolute;inset:5px;border-radius:19px;border:1px solid rgba(255,255,255,.28);pointer-events:none;}
    #bottom-nav .nav-item.nav-cta.active{transform:translateY(-5px) scale(1.02)!important;color:#fff!important;background:linear-gradient(135deg,#7c5cff,#4f7cff)!important;}
    #bottom-nav .nav-item.nav-cta.active:after{background:#fff;bottom:7px;}
    #bottom-nav .nav-icon{font-size:20px!important;line-height:1!important;filter:drop-shadow(0 2px 3px rgba(20,28,60,.12));}
    #bottom-nav .nav-cta .nav-icon{font-size:24px!important;}
    #bottom-nav .nav-label{font-size:10px!important;line-height:1.1!important;font-weight:1000!important;letter-spacing:-.04em!important;white-space:nowrap!important;}
    #bottom-nav .nav-item.active .nav-label{color:inherit!important;}
    @media(max-width:380px){#bottom-nav{width:calc(100vw - 12px)!important;max-width:calc(100vw - 12px)!important;padding:6px!important}.nav-label{font-size:9px!important}#bottom-nav .nav-icon{font-size:18px!important}#bottom-nav .nav-cta .nav-icon{font-size:22px!important}}
    [data-theme="dark"] #bottom-nav{border-color:rgba(255,255,255,.12)!important;background:linear-gradient(135deg,rgba(18,25,42,.88),rgba(12,17,30,.76))!important;box-shadow:0 18px 55px rgba(0,0,0,.42),0 1px 0 rgba(255,255,255,.08) inset!important;}
    [data-theme="dark"] #bottom-nav .nav-item{color:#9ba6bd!important;}
    [data-theme="dark"] #bottom-nav .nav-item.active{background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(124,92,255,.24))!important;color:#fff!important;box-shadow:0 12px 32px rgba(124,92,255,.28),0 0 0 1px rgba(255,255,255,.10) inset!important;}
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
    <a href="#/feed" class="nav-item${hash === '#/feed' || hash === '#/feed/top' || (hash.startsWith('#/feed/') && !['#/feed/new'].includes(hash)) ? ' active' : ''}"><span class="nav-icon">✨</span><span class="nav-label">피드</span></a>
    <a href="#/feed/new" class="nav-item nav-cta${hash === '#/feed/new' ? ' active' : ''}"><span class="nav-icon">＋</span><span class="nav-label">만들기</span></a>
    <a href="#/mission" class="nav-item${hash === '#/mission' ? ' active' : ''}"><span class="nav-icon">🎯</span><span class="nav-label">미션</span></a>
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
    <div style="position:absolute;bottom:88px;left:0;right:0;margin:0 16px;">
      <div class="card" style="padding:0;overflow:hidden;border-radius:24px;">
        <div style="padding:18px 18px 14px;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--cream-dim);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">소소킹 계정</div>
          <div style="display:flex;align-items:center;gap:12px;"><div style="width:42px;height:42px;border-radius:16px;background:linear-gradient(135deg,#ffe85c,#ff7a59);display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div><div><div id="menu-nickname" style="font-size:16px;font-weight:900;color:var(--cream);">${escHtml(displayName)}</div>${emailLine}</div></div>
        </div>
        <a href="#/account" id="account-profile-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">⚙️</span> 내정보 수정</a>
        <a href="#/mission" id="account-mission-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🎯</span> 오늘의 미션</a>
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
  overlay.innerHTML = `<div id="anon-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.5)"></div><div style="position:absolute;bottom:88px;left:0;right:0;margin:0 16px;"><div class="card" style="padding:0;overflow:hidden;border-radius:24px;"><a href="#/mission" id="anon-mission-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🎯</span> 오늘의 미션</a><a href="#/feed" id="anon-feed-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">✨</span> 소소피드</a><a href="#/guide" id="anon-guide-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">📖</span> 이용 안내</a><button id="anon-theme-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">${getTheme() === 'dark' ? '☀️' : '🌙'}</span>${getTheme() === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}</button><a href="#/login" id="anon-login-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--gold);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:10px;text-decoration:none;"><span style="font-size:16px;">🔐</span> 로그인 / 회원가입</a></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#anon-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => overlay.remove()));
  overlay.querySelector('#anon-theme-btn').addEventListener('click', () => { toggleTheme(); overlay.remove(); });
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
