import { auth, googleProvider, signInWithPopup, signInWithRedirect } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { goAfterLogin, triggerKakaoLogin } from './login.js';
import { setMeta } from '../utils/seo.js';

export function renderSignup() {
  setMeta('회원가입');
  const el = document.getElementById('page-content');
  if (auth.currentUser) {
    el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
    goAfterLogin(auth.currentUser);
    return;
  }

  window.__kakaoSignup = () => triggerKakaoLogin('signup');

  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="card__body--lg">
          <div class="auth-logo">
            <img src="/logo.svg" alt="소소킹" width="56" height="56"
              style="display:block;margin:0 auto 12px;border-radius:16px;box-shadow:0 10px 28px rgba(255,107,74,.18)">
            <div class="auth-logo__mark">소소킹</div>
            <div class="auth-logo__sub">지금 바로 소소킹에 합류하세요</div>
          </div>

          <button type="button" class="social-btn" id="btn-google-signup">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20">
            Google로 가입
          </button>
          <button type="button" class="social-btn social-btn--kakao" id="btn-kakao-signup" onclick="window.__kakaoSignup()">
            💛 카카오로 가입
          </button>

          <div class="auth-divider">또는 이메일로 가입</div>

          <div class="form-group">
            <label class="form-label">이메일 <span style="color:var(--color-danger)">*</span></label>
            <input id="su-email" class="form-input" type="email" placeholder="이메일 주소" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호 <span style="color:var(--color-danger)">*</span></label>
            <input id="su-password" class="form-input" type="password" placeholder="6자 이상" autocomplete="new-password">
            <div class="form-hint">영문·숫자·특수문자 조합 6자 이상</div>
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호 확인 <span style="color:var(--color-danger)">*</span></label>
            <input id="su-password-confirm" class="form-input" type="password" placeholder="비밀번호 재입력" autocomplete="new-password">
            <div id="pw-match-hint" style="font-size:12px;margin-top:4px;min-height:16px"></div>
          </div>

          <label class="form-check-row" style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer">
            <input type="checkbox" id="su-terms" style="width:16px;height:16px;cursor:pointer">
            <span style="font-size:13px;color:var(--color-text-secondary)">
              <a href="#/legal/terms" style="color:var(--color-primary)" target="_self">이용약관</a> 및
              <a href="#/legal/privacy" style="color:var(--color-primary)" target="_self">개인정보처리방침</a>에 동의합니다
            </span>
          </label>

          <button type="button" class="btn btn--primary btn--full" id="btn-email-signup">이메일로 가입하기</button>

          <div class="auth-switch" style="text-align:center;margin-top:20px;font-size:14px;color:var(--color-text-secondary)">
            이미 계정이 있으신가요?
            <button type="button" class="btn btn--ghost btn--sm" id="btn-go-login"
              style="font-weight:700;color:var(--color-primary);margin-left:4px">로그인</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-go-login')?.addEventListener('click', () => navigate('/login'));

  /* 비밀번호 일치 실시간 확인 */
  const pwInput  = document.getElementById('su-password');
  const pwConfirm = document.getElementById('su-password-confirm');
  const pwHint   = document.getElementById('pw-match-hint');
  function checkPwMatch() {
    const a = pwInput?.value;
    const b = pwConfirm?.value;
    if (!b) { pwHint.textContent = ''; return; }
    if (a === b) {
      pwHint.style.color = 'var(--color-success)';
      pwHint.textContent = '비밀번호가 일치해요';
    } else {
      pwHint.style.color = 'var(--color-danger)';
      pwHint.textContent = '비밀번호가 일치하지 않아요';
    }
  }
  pwInput?.addEventListener('input', checkPwMatch);
  pwConfirm?.addEventListener('input', checkPwMatch);

  /* Google 가입 */
  document.getElementById('btn-google-signup')?.addEventListener('click', async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      toast.success('가입됐어요! 환영해요 🎉');
      await goAfterLogin(cred.user);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') return;
      if (e.code === 'auth/popup-blocked') {
        try { await signInWithRedirect(auth, googleProvider); } catch { toast.error('가입에 실패했어요'); }
      } else {
        toast.error('Google 가입에 실패했어요');
      }
    }
  });

  /* 이메일 가입 */
  document.getElementById('btn-email-signup')?.addEventListener('click', async () => {
    const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const email    = document.getElementById('su-email')?.value.trim();
    const password = document.getElementById('su-password')?.value;
    const confirm  = document.getElementById('su-password-confirm')?.value;
    const agreed   = document.getElementById('su-terms')?.checked;

    if (!email)    { toast.warn('이메일을 입력해주세요'); return; }
    if (!password) { toast.warn('비밀번호를 입력해주세요'); return; }
    if (password.length < 6) { toast.warn('비밀번호는 6자 이상이어야 해요'); return; }
    if (password !== confirm) { toast.warn('비밀번호가 일치하지 않아요'); return; }
    if (!agreed) { toast.warn('이용약관에 동의해주세요'); return; }

    const btn = document.getElementById('btn-email-signup');
    btn.disabled = true; btn.textContent = '가입 처리 중...';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // displayName은 ensureUserProvisioned에서 설정되므로 여기선 임시값
      await updateProfile(cred.user, { displayName: email.split('@')[0] }).catch(() => {});
      toast.success('가입됐어요! 환영합니다 🎉');
      await goAfterLogin(cred.user);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        toast.error('이미 사용 중인 이메일이에요. 로그인을 시도해보세요.');
      } else if (e.code === 'auth/invalid-email') {
        toast.error('올바른 이메일 형식이 아니에요');
      } else if (e.code === 'auth/weak-password') {
        toast.error('비밀번호가 너무 약해요. 6자 이상 입력해주세요');
      } else {
        toast.error('가입에 실패했어요 (' + (e.code || e.message) + ')');
      }
    } finally {
      btn.disabled = false; btn.textContent = '이메일로 가입하기';
    }
  });

  document.getElementById('su-password-confirm')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-email-signup')?.click();
  });
}
