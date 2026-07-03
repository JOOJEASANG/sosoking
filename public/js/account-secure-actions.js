import { auth, functions, signOut } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
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
    // 계정 삭제는 서버(Admin SDK)에서 수행하므로 클라이언트 재인증이 필요 없다.
    // (카카오 커스텀 토큰 사용자는 비밀번호/구글 재인증이 불가능하므로 재인증을 강요하면 탈퇴가 막힌다.)
    await callDeleteMyAccount();
    await signOut(auth).catch(() => {});
    toast.success('탈퇴가 완료됐어요. 이용해주셔서 감사합니다');
    navigate('/');
  } catch (error) {
    console.error('[withdraw]', error);
    const code = error?.code || '';
    const msg  = error?.message || '탈퇴 처리 중 오류가 발생했어요';
    toast.error(code ? `${msg} (${code})` : msg);
  } finally {
    btn.disabled = false;
    btn.textContent = '회원 탈퇴';
  }
}

document.addEventListener('click', handleNicknameSave, true);
document.addEventListener('click', handleWithdraw, true);
