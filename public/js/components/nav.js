import { toggleTheme, getTheme } from './theme.js';
import { auth, logout, db, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

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
           <span class="nav-icon">🔓</span>
           <span class="nav-label">로그아웃</span>
         </button>`
    }
  `;
  document.body.appendChild(nav);

  if (!isAnon) {
    nav.querySelector('#nav-account-btn')?.addEventListener('click', async () => {
      const nick = await getNickname(user.uid);
      showAccountMenu(user, nick);
    });
  }
}

function showAccountMenu(user, nickname) {
  const existing = document.getElementById('account-menu-overlay');
  if (existing) { existing.remove(); return; }

  const displayName = nickname || user.displayName || user.email || '사용자';
  const emailLine = user.email ? `<div style="font-size:12px;color:var(--cream-dim);margin-top:2px;">${user.email}</div>` : '';

  const overlay = document.createElement('div');
  overlay.id = 'account-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  overlay.innerHTML = `
    <div id="account-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.5)"></div>
    <div style="position:absolute;bottom:66px;left:0;right:0;margin:0 16px;">
      <div class="card" style="padding:0;overflow:hidden;border-radius:16px;">

        <div style="padding:18px 18px 14px;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--cream-dim);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">내 계정</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:50%;background:rgba(201,168,76,0.15);border:1.5px solid rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;">🔓</div>
            <div>
              <div id="menu-nickname" style="font-size:16px;font-weight:700;color:var(--cream);">${displayName}</div>
              ${emailLine}
            </div>
          </div>
        </div>

        <div id="nickname-edit-area" style="display:none;padding:14px 18px;border-bottom:1px solid var(--border);">
          <div style="font-size:12px;color:var(--cream-dim);margin-bottom:8px;">새 닉네임 입력 (2~12자)</div>
          <div style="display:flex;gap:8px;">
            <input id="new-nickname-input" type="text" maxlength="12" placeholder="닉네임"
              style="flex:1;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-size:14px;color:var(--cream);outline:none;">
            <button id="nickname-save-btn" style="padding:9px 14px;background:var(--gold);color:#0d1117;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">저장</button>
            <button id="nickname-cancel-btn" style="padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--cream-dim);cursor:pointer;">취소</button>
          </div>
          <div id="nickname-edit-msg" style="font-size:12px;margin-top:6px;min-height:16px;"></div>
        </div>

        <button id="account-edit-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:16px;">✏️</span> 닉네임 변경
        </button>
        <button id="account-logout-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--red);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:10px;">
          <span style="font-size:16px;">🚪</span> 로그아웃
        </button>

      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#account-menu-backdrop').addEventListener('click', () => overlay.remove());

  // 닉네임 변경 토글
  overlay.querySelector('#account-edit-btn').addEventListener('click', () => {
    const area = document.getElementById('nickname-edit-area');
    const input = document.getElementById('new-nickname-input');
    const isHidden = area.style.display === 'none';
    area.style.display = isHidden ? 'block' : 'none';
    if (isHidden) { input.value = nickname || ''; input.focus(); }
  });

  overlay.querySelector('#nickname-cancel-btn').addEventListener('click', () => {
    document.getElementById('nickname-edit-area').style.display = 'none';
  });

  overlay.querySelector('#nickname-save-btn').addEventListener('click', async () => {
    const input = document.getElementById('new-nickname-input');
    const msg = document.getElementById('nickname-edit-msg');
    const newNick = input.value.trim();
    if (!newNick || newNick.length < 2) { msg.style.color = 'var(--red)'; msg.textContent = '2자 이상 입력해주세요'; return; }
    const saveBtn = document.getElementById('nickname-save-btn');
    saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
    msg.textContent = '';
    try {
      const registerUser = httpsCallable(functions, 'registerUser');
      await registerUser({ nickname: newNick });
      _nicknameCache = newNick; _nicknameCacheUid = user.uid;
      document.getElementById('menu-nickname').textContent = newNick;
      document.getElementById('nickname-edit-area').style.display = 'none';
      msg.style.color = '#27ae60'; msg.textContent = '닉네임이 변경되었습니다';
      nickname = newNick;
    } catch (err) {
      msg.style.color = 'var(--red)'; msg.textContent = err.message || '저장 실패';
      saveBtn.disabled = false; saveBtn.textContent = '저장';
    }
  });

  overlay.querySelector('#account-logout-btn').addEventListener('click', async () => {
    overlay.remove();
    _nicknameCache = null; _nicknameCacheUid = null;
    await logout();
    renderNav();
    location.hash = '#/';
  });
}

