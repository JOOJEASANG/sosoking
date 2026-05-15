import { auth, googleProvider, signInWithPopup } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';

export function renderLogin() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="card__body--lg">
          <div class="auth-logo">
            <div class="auth-logo__mark">소소킹</div>
            <div class="auth-logo__sub">글과 사진으로 즐기는 게임형 커뮤니티</div>
          </div>

          <button class="social-btn" id="btn-google">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google">
            Google로 로그인
          </button>

          <div class="auth-divider">또는</div>

          <div class="form-group">
            <label class="form-label">이메일</label>
            <input id="f-email" class="form-input" type="email" placeholder="이메일 주소">
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호</label>
            <input id="f-password" class="form-input" type="password" placeholder="비밀번호">
          </div>
          <button class="btn btn--primary btn--full" id="btn-email-login">이메일로 로그인</button>
          <button class="btn btn--ghost btn--full" id="btn-email-signup" style="margin-top:8px">회원가입</button>

          <p style="text-align:center;font-size:12px;color:var(--color-text-muted);margin-top:16px">
            로그인 시 <a href="#/guide" style="color:var(--color-primary)">이용 약관</a>에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('로그인됐어요!');
      navigate('/');
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') toast.error('로그인에 실패했어요');
    }
  });

  // 이메일 로그인/가입은 Firebase Auth import 필요 (lazy)
  document.getElementById('btn-email-login')?.addEventListener('click', async () => {
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const email    = document.getElementById('f-email')?.value.trim();
    const password = document.getElementById('f-password')?.value;
    if (!email || !password) { toast.warn('이메일과 비밀번호를 입력해주세요'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('로그인됐어요!');
      navigate('/');
    } catch { toast.error('이메일 또는 비밀번호가 올바르지 않아요'); }
  });

  document.getElementById('btn-email-signup')?.addEventListener('click', async () => {
    const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const email    = document.getElementById('f-email')?.value.trim();
    const password = document.getElementById('f-password')?.value;
    if (!email || !password) { toast.warn('이메일과 비밀번호를 입력해주세요'); return; }
    if (password.length < 6) { toast.warn('비밀번호는 6자 이상이어야 해요'); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: email.split('@')[0] });
      toast.success('가입됐어요! 환영해요 🎉');
      navigate('/');
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') toast.error('이미 사용 중인 이메일이에요');
      else toast.error('가입에 실패했어요');
    }
  });
}
