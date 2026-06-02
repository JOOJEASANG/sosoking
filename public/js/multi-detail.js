import { auth, db, functions } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { getDetailId, hasInteractiveModule } from './multi-detail/utils.js';
import { renderModules, renderVoteModule, renderItemList, renderMultiReplyList } from './multi-detail/render.js';
import { fetchItems, addParticipation, addItemReaction, fetchReplies, addItemReply, applyVote } from './multi-detail/actions.js';

const LIST_TARGETS = {
  naming: 'multi-naming-list',
  drip: 'multi-drip-list',
  fill: 'multi-fill-list',
};

function pointText(result, fallback = '') {
  const points = Number(result?.points || 0);
  return points > 0 ? `${fallback} +${points}P` : fallback;
}

async function refreshList(postId, kind) {
  const el = document.getElementById(LIST_TARGETS[kind]);
  if (!el) return;
  el.innerHTML = `<div class="multi-empty">불러오는 중...</div>`;
  try {
    const items = await fetchItems(postId, kind);
    el.innerHTML = renderItemList(items, kind);
    bindMultiItemActions(postId, kind);
  } catch {
    el.innerHTML = `<div class="multi-empty">불러오지 못했어요.</div>`;
  }
}

async function refreshReplies(postId, kind, itemId, box) {
  const list = box.querySelector('.multi-replies__list');
  if (!list) return;
  list.innerHTML = `<div class="multi-empty">불러오는 중...</div>`;
  try {
    const replies = await fetchReplies(postId, kind, itemId);
    list.innerHTML = renderMultiReplyList(replies);
  } catch {
    list.innerHTML = `<div class="multi-empty">답글을 불러오지 못했어요.</div>`;
  }
}

function requireLogin() {
  if (auth.currentUser) return true;
  navigate('/login');
  return false;
}

function bindOnce(element, eventName, handler, key = eventName) {
  if (!element) return;
  const flag = `bound${key.replace(/[^a-zA-Z0-9]/g, '')}`;
  if (element.dataset[flag] === '1') return;
  element.dataset[flag] = '1';
  element.addEventListener(eventName, handler);
}

function bindMultiItemActions(postId, kind) {
  document.querySelectorAll(`.multi-participation-item[data-multi-kind="${kind}"]`).forEach(item => {
    if (item.dataset.actionReady === '1') return;
    item.dataset.actionReady = '1';
    const itemId = item.dataset.multiItemId;

    item.querySelectorAll('[data-multi-react]').forEach(btn => {
      bindOnce(btn, 'click', async () => {
        if (!requireLogin()) return;
        const key = btn.dataset.multiReact;
        try {
          btn.disabled = true;
          const result = await addItemReaction(postId, kind, itemId, key);
          if (result?.reactionAdded === false) toast.warn('이미 반응했어요.');
          else if (Number(result?.points || 0) > 0) toast.success(`반응했어요! 작성자에게 +${result.points}P`);
          else toast.success('반응했어요!');
          await refreshList(postId, kind);
        } catch (error) {
          console.error(error);
          toast.error('반응 등록에 실패했어요.');
          btn.disabled = false;
        }
      }, `react-${kind}-${itemId}-${btn.dataset.multiReact}`);
    });

    const box = item.querySelector('.multi-replies');
    bindOnce(item.querySelector('[data-multi-reply-toggle]'), 'click', async () => {
      const open = !box.classList.contains('open');
      box.classList.toggle('open', open);
      if (open) await refreshReplies(postId, kind, itemId, box);
      if (open) box.querySelector('.multi-replies__input')?.focus();
    }, `reply-toggle-${kind}-${itemId}`);

    const sendReply = async () => {
      if (!requireLogin()) return;
      const input = box.querySelector('.multi-replies__input');
      const submit = box.querySelector('.multi-replies__submit');
      const text = input.value.trim();
      if (!text) {
        toast.warn('답글을 입력해주세요');
        return;
      }
      try {
        if (submit) submit.disabled = true;
        const result = await addItemReply(postId, kind, itemId, text);
        input.value = '';
        toast.success(pointText(result, '답글을 남겼어요'));
        await refreshReplies(postId, kind, itemId, box);
      } catch (error) {
        console.error(error);
        toast.error('답글 등록에 실패했어요.');
      } finally {
        if (submit) submit.disabled = false;
      }
    };

    bindOnce(item.querySelector('.multi-replies__submit'), 'click', sendReply, `reply-submit-${kind}-${itemId}`);
    bindOnce(item.querySelector('.multi-replies__input'), 'keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendReply();
      }
    }, `reply-enter-${kind}-${itemId}`);
  });
}

