import { auth, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from './components/toast.js';
import { openShareSheet } from './detail/share.js';
import { openGallery } from './detail/gallery.js';
import { ensureCommentActor, deleteComment, toggleCommentReaction, adjustReactCount } from './detail/comment-actions.js';
import { toggleAcrosticReaction, adjustAcrosticCount } from './detail/acrostic-actions.js';

function currentPostId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function isDetailPath() {
  return !!currentPostId();
}

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

async function getCurrentPostSummary() {
  const id = currentPostId();
  if (!id) return null;
  const snap = await getDoc(doc(db, 'feeds', id)).catch(() => null);
  if (!snap?.exists?.()) return { id };
  const data = snap.data();
  return { id, title: data.title || '', desc: data.desc || '', images: data.images || [] };
}

async function handleShare(event) {
  const btn = event.target.closest?.('#btn-share');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  const post = await getCurrentPostSummary();
  if (post) openShareSheet(post);
  return true;
}

function handleGallery(event) {
  const thumb = event.target.closest?.('.detail-gallery__thumb');
  if (!thumb || !isDetailPath()) return false;
  stop(event);
  const grid = thumb.closest('[data-images]');
  if (!grid) return true;
  const images = JSON.parse(decodeURIComponent(grid.dataset.images || '%5B%5D'));
  const idx = parseInt(thumb.dataset.galleryIdx || '0', 10) || 0;
  if (images.length) openGallery(images, idx);
  return true;
}

async function handleCommentDelete(event) {
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

async function handleCommentReaction(event) {
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

async function handleAcrosticReaction(event) {
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

document.addEventListener('click', async event => {
  if (!isDetailPath()) return;
  if (await handleShare(event)) return;
  if (handleGallery(event)) return;
  if (await handleCommentDelete(event)) return;
  if (await handleCommentReaction(event)) return;
  await handleAcrosticReaction(event);
}, true);
