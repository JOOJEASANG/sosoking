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
  const inAppBanner = inApp ? `<div class="auth-alert"><b>인앱 브라우저 감지</b><p>카카오톡·인스타 앱 안에서는 Google 로그인이 차단될 수 있습니다. 외부 브라우저로 열거나 이메일 로그인을 사용해주세요.</p></div>` : '';

  container.innerHTML = `
    <main class="predict-app auth-page-v2">
      <section class="auth-shell">
        <a href="#/" class="back-link auth-back">‹</a>
        <div class="auth-hero-card">
          <img src="/logo.svg" alt="소소킹">
          <span>SOSOKING ACCOUNT</span>
          <h1>소소킹 계정으로<br>계속하기</h1>
          <p>예측 기록, 소소머니, 소소피드 활동을 계정에 안전하게 연결합니다.</p>
          <div class="auth-mini-tags"><b>구글 계정 선택</b><b>관리자 자동 이동</b><b>비밀번호 변경</b></div>
        </div>
        <section class="auth-card-v2">
          ${inAppBanner}
          <div class="auth-tabs-v2">
            <button class="active" data-tab="login">로그인</button>
            <button data-tab="signup">회원가입</button>
            <button data-tab="password">비밀번호</button>
          </div>

          <div id="auth-tab-login" class="auth-panel-v2">
            <button id="google-login-btn" class="google-btn-v2">${googleIcon()}<span>Google로 계속하기</span></button>
            <div class="auth-divider-v2"><span>또는 이메일로 로그인</span></div>
            <form id="login-form" class="auth-form-v2">
              <label>이메일</label><input type="email" id="login-email" placeholder="이메일" autocomplete="email" required>
              <label>비밀번호</label><input type="password" id="login-password" placeholder="비밀번호" autocomplete="current-password" required>
              <button type="submit" id="login-submit-btn">로그인</button>
            </form>
            <button class="link-button" id="open-reset-btn" type="button">비밀번호를 잊으셨나요?</button>
          </div>

          <div id="auth-tab-signup" class="auth-panel-v2" hidden>
            <button id="google-signup-btn" class="google-btn-v2">${googleIcon()}<span>Google로 가입하기</span></button>
            <div class="auth-divider-v2"><span>또는 이메일로 가입</span></div>
            <form id="signup-form" class="auth-form-v2">
              <label>이메일</label><input type="email" id="signup-email" placeholder="이메일" autocomplete="email" required>
              <label>비밀번호</label><input type="password" id="signup-password" placeholder="비밀번호 6자 이상" autocomplete="new-password" required minlength="6">
              <label>비밀번호 확인</label><input type="password" id="signup-password2" placeholder="비밀번호 확인" autocomplete="new-password" required>
              <label>닉네임</label><div class="nick-row"><input type="text" id="signup-nickname" placeholder="닉네임 2~12자" maxlength="12" required><button type="button" id="check-nick-btn">중복확인</button></div>
              <div id="nick-status" class="auth-status"></div>
              <button type="submit" id="signup-submit-btn">회원가입</button>
            </form>
          </div>

          <div id="auth-tab-password" class="auth-panel-v2" hidden>
            <form id="reset-form" class="auth-form-v2 password-box">
              <b>비밀번호 재설정 메일 받기</b>
              <p>로그인할 수 없는 경우 가입한 이메일로 재설정 메일을 보냅니다.</p>
              <label>이메일</label><input type="email" id="reset-email" value="${escapeAttr(currentEmail)}" placeholder="가입한 이메일" autocomplete="email" required>
              <button type="submit" id="reset-submit-btn">재설정 메일 보내기</button>
            </form>
            <form id="change-form" class="auth-form-v2 password-box">
              <b>로그인 상태에서 비밀번호 변경</b>
              <p>이메일/비밀번호 계정은 현재 비밀번호 확인 후 새 비밀번호로 변경할 수 있습니다.</p>
              <label>현재 비밀번호</label><input type="password" id="current-password" placeholder="현재 비밀번호" autocomplete="current-password">
              <label>새 비밀번호</label><input type="password" id="new-password" placeholder="새 비밀번호 6자 이상" autocomplete="new-password" minlength="6">
              <label>새 비밀번호 확인</label><input type="password" id="new-password2" placeholder="새 비밀번호 확인" autocomplete="new-password">
              <button type="submit" id="change-submit-btn">비밀번호 변경</button>
            </form>
          </div>

          <button id="guest-btn" class="guest-btn-v2" type="button">게스트로 계속 이용하기</button>
        </section>
      </section>
    </main>`;

  bindTabs(container);
  container.querySelector('#guest-btn').addEventListener('click', () => { location.hash = '#/'; });
  container.querySelector('#open-reset-btn').addEventListener('click', () => selectTab(container, 'password'));

  async function handleGoogleLogin() {
    if (inApp) { showToast('인앱 브라우저에서는 Google 로그인을 사용할 수 없습니다. 외부 브라우저로 열거나 이메일 로그인을 사용해주세요.', 'error'); return; }
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
      btn.disabled = false; btn.textContent = '로그인';
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
    if (!nickChecked || nickCheckValue !== nick) { showToast('닉네임 중복확인을 먼저 해주세요', 'error'); return; }
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
      btn.disabled = false; btn.textContent = '회원가입';
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
  container.querySelectorAll('.auth-tabs-v2 button').forEach(tab => tab.addEventListener('click', () => selectTab(container, tab.dataset.tab)));
}
function selectTab(container, tabName) {
  container.querySelectorAll('.auth-tabs-v2 button').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  ['login','signup','password'].forEach(name => { container.querySelector(`#auth-tab-${name}`).hidden = name !== tabName; });
}

