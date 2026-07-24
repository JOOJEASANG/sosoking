import { auth, googleProvider, signInWithPopup, signInWithRedirect } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { goAfterLogin, triggerKakaoLogin } from './login.js';
import { setMeta } from '../utils/seo.js';
import { ensureUserProvisioned } from '../services/user-service.js';

export function renderSignup() {
  setMeta('회원가입');
  const root = document.getElementById('page-content');
  if (!root) return;
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    root.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
    ensureUserProvisioned(auth.currentUser).finally(() => goAfterLogin(auth.currentUser));
    return;
  }

  root.innerHTML = `
    <div class="auth-page"><div class="auth-card card"><div class="card__body--lg">
      <div class="auth-logo"><img src="/logo.svg" alt="소소킹" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:16px"><div class="auth-logo__mark">소소킹</div><div class="auth-logo__sub">AI 캐릭터 참여형 커뮤니티에 가입하세요</div></div>
      <button type="button" class="social-btn" id="btn-google-signup"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20">Google로 가입</button>
      <button type="button" class="social-btn social-btn--kakao" id="btn-kakao-signup">💛 카카오로 가입</button>
      <div class="auth-divider">또는 이메일로 가입</div>
      <div class="form-group"><label class="form-label" for="su-email">이메일</label><input id="su-email" class="form-input" type="email" autocomplete="email"></div>
      <div class="form-group"><label class="form-label" for="su-password">비밀번호</label><input id="su-password" class="form-input" type="password" autocomplete="new-password"><div class="form-hint">6자 이상 입력해주세요.</div></div>
      <div class="form-group"><label class="form-label" for="su-password-confirm">비밀번호 확인</label><input id="su-password-confirm" class="form-input" type="password" autocomplete="new-password"><div id="pw-match-hint" class="form-hint"></div></div>
      <label class="form-check-row" style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><input type="checkbox" id="su-terms"><span><a href="#/legal/terms">이용약관</a> 및 <a href="#/legal/privacy">개인정보처리방침</a>에 동의합니다.</span></label>
      <button type="button" class="btn btn--primary btn--full" id="btn-email-signup">이메일로 가입하기</button>
      <div class="auth-switch" style="text-align:center;margin-top:20px">이미 계정이 있으신가요? <button type="button" class="btn btn--ghost btn--sm" id="btn-go-login">로그인</button></div>
    </div></div></div>`;

  root.querySelector('#btn-go-login')?.addEventListener('click', () => navigate('/login'));
  root.querySelector('#btn-kakao-signup')?.addEventListener('click', () => triggerKakaoLogin('signup'));
  const password = root.querySelector('#su-password');
  const confirm = root.querySelector('#su-password-confirm');
  const hint = root.querySelector('#pw-match-hint');
  const checkMatch = () => {
    if (!confirm.value) return hint.textContent = '';
    hint.textContent = password.value === confirm.value ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.';
  };
  password?.addEventListener('input', checkMatch);
  confirm?.addEventListener('input', checkMatch);

  root.querySelector('#btn-google-signup')?.addEventListener('click', async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await ensureUserProvisioned(credential.user);
      toast.success('가입되었습니다.');
      await goAfterLogin(credential.user);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/popup-blocked') return signInWithRedirect(auth, googleProvider);
      toast.error('Google 가입에 실패했습니다.');
    }
  });

  const emailSignup = async () => {
    const email = root.querySelector('#su-email')?.value.trim();
    const passwordValue = password?.value || '';
    const confirmValue = confirm?.value || '';
    if (!email) return toast.warn('이메일을 입력해주세요.');
    if (passwordValue.length < 6) return toast.warn('비밀번호는 6자 이상이어야 합니다.');
    if (passwordValue !== confirmValue) return toast.warn('비밀번호가 일치하지 않습니다.');
    if (!root.querySelector('#su-terms')?.checked) return toast.warn('이용약관에 동의해주세요.');
    const button = root.querySelector('#btn-email-signup');
    button.disabled = true;
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const credential = await createUserWithEmailAndPassword(auth, email, passwordValue);
      await updateProfile(credential.user, { displayName: email.split('@')[0] }).catch(() => {});
      await ensureUserProvisioned(credential.user);
      toast.success('가입되었습니다.');
      await goAfterLogin(credential.user);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') toast.error('이미 사용 중인 이메일입니다.');
      else if (error.code === 'auth/invalid-email') toast.error('이메일 형식을 확인해주세요.');
      else toast.error(error.message || '가입에 실패했습니다.');
    } finally {
      button.disabled = false;
    }
  };
  root.querySelector('#btn-email-signup')?.addEventListener('click', emailSignup);
  confirm?.addEventListener('keydown', event => { if (event.key === 'Enter') emailSignup(); });
}
