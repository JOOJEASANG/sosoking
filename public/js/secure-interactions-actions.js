import { auth, functions } from './firebase.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const callView = httpsCallable(functions, 'incrementPostView');
const callVote = httpsCallable(functions, 'votePostOption');
const callReactPost = httpsCallable(functions, 'reactToPost');
const callReactComment = httpsCallable(functions, 'reactToComment');
const callReactAcrostic = httpsCallable(functions, 'reactToAcrostic');
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
    else node.textContent = next;
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <${tagName}>1</${tagName}>`);
  }
}

function applyToggleUi(btn, result, countTag = 'strong') {
  const container = btn.closest('[data-comment-id], [data-acrostic-id], .reaction-bar') || btn.parentElement;
  const previous = result.previousReaction;
  if (previous && previous !== result.reaction) {
    const prevBtn = container?.querySelector(`[data-react="${previous}"], [data-acrostic-reaction="${previous}"], [data-reaction="${previous}"]`);
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

function renderVoteOptions(options) {
  const total = options.reduce((sum, opt) => sum + Number(opt.votes || 0), 0);
  return options.map((opt, i) => {
    const votes = Number(opt.votes || 0);
    const pct = total ? Math.round(votes / total * 100) : 0;
    const text = String(opt.text || opt || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
    return `
      <div class="vote-option" data-vote-idx="${i}">
        <div class="vote-option__bar vote-option__bar--selected" style="width:${pct}%"></div>
        <div class="vote-option__content">
          <span>${text}</span>
          <span class="vote-option__pct">${pct}%</span>
        </div>
      </div>`;
  }).join('');
}

async function handleVote(btn) {
  await ensureUser({ anonymous: true });
  const postId = getPostIdFromPage(btn);
  const optionIndex = Number(btn.dataset.voteIdx);
  btn.disabled = true;
  try {
    const res = await callVote({ postId, optionIndex });
    const options = res.data?.options || [];
    const area = document.getElementById('vote-area');
    if (area && options.length) area.innerHTML = renderVoteOptions(options);
    toast.success('투표했어요');
  } catch (error) {
    toast.warn(error?.message || '투표에 실패했어요');
    btn.disabled = false;
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

async function handleAcrosticReaction(btn) {
  await ensureUser();
  if (btn._pending) return;
  btn._pending = true;
  try {
    const res = await callReactAcrostic({ postId: getPostIdFromPage(btn), acrosticId: btn.dataset.acrosticId, reaction: btn.dataset.acrosticReaction });
    applyToggleUi(btn, res.data || {}, 'strong');
  } catch (error) {
    toast.error(error?.message || '삼행시 반응에 실패했어요');
  } finally { btn._pending = false; }
}

document.addEventListener('click', async event => {
  const target = event.target;
  const voteBtn = target.closest?.('[data-vote-idx]');
  const postReactionBtn = target.closest?.('.reaction-bar [data-reaction]');
  const commentReactionBtn = target.closest?.('.comment-react-btn');
  const acrosticReactionBtn = target.closest?.('[data-acrostic-reaction]');

  const handled = voteBtn || postReactionBtn || commentReactionBtn || acrosticReactionBtn;
  if (!handled) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  try {
    if (voteBtn) return await handleVote(voteBtn);
    if (postReactionBtn) return await handlePostReaction(postReactionBtn);
    if (commentReactionBtn) return await handleCommentReaction(commentReactionBtn);
    if (acrosticReactionBtn) return await handleAcrosticReaction(acrosticReactionBtn);
  } catch (error) {
    if (error.message !== 'auth-required') console.error(error);
  }
}, true);

window.addEventListener('hashchange', () => setTimeout(maybeTrackView, 150));
setTimeout(maybeTrackView, 500);
