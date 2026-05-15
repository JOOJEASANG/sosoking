import { auth, functions, logout } from './firebase.js';
import { invalidateNicknameCache, renderNav } from './components/nav.js';
import { showToast } from './components/toast.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

function isPasswordUser(user) {
  return (user?.providerData || []).some(provider => provider.providerId === 'password');
}

function isGoogleUser(user) {
  return (user?.providerData || []).some(provider => provider.providerId === 'google.com');
}

async function reauthenticateForDeletion(user) {
  if (!user || user.isAnonymous) throw new Error('로그인 후 탈퇴할 수 있습니다.');
  if (isPasswordUser(user)) {
    const password = document.querySelector('#delete-password')?.value || '';
    if (!password) throw new Error('현재 비밀번호를 입력해주세요.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return;
  }
  if (isGoogleUser(user)) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await reauthenticateWithPopup(user, provider);
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target?.closest?.('#delete-account-btn');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const confirmedData = document.querySelector('#delete-confirm')?.checked;
  if (!confirmedData) { showToast('데이터 보존 안내를 확인해주세요.', 'error'); return; }
  if (!confirm('정말 탈퇴하시겠습니까? 기존 글과 댓글은 삭제되지 않습니다.')) return;

  const user = auth.currentUser;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '탈퇴 처리 중...';

  try {
    await reauthenticateForDeletion(user);
    const deleteAccount = httpsCallable(functions, 'deleteAccount');
    await deleteAccount({});
    invalidateNicknameCache();
    showToast('회원 탈퇴가 완료되었습니다.', 'success');
    await logout().catch(() => {});
    renderNav();
    location.hash = '#/';
  } catch (error) {
    showToast(error.message || '탈퇴 처리에 실패했습니다. 다시 로그인 후 시도해주세요.', 'error');
    button.disabled = false;
    button.textContent = originalText || '회원 탈퇴';
  }
}, true);
