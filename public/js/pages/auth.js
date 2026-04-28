import { auth, loginWithPin, db, functions, trackEvent, trackUser } from '../firebase.js';
import { invalidateNicknameCache } from '../components/nav.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

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
  const inApp = detectInAppBrowser();
  const inAppBanner = inApp ? `
    <div style="margin-bottom:20px;padding:14px 16px;background:rgba(231,76,60,0.1);border:1.5px solid rgba(231,76,60,0.4);border-radius:12px;">
      <div style="font-size:13px;font-weight:700;color:#e74c3c;margin-bottom:6px;">⚠️ 인앱 브라우저 감지됨</div>
      <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;">
        카카오톡·인스타 등 앱 내 브라우저에서는 <strong style="color:var(--cream);">Google 로그인이 차단</strong>됩니다.<br>
        우측 상단 <strong style="color:var(--cream);">⋮ 메뉴 → 외부 브라우저로 열기</strong>를 눌러주세요.<br>
        또는 이메일로 가입·로그인하세요.
      </div>
    </div>` : '';

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">👑 소소킹</span>
      </div>
      <div class="container" style="padding-top:32px;padding-bottom:80px;max-width:420px;">

        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:48px;margin-bottom:8px;filter:drop-shadow(0 0 16px rgba(185,255,75,0.5));">🔐</div>
          <h2 style="font-family:var(--font-serif);font-size:22px;font-weight:700;color:var(--text);margin-bottom:6px;">닉네임 + PIN으로 시작</h2>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.6;">이메일 없이 닉네임과 4자리 PIN만으로<br>어디서든 내 기록에 접근하세요</p>
        </div>
        ${inAppBanner}
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">로그인</button>
          <button class="auth-tab" data-tab="signup">회원가입</button>
        </div>

        <!-- 로그인 패널 -->
        <div id="auth-tab-login" class="auth-panel">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">닉네임</label>
            <input type="text" class="form-input" id="login-nick" placeholder="닉네임 입력" maxlength="12" autocomplete="username">
          </div>
          <div class="form-group" style="margin-bottom:8px;">
            <label class="form-label">PIN 4자리</label>
            <div class="pin-display" id="login-pin-display">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div class="pin-pad" id="login-pin-pad"></div>
          <div id="login-msg" style="text-align:center;font-size:13px;min-height:18px;margin-bottom:12px;"></div>
          <button id="login-btn" class="btn btn-primary" disabled>로그인</button>
        </div>

        <!-- 회원가입 패널 -->
        <div id="auth-tab-signup" class="auth-panel" style="display:none;">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">닉네임</label>
            <div style="display:flex;gap:8px;">
              <input type="text" class="form-input" id="signup-nick" placeholder="2~12자 (한글·영문·숫자·_)" maxlength="12" style="flex:1;" autocomplete="username">
              <button type="button" id="check-nick-btn" class="nick-check-btn">중복확인</button>
            </div>
            <div id="nick-status" style="font-size:12px;margin-top:6px;min-height:16px;"></div>
          </div>
          <div class="form-group" style="margin-bottom:8px;">
            <label class="form-label">PIN 4자리 설정</label>
            <div class="pin-display" id="signup-pin-display">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div class="pin-pad" id="signup-pin-pad"></div>
          <div id="signup-msg" style="text-align:center;font-size:13px;min-height:18px;margin-bottom:12px;"></div>
          <button id="signup-btn" class="btn btn-primary" disabled>회원가입</button>
        </div>

        <div style="text-align:center;margin-top:20px;">
          <button id="guest-btn" style="background:none;border:none;color:var(--text-dim);font-size:13px;cursor:pointer;text-decoration:underline;padding:8px;">
            그냥 익명으로 계속하기
          </button>
        </div>
      </div>
    </div>
  `;

  // 탭 전환
  container.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      container.querySelector('#auth-tab-login').style.display = tab.dataset.tab === 'login' ? '' : 'none';
      container.querySelector('#auth-tab-signup').style.display = tab.dataset.tab === 'signup' ? '' : 'none';
    });
  });

  // 게스트 계속
  container.querySelector('#guest-btn').addEventListener('click', () => {
    history.back();
    if (location.hash === '#/login') location.hash = '#/';
  });

  // PIN 패드 세팅
  setupPinPad('login',  container);
  setupPinPad('signup', container);

  // 닉네임 중복확인
  let nickChecked = false;
  let nickCheckedVal = '';
  container.querySelector('#signup-nick').addEventListener('input', () => {
    nickChecked = false; nickCheckedVal = '';
    container.querySelector('#nick-status').textContent = '';
    updateSignupBtn(container, nickChecked);
  });
  container.querySelector('#check-nick-btn').addEventListener('click', async () => {
    const nick = container.querySelector('#signup-nick').value.trim();
    const statusEl = container.querySelector('#nick-status');
    if (!nick || nick.length < 2 || nick.length > 12) {
      statusEl.style.color = 'var(--red)'; statusEl.textContent = '닉네임은 2~12자여야 합니다'; return;
    }
    if (!/^[가-힣a-zA-Z0-9_]+$/.test(nick)) {
      statusEl.style.color = 'var(--red)'; statusEl.textContent = '한글·영문·숫자·_만 사용 가능합니다'; return;
    }
    statusEl.style.color = 'var(--text-dim)'; statusEl.textContent = '확인 중...';
    try {
      const snap = await getDoc(doc(db, 'nicknames', nick));
      if (snap.exists()) {
        statusEl.style.color = 'var(--red)'; statusEl.textContent = '이미 사용 중인 닉네임입니다 ✗';
        nickChecked = false;
      } else {
        statusEl.style.color = 'var(--green)'; statusEl.textContent = '사용 가능합니다 ✓';
        nickChecked = true; nickCheckedVal = nick;
        updateSignupBtn(container, nickChecked);
      }
    } catch {
      statusEl.style.color = 'var(--red)'; statusEl.textContent = '확인 실패. 다시 시도해주세요';
    }
  });

  // 로그인 버튼
  container.querySelector('#login-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#login-btn');
    const nick = container.querySelector('#login-nick').value.trim();
    const pin  = container.querySelector('#login-pin-pad').dataset.pin || '';
    const msgEl = container.querySelector('#login-msg');
    if (!nick) { msgEl.style.color = 'var(--red)'; msgEl.textContent = '닉네임을 입력해주세요'; return; }
    if (pin.length !== 4) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'PIN 4자리를 입력해주세요'; return; }
    btn.disabled = true; btn.textContent = '로그인 중...'; msgEl.textContent = '';
    try {
      const loginNickname = httpsCallable(functions, 'loginNickname');
      const res = await loginNickname({ nickname: nick, pin });
      await loginWithPin(res.data.customToken);
      invalidateNicknameCache();
      trackEvent('login', { method: 'pin' });
      if (auth.currentUser?.uid) trackUser(auth.currentUser.uid);
      showToast(`${res.data.nickname}님 환영합니다! 👑`, 'success');
      location.hash = '#/my-history';
    } catch (err) {
      msgEl.style.color = 'var(--red)'; msgEl.textContent = err.message || '로그인 실패';
      btn.disabled = false; btn.textContent = '로그인';
      shakePinDisplay('login', container);
      clearPin('login', container);
    }
  });

  // 회원가입 버튼
  container.querySelector('#signup-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#signup-btn');
    const nick = container.querySelector('#signup-nick').value.trim();
    const pin  = container.querySelector('#signup-pin-pad').dataset.pin || '';
    const msgEl = container.querySelector('#signup-msg');
    if (!nickChecked || nickCheckedVal !== nick) {
      msgEl.style.color = 'var(--red)'; msgEl.textContent = '닉네임 중복확인을 먼저 해주세요'; return;
    }
    if (pin.length !== 4) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'PIN 4자리를 입력해주세요'; return; }
    btn.disabled = true; btn.textContent = '가입 중...'; msgEl.textContent = '';
    try {
      const registerNickname = httpsCallable(functions, 'registerNickname');
      await registerNickname({ nickname: nick, pin });
      invalidateNicknameCache();
      trackEvent('sign_up', { method: 'pin' });
      if (auth.currentUser?.uid) trackUser(auth.currentUser.uid);
      showToast(`${nick}님, 가입 완료! 👑`, 'success');
      location.hash = '#/my-history';
    } catch (err) {
      msgEl.style.color = 'var(--red)'; msgEl.textContent = err.message || '가입 실패';
      btn.disabled = false; btn.textContent = '회원가입';
    }
  });
}

function setupPinPad(mode, container) {
  const padEl = container.querySelector(`#${mode}-pin-pad`);
  if (!padEl) return;
  padEl.dataset.pin = '';

  const nums = [1,2,3,4,5,6,7,8,9,'',0,'⌫'];
  padEl.innerHTML = `<div class="pin-pad-grid">
    ${nums.map(n => `<button class="pin-key${n === '' ? ' pin-key-empty' : ''}" data-val="${n}">${n}</button>`).join('')}
  </div>`;

  padEl.addEventListener('click', (e) => {
    const key = e.target.closest('.pin-key');
    if (!key || key.classList.contains('pin-key-empty')) return;
    const val = key.dataset.val;
    let pin = padEl.dataset.pin || '';
    if (val === '⌫') {
      pin = pin.slice(0, -1);
    } else if (pin.length < 4) {
      pin += val;
    }
    padEl.dataset.pin = pin;
    updatePinDisplay(mode, container, pin);
    if (mode === 'login') updateLoginBtn(container);
    else updateSignupBtn(container, null);
  });

  // 닉네임 입력에서도 업데이트
  if (mode === 'login') {
    container.querySelector('#login-nick')?.addEventListener('input', () => updateLoginBtn(container));
  }
}

