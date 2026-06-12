import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { isDetailPath } from './action-utils.js';
import { currentPostId, getCurrentPostSummary, stop } from './bootstrap-context.js';
import { ensureCommentActor, deleteComment, toggleCommentReaction, adjustReactCount } from './comment-actions.js';
import { submitDetailComment, submitCbattleComment, submitAcrosticEntry, getSelectedCbattleSide, bindCbattleSideButtons } from './submit-actions.js';

const callReactAcrostic = httpsCallable(functions, 'reactToAcrostic');

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

  const guestName = document.getElementById('comment-guest-name')?.value.trim() || '';

  btn._detailPending = true;
  try {
    const post = await getCurrentPostSummary();
    if (post?.type === 'cbattle') await submitCbattleComment(currentPostId(), text, getSelectedCbattleSide(), guestName);
    else await submitDetailComment(currentPostId(), { text, guestName });
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
    await toggleCommentReaction(postId, commentId, key, currentKey);
  } catch {
    toast.error('반응 등록에 실패했어요.');
  }

  btn._detailPending = false;
  return true;
}

export function refreshCbattleSideBinding() {
  if (isDetailPath()) bindCbattleSideButtons(document);
}

export async function handleCharSubmit(event) {
  const btn = event.target.closest?.('#btn-char-submit');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;

  const freeInput = document.getElementById('free-naming-input');
  let text;
  if (freeInput) {
    text = freeInput.value.trim();
    if (!text) { toast.warn('이름을 입력해주세요'); return true; }
  } else {
    const boxes = [...document.querySelectorAll('.char-box')];
    if (!boxes.length) return true;
    text = boxes.map(b => b.value.trim()).join('');
    if (!text || boxes.some(b => !b.value.trim())) { toast.warn('모든 칸을 채워주세요'); return true; }
  }

  btn._detailPending = true;
  try {
    await submitDetailComment(currentPostId(), { text });
    if (freeInput) freeInput.value = '';
    else document.querySelectorAll('.char-box').forEach(b => { b.value = ''; });
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

  const keywordEl = document.getElementById('acrostic-keyword');
  const keyword = keywordEl?.dataset.keyword || keywordEl?.textContent?.trim() || '';
  const lines = [...document.querySelectorAll('.acrostic-line-input')].map(el => el.value.trim());

  if (!keyword) { toast.warn('제시어를 찾을 수 없어요'); return true; }
  if (!lines.length || lines.some(l => !l)) { toast.warn('모든 줄을 입력해주세요'); return true; }

  btn._detailPending = true;
  try {
    await submitAcrosticEntry(currentPostId(), keyword, lines);
    document.querySelectorAll('.acrostic-line-input').forEach(el => { el.value = ''; });
    toast.success('행시를 등록했어요! 🎉');
    window.dispatchEvent(new Event('hashchange'));
  } catch (error) {
    toast.error(error.message || '등록에 실패했어요');
  }
  btn._detailPending = false;
  return true;
}

export async function handleAcrosticReaction(event) {
  const btn = event.target.closest?.('[data-acrostic-reaction]');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;

  if (!auth.currentUser) {
    const { navigate } = await import('../router.js');
    navigate('/login');
    return true;
  }

  btn._detailPending = true;
  try {
    const res = await callReactAcrostic({
      postId: currentPostId(),
      acrosticId: btn.dataset.acrosticId,
      reaction: btn.dataset.acrosticReaction,
    });
    const result = res.data || {};
    if (result.active) btn.classList.add('active');
    else btn.classList.remove('active');
  } catch (error) {
    toast.error(error?.message || '삼행시 반응에 실패했어요');
  }
  btn._detailPending = false;
  return true;
}
