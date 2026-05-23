import { auth, db, googleProvider, signInWithPopup, signInWithRedirect } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const OWNER_EMAILS = new Set(['joojeasang@gmail.com']);

function isOwnerEmail(user) {
  return OWNER_EMAILS.has(String(user?.email || '').toLowerCase());
}

async function isSignedInUserAdmin(user = auth.currentUser) {
  if (!user) return false;
  if (isOwnerEmail(user)) return true;

  try {
    const token = await user.getIdTokenResult?.(true);
    if (token?.claims?.admin || token?.claims?.owner) return true;
  } catch (error) {
    console.warn('[login] admin token check failed', error);
  }

  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch (error) {
    console.warn('[login] admin doc check failed', error);
    return false;
  }
}

async function goAfterLogin(user = auth.currentUser) {
  if (await isSignedInUserAdmin(user)) {
    navigate('/admin');
    return;
  }

  const params = Object.fromEntries(new URLSearchParams(window.location.hash.slice(1).split('?')[1] || ''));
  const returnTo = params.return;
  if (returnTo) { navigate(returnTo); return; }

  const currentPath = window.location.hash.slice(1).split('?')[0] || '/';
  if (currentPath === '/login') navigate('/');
  else window.dispatchEvent(new Event('hashchange'));
}

export function renderLogin() {
  const el = document.getElementById('page-content');
  const existingUser = auth.currentUser;
  if (existingUser) {
    el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
    goAfterLogin(existingUser);
    return;
  }

  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="card__body--lg">
          <div class="auth-logo">
            <img class="auth-logo__site-img" src="/logo.svg" alt="소소킹" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:16px;box-shadow:0 10px 28px rgba(255,107,74,.18)">
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
          <button class="btn btn--ghost btn--full" id="btn-reset-password" style="margin-top:4px;font-size:13px;color:var(--color-text-muted)">비밀번호 재설정</button>

          <p style="text-align:center;font-size:12px;color:var(--color-text-muted);margin-top:16px">
            로그인 시 <a href="#/legal/terms" style="color:var(--color-primary)">이용 약관</a>에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      toast.success('로그인됐어요!');
      await goAfterLogin(cred.user);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') return;
      if (e.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch { toast.error('로그인에 실패했어요'); }
      } else {
        toast.error('로그인에 실패했어요');
      }
    }
  });

  document.getElementById('btn-email-login')?.addEventListener('click', async () => {
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const email    = document.getElementById('f-email')?.value.trim();
    const password = document.getElementById('f-password')?.value;
    if (!email || !password) { toast.warn('이메일과 비밀번호를 입력해주세요'); return; }
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      toast.success('로그인됐어요!');
      await goAfterLogin(cred.user);
    } catch { toast.error('이메일 또는 비밀번호가 올바르지 않아요'); }
  });

  document.getElementById('btn-reset-password')?.addEventListener('click', async () => {
    const email = document.getElementById('f-email')?.value.trim();
    if (!email) { toast.warn('이메일을 먼저 입력해주세요'); return; }
    try {
      const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sendPasswordResetEmail(auth, email);
      toast.success('비밀번호 재설정 이메일을 보냈어요 📧');
    } catch (e) {
      if (e.code === 'auth/user-not-found') toast.error('등록되지 않은 이메일이에요');
      else toast.error('이메일 전송에 실패했어요');
    }
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
      await goAfterLogin(cred.user);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') toast.error('이미 사용 중인 이메일이에요');
      else toast.error('가입에 실패했어요');
    }
  });
}
