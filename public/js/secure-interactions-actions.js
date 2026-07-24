import { auth, functions } from './firebase.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const reactToPost = httpsCallable(functions, 'reactToPost');
const reactToComment = httpsCallable(functions, 'reactToComment');

function postIdFromPage(target) {
  const direct = target?.dataset?.postId;
  if (direct) return direct;
  const match = (location.hash || '').match(/#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function ensureUser({ anonymous = false } = {}) {
  if (auth.currentUser) return auth.currentUser;
  if (anonymous) {
    try { return await signInAnonymously(auth); } catch {}
  }
  navigate('/login');
  throw new Error('auth-required');
}

function changeCount(button, selector, delta) {
  const node = button?.querySelector(selector);
  if (node) {
    const next = Math.max(0, Number(node.textContent || 0) + delta);
    node.textContent = next ? String(next) : '';
  }
}

function applyResult(button, result, selector) {
  const container = button.closest('[data-comment-id], .reaction-bar') || button.parentElement;
  if (result.previousReaction && result.previousReaction !== result.reaction) {
    const previous = container?.querySelector(`[data-reaction="${result.previousReaction}"], [data-react="${result.previousReaction}"]`);
    previous?.classList.remove('active');
    changeCount(previous, selector, -1);
  }
  button.classList.toggle('active', !!result.active);
  changeCount(button, selector, result.active ? 1 : -1);
}

async function handlePostReaction(button) {
  await ensureUser();
  if (button.dataset.pending === '1') return;
  button.dataset.pending = '1';
  try {
    const result = await reactToPost({ postId: button.dataset.postId || postIdFromPage(button), reaction: button.dataset.reaction });
    applyResult(button, result.data || {}, 'strong');
  } catch (error) {
    toast.error(error.message || '반응 등록에 실패했어요.');
  } finally {
    delete button.dataset.pending;
  }
}

async function handleCommentReaction(button) {
  await ensureUser({ anonymous: true });
  if (button.dataset.pending === '1') return;
  button.dataset.pending = '1';
  try {
    const result = await reactToComment({
      postId: postIdFromPage(button),
      commentId: button.dataset.commentId,
      reaction: button.dataset.react,
    });
    applyResult(button, result.data || {}, 'b');
  } catch (error) {
    toast.error(error.message || '댓글 반응에 실패했어요.');
  } finally {
    delete button.dataset.pending;
  }
}

document.addEventListener('click', async event => {
  const postButton = event.target.closest?.('.reaction-bar [data-reaction]');
  const commentButton = event.target.closest?.('.comment-react-btn');
  if (!postButton && !commentButton) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  try {
    if (postButton) await handlePostReaction(postButton);
    else await handleCommentReaction(commentButton);
  } catch (error) {
    if (error.message !== 'auth-required') console.error(error);
  }
}, true);