async function redirectAfterLogin(showSuccess = false) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  if (showSuccess) showToast('로그인 성공!', 'success');
  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) { location.href = '/admin/'; return; }
  } catch {}
  location.hash = '#/history';
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
    if (snap.exists() && snap.data().nickname) { showToast('로그인 성공!', 'success'); location.hash = '#/history'; return; }
  } catch {}
  showNicknameModal();
}

function showNicknameModal() {
  document.getElementById('nickname-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'nickname-modal';
  modal.innerHTML = `<div class="modal-backdrop"><div class="modal-box nickname-box"><img src="/logo.svg" alt="소소킹"><h3>닉네임을 설정해주세요</h3><p>예측 근거와 소소피드에 표시될 이름입니다.</p><div class="nick-row"><input type="text" id="modal-nick-input" class="form-input" placeholder="닉네임 2~12자" maxlength="12"><button id="modal-nick-check">중복확인</button></div><div id="modal-nick-status" class="auth-status"></div><button id="modal-nick-save" class="modal-save-btn" disabled>저장하기</button><button id="modal-nick-skip" class="link-button">나중에 설정하기</button></div></div>`;
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
    if (!checked || checkedVal !== nick) { showToast('닉네임 중복확인을 먼저 해주세요', 'error'); return; }
    const saveBtn = modal.querySelector('#modal-nick-save');
    saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
    try { const registerUser = httpsCallable(functions, 'registerUser'); await registerUser({ nickname: nick }); invalidateNicknameCache(); modal.remove(); showToast('환영합니다!', 'success'); location.hash = '#/history'; }
    catch (err) { showToast(err.message || '저장 실패', 'error'); saveBtn.disabled = false; saveBtn.textContent = '저장하기'; }
  });
  modal.querySelector('#modal-nick-skip').addEventListener('click', () => { modal.remove(); showToast('로그인 성공! 닉네임은 나중에 설정할 수 있습니다.', 'info'); location.hash = '#/history'; });
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
    .auth-page-v2{padding:18px clamp(16px,4vw,34px) 112px;background:radial-gradient(circle at 16% 0%,rgba(79,124,255,.18),transparent 30%),radial-gradient(circle at 92% 6%,rgba(255,92,138,.12),transparent 28%),var(--predict-bg)}.auth-shell{max-width:980px;margin:0 auto;display:grid;grid-template-columns:44px 1fr 430px;gap:14px;align-items:start}.auth-back{margin-top:6px}.auth-hero-card,.auth-card-v2{border:1px solid rgba(79,124,255,.14);border-radius:32px;background:rgba(255,255,255,.86);box-shadow:0 22px 70px rgba(55,90,170,.13);backdrop-filter:blur(14px)}.auth-hero-card{position:relative;overflow:hidden;min-height:560px;padding:30px;background:linear-gradient(135deg,#101b3c,#4f7cff 60%,#7c5cff);color:#fff}.auth-hero-card:after{content:'🔐';position:absolute;right:24px;bottom:-34px;font-size:132px;opacity:.13}.auth-hero-card img{width:68px;height:68px;border-radius:24px;background:#fff;box-shadow:0 16px 40px rgba(0,0,0,.18);transform:rotate(-7deg)}.auth-hero-card span{display:block;margin-top:24px;color:rgba(255,255,255,.72);font-size:11px;font-weight:1000;letter-spacing:.16em}.auth-hero-card h1{margin:8px 0 12px;font-size:clamp(36px,6vw,58px);line-height:1;letter-spacing:-.08em}.auth-hero-card p{max-width:440px;color:rgba(255,255,255,.78);line-height:1.75}.auth-mini-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.auth-mini-tags b{display:inline-flex;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12px}.auth-card-v2{padding:20px}.auth-tabs-v2{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:16px;padding:5px;border-radius:18px;background:rgba(79,124,255,.06)}.auth-tabs-v2 button{border:0;border-radius:14px;padding:10px 8px;background:transparent;color:var(--predict-muted);font-weight:1000}.auth-tabs-v2 button.active{background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;box-shadow:0 10px 24px rgba(79,124,255,.22)}.auth-panel-v2{display:grid;gap:12px}.google-btn-v2{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid rgba(79,124,255,.14);border-radius:18px;padding:14px;background:#fff;color:#172033;font-weight:1000;box-shadow:0 12px 28px rgba(55,90,170,.09)}.auth-divider-v2{display:flex;align-items:center;gap:10px;color:var(--predict-muted);font-size:12px;font-weight:900}.auth-divider-v2:before,.auth-divider-v2:after{content:'';height:1px;flex:1;background:rgba(79,124,255,.13)}.auth-form-v2{display:grid;gap:8px}.auth-form-v2 label{color:var(--predict-muted);font-size:12px;font-weight:1000}.auth-form-v2 input{width:100%;border:1px solid rgba(79,124,255,.14);border-radius:16px;padding:13px;background:var(--predict-bg);color:var(--predict-ink);font-family:inherit}.auth-form-v2>button,.modal-save-btn{border:0;border-radius:18px;padding:14px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000;box-shadow:0 12px 30px rgba(79,124,255,.22)}.nick-row{display:grid;grid-template-columns:1fr 92px;gap:8px}.nick-row button{border:1px solid rgba(79,124,255,.16);border-radius:16px;background:rgba(79,124,255,.08);color:var(--predict-main);font-weight:1000}.auth-status{min-height:18px;color:var(--predict-muted);font-size:12px;font-weight:900}.auth-status.ok{color:var(--predict-money)}.auth-status.error{color:var(--predict-hot)}.link-button,.guest-btn-v2{border:0;background:transparent;color:var(--predict-muted);font-size:13px;font-weight:900;text-decoration:underline;cursor:pointer}.guest-btn-v2{margin-top:4px}.password-box{padding:14px;border:1px solid rgba(79,124,255,.12);border-radius:22px;background:rgba(79,124,255,.04)}.password-box b{font-size:15px}.password-box p{margin:0 0 5px;color:var(--predict-muted);font-size:12px;line-height:1.6}.auth-alert{padding:13px;border-radius:18px;background:rgba(255,92,122,.09);border:1px solid rgba(255,92,122,.22)}.auth-alert b{color:var(--predict-hot);font-size:13px}.auth-alert p{margin:5px 0 0;color:var(--predict-muted);font-size:12px;line-height:1.6}.modal-backdrop{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;padding:18px;background:rgba(3,8,20,.62);backdrop-filter:blur(8px)}.nickname-box{width:min(420px,100%);display:grid;gap:10px;padding:22px;border:1px solid rgba(79,124,255,.14);border-radius:28px;background:var(--predict-card);box-shadow:0 28px 90px rgba(0,0,0,.24);text-align:center}.nickname-box img{width:62px;height:62px;margin:0 auto;border-radius:22px;background:#fff;transform:rotate(-6deg)}.nickname-box h3{margin:6px 0 0}.nickname-box p{margin:0;color:var(--predict-muted);font-size:13px;line-height:1.6}@media(max-width:920px){.auth-shell{grid-template-columns:1fr}.auth-back{width:42px}.auth-hero-card{min-height:auto}.auth-card-v2{padding:18px}}@media(max-width:520px){.auth-hero-card{padding:24px;border-radius:28px}.auth-card-v2{border-radius:28px}.nick-row{grid-template-columns:1fr}.auth-tabs-v2 button{font-size:12px}}[data-theme="dark"] .auth-hero-card{background:linear-gradient(135deg,#0f1726,#1f3b7a 58%,#533aa2)}[data-theme="dark"] .auth-card-v2,[data-theme="dark"] .password-box,[data-theme="dark"] .nickname-box{background:rgba(16,23,34,.90);box-shadow:none}[data-theme="dark"] .google-btn-v2{background:rgba(255,255,255,.94);color:#172033}
  `;
  document.head.appendChild(style);
}
