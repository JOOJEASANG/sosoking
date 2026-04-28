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
  const isHome   = hash === '#/' || hash === '#' || hash === '';
  const isCourt  = hash.startsWith('#/topics') || hash.startsWith('#/topic/') || hash.startsWith('#/debate/') || hash.startsWith('#/join/') || hash === '#/submit-topic';
  const isNews   = hash === '#/sosonews';
  const isDevil  = hash === '#/devil-deal';
  const isMy     = hash === '#/my-history';

  const user = auth.currentUser;
  const isAnon = !user || user.isAnonymous;

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/" class="nav-item${isHome ? ' active' : ''}">
      <span class="nav-icon">👑</span>
      <span class="nav-label">홈</span>
    </a>
    <a href="#/topics" class="nav-item${isCourt ? ' active' : ''}">
      <span class="nav-icon">⚖️</span>
      <span class="nav-label">재판</span>
    </a>
    <a href="#/sosonews" class="nav-item${isNews ? ' active' : ''}">
      <span class="nav-icon">📺</span>
      <span class="nav-label">뉴스</span>
    </a>
    <a href="#/devil-deal" class="nav-item${isDevil ? ' active' : ''}">
      <span class="nav-icon">😈</span>
      <span class="nav-label">거래</span>
    </a>
    ${isAnon
      ? `<button class="nav-item" id="nav-anon-btn" type="button">
           <span class="nav-icon">🔐</span>
           <span class="nav-label">나</span>
         </button>`
      : `<button class="nav-item${isMy ? ' active' : ''}" id="nav-account-btn" type="button">
           <span class="nav-icon">🔓</span>
           <span class="nav-label">나</span>
         </button>`
    }
  `;
  document.body.appendChild(nav);

  if (!isAnon) {
    nav.querySelector('#nav-account-btn')?.addEventListener('click', async () => {
      const nick = await getNickname(user.uid);
      showAccountMenu(user, nick);
    });
  } else {
    nav.querySelector('#nav-anon-btn')?.addEventListener('click', () => {
      showAnonMenu();
    });
  }
}

function showAccountMenu(user, nickname) {
  const existing = document.getElementById('account-menu-overlay');
  if (existing) { existing.remove(); return; }

  let nick = nickname;
  const displayName = nick || user.displayName || user.email || '사용자';
  const emailLine = user.email ? `<div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${user.email}</div>` : '';

  const overlay = document.createElement('div');
  overlay.id = 'account-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  overlay.innerHTML = `
    <div id="account-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.6)"></div>
    <div style="position:absolute;bottom:66px;left:0;right:0;margin:0 16px;">
      <div class="card" style="padding:0;overflow:hidden;border-radius:20px;">

        <div style="padding:18px 18px 14px;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--text-dim);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">내 계정</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--lime-dim);border:1.5px solid rgba(185,255,75,0.35);display:flex;align-items:center;justify-content:center;font-size:20px;">👑</div>
            <div>
              <div id="menu-nickname" style="font-size:16px;font-weight:700;color:var(--text);">${displayName}</div>
              ${emailLine}
            </div>
          </div>
        </div>

        <div id="nickname-edit-area" style="display:none;padding:14px 18px;border-bottom:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">새 닉네임 입력 (2~12자)</div>
          <div style="display:flex;gap:8px;">
            <input id="new-nickname-input" type="text" maxlength="12" placeholder="닉네임"
              style="flex:1;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-size:14px;color:var(--text);outline:none;">
            <button id="nickname-save-btn" style="padding:9px 14px;background:var(--lime);color:#0b0b16;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">저장</button>
            <button id="nickname-cancel-btn" style="padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text-dim);cursor:pointer;">취소</button>
          </div>
          <div id="nickname-edit-msg" style="font-size:12px;margin-top:6px;min-height:16px;"></div>
        </div>

        <button id="account-edit-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:16px;">✏️</span> 닉네임 변경
        </button>
        <a href="#/my-history" id="account-history-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;">
          <span style="font-size:16px;">📋</span> 내 기록
        </a>
        <button id="account-theme-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <span style="display:flex;align-items:center;gap:10px;"><span style="font-size:16px;">${getTheme() === 'dark' ? '☀️' : '🌙'}</span> ${getTheme() === 'dark' ? '라이트 모드' : '다크 모드'}</span>
        </button>
        <button id="account-logout-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--red);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:10px;">
          <span style="font-size:16px;">🚪</span> 로그아웃
        </button>
        <button id="account-delete-btn" style="width:100%;padding:12px 18px;background:none;border:none;text-align:left;font-size:12px;color:rgba(239,68,68,0.5);cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:14px;">🗑️</span> 회원 탈퇴
        </button>

      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#account-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#account-history-btn').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#account-theme-btn').addEventListener('click', () => {
    toggleTheme(); overlay.remove();
  });

  overlay.querySelector('#account-edit-btn').addEventListener('click', () => {
    const area = document.getElementById('nickname-edit-area');
    const input = document.getElementById('new-nickname-input');
    const isHidden = area.style.display === 'none';
    area.style.display = isHidden ? 'block' : 'none';
    if (isHidden) { input.value = nick || ''; input.focus(); }
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
      nick = newNick;
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

  overlay.querySelector('#account-delete-btn').addEventListener('click', async () => {
    const confirmed = confirm('정말로 탈퇴하시겠습니까?\n\n· 계정 및 모든 기록이 영구 삭제됩니다\n· 삭제된 데이터는 복구할 수 없습니다');
    if (!confirmed) return;
    const btn = overlay.querySelector('#account-delete-btn');
    btn.disabled = true;
    btn.innerHTML = '<span style="font-size:14px;">⏳</span> 탈퇴 처리 중...';
    try {
      const deleteAccount = httpsCallable(functions, 'deleteAccount');
      await deleteAccount({});
      overlay.remove();
      _nicknameCache = null; _nicknameCacheUid = null;
      await logout();
      renderNav();
      location.hash = '#/';
      setTimeout(() => alert('탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.'), 300);
    } catch (err) {
      alert('탈퇴 처리 중 오류: ' + (err.message || '다시 시도해주세요'));
      btn.disabled = false;
      btn.innerHTML = '<span style="font-size:14px;">🗑️</span> 회원 탈퇴';
    }
  });
}

function showAnonMenu() {
  const existing = document.getElementById('anon-menu-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'anon-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  overlay.innerHTML = `
    <div id="anon-menu-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.6)"></div>
    <div style="position:absolute;bottom:66px;left:0;right:0;margin:0 16px;">
      <div class="card" style="padding:0;overflow:hidden;border-radius:20px;">
        <a href="#/my-history" id="anon-history-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:10px;text-decoration:none;">
          <span style="font-size:16px;">📋</span> 내 기록
        </a>
        <button id="anon-theme-btn" style="width:100%;padding:14px 18px;background:none;border:none;border-bottom:1px solid var(--border);text-align:left;font-size:14px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:16px;">${getTheme() === 'dark' ? '☀️' : '🌙'}</span>
          ${getTheme() === 'dark' ? '라이트 모드' : '다크 모드'}
        </button>
        <a href="#/login" id="anon-login-btn" style="width:100%;padding:14px 18px;background:none;border:none;text-align:left;font-size:14px;color:var(--lime);cursor:pointer;font-weight:700;display:flex;align-items:center;gap:10px;text-decoration:none;">
          <span style="font-size:16px;">🔐</span> 로그인 / 회원가입
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#anon-menu-backdrop').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#anon-history-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#anon-theme-btn').addEventListener('click', () => { toggleTheme(); overlay.remove(); });
  overlay.querySelector('#anon-login-btn').addEventListener('click', () => overlay.remove());
}
