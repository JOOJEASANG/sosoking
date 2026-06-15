import { toast } from '../components/toast.js';
import { isDetailPath } from './action-utils.js';
import { currentPostId, stop } from './bootstrap-context.js';
import { ensureCommentActor, deleteComment, toggleCommentReaction, adjustReactCount } from './comment-actions.js';
import { submitDetailComment } from './submit-actions.js';

export async function handleCommentSubmit(event) {
  const btn = event.target.closest?.('#btn-comment');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;

  const input = document.getElementById('comment-input');
  const text = input?.value.trim() || '';
  if (!text) {
    toast.warn('내용을 입력해주세요');
    return true;
  }

  const guestName = document.getElementById('comment-guest-name')?.value.trim() || '';

  btn._detailPending = true;
  try {
    await submitDetailComment(currentPostId(), { text, guestName });
    if (input) input.value = '';
    toast.success('등록됐어요! 🎉');
    window.dispatchEvent(new Event('hashchange'));
  } catch (error) {
    toast.error(error.message || '등록에 실패했어요');
  }
  btn._detailPending = false;
  return true;
}

export async function handleCommentDelete(event) {
  const btn = event.target.closest?.('.comment-delete-btn');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (!confirm('댓글을 삭제할까요?')) return true;
  const postId = currentPostId();
  const commentId = btn.dataset.commentId;
  try {
    await deleteComment(postId, commentId);
    btn.closest('[data-comment-id]')?.remove();
    toast.success('댓글을 삭제했어요');
  } catch {
    toast.error('삭제에 실패했어요');
  }
  return true;
}

export async function handleCommentReaction(event) {
  const btn = event.target.closest?.('.comment-react-btn');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (!(await ensureCommentActor())) return true;
  if (btn._detailPending) return true;

  btn._detailPending = true;
  const postId = currentPostId();
  const commentId = btn.dataset.commentId;
  const key = btn.dataset.react;
  const parent = btn.closest('[data-comment-id]');
  const activeBtn = parent?.querySelector('.comment-react-btn.active');
  const currentKey = activeBtn?.dataset.react ?? null;

  try {
    if (currentKey === key) {
      btn.classList.remove('active');
      adjustReactCount(btn, -1);
    } else if (currentKey) {
      activeBtn.classList.remove('active');
      adjustReactCount(activeBtn, -1);
      btn.classList.add('active');
      adjustReactCount(btn, 1);
    } else {
      btn.classList.add('active');
      adjustReactCount(btn, 1);
    }
    await toggleCommentReaction(postId, commentId, key);
  } catch {
    toast.error('반응 등록에 실패했어요.');
  }

  btn._detailPending = false;
  return true;
}

export function refreshCbattleSideBinding() {
  // 구형 찬반/드립 게임은 정치게임 전환으로 사용하지 않는다.
}
