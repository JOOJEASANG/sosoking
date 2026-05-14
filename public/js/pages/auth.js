import { auth, loginWithGoogle, loginWithEmail, signupWithEmail, sendResetEmail, changeEmailPassword, db, functions, trackEvent, trackUser } from '../firebase.js';
import { invalidateNicknameCache } from '../components/nav.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';
import { injectPredictStyle } from './predict-home.js';

function detectInAppBrowser() {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV/i.test(ua)) return 'facebook';
  if (/Line\//i.test(ua)) return 'line';
  if (/wv\)/.test(ua) || /WebView/i.test(ua)) return 'webview';
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari/.test(ua) && !/CriOS/.test(ua)) return 'ios-webview';
  return null;
}

export async function renderAuth(container) {
  injectPredictStyle();
  injectAuthStyle();
  const inApp = detectInAppBrowser();
  const currentEmail = auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.email || '' : '';
  const inAppBanner = inApp ? `<div class="auth-alert"><b>Google 로그인이 막힐 수 있어요</b><p>이메일 로그인이나 외부 브라우저 사용을 권장합니다.</p></div>` : '';

  container.innerHTML = `
    <main class="predict-app auth-page-v2 simple-auth-page">
      <section class="auth-simple-shell">
        <a href="#/" class="back-link auth-back">‹</a>
        <section class="auth-simple-card">
          <div class="auth-simple-brand">
            <img src="/logo.svg" alt="소소킹">
            <span>SOSOKING</span>
            <h1>소소킹 시작하기</h1>
            <p>피드, 댓글, 투표, 미친작명소를 바로 즐겨보세요.</p>
          </div>

          ${inAppBanner}

          <div class="auth-panel-v2" id="auth-tab-login">
            <button id="google-login-btn" class="google-btn-v2">${googleIcon()}<span>Google 계정 선택하기</span></button>
            <form id="login-form" class="auth-form-v2 simple-login-form">
              <input type="email" id="login-email" placeholder="이메일" autocomplete="email" required>
              <input type="password" id="login-password" placeholder="비밀번호" autocomplete="current-password" required>
              <button type="submit" id="login-submit-btn">이메일로 로그인</button>
            </form>
            <button id="guest-btn" class="guest-btn-v2" type="button">게스트로 둘러보기</button>
            <div class="auth-simple-links">
              <button type="button" data-tab="signup">회원가입</button>
              <button type="button" data-tab="password">비밀번호 찾기</button>
            </div>
          </div>

          <div id="auth-tab-signup" class="auth-panel-v2 auth-sub-panel" hidden>
            <div class="auth-sub-head"><b>회원가입</b><button type="button" data-tab="login">닫기</button></div>
            <button id="google-signup-btn" class="google-btn-v2">${googleIcon()}<span>Google 계정으로 가입</span></button>
            <form id="signup-form" class="auth-form-v2">
              <label>이메일</label><input type="email" id="signup-email" placeholder="이메일" autocomplete="email" required>
              <label>비밀번호</label><input type="password" id="signup-password" placeholder="비밀번호 6자 이상" autocomplete="new-password" required minlength="6">
              <label>비밀번호 확인</label><input type="password" id="signup-password2" placeholder="비밀번호 확인" autocomplete="new-password" required>
              <label>닉네임</label><div class="nick-row"><input type="text" id="signup-nickname" placeholder="닉네임 2~12자" maxlength="12" required><button type="button" id="check-nick-btn">확인</button></div>
              <div id="nick-status" class="auth-status"></div>
              <button type="submit" id="signup-submit-btn">가입 완료</button>
            </form>
          </div>

          <div id="auth-tab-password" class="auth-panel-v2 auth-sub-panel" hidden>
            <div class="auth-sub-head"><b>비밀번호</b><button type="button" data-tab="login">닫기</button></div>
            <form id="reset-form" class="auth-form-v2 password-box">
              <p>가입한 이메일로 재설정 메일을 보냅니다.</p>
              <input type="email" id="reset-email" value="${escapeAttr(currentEmail)}" placeholder="가입한 이메일" autocomplete="email" required>
              <button type="submit" id="reset-submit-btn">재설정 메일 보내기</button>
            </form>
            <form id="change-form" class="auth-form-v2 password-box">
              <p>로그인 상태라면 비밀번호를 바로 변경할 수 있습니다.</p>
              <input type="password" id="current-password" placeholder="현재 비밀번호" autocomplete="current-password">
              <input type="password" id="new-password" placeholder="새 비밀번호 6자 이상" autocomplete="new-password" minlength="6">
              <input type="password" id="new-password2" placeholder="새 비밀번호 확인" autocomplete="new-password">
              <button type="submit" id="change-submit-btn">비밀번호 변경</button>
            </form>
          </div>
        </section>
      </section>
    </main>`;

  bindTabs(container);
  container.querySelector('#guest-btn').addEventListener('click', () => { location.hash = '#/'; });

  async function handleGoogleLogin() {
    if (inApp) { showToast('인앱 브라우저에서는 Google 로그인이 막힐 수 있습니다. 외부 브라우저로 열거나 이메일 로그인을 사용해주세요.', 'error'); return; }
    try {
      await loginWithGoogle();
      trackEvent('login', { method: 'google' });
      if (auth.currentUser?.uid) trackUser(auth.currentUser.uid);
      await ensureNicknameAndRedirect();
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      if (err.message?.includes('disallowed_useragent') || err.code === 'auth/operation-not-supported-in-this-environment') {
        showToast('이 브라우저에서는 Google 로그인이 차단됩니다. Chrome/Safari에서 열거나 이메일 로그인을 사용해주세요.', 'error'); return;
      }
      showToast(err.message || 'Google 로그인 실패', 'error');
    }
  }

  container.querySelector('#google-login-btn').addEventListener('click', handleGoogleLogin);
  container.querySelector('#google-signup-btn').addEventListener('click', handleGoogleLogin);

  container.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#login-submit-btn');
    btn.disabled = true; btn.textContent = '로그인 중...';
    try {
      await loginWithEmail(container.querySelector('#login-email').value.trim(), container.querySelector('#login-password').value);
      trackEvent('login', { method: 'email' });
      if (auth.currentUser?.uid) trackUser(auth.currentUser.uid);
      await redirectAfterLogin(true);
    } catch (err) {
      showToast(authErrorMsg(err.code) || '로그인 실패', 'error');
      btn.disabled = false; btn.textContent = '이메일로 로그인';
    }
  });

  let nickChecked = false;
  let nickCheckValue = '';
  container.querySelector('#signup-nickname').addEventListener('input', () => { nickChecked = false; nickCheckValue = ''; container.querySelector('#nick-status').textContent = ''; });
  container.querySelector('#check-nick-btn').addEventListener('click', async () => {
    const nick = container.querySelector('#signup-nickname').value.trim();
    const statusEl = container.querySelector('#nick-status');
    const result = validateNickname(nick);
    if (result) { statusEl.className = 'auth-status error'; statusEl.textContent = result; return; }
    statusEl.className = 'auth-status'; statusEl.textContent = '확인 중...';
    try {
      const snap = await getDoc(doc(db, 'nicknames', nick));
      if (snap.exists()) { statusEl.className = 'auth-status error'; statusEl.textContent = '이미 사용 중인 닉네임입니다'; nickChecked = false; }
      else { statusEl.className = 'auth-status ok'; statusEl.textContent = '사용 가능한 닉네임입니다 ✓'; nickChecked = true; nickCheckValue = nick; }
    } catch { statusEl.className = 'auth-status error'; statusEl.textContent = '확인 실패. 다시 시도해주세요'; }
  });

  container.querySelector('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#signup-email').value.trim();
    const pw = container.querySelector('#signup-password').value;
    const pw2 = container.querySelector('#signup-password2').value;
    const nick = container.querySelector('#signup-nickname').value.trim();
    const btn = container.querySelector('#signup-submit-btn');
    if (pw !== pw2) { showToast('비밀번호가 일치하지 않습니다', 'error'); return; }
    if (!nickChecked || nickCheckValue !== nick) { showToast('닉네임 확인을 먼저 해주세요', 'error'); return; }
    btn.disabled = true; btn.textContent = '가입 중...';
    try {
      await signupWithEmail(email, pw);
      const registerUser = httpsCallable(functions, 'registerUser');
      await registerUser({ nickname: nick });
      invalidateNicknameCache();
      trackEvent('sign_up', { method: 'email' });
      if (auth.currentUser?.uid) trackUser(auth.currentUser.uid);
      await redirectAfterLogin(true);
    } catch (err) {
      showToast(authErrorMsg(err.code) || err.message || '가입 실패', 'error');
      btn.disabled = false; btn.textContent = '가입 완료';
    }
  });

  container.querySelector('#reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#reset-submit-btn');
    const email = container.querySelector('#reset-email').value.trim();
    btn.disabled = true; btn.textContent = '전송 중...';
    try { await sendResetEmail(email); showToast('비밀번호 재설정 메일을 보냈습니다.', 'success'); btn.textContent = '메일 전송 완료'; }
    catch (err) { showToast(authErrorMsg(err.code) || '재설정 메일 전송 실패', 'error'); btn.disabled = false; btn.textContent = '재설정 메일 보내기'; }
  });

  container.querySelector('#change-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = container.querySelector('#current-password').value;
    const next = container.querySelector('#new-password').value;
    const next2 = container.querySelector('#new-password2').value;
    const btn = container.querySelector('#change-submit-btn');
    if (!auth.currentUser || auth.currentUser.isAnonymous) { showToast('로그인 후 비밀번호를 변경할 수 있습니다.', 'error'); return; }
    if (next !== next2) { showToast('새 비밀번호가 일치하지 않습니다.', 'error'); return; }
    if (next.length < 6) { showToast('새 비밀번호는 6자 이상이어야 합니다.', 'error'); return; }
    btn.disabled = true; btn.textContent = '변경 중...';
    try { await changeEmailPassword(current, next); showToast('비밀번호가 변경되었습니다.', 'success'); e.currentTarget.reset(); btn.disabled = false; btn.textContent = '비밀번호 변경'; }
    catch (err) { showToast(authErrorMsg(err.code) || err.message || '비밀번호 변경 실패', 'error'); btn.disabled = false; btn.textContent = '비밀번호 변경'; }
  });
}