async function handleVote(post, idx, btn) {
  if (!requireLogin()) return;
  const postRef = doc(db, 'feeds', post.id);
  try {
    if (btn) btn.disabled = true;
    const resultOrPost = await applyVote(postRef, post, idx);
    const updated = resultOrPost?.post || resultOrPost;
    toast.success(pointText(resultOrPost, '투표했어요!'));
    const voteModule = document.querySelector('[data-multi-module="vote"]');
    if (voteModule) voteModule.outerHTML = renderVoteModule(updated);
    setupEvents(updated);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '투표에 실패했어요.');
    if (btn) btn.disabled = false;
  }
}

async function handleNamingSubmit(post, btn) {
  const free = document.getElementById('multi-naming-free');
  const text = free?.value.trim() || '';
  if (!text) {
    toast.warn('이름을 입력해주세요');
    return;
  }
  if (btn) btn.disabled = true;
  const result = await addParticipation(post.id, 'naming', { text });
  toast.success(pointText(result, '참여글을 올렸어요!'));
  if (free) free.value = '';
  await refreshList(post.id, 'naming');
  if (btn) btn.disabled = false;
}

async function handleDripSubmit(post, btn) {
  const input = document.getElementById('multi-drip-input');
  const text = input?.value.trim() || '';
  if (!text) {
    toast.warn('드립을 입력해주세요');
    return;
  }
  if (btn) btn.disabled = true;
  const result = await addParticipation(post.id, 'drip', { text });
  toast.success(pointText(result, '드립을 등록했어요!'));
  input.value = '';
  await refreshList(post.id, 'drip');
  if (btn) btn.disabled = false;
}

function collectFillAnswers() {
  const groups = [...document.querySelectorAll('[data-fill-group]')];
  return groups.map((group, index) => ({
    index,
    text: [...group.querySelectorAll('.multi-fill-char')].map(input => input.value.trim()).join(''),
  }));
}

async function handleFillSubmit(post, btn) {
  const answers = collectFillAnswers();
  const filled = answers.filter(answer => answer.text);
  if (!filled.length) {
    toast.warn('빈칸에 들어갈 말을 입력해주세요');
    return;
  }
  const incomplete = answers.some(answer => !answer.text || [...answer.text].length < 1);
  if (incomplete) {
    toast.warn('모든 빈칸을 입력해주세요');
    return;
  }
  const text = answers.length > 1
    ? answers.map(answer => `빈칸 ${answer.index + 1}: ${answer.text}`).join(' / ')
    : answers[0].text;
  const input = document.getElementById('multi-fill-answer');
  if (input) input.value = text;
  if (btn) btn.disabled = true;
  const result = await addParticipation(post.id, 'fill', { text, answers });
  toast.success(pointText(result, '참여글을 올렸어요!'));
  if (input) input.value = '';
  document.querySelectorAll('.multi-fill-char').forEach(box => { box.value = ''; });
  await refreshList(post.id, 'fill');
  if (btn) btn.disabled = false;
}

function setupEvents(post) {
  document.querySelectorAll('[data-multi-vote-idx]').forEach(btn => {
    bindOnce(btn, 'click', () => handleVote(post, Number(btn.dataset.multiVoteIdx), btn), `vote-${post.id}-${btn.dataset.multiVoteIdx}`);
  });

  const namingBtn = document.getElementById('multi-naming-submit');
  bindOnce(namingBtn, 'click', async () => {
    if (!requireLogin()) return;
    await handleNamingSubmit(post, namingBtn).catch(error => {
      console.error(error);
      toast.error('등록에 실패했어요.');
      namingBtn.disabled = false;
    });
  }, `naming-${post.id}`);

  const dripBtn = document.getElementById('multi-drip-submit');
  bindOnce(dripBtn, 'click', async () => {
    if (!requireLogin()) return;
    await handleDripSubmit(post, dripBtn).catch(error => {
      console.error(error);
      toast.error('등록에 실패했어요.');
      dripBtn.disabled = false;
    });
  }, `drip-${post.id}`);

  const fillBtn = document.getElementById('multi-fill-submit');
  bindOnce(fillBtn, 'click', async () => {
    if (!requireLogin()) return;
    await handleFillSubmit(post, fillBtn).catch(error => {
      console.error(error);
      toast.error('등록에 실패했어요.');
      fillBtn.disabled = false;
    });
  }, `fill-${post.id}`);

}

async function enhanceMultiDetail() {
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root || root.querySelector('[data-multi-modules-root]')) return;
  const badge = root.querySelector('.feed-card__type-badge');
  if (!badge) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.type !== 'multi') return;
    if (!hasInteractiveModule(post)) return;

    const body = root.querySelector('.detail-body');
    if (!body) return;
    body.insertAdjacentHTML('afterend', renderModules(post));
    setupEvents(post);
    await Promise.all([
      refreshList(post.id, 'naming'),
      refreshList(post.id, 'drip'),
      refreshList(post.id, 'fill'),
    ]);
  } catch (error) {
    console.warn('[multi-detail] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceMultiDetail, 220);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);