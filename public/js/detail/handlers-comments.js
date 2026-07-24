import { toast } from '../components/toast.js';
import { isDetailPath } from './action-utils.js';
import { currentPostId, stop } from './bootstrap-context.js';
import { deleteComment } from './comment-actions.js';
import { submitDetailComment } from './submit-actions.js';

export async function handleCommentSubmit(event) {
  const button = event.target.closest?.('#btn-comment');
  if (!button || !isDetailPath()) return false;
  stop(event);
  if (button.dataset.pending === '1') return true;
  const input = document.getElementById('comment-input');
  const text = input?.value.trim() || '';
  if (!text) {
    toast.warn('내용을 입력해주세요.');
    return true;
  }
  const guestName = document.getElementById('comment-guest-name')?.value.trim() || '';
  button.dataset.pending = '1';
  try {
    await submitDetailComment(currentPostId(), { text, guestName });
    if (input) input.value = '';
    toast.success('댓글을 등록했어요.');
    window.dispatchEvent(new Event('hashchange'));
  } catch (error) {
    toast.error(error.message || '댓글 등록에 실패했어요.');
  } finally {
    delete button.dataset.pending;
  }
  return true;
}

export async function handleCommentDelete(event) {
  const button = event.target.closest?.('.comment-delete-btn');
  if (!button || !isDetailPath()) return false;
  stop(event);
  if (!confirm('댓글을 삭제할까요?')) return true;
  try {
    await deleteComment(currentPostId(), button.dataset.commentId);
    button.closest('[data-comment-id]')?.remove();
    toast.success('댓글을 삭제했어요.');
  } catch {
    toast.error('댓글 삭제에 실패했어요.');
  }
  return true;
}