function bindTabs(container) {
  container.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => selectTab(container, tab.dataset.tab)));
}
function selectTab(container, tabName) {
  ['login','signup','password'].forEach(name => { container.querySelector(`#auth-tab-${name}`).hidden = name !== tabName; });
  container.querySelector('.auth-simple-card')?.setAttribute('data-mode', tabName);
}

async function redirectAfterLogin(showSuccess = false) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  if (showSuccess) showToast('로그인 성공!', 'success');
  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) { location.href = '/admin/'; return; }
  } catch {}
  location.hash = '#/feed';
}

async function ensureNicknameAndRedirect() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) { showToast('관리자 로그인 성공', 'success'); location.href = '/admin/'; return; }
  } catch {}
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.data().nickname) { showToast('로그인 성공!', 'success'); location.hash = '#/feed'; return; }
  } catch {}
  showNicknameModal();
}

function showNicknameModal() {
  document.getElementById('nickname-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'nickname-modal';
  modal.innerHTML = `<div class="modal-backdrop"><div class="modal-box nickname-box"><img src="/logo.svg" alt="소소킹"><h3>닉네임을 설정해주세요</h3><p>소소피드에 표시될 이름입니다.</p><div class="nick-row"><input type="text" id="modal-nick-input" class="form-input" placeholder="닉네임 2~12자" maxlength="12"><button id="modal-nick-check">확인</button></div><div id="modal-nick-status" class="auth-status"></div><button id="modal-nick-save" class="modal-save-btn" disabled>저장하기</button><button id="modal-nick-skip" class="link-button">나중에 설정하기</button></div></div>`;
  document.body.appendChild(modal);
  let checked = false, checkedVal = '';
  modal.querySelector('#modal-nick-input').addEventListener('input', () => { checked = false; checkedVal = ''; modal.querySelector('#modal-nick-status').textContent = ''; modal.querySelector('#modal-nick-save').disabled = true; });
  modal.querySelector('#modal-nick-check').addEventListener('click', async () => {
    const nick = modal.querySelector('#modal-nick-input').value.trim();
    const statusEl = modal.querySelector('#modal-nick-status');
    const result = validateNickname(nick);
    if (result) { statusEl.className = 'auth-status error'; statusEl.textContent = result; return; }
    statusEl.className = 'auth-status'; statusEl.textContent = '확인 중...';
    try {
      const snap = await getDoc(doc(db, 'nicknames', nick));
      if (snap.exists()) { statusEl.className = 'auth-status error'; statusEl.textContent = '이미 사용 중인 닉네임입니다'; checked = false; }
      else { statusEl.className = 'auth-status ok'; statusEl.textContent = '사용 가능한 닉네임입니다 ✓'; checked = true; checkedVal = nick; modal.querySelector('#modal-nick-save').disabled = false; }
    } catch { statusEl.className = 'auth-status error'; statusEl.textContent = '확인 실패. 다시 시도해주세요'; }
  });
  modal.querySelector('#modal-nick-save').addEventListener('click', async () => {
    const nick = modal.querySelector('#modal-nick-input').value.trim();
    if (!checked || checkedVal !== nick) { showToast('닉네임 확인을 먼저 해주세요', 'error'); return; }
    const saveBtn = modal.querySelector('#modal-nick-save');
    saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
    try { const registerUser = httpsCallable(functions, 'registerUser'); await registerUser({ nickname: nick }); invalidateNicknameCache(); modal.remove(); showToast('환영합니다!', 'success'); location.hash = '#/feed'; }
    catch (err) { showToast(err.message || '저장 실패', 'error'); saveBtn.disabled = false; saveBtn.textContent = '저장하기'; }
  });
  modal.querySelector('#modal-nick-skip').addEventListener('click', () => { modal.remove(); showToast('로그인 성공! 닉네임은 나중에 설정할 수 있습니다.', 'info'); location.hash = '#/feed'; });
}

function validateNickname(nick) {
  if (!nick || nick.length < 2 || nick.length > 12) return '닉네임은 2~12자여야 합니다';
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nick)) return '한글, 영문, 숫자, _만 사용 가능합니다';
  return '';
}
function googleIcon() { return `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>`; }
function escapeAttr(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function authErrorMsg(code) {
  const map = { 'auth/user-not-found':'등록된 이메일이 없습니다', 'auth/wrong-password':'비밀번호가 틀렸습니다', 'auth/invalid-credential':'이메일 또는 비밀번호가 잘못되었습니다', 'auth/email-already-in-use':'이미 가입된 이메일입니다', 'auth/weak-password':'비밀번호는 6자 이상이어야 합니다', 'auth/invalid-email':'이메일 형식이 올바르지 않습니다', 'auth/too-many-requests':'잠시 후 다시 시도해주세요', 'auth/network-request-failed':'네트워크 오류가 발생했습니다', 'auth/requires-recent-login':'보안을 위해 다시 로그인한 뒤 변경해주세요' };
  return map[code] || null;
}

function injectAuthStyle() {
  if (document.getElementById('sosoking-auth-v2-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-auth-v2-style';
  style.textContent = `
    .simple-auth-page{min-height:100vh;padding:10px 12px 96px;background:radial-gradient(circle at 18% -4%,rgba(255,232,92,.30),transparent 26%),radial-gradient(circle at 88% 4%,rgba(124,92,255,.16),transparent 30%),linear-gradient(180deg,#fffaf5,#f6f8ff)!important}.auth-simple-shell{width:min(398px,100%);margin:0 auto;position:relative}.auth-back{position:absolute;left:0;top:0;z-index:2}.auth-simple-card{margin-top:12px;border:1px solid rgba(79,124,255,.13);border-radius:28px;padding:18px;background:rgba(255,255,255,.95);box-shadow:0 18px 54px rgba(55,90,170,.12);backdrop-filter:blur(18px)}.auth-simple-brand{text-align:center;margin-bottom:12px}.auth-simple-brand img{width:58px;height:58px;border-radius:20px;background:#fff;box-shadow:0 12px 28px rgba(79,124,255,.16);transform:rotate(-6deg)}.auth-simple-brand span{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:rgba(255,232,92,.56);color:#1b2250;border:1px solid rgba(255,184,0,.22);font-size:10px;font-weight:1000;letter-spacing:.13em}.auth-simple-brand h1{margin:7px 0 4px;font-size:28px;line-height:1.04;letter-spacing:-.08em;color:#080d35}.auth-simple-brand p{margin:0;color:#667085;font-size:12.5px;line-height:1.5;font-weight:800}.auth-panel-v2{display:grid;gap:8px}.google-btn-v2,.guest-btn-v2,.auth-form-v2>button,.modal-save-btn{width:100%;min-height:44px;border-radius:999px;font-family:inherit;font-weight:1000}.google-btn-v2{display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid rgba(79,124,255,.14);background:#fff;color:#172033;box-shadow:0 10px 22px rgba(55,90,170,.07)}.auth-form-v2{display:grid;gap:7px}.auth-form-v2 label{color:#667085;font-size:11px;font-weight:1000}.auth-form-v2 input{width:100%;min-height:42px;box-sizing:border-box;border:1px solid rgba(79,124,255,.14);border-radius:15px;padding:0 12px;background:#fff;color:#151a33;font-family:inherit;font-weight:800;box-shadow:0 7px 18px rgba(55,90,170,.04) inset}.auth-form-v2>button,.modal-save-btn{border:0;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff;box-shadow:0 12px 30px rgba(255,92,138,.20)}.guest-btn-v2{border:1px solid rgba(79,124,255,.14);background:#f3f6ff;color:#4f7cff;text-decoration:none;cursor:pointer}.auth-simple-links{display:flex;justify-content:center;gap:5px;color:#8a94a8;margin-top:1px}.auth-simple-links button,.auth-sub-head button,.link-button{border:0;background:transparent;color:#667085;font-family:inherit;font-size:12px;font-weight:1000;text-decoration:underline;cursor:pointer}.auth-simple-links button+button:before{content:'· ';text-decoration:none}.auth-sub-panel{margin-top:2px;padding-top:10px;border-top:1px solid rgba(79,124,255,.10)}.auth-sub-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.auth-sub-head b{font-size:18px;letter-spacing:-.05em;color:#10172f}.nick-row{display:grid;grid-template-columns:1fr 70px;gap:7px}.nick-row button{border:1px solid rgba(79,124,255,.16);border-radius:15px;background:rgba(79,124,255,.08);color:#4f7cff;font-weight:1000}.auth-status{min-height:15px;color:#667085;font-size:11px;font-weight:900}.auth-status.ok{color:#10b981}.auth-status.error{color:#ff5c8a}.password-box{padding:10px;border:1px solid rgba(79,124,255,.12);border-radius:20px;background:linear-gradient(135deg,rgba(255,255,255,.86),rgba(245,248,255,.78))}.password-box p{margin:0 0 4px;color:#667085;font-size:11.5px;line-height:1.5;font-weight:800}.auth-alert{padding:10px;border-radius:16px;background:rgba(255,92,122,.09);border:1px solid rgba(255,92,122,.22)}.auth-alert b{color:#ff5c8a;font-size:12px}.auth-alert p{margin:4px 0 0;color:#667085;font-size:11.5px;line-height:1.5}.modal-backdrop{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;padding:18px;background:rgba(3,8,20,.62);backdrop-filter:blur(8px)}.nickname-box{width:min(390px,100%);display:grid;gap:8px;padding:18px;border:1px solid rgba(79,124,255,.14);border-radius:26px;background:#fff;box-shadow:0 24px 78px rgba(0,0,0,.22);text-align:center}.nickname-box img{width:54px;height:54px;margin:0 auto;border-radius:19px;background:#fff;transform:rotate(-6deg)}.nickname-box h3{margin:4px 0 0}.nickname-box p{margin:0;color:#667085;font-size:12px;line-height:1.5}@media(max-width:520px){.simple-auth-page{padding-top:8px}.auth-simple-card{padding:16px;border-radius:26px}.auth-simple-brand img{width:54px;height:54px}.auth-simple-brand h1{font-size:26px}.nick-row{grid-template-columns:1fr 66px}}[data-theme="dark"] .simple-auth-page{background:radial-gradient(circle at 8% -6%,rgba(124,92,255,.16),transparent 30%),#070b13!important}[data-theme="dark"] .auth-simple-card,[data-theme="dark"] .password-box,[data-theme="dark"] .nickname-box{background:rgba(16,23,34,.90);box-shadow:none}[data-theme="dark"] .auth-simple-brand h1,[data-theme="dark"] .auth-sub-head b{color:#f5f7fb}[data-theme="dark"] .auth-simple-brand p,[data-theme="dark"] .password-box p{color:#a8b3c7}[data-theme="dark"] .auth-form-v2 input{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.12)}[data-theme="dark"] .google-btn-v2{background:rgba(255,255,255,.94);color:#172033}[data-theme="dark"] .guest-btn-v2{background:rgba(79,124,255,.12);color:#9db5ff}
  `;
  document.head.appendChild(style);
}