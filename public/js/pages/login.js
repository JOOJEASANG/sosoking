import { auth, db, googleProvider, signInWithPopup, signInWithRedirect } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const KAKAO_JS_APP_KEY = '377995fee0850a5de4167641d343be0e';
const KAKAO_REDIRECT_URI = 'https://sosoking.co.kr';

async function isAdmin(user = auth.currentUser) {
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult?.(true);
    if (token?.claims?.admin || token?.claims?.owner) return true;
  } catch {}
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function goAfterLogin(user = auth.currentUser) {
  if (await isAdmin(user)) return navigate('/admin');
  const query = (location.hash.slice(1).split('?')[1] || '');
  const returnTo = new URLSearchParams(query).get('return');
  if (returnTo && !['/login', '/signup'].includes(returnTo)) return navigate(returnTo);
  navigate('/');
}

export function triggerKakaoLogin(page = 'login') {
  const button = document.getElementById('btn-kakao');
  if (button) {
    button.disabled = true;
    button.textContent = '카카오로 이동 중...';
  }
  sessionStorage.setItem('kakao_return_to', '/');
  sessionStorage.setItem('kakao_page', page);
  try {
    const Kakao = window.Kakao;
    if (Kakao) {
      if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_APP_KEY);
      if (typeof Kakao.Auth?.authorize === 'function') {
        Kakao.Auth.authorize({ redirectUri: KAKAO_REDIRECT_URI, scope: 'profile_nickname' });
        return;
      }
    }
    const params = new URLSearchParams({
      client_id: KAKAO_JS_APP_KEY,
      redirect_uri: KAKAO_REDIRECT_URI,
      response_type: 'code',
      scope: 'profile_nickname',
    });
    location.href = `https://kauth.kakao.com/oauth/authorize?${params}`;
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = '💛 카카오로 로그인';
    }
    toast.error(error.message || '카카오 로그인에 실패했습니다.');
  }
}

export function renderLogin() {
  const root = document.getElementById('page-content');
  if (!root) return;
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    root.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
    goAfterLogin(auth.currentUser);
    return;
  }

  root.innerHTML = `
    <div class="auth-page"><div class="auth-card card"><div class="card__body--lg">
      <div class="auth-logo">
        <img src="/logo.svg" alt="소소킹" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:16px">
        <div class="auth-logo__mark">소소킹</div>
        <div class="auth-logo__sub">AI 캐릭터 참여형 커뮤니티</div>
      </div>
      <button type="button" class="social-btn" id="btn-google"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20">Google로 로그인</button>
      <button type="button" class="social-btn social-btn--kakao" id="btn-kakao">💛 카카오로 로그인</button>
      <div class="auth-divider">또는 이메일로 로그인</div>
      <div class="form-group"><label class="form-label" for="f-email">이메일</label><input id="f-email" class="form-input" type="email" autocomplete="email"></div>
      <div class="form-group"><label class="form-label" for="f-password">비밀번호</label><input id="f-password" class="form-input" type="password" autocomplete="current-password"></div>
      <button type="button" class="btn btn--primary btn--full" id="btn-email-login">로그인</button>
      <button type="button" class="btn btn--ghost btn--full" id="btn-reset-password" style="margin-top:8px">비밀번호 재설정</button>
      <div class="auth-switch" style="text-align:center;margin-top:20px">계정이 없으신가요? <button type="button" class="btn btn--ghost btn--sm" id="btn-go-signup">회원가입</button></div>
      <p style="text-align:center;font-size:11px;color:var(--color-text-muted);margin-top:12px">로그인 시 <a href="#/legal/terms">이용약관</a> 및 <a href="#/legal/privacy">개인정보처리방침</a>에 동의합니다.</p>
    </div></div></div>`;

  root.querySelector('#btn-go-signup')?.addEventListener('click', () => navigate('/signup'));
  root.querySelector('#btn-kakao')?.addEventListener('click', () => triggerKakaoLogin('login'));
  root.querySelector('#btn-google')?.addEventListener('click', async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await goAfterLogin(credential.user);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/popup-blocked') return signInWithRedirect(auth, googleProvider);
      toast.error('Google 로그인에 실패했습니다.');
    }
  });

  const emailLogin = async () => {
    const email = root.querySelector('#f-email')?.value.trim();
    const password = root.querySelector('#f-password')?.value || '';
    if (!email || !password) return toast.warn('이메일과 비밀번호를 입력해주세요.');
    const button = root.querySelector('#btn-email-login');
    button.disabled = true;
    try {
      const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await goAfterLogin(credential.user);
    } catch {
      toast.error('이메일 또는 비밀번호를 확인해주세요.');
    } finally {
      button.disabled = false;
    }
  };
  root.querySelector('#btn-email-login')?.addEventListener('click', emailLogin);
  root.querySelector('#f-password')?.addEventListener('keydown', event => { if (event.key === 'Enter') emailLogin(); });
  root.querySelector('#btn-reset-password')?.addEventListener('click', async () => {
    const email = root.querySelector('#f-email')?.value.trim();
    if (!email) return toast.warn('이메일을 먼저 입력해주세요.');
    try {
      const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sendPasswordResetEmail(auth, email);
      toast.success('비밀번호 재설정 이메일을 보냈습니다.');
    } catch {
      toast.error('이메일 전송에 실패했습니다.');
    }
  });
}
