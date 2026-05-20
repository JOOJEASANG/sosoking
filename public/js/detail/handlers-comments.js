import { auth } from '../firebase.js';
import { toast } from '../components/toast.js';
import { isDetailPath } from './action-utils.js';
import { currentPostId, getCurrentPostSummary, stop } from './bootstrap-context.js';
import { ensureCommentActor, deleteComment, toggleCommentReaction, adjustReactCount } from './comment-actions.js';
import { toggleAcrosticReaction, adjustAcrosticCount } from './acrostic-actions.js';
import { submitDetailComment, submitCharParticipation, submitCbattleComment, submitAcrosticEntry, getSelectedCbattleSide, bindCbattleSideButtons } from './submit-actions.js';

export async function handleCbattleSide(event) {
  const btn = event.target.closest?.('.cbattle-side-btn');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  document.querySelectorAll('.cbattle-side-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  return true;
}

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

  btn._detailPending = true;
  try {
    const post = await getCurrentPostSummary();
    if (post?.type === 'cbattle') await submitCbattleComment(currentPostId(), text, getSelectedCbattleSide());
    else await submitDetailComment(currentPostId(), { text });
    if (input) input.value = '';
    toast.success('등록됐어요! 🎉');
    window.dispatchEvent(new Event('hashchange'));
  } catch (error) {
    toast.error(error.message || '등록에 실패했어요');
  }
  btn._detailPending = false;
  return true;
}

export async function handleCharSubmit(event) {
  const btn = event.target.closest?.('#btn-char-submit');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;

  const freeInput = document.getElementById('free-naming-input');
  const boxes = [...document.querySelectorAll('.char-box')];
  const text = freeInput ? freeInput.value.trim() : boxes.map(b => b.value.trim()).join('');
  if (!text) {
    toast.warn('내용을 입력해주세요');
    return true;
  }

  btn._detailPending = true;
  try {
    await submitCharParticipation(currentPostId(), text);
    if (freeInput) freeInput.value = '';
    boxes.forEach(b => { b.value = ''; });
    toast.success('등록됐어요! 🎉');
    window.dispatchEvent(new Event('hashchange'));
  } catch (error) {
    toast.error(error.message || '등록에 실패했어요');
  }
  btn._detailPending = false;
  return true;
}

export async function handleAcrosticSubmit(event) {
  const btn = event.target.closest?.('#btn-acrostic-submit');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;

  const post = await getCurrentPostSummary();
  const lines = [...document.querySelectorAll('.acrostic-submit-input')].map(input => input.value.trim());
  btn._detailPending = true;
  try {
    await submitAcrosticEntry(currentPostId(), post?.keyword || '', lines);
    document.querySelectorAll('.acrostic-submit-input').forEach(input => { input.value = ''; });
    toast.success('삼행시를 올렸어요! 🎉');
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
    await toggleCommentReaction(postId, commentId, key, currentKey);
  } catch {
    toast.error('반응 등록에 실패했어요.');
  }

  btn._detailPending = false;
  return true;
}

export async function handleAcrosticReaction(event) {
  const btn = event.target.closest?.('[data-acrostic-reaction]');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (!auth.currentUser) {
    location.hash = '#/login';
    return true;
  }
  if (btn._detailPending) return true;

  btn._detailPending = true;
  const postId = currentPostId();
  const acrosticId = btn.dataset.acrosticId;
  const key = btn.dataset.acrosticReaction;
  const card = btn.closest('[data-acrostic-id]');
  const activeBtn = card?.querySelector('[data-acrostic-reaction].active');
  const currentKey = activeBtn?.dataset.acrosticReaction ?? null;

  try {
    if (currentKey === key) {
      btn.classList.remove('active');
      adjustAcrosticCount(btn, -1);
    } else if (currentKey) {
      activeBtn.classList.remove('active');
      adjustAcrosticCount(activeBtn, -1);
      btn.classList.add('active');
      adjustAcrosticCount(btn, 1);
    } else {
      btn.classList.add('active');
      adjustAcrosticCount(btn, 1);
    }
    await toggleAcrosticReaction(postId, acrosticId, key, currentKey);
  } catch {
    toast.error('반응 등록에 실패했어요.');
  }

  btn._detailPending = false;
  return true;
}

export function refreshCbattleSideBinding() {
  if (isDetailPath()) bindCbattleSideButtons(document);
}
