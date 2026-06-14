// admin-feed-safety-fix.js
// 관리자 피드 삭제가 게시글 본문만 삭제하지 않고 서버의 deep delete 함수를 쓰도록 보강합니다.

import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

function currentPath() {
  return (window.location.hash.slice(1) || '/').split('?')[0] || '/';
}

async function handleAdminDeepDelete(event) {
  if (currentPath() !== '/admin') return;
  const btn = event.target?.closest?.('[data-admin-delete-post]');
  if (!btn || btn.dataset.deepDeleteBound === 'done') return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const postId = btn.dataset.adminDeletePost;
  if (!postId) return;
  if (!confirm('이 게시글과 댓글·답글·스크랩 등 하위 데이터를 함께 삭제할까요? 되돌릴 수 없습니다.')) return;

  btn.dataset.deepDeleteBound = 'done';
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '삭제 중...';

  try {
    const { data } = await httpsCallable(functions, 'deleteFeedPostDeep')({ postId });
    const childCount = Number(data?.deletedChildren || 0);
    toast.success(childCount > 0 ? `게시글과 하위 데이터 ${childCount}개를 삭제했어요` : '게시글을 삭제했어요');
    btn.closest('tr')?.remove();
  } catch (error) {
    console.error('[admin deep delete]', error);
    toast.error(error?.message || '서버 삭제에 실패했어요');
    btn.disabled = false;
    btn.textContent = originalText;
    btn.dataset.deepDeleteBound = '';
  }
}

document.addEventListener('click', handleAdminDeepDelete, true);
