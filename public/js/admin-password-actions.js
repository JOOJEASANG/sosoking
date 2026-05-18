import { auth } from './firebase.js';
import { toast } from './components/toast.js';

function isAdminPage() {
  return (window.location.hash || '').startsWith('#/admin');
}

function isPasswordProvider(user) {
  return (user?.providerData || []).some(p => p.providerId === 'password');
}

function injectPasswordButton() {
  if (!isAdminPage()) return;
  const sidebar = document.querySelector('.admin-sidebar');
  if (!sidebar || document.getElementById('admin-password-btn')) return;

  const target = document.getElementById('admin-logout-btn')?.parentElement || sidebar;
  target.insertAdjacentHTML('afterbegin', `
    <button class="btn btn--ghost btn--full" id="admin-password-btn" style="justify-content:center;margin-bottom:8px">
      비밀번호 변경
    </button>
  `);

  document.getElementById('admin-password-btn')?.addEventListener('click', openPasswordDialog);
}

function openPasswordDialog() {
  const user = auth.currentUser;
  if (!user) {
    toast.warn('로그인이 필요합니다');
    return;
  }

  if (!isPasswordProvider(user)) {
    toast.warn('Google 로그인 계정은 Google 계정 설정에서 비밀번호를 변경해주세요');
    return;
  }

  if (document.getElementById('admin-password-modal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="admin-password-modal" style="position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:18px">
      <div class="card" style="width:100%;max-width:420px">
        <div class="card__body--lg">
          <div style="font-size:20px;font-weight:950;margin-bottom:6px">관리자 비밀번호 변경</div>
          <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:18px">보안을 위해 현재 비밀번호를 한 번 더 확인합니다.</div>
          <div class="form-group">
            <label class="form-label">현재 비밀번호</label>
            <input id="admin-current-password" class="form-input" type="password" autocomplete="current-password">
          </div>
          <div class="form-group">
            <label class="form-label">새 비밀번호</label>
            <input id="admin-new-password" class="form-input" type="password" autocomplete="new-password" placeholder="6자 이상">
          </div>
          <div class="form-group">
            <label class="form-label">새 비밀번호 확인</label>
            <input id="admin-new-password2" class="form-input" type="password" autocomplete="new-password">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
            <button class="btn btn--ghost" id="admin-password-cancel">취소</button>
            <button class="btn btn--primary" id="admin-password-save">변경하기</button>
          </div>
        </div>
      </div>
    </div>
  `);

  document.getElementById('admin-password-cancel')?.addEventListener('click', closePasswordDialog);
  document.getElementById('admin-password-modal')?.addEventListener('click', event => {
    if (event.target?.id === 'admin-password-modal') closePasswordDialog();
  });
  document.getElementById('admin-password-save')?.addEventListener('click', changePassword);
}

function closePasswordDialog() {
  document.getElementById('admin-password-modal')?.remove();
}

async function changePassword() {
  const user = auth.currentUser;
  const currentPassword = document.getElementById('admin-current-password')?.value || '';
  const newPassword = document.getElementById('admin-new-password')?.value || '';
  const newPassword2 = document.getElementById('admin-new-password2')?.value || '';

  if (!user?.email) {
    toast.error('계정 이메일을 확인할 수 없습니다');
    return;
  }
  if (!currentPassword || !newPassword) {
    toast.warn('현재 비밀번호와 새 비밀번호를 입력해주세요');
    return;
  }
  if (newPassword.length < 6) {
    toast.warn('새 비밀번호는 6자 이상이어야 합니다');
    return;
  }
  if (newPassword !== newPassword2) {
    toast.warn('새 비밀번호 확인이 일치하지 않습니다');
    return;
  }

  const btn = document.getElementById('admin-password-save');
  const oldText = btn?.textContent || '변경하기';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '변경 중...';
  }

  try {
    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    toast.success('관리자 비밀번호를 변경했습니다');
    closePasswordDialog();
  } catch (error) {
    console.error(error);
    if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
      toast.error('현재 비밀번호가 올바르지 않습니다');
    } else if (error?.code === 'auth/weak-password') {
      toast.error('새 비밀번호가 너무 약합니다');
    } else if (error?.code === 'auth/requires-recent-login') {
      toast.error('다시 로그인한 뒤 변경해주세요');
    } else {
      toast.error('비밀번호 변경에 실패했습니다');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

const observer = new MutationObserver(() => setTimeout(injectPasswordButton, 80));
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(injectPasswordButton, 120));
setTimeout(injectPasswordButton, 500);
