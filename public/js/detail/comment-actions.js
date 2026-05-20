import { auth, db } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { doc, updateDoc, deleteDoc, increment, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
    else countEl.textContent = next;
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <b>1</b>`);
  }
}

export async function toggleCommentReaction(postId, commentId, key, currentKey) {
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'feeds', postId, 'comments', commentId);

  if (currentKey === key) {
    await updateDoc(ref, {
      [`reactions.${key}`]: increment(-1),
      [`reactedWith.${uid}`]: deleteField(),
    });
    return 'removed';
  }

  if (currentKey) {
    await updateDoc(ref, {
      [`reactions.${currentKey}`]: increment(-1),
      [`reactions.${key}`]: increment(1),
      [`reactedWith.${uid}`]: key,
    });
    return 'switched';
  }

  await updateDoc(ref, {
    [`reactions.${key}`]: increment(1),
    [`reactedWith.${uid}`]: key,
  });
  return 'added';
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

      // 낙관적 업데이트 전 현재 상태 스냅샷 저장
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
        await toggleCommentReaction(postId, commentId, key, currentKey);
      } catch {
        // 실패 시 낙관적 업데이트 롤백
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