function updatePinDisplay(mode, container, pin) {
  const dots = container.querySelectorAll(`#${mode}-pin-display span`);
  dots.forEach((dot, i) => {
    dot.className = i < pin.length ? 'filled' : '';
  });
}

function updateLoginBtn(container) {
  const btn = container.querySelector('#login-btn');
  if (!btn) return;
  const nick = container.querySelector('#login-nick')?.value.trim();
  const pin  = container.querySelector('#login-pin-pad')?.dataset.pin || '';
  btn.disabled = !nick || pin.length !== 4;
}

function updateSignupBtn(container, nickOk) {
  const btn = container.querySelector('#signup-btn');
  if (!btn) return;
  const pin = container.querySelector('#signup-pin-pad')?.dataset.pin || '';
  const checked = nickOk !== null ? nickOk : (container.querySelector('#nick-status')?.textContent.includes('✓'));
  btn.disabled = !checked || pin.length !== 4;
}

function shakePinDisplay(mode, container) {
  const el = container.querySelector(`#${mode}-pin-display`);
  if (!el) return;
  el.style.animation = 'pinShake 0.4s ease';
  setTimeout(() => { el.style.animation = ''; }, 400);
}

function clearPin(mode, container) {
  const padEl = container.querySelector(`#${mode}-pin-pad`);
  if (padEl) { padEl.dataset.pin = ''; updatePinDisplay(mode, container, ''); }
}
