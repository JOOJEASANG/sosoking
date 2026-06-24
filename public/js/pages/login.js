import { auth, db, googleProvider, signInWithPopup, signInWithRedirect } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const KAKAO_JS_APP_KEY = '377995fee0850a5de4167641d343be0e';
const KAKAO_REDIRECT_URI = 'https://sosoking.co.kr/';
const KAKAO_STATE_KEY = 'kakao_oauth_state';
const KAKAO_RETURN_KEY = 'kakao_return_to';
const KAKAO_PAGE_KEY = 'kakao_page';

function createOAuthState() {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function safeReturnPath(value) {
  const path = String(value || '').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  if (path === '/login' || path === '/signup') return '/';
  return path;
}

async function isSignedInUserAdmin(user = auth.currentUser) {
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult?.(true);
    if (token?.claims?.admin || token?.claims?.owner) return true;
  } catch {}
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch { return false; }
}

export async function goAfterLogin(user = auth.currentUser) {
  if (await isSignedInUserAdmin(user)) { navigate('/admin'); return; }
  const params = Object.fromEntries(new URLSearchParams(window.location.hash.slice(1).split('?')[1] || ''));
  navigate(safeReturnPath(params.return));
}

export function triggerKakaoLogin(page = 'login') {
  const btn = document.getElementById('btn-kakao');
  if (btn) { btn.disabled = true; btn.textContent = '카카오로 이동 중...'; }

  const returnTo = safeReturnPath(window.location.hash.slice(1).split('?')[0] || '/');
  const state = createOAuthState();
  sessionStorage.setItem(KAKAO_STATE_KEY, state);
  sessionStorage.setItem(KAKAO_RETURN_KEY, returnTo);
  sessionStorage.setItem(KAKAO_PAGE_KEY, page);

  try {
    const K = window.Kakao;
    if (K) {
      if (!K.isInitialized()) K.init(KAKAO_JS_APP_KEY);
      if (typeof K.Auth?.authorize === 'function') {
        K.Auth.authorize({
          redirectUri: KAKAO_REDIRECT_URI,
          scope: 'profile_nickname',
          state,
        });
        return;
      }
    }
    const params = new URLSearchParams({
      client_id: KAKAO_JS_APP_KEY,
      redirect_uri: KAKAO_REDIRECT_URI,
      response_type: 'code',
      scope: 'profile_nickname',
      state,
    });
    window.location.href = `https://kauth.kakao.com/oauth/authorize?${params}`;
  } catch (error) {
    sessionStorage.removeItem(KAKAO_STATE_KEY);
    sessionStorage.removeItem(KAKAO_RETURN_KEY);
    sessionStorage.removeItem(KAKAO_PAGE_KEY);
    if (btn) { btn.disabled = false; btn.textContent = '💛 카카오로 로그인'; }
    toast.error('카카오 로그인 오류: ' + (error.message || String(error)));
  }
}

export function renderLogin() {
  const element = document.getElementById('page-content');
  if (auth.currentUser) {
    element.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
    goAfterLogin(auth.currentUser);
    return;
  }

  window.__kakaoLogin = () => triggerKakaoLogin('login');

  element.innerHTML = `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="card__body--lg">
          <div class="auth-logo">
            <img src="/logo.svg" alt="소소킹" width="56" height="56"
              style="display:block;margin:0 auto 12px;border-radius:16px;box-shadow:0 10px 28px rgba(255,107,74,.18)">
            <div class="auth-logo__mark">소소킹</div>
            <div class="auth-logo__sub">글과 사진으로 즐기는 게임형 커뮤니티</div>
          </div>

          <button type="button" class="social-btn" id="btn-google">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20">
            Google로 로그인
          </button>
          <button type="button" class="social-btn social-btn--kakao" id="btn-kakao" onclick="window.__kakaoLogin()">
            💛 카카오로 로그인
          </button>

          <div class="auth-divider">또는 이메일로 로그인</div>

          <div class="form-group">
            <label class="form-label">이메일</label>
            <input id="f-email" class="form-input" type="email" placeholder="이메일 주소" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호</label>
            <input id="f-password" class="form-input" type="password" placeholder="비밀번호" autocomplete="current-password">
          </div>

          <button type="button" class="btn btn--primary btn--full" id="btn-email-login">로그인</button>
          <button type="button" class="btn btn--ghost btn--full" id="btn-reset-password"
            style="margin-top:8px;font-size:13px;color:var(--color-text-muted)">비밀번호 재설정</button>

          <div class="auth-switch" style="text-align:center;margin-top:20px;font-size:14px;color:var(--color-text-secondary)">
            계정이 없으신가요?
            <button type="button" class="btn btn--ghost btn--sm" id="btn-go-signup"
              style="font-weight:700;color:var(--color-primary);margin-left:4px">회원가입</button>
          </div>

          <p style="text-align:center;font-size:11px;color:var(--color-text-muted);margin-top:12px">
            로그인 시 <a href="#/legal/terms" style="color:var(--color-primary)">이용약관</a> 및
            <a href="#/legal/privacy" style="color:var(--color-primary)">개인정보처리방침</a>에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-go-signup')?.addEventListener('click', () => navigate('/signup'));

  document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      toast.success('로그인됐어요!');
      await goAfterLogin(credential.user);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/popup-blocked') {
        try { await signInWithRedirect(auth, googleProvider); } catch { toast.error('로그인에 실패했어요'); }
      } else {
        toast.error('Google 로그인에 실패했어요');
      }
    }
  });

  document.getElementById('btn-email-login')?.addEventListener('click', async () => {
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const email = document.getElementById('f-email')?.value.trim();
    const password = document.getElementById('f-password')?.value;
    if (!email || !password) { toast.warn('이메일과 비밀번호를 입력해주세요'); return; }
    const btn = document.getElementById('btn-email-login');
    btn.disabled = true;
    btn.textContent = '로그인 중...';
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      toast.success('로그인됐어요!');
      await goAfterLogin(credential.user);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('이메일 또는 비밀번호가 올바르지 않아요');
      } else {
        toast.error('로그인에 실패했어요 (' + (error.code || error.message) + ')');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  });

  document.getElementById('f-password')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') document.getElementById('btn-email-login')?.click();
  });

  document.getElementById('btn-reset-password')?.addEventListener('click', async () => {
    const email = document.getElementById('f-email')?.value.trim();
    if (!email) { toast.warn('이메일을 먼저 입력해주세요'); return; }
    try {
      const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sendPasswordResetEmail(auth, email);
      toast.success('비밀번호 재설정 이메일을 보냈어요 📧');
    } catch (error) {
      if (error.code === 'auth/user-not-found') toast.error('등록되지 않은 이메일이에요');
      else toast.error('이메일 전송에 실패했어요');
    }
  });
}
