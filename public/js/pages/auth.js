import { auth, loginWithGoogle, loginWithEmail, signupWithEmail, db, functions } from '../firebase.js';
import { invalidateNicknameCache } from '../components/nav.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderAuth(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">⚖️ 소소재판</span>
      </div>
      <div class="container" style="padding-top:32px;padding-bottom:80px;max-width:420px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:40px;margin-bottom:8px;">🔐</div>
          <h2 style="font-family:var(--font-serif);font-size:22px;font-weight:700;color:var(--cream);margin-bottom:6px;">계정으로 시작하기</h2>
          <p style="font-size:14px;color:var(--cream-dim);line-height:1.6;">로그인하면 어떤 기기에서도<br>내 재판 기록을 볼 수 있어요</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">로그인</button>
          <button class="auth-tab" data-tab="signup">회원가입</button>
        </div>

        <div id="auth-tab-login" class="auth-panel">
          <button id="google-login-btn" class="btn-google">
            <svg width="20" height="20" viewBox="0 0 48 48" style="margin-right:10px;flex-shrink:0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            Google로 계속하기
          </button>

          <div class="auth-divider"><span>또는 이메일로</span></div>

          <form id="login-form">
            <div class="form-group" style="margin-bottom:14px;">
              <input type="email" class="form-input" id="login-email" placeholder="이메일" autocomplete="email" required>
            </div>
            <div class="form-group" style="margin-bottom:20px;">
              <input type="password" class="form-input" id="login-password" placeholder="비밀번호" autocomplete="current-password" required>
            </div>
            <button type="submit" class="btn btn-primary" id="login-submit-btn">로그인</button>
          </form>
        </div>

        <div id="auth-tab-signup" class="auth-panel" style="display:none;">
          <button id="google-signup-btn" class="btn-google">
            <svg width="20" height="20" viewBox="0 0 48 48" style="margin-right:10px;flex-shrink:0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            Google로 가입하기
          </button>

          <div class="auth-divider"><span>또는 이메일로 가입</span></div>

          <form id="signup-form">
            <div class="form-group" style="margin-bottom:14px;">
              <input type="email" class="form-input" id="signup-email" placeholder="이메일" autocomplete="email" required>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <input type="password" class="form-input" id="signup-password" placeholder="비밀번호 (6자 이상)" autocomplete="new-password" required minlength="6">
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <input type="password" class="form-input" id="signup-password2" placeholder="비밀번호 확인" autocomplete="new-password" required>
            </div>
            <div class="form-group" style="margin-bottom:20px;">
              <div style="display:flex;gap:8px;">
                <input type="text" class="form-input" id="signup-nickname" placeholder="닉네임 (2~12자)" maxlength="12" style="flex:1;" required>
                <button type="button" id="check-nick-btn" class="nick-check-btn" title="중복확인">✔</button>
              </div>
              <div id="nick-status" style="font-size:12px;margin-top:6px;min-height:16px;"></div>
            </div>
            <button type="submit" class="btn btn-primary" id="signup-submit-btn">회원가입</button>
          </form>
        </div>

        <div style="text-align:center;margin-top:24px;">
          <button id="guest-btn" style="background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;text-decoration:underline;padding:8px;">
            게스트로 계속하기 (로그인 없이 이용)
          </button>
        </div>
      </div>
    </div>
  `;

  const tabs = container.querySelectorAll('.auth-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      container.querySelector('#auth-tab-login').style.display = tab.dataset.tab === 'login' ? '' : 'none';
      container.querySelector('#auth-tab-signup').style.display = tab.dataset.tab === 'signup' ? '' : 'none';
    });
  });

  container.querySelector('#guest-btn').addEventListener('click', () => {
    history.back();
    if (location.hash === '#/login') location.hash = '#/';
  });

  async function handleGoogleLogin() {
    try {
      await loginWithGoogle();
      await ensureNickname();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showToast(err.message || 'Google 로그인 실패', 'error');
      }
    }
  }

  container.querySelector('#google-login-btn').addEventListener('click', handleGoogleLogin);
  container.querySelector('#google-signup-btn').addEventListener('click', handleGoogleLogin);

  container.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#login-submit-btn');
    btn.disabled = true; btn.textContent = '로그인 중...';
    try {
      await loginWithEmail(
        container.querySelector('#login-email').value.trim(),
        container.querySelector('#login-password').value,
      );
      showToast('로그인 성공!', 'success');
      location.hash = '#/my-history';
    } catch (err) {
      showToast(authErrorMsg(err.code), 'error');
      btn.disabled = false; btn.textContent = '로그인';
    }
  });

  let nickChecked = false;
  let nickCheckValue = '';

  container.querySelector('#signup-nickname').addEventListener('input', () => {
    nickChecked = false;
    nickCheckValue = '';
    container.querySelector('#nick-status').textContent = '';
  });

  container.querySelector('#check-nick-btn').addEventListener('click', async () => {
    const nick = container.querySelector('#signup-nickname').value.trim();
    const statusEl = container.querySelector('#nick-status');
    if (!nick || nick.length < 2 || nick.length > 12) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = '닉네임은 2~12자여야 합니다';
      return;
    }
    if (!/^[가-힣a-zA-Z0-9_]+$/.test(nick)) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = '한글, 영문, 숫자, _만 사용 가능합니다';
      return;
    }
    statusEl.style.color = 'var(--cream-dim)';
    statusEl.textContent = '확인 중...';
    try {
      const snap = await getDoc(doc(db, 'nicknames', nick));
      if (snap.exists()) {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = '이미 사용 중인 닉네임입니다';
        nickChecked = false;
      } else {
        statusEl.style.color = '#27ae60';
        statusEl.textContent = '사용 가능한 닉네임입니다 ✓';
        nickChecked = true;
        nickCheckValue = nick;
      }
    } catch {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = '확인 실패. 다시 시도해주세요';
    }
  });

  container.querySelector('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#signup-email').value.trim();
    const pw = container.querySelector('#signup-password').value;
    const pw2 = container.querySelector('#signup-password2').value;
    const nick = container.querySelector('#signup-nickname').value.trim();
    const btn = container.querySelector('#signup-submit-btn');

    if (pw !== pw2) { showToast('비밀번호가 일치하지 않습니다', 'error'); return; }
    if (!nickChecked || nickCheckValue !== nick) {
      showToast('닉네임 중복확인을 먼저 해주세요', 'error'); return;
    }

    btn.disabled = true; btn.textContent = '가입 중...';
    try {
      await signupWithEmail(email, pw);
      const registerUser = httpsCallable(functions, 'registerUser');
      await registerUser({ nickname: nick });
      invalidateNicknameCache();
      showToast('가입 완료!', 'success');
      location.hash = '#/my-history';
    } catch (err) {
      showToast(authErrorMsg(err.code) || err.message || '가입 실패', 'error');
      btn.disabled = false; btn.textContent = '회원가입';
    }
  });
}

async function ensureNickname() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.data().nickname) {
      showToast('로그인 성공!', 'success');
      location.hash = '#/my-history';
      return;
    }
  } catch {}
  showNicknameModal();
}

function showNicknameModal() {
  const existing = document.getElementById('nickname-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'nickname-modal';
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-box">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:32px;margin-bottom:8px;">👤</div>
          <h3 style="font-size:18px;font-weight:700;color:var(--cream);margin-bottom:6px;">닉네임을 설정해주세요</h3>
          <p style="font-size:13px;color:var(--cream-dim);">재판에서 사용할 이름이에요</p>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" id="modal-nick-input" class="form-input" placeholder="닉네임 (2~12자)" maxlength="12" style="flex:1;">
          <button id="modal-nick-check" class="nick-check-btn" title="중복확인">✔</button>
        </div>
        <div id="modal-nick-status" style="font-size:12px;min-height:16px;margin-bottom:16px;"></div>
        <button id="modal-nick-save" class="btn btn-primary" disabled>저장하기</button>
        <button id="modal-nick-skip" style="background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;margin-top:10px;text-decoration:underline;width:100%;padding:4px;">나중에 설정하기</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let checked = false;
  let checkedVal = '';

  modal.querySelector('#modal-nick-input').addEventListener('input', () => {
    checked = false; checkedVal = '';
    modal.querySelector('#modal-nick-status').textContent = '';
    modal.querySelector('#modal-nick-save').disabled = true;
  });

  modal.querySelector('#modal-nick-check').addEventListener('click', async () => {
    const nick = modal.querySelector('#modal-nick-input').value.trim();
    const statusEl = modal.querySelector('#modal-nick-status');
    if (!nick || nick.length < 2 || nick.length > 12) {
      statusEl.style.color = 'var(--red)'; statusEl.textContent = '닉네임은 2~12자여야 합니다'; return;
    }
    if (!/^[가-힣a-zA-Z0-9_]+$/.test(nick)) {
      statusEl.style.color = 'var(--red)'; statusEl.textContent = '한글, 영문, 숫자, _만 사용 가능합니다'; return;
    }
    statusEl.style.color = 'var(--cream-dim)'; statusEl.textContent = '확인 중...';
    try {
      const snap = await getDoc(doc(db, 'nicknames', nick));
      if (snap.exists()) {
        statusEl.style.color = 'var(--red)'; statusEl.textContent = '이미 사용 중인 닉네임입니다';
        checked = false;
      } else {
        statusEl.style.color = '#27ae60'; statusEl.textContent = '사용 가능한 닉네임입니다 ✓';
        checked = true; checkedVal = nick;
        modal.querySelector('#modal-nick-save').disabled = false;
      }
    } catch {
      statusEl.style.color = 'var(--red)'; statusEl.textContent = '확인 실패. 다시 시도해주세요';
    }
  });

  modal.querySelector('#modal-nick-save').addEventListener('click', async () => {
    const nick = modal.querySelector('#modal-nick-input').value.trim();
    if (!checked || checkedVal !== nick) {
      showToast('닉네임 중복확인을 먼저 해주세요', 'error'); return;
    }
    const saveBtn = modal.querySelector('#modal-nick-save');
    saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
    try {
      const registerUser = httpsCallable(functions, 'registerUser');
      await registerUser({ nickname: nick });
      invalidateNicknameCache();
      modal.remove();
      showToast('환영합니다! 🎉', 'success');
      location.hash = '#/my-history';
    } catch (err) {
      showToast(err.message || '저장 실패', 'error');
      saveBtn.disabled = false; saveBtn.textContent = '저장하기';
    }
  });

  modal.querySelector('#modal-nick-skip').addEventListener('click', () => {
    modal.remove();
    showToast('로그인 성공! 닉네임은 내 기록 > 계정에서 설정할 수 있어요', 'info');
    location.hash = '#/my-history';
  });
}

function authErrorMsg(code) {
  const map = {
    'auth/user-not-found': '등록된 이메일이 없습니다',
    'auth/wrong-password': '비밀번호가 틀렸습니다',
    'auth/invalid-credential': '이메일 또는 비밀번호가 잘못되었습니다',
    'auth/email-already-in-use': '이미 가입된 이메일입니다',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다',
    'auth/too-many-requests': '잠시 후 다시 시도해주세요',
    'auth/network-request-failed': '네트워크 오류가 발생했습니다',
  };
  return map[code] || null;
}
