import { auth, db } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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
}

export function bindCommentDelete(postId, root = document) {
  root.querySelectorAll('.comment-delete-btn').forEach(button => {
    if (button.dataset.deleteReady === '1') return;
    button.dataset.deleteReady = '1';
    button.addEventListener('click', async () => {
      if (!confirm('댓글을 삭제할까요?')) return;
      try {
        await deleteComment(postId, button.dataset.commentId);
        button.closest('[data-comment-id]')?.remove();
        toast.success('댓글을 삭제했어요.');
      } catch {
        toast.error('댓글 삭제에 실패했어요.');
      }
    });
  });
}

export function bindCommentLikes() {}
