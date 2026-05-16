import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import {
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const callUpdateNickname = httpsCallable(functions, 'updateNickname');
const callDeleteMyAccount = httpsCallable(functions, 'deleteMyAccount');
const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;

function isSettingsPage() {
  return !!document.getElementById('account-tab-content');
}

async function handleNicknameSave(event) {
  const btn = event.target.closest('#btn-save-nickname');
  if (!btn || !isSettingsPage()) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const user = auth.currentUser;
  const input = document.getElementById('new-nickname');
  const feedback = document.getElementById('nickname-feedback');
  const newNick = input?.value.trim() || '';

  if (!user) { navigate('/login'); return; }
  if (!newNick) { toast.error('닉네임을 입력해주세요'); return; }
  if (!NICK_RE.test(newNick)) { toast.error('닉네임 형식이 맞지 않아요'); return; }
  if (newNick === user.displayName) { toast.info('현재 닉네임과 같아요'); return; }

  btn.disabled = true;
  btn.textContent = '저장 중...';
  try {
    await callUpdateNickname({ nickname: newNick });
    await updateProfile(user, { displayName: newNick });
    if (feedback) {
      feedback.style.color = 'var(--color-success)';
      feedback.textContent = '저장됐어요!';
    }
    toast.success('닉네임이 변경됐어요');
  } catch (error) {
    console.error(error);
    toast.error(error?.message || '저장에 실패했어요. 다시 시도해주세요');
  } finally {
    btn.disabled = false;
    btn.textContent = '저장하기';
  }
}

async function reauthenticate(user) {
  const isGoogle = user.providerData?.some(p => p.providerId === 'google.com');
  if (isGoogle) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await reauthenticateWithPopup(user, provider);
    return;
  }
  const password = window.prompt('보안을 위해 비밀번호를 입력해주세요:');
  if (!password) throw new Error('비밀번호 입력이 취소됐습니다.');
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

async function handleWithdraw(event) {
  const btn = event.target.closest('#btn-withdraw');
  if (!btn || !isSettingsPage()) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const user = auth.currentUser;
  if (!user) { navigate('/login'); return; }
  const confirmed = window.confirm('정말 탈퇴하시겠어요?\n\n계정이 삭제되며 복구할 수 없어요.');
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = '탈퇴 처리 중...';
  try {
    await reauthenticate(user);
    await callDeleteMyAccount();
    toast.success('탈퇴가 완료됐어요. 이용해주셔서 감사합니다');
    navigate('/');
  } catch (error) {
    if (error?.code === 'auth/wrong-password') toast.error('비밀번호가 틀렸어요');
    else if (error?.code === 'auth/popup-closed-by-user') {}
    else if (String(error?.message || '').includes('취소')) {}
    else {
      console.error(error);
      toast.error(error?.message || '탈퇴 처리 중 오류가 발생했어요');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '회원 탈퇴';
  }
}

document.addEventListener('click', handleNicknameSave, true);
document.addEventListener('click', handleWithdraw, true);
