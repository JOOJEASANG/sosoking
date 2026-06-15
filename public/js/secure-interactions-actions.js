import { auth, functions } from './firebase.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const callView = httpsCallable(functions, 'incrementPostView');
const callReactPost = httpsCallable(functions, 'reactToPost');
const callReactComment = httpsCallable(functions, 'reactToComment');
const viewedInSession = new Set();

function getPostIdFromPage(target) {
  const direct = target?.dataset?.postId;
  if (direct) return direct;
  const hash = window.location.hash || '';
  const match = hash.match(/#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function maybeTrackView() {
  const postId = getPostIdFromPage(document.body);
  if (!postId || viewedInSession.has(postId)) return;
  viewedInSession.add(postId);
  callView({ postId }).catch(() => {});
}

async function ensureUser({ anonymous = false } = {}) {
  if (auth.currentUser) return auth.currentUser;
  if (anonymous) {
    try { return await signInAnonymously(auth); } catch {}
  }
  navigate('/login');
  throw new Error('auth-required');
}

function adjustInlineCount(btn, tagName, delta) {
  if (!btn) return;
  const node = btn.querySelector(tagName);
  if (node) {
    const next = Math.max(0, Number(node.textContent || 0) + delta);
    if (next === 0) node.remove();
    else node.textContent = String(next);
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <${tagName}>1</${tagName}>`);
  }
}

function applyToggleUi(btn, result, countTag = 'strong') {
  const container = btn.closest('[data-comment-id], .reaction-bar') || btn.parentElement;
  const previous = result.previousReaction;
  if (previous && previous !== result.reaction) {
    const prevBtn = container?.querySelector(`[data-react="${previous}"], [data-reaction="${previous}"]`);
    prevBtn?.classList.remove('active');
    adjustInlineCount(prevBtn, countTag, -1);
  }
  if (result.active) {
    btn.classList.add('active');
    adjustInlineCount(btn, countTag, 1);
  } else {
    btn.classList.remove('active');
    adjustInlineCount(btn, countTag, -1);
  }
}

async function handlePostReaction(btn) {
  await ensureUser();
  if (btn._pending) return;
  btn._pending = true;
  try {
    const res = await callReactPost({ postId: btn.dataset.postId || getPostIdFromPage(btn), reaction: btn.dataset.reaction });
    applyToggleUi(btn, res.data || {}, 'strong');
  } catch (error) {
    toast.error(error?.message || '반응 등록에 실패했어요');
  } finally { btn._pending = false; }
}

async function handleCommentReaction(btn) {
  await ensureUser({ anonymous: true });
  if (btn._pending) return;
  btn._pending = true;
  try {
    const res = await callReactComment({ postId: getPostIdFromPage(btn), commentId: btn.dataset.commentId, reaction: btn.dataset.react });
    applyToggleUi(btn, res.data || {}, 'b');
  } catch (error) {
    toast.error(error?.message || '댓글 반응에 실패했어요');
  } finally { btn._pending = false; }
}

document.addEventListener('click', async event => {
  const target = event.target;
  const postReactionBtn = target.closest?.('.reaction-bar [data-reaction]');
  const commentReactionBtn = target.closest?.('.comment-react-btn');

  const handled = postReactionBtn || commentReactionBtn;
  if (!handled) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  try {
    if (postReactionBtn) return await handlePostReaction(postReactionBtn);
    if (commentReactionBtn) return await handleCommentReaction(commentReactionBtn);
  } catch (error) {
    if (error.message !== 'auth-required') console.error(error);
  }
}, true);

window.addEventListener('hashchange', () => setTimeout(maybeTrackView, 150));
setTimeout(maybeTrackView, 500);
