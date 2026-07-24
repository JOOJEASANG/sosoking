import { auth, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { getDetailId, hasInteractiveModule } from './multi-detail/utils.js';
import { renderModules, renderVoteModule, renderDripList, renderDripReplies } from './multi-detail/render.js';
import { fetchDrips, fetchDripReplies, applyVote, addDrip, addDripReply, reactDrip } from './multi-detail/actions.js';

function requireMember() {
  if (auth.currentUser && !auth.currentUser.isAnonymous) return true;
  navigate('/login');
  return false;
}

function pointsMessage(result, message) {
  const points = Number(result?.points || 0);
  return points > 0 ? `${message} +${points}P` : message;
}

async function refreshDrips(postId) {
  const list = document.getElementById('multi-drip-list');
  if (!list) return;
  try {
    const items = await fetchDrips(postId);
    list.innerHTML = renderDripList(items);
    bindDripItems(postId);
  } catch (error) {
    console.warn('[drip list]', error);
    list.innerHTML = '<div class="multi-empty">드립을 불러오지 못했습니다.</div>';
  }
}

async function refreshReplies(postId, itemId, box) {
  const list = box.querySelector('.multi-replies__list');
  if (!list) return;
  list.innerHTML = '<div class="multi-empty">불러오는 중...</div>';
  try {
    list.innerHTML = renderDripReplies(await fetchDripReplies(postId, itemId));
  } catch {
    list.innerHTML = '<div class="multi-empty">답글을 불러오지 못했습니다.</div>';
  }
}

function bindDripItems(postId) {
  document.querySelectorAll('[data-drip-item]').forEach(item => {
    if (item.dataset.bound === '1') return;
    item.dataset.bound = '1';
    const itemId = item.dataset.dripItem;
    item.querySelectorAll('[data-drip-react]').forEach(button => button.addEventListener('click', async () => {
      if (!requireMember()) return;
      button.disabled = true;
      try {
        const result = await reactDrip(postId, itemId, button.dataset.dripReact);
        if (result.reactionAdded === false) toast.warn('이미 반응했어요.');
        else toast.success(pointsMessage(result, '반응을 남겼어요.'));
        await refreshDrips(postId);
      } catch (error) {
        toast.error(error.message || '반응 등록에 실패했습니다.');
        button.disabled = false;
      }
    }));

    const box = item.querySelector('.multi-replies');
    item.querySelector('[data-drip-replies-toggle]')?.addEventListener('click', async () => {
      box.hidden = !box.hidden;
      if (!box.hidden) await refreshReplies(postId, itemId, box);
    });

    const send = async () => {
      if (!requireMember()) return;
      const input = box.querySelector('.multi-replies__input');
      const button = box.querySelector('.multi-replies__submit');
      const text = input?.value.trim() || '';
      if (!text) return toast.warn('답글을 입력해주세요.');
      button.disabled = true;
      try {
        const result = await addDripReply(postId, itemId, text);
        input.value = '';
        toast.success(pointsMessage(result, '답글을 등록했어요.'));
        await refreshReplies(postId, itemId, box);
      } catch (error) {
        toast.error(error.message || '답글 등록에 실패했습니다.');
      } finally {
        button.disabled = false;
      }
    };
    box.querySelector('.multi-replies__submit')?.addEventListener('click', send);
    box.querySelector('.multi-replies__input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
  });
}

function bindVote(post) {
  document.querySelectorAll('[data-community-vote]').forEach(button => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', async () => {
      if (!requireMember()) return;
      document.querySelectorAll('[data-community-vote]').forEach(item => { item.disabled = true; });
      try {
        const result = await applyVote(post.id, Number(button.dataset.communityVote));
        const updated = result.post || post;
        const module = document.querySelector('[data-multi-module="vote"]');
        if (module) module.outerHTML = renderVoteModule(updated);
        bindVote(updated);
        toast.success('투표했어요.');
      } catch (error) {
        toast.warn(error.message || '투표에 실패했습니다.');
        document.querySelectorAll('[data-community-vote]').forEach(item => { item.disabled = false; });
      }
    });
  });
}

function bindDripSubmit(postId) {
  const button = document.getElementById('multi-drip-submit');
  if (!button || button.dataset.bound === '1') return;
  button.dataset.bound = '1';
  button.addEventListener('click', async () => {
    if (!requireMember()) return;
    const input = document.getElementById('multi-drip-input');
    const text = input?.value.trim() || '';
    if (!text) return toast.warn('한 줄 드립을 입력해주세요.');
    button.disabled = true;
    try {
      const result = await addDrip(postId, text);
      input.value = '';
      toast.success(pointsMessage(result, '드립을 등록했어요.'));
      await refreshDrips(postId);
    } catch (error) {
      toast.error(error.message || '드립 등록에 실패했습니다.');
    } finally {
      button.disabled = false;
    }
  });
}

async function enhanceDetail() {
  const postId = getDetailId();
  const root = document.getElementById('page-content');
  if (!postId || !root || root.querySelector('[data-community-modules-root]')) return;
  const detailBody = root.querySelector('.detail-body');
  if (!detailBody) return;
  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.type !== 'multi' || !hasInteractiveModule(post)) return;
    detailBody.insertAdjacentHTML('afterend', renderModules(post));
    bindVote(post);
    bindDripSubmit(post.id);
    if (post.modules?.drip?.enabled) await refreshDrips(post.id);
  } catch (error) {
    console.warn('[community detail]', error);
  }
}

let timer;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceDetail, 180);
}
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.getElementById('app') || document.documentElement, { childList: true, subtree: true });
schedule();
