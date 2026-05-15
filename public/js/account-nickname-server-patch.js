import { functions } from './firebase.js';
import { invalidateNicknameCache, renderNav } from './components/nav.js';
import { showToast } from './components/toast.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

// 안정화: 디자인/반응형 런타임 패치들은 DOM 감시 충돌 가능성이 있어 로드하지 않습니다.
// 닉네임 서버 처리 기능만 유지합니다.

function validNickname(nick) {
  if (!nick || nick.length < 2 || nick.length > 12) return '닉네임은 2~12자여야 합니다.';
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nick)) return '한글, 영문, 숫자, _만 사용할 수 있습니다.';
  return '';
}

document.addEventListener('submit', async (event) => {
  const form = event.target?.closest?.('#nickname-form');
  if (!form) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const input = document.querySelector('#new-nickname');
  const button = document.querySelector('#save-nickname');
  const nickname = input?.value.trim() || '';
  const invalid = validNickname(nickname);
  if (invalid) { showToast(invalid, 'error'); return; }

  const originalText = button?.textContent || '닉네임 저장';
  if (button) { button.disabled = true; button.textContent = '저장 중...'; }

  try {
    const updateNickname = httpsCallable(functions, 'updateNickname');
    await updateNickname({ nickname });
    invalidateNicknameCache();
    showToast('닉네임이 변경되었습니다.', 'success');
    renderNav();
    location.reload();
  } catch (error) {
    showToast(error.message || '닉네임 저장에 실패했습니다.', 'error');
    if (button) { button.disabled = false; button.textContent = originalText; }
  }
}, true);
