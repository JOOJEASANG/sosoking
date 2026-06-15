import { auth, db, functions } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { doc, updateDoc, deleteDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const reactToComment = httpsCallable(functions, 'reactToComment');

export async function ensureCommentActor() {
  if (auth.currentUser) return true;
  try {
    await signInAnonymously(auth);
    return true;
  } catch {
    navigate('/login');
    return false;
  }
}

export async function deleteComment(postId, commentId) {
  await deleteDoc(doc(db, 'feeds', postId, 'comments', commentId));
  await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(-1) });
}

export function bindCommentDelete(postId, root = document) {
  root.querySelectorAll('.comment-delete-btn').forEach(btn => {
    if (btn.dataset.deleteReady === '1') return;
    btn.dataset.deleteReady = '1';
    btn.addEventListener('click', async () => {
      if (!confirm('댓글을 삭제할까요?')) return;
      const commentId = btn.dataset.commentId;
      try {
        await deleteComment(postId, commentId);
        btn.closest('[data-comment-id]')?.remove();
        toast.success('댓글을 삭제했어요');
      } catch {
        toast.error('삭제에 실패했어요');
      }
    });
  });
}

export function adjustReactCount(btn, delta) {
  if (!btn) return;
  const countEl = btn.querySelector('b');
  if (countEl) {
    const next = Math.max(0, parseInt(countEl.textContent || '0', 10) + delta);
    if (next === 0) countEl.remove();
    else countEl.textContent = String(next);
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <b>1</b>`);
  }
}

export async function toggleCommentReaction(postId, commentId, key) {
  const result = await reactToComment({ postId, commentId, reaction: key });
  return result.data || { ok: true };
}

export function bindCommentLikes(postId, root = document) {
  root.querySelectorAll('.comment-react-btn').forEach(btn => {
    if (btn.dataset.reactReady === '1') return;
    btn.dataset.reactReady = '1';
    btn.addEventListener('click', async () => {
      if (!(await ensureCommentActor())) return;
      if (btn._pending) return;
      btn._pending = true;

      const commentId = btn.dataset.commentId;
      const key = btn.dataset.react;
      const parent = btn.closest('[data-comment-id]');
      const activeBtn = parent?.querySelector('.comment-react-btn.active');
      const currentKey = activeBtn?.dataset.react ?? null;

      const prevActiveKey = currentKey;
      const prevActiveBtnEl = activeBtn;

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
        if (prevActiveKey === key) {
          btn.classList.add('active');
          adjustReactCount(btn, 1);
        } else if (prevActiveKey) {
          btn.classList.remove('active');
          adjustReactCount(btn, -1);
          prevActiveBtnEl?.classList.add('active');
          adjustReactCount(prevActiveBtnEl, 1);
        } else {
          btn.classList.remove('active');
          adjustReactCount(btn, -1);
        }
        toast.error('반응 등록에 실패했어요.');
      }
      btn._pending = false;
    });
  });
}