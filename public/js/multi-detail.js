import { auth, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { getDetailId, hasInteractiveModule, normalizeAnswer } from './multi-detail/utils.js';
import { renderModules, renderVoteModule, renderItemList, renderMultiReplyList, markQuizResult } from './multi-detail/render.js';
import { fetchItems, addParticipation, addItemReaction, fetchReplies, addItemReply, applyVote } from './multi-detail/actions.js';

const LIST_TARGETS = {
  naming: 'multi-naming-list',
  acrostic: 'multi-acrostic-list',
  relay: 'multi-relay-list',
  fill: 'multi-fill-list',
};

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

function bindMultiItemActions(postId, kind) {
  document.querySelectorAll(`.multi-participation-item[data-multi-kind="${kind}"]`).forEach(item => {
    if (item.dataset.actionReady === '1') return;
    item.dataset.actionReady = '1';
    const itemId = item.dataset.multiItemId;

    item.querySelectorAll('[data-multi-react]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireLogin()) return;
        const key = btn.dataset.multiReact;
        try {
          await addItemReaction(postId, kind, itemId, key);
          const countEl = btn.querySelector('b');
          countEl.textContent = String((Number(countEl.textContent || 0) || 0) + 1);
        } catch (error) {
          console.error(error);
          toast.error('반응 등록에 실패했어요.');
        }
      });
    });

    const box = item.querySelector('.multi-replies');
    item.querySelector('[data-multi-reply-toggle]')?.addEventListener('click', async () => {
      const open = !box.classList.contains('open');
      box.classList.toggle('open', open);
      if (open) await refreshReplies(postId, kind, itemId, box);
      if (open) box.querySelector('.multi-replies__input')?.focus();
    });

    const sendReply = async () => {
      if (!requireLogin()) return;
      const input = box.querySelector('.multi-replies__input');
      const text = input.value.trim();
      if (!text) {
        toast.warn('답글을 입력해주세요');
        return;
      }
      try {
        await addItemReply(postId, kind, itemId, text);
        input.value = '';
        toast.success('답글을 남겼어요');
        await refreshReplies(postId, kind, itemId, box);
      } catch (error) {
        console.error(error);
        toast.error('답글 등록에 실패했어요.');
      }
    };

    item.querySelector('.multi-replies__submit')?.addEventListener('click', sendReply);
    item.querySelector('.multi-replies__input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendReply();
      }
    });
  });
}

async function handleVote(post, idx) {
  if (!requireLogin()) return;
  const postRef = doc(db, 'feeds', post.id);
  try {
    const snap = await getDoc(postRef);
    const updated = await applyVote(postRef, post, idx, snap.data() || {});
    toast.success('투표했어요!');
    const voteModule = document.querySelector('[data-multi-module="vote"]');
    if (voteModule) voteModule.outerHTML = renderVoteModule(updated);
    setupEvents(updated);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '투표에 실패했어요.');
  }
}

async function handleNamingSubmit(post) {
  const free = document.getElementById('multi-naming-free');
  const chars = [...document.querySelectorAll('.multi-name-char')];
  const text = free ? free.value.trim() : chars.map(input => input.value.trim()).join('');
  if (!text) {
    toast.warn('이름을 입력해주세요');
    return;
  }
  await addParticipation(post.id, 'naming', { text });
  toast.success('참여글을 올렸어요!');
  if (free) free.value = '';
  else chars.forEach(input => { input.value = ''; });
  await refreshList(post.id, 'naming');
}

async function handleFillSubmit(post) {
  const input = document.getElementById('multi-fill-answer');
  const text = input?.value.trim() || '';
  if (!text) {
    toast.warn('빈칸에 들어갈 말을 입력해주세요');
    return;
  }
  await addParticipation(post.id, 'fill', { text });
  toast.success('참여글을 올렸어요!');
  input.value = '';
  await refreshList(post.id, 'fill');
}

async function handleAcrosticSubmit(post) {
  const keyword = String(post.modules?.acrostic?.keyword || '');
  const values = [...document.querySelectorAll('.multi-acrostic-input')].map(input => input.value.trim());
  if (values.some(value => !value)) {
    toast.warn('모든 줄을 입력해주세요');
    return;
  }
  const lines = [...keyword].map((char, index) => ({ char, line: values[index] }));
  await addParticipation(post.id, 'acrostic', { text: lines.map(line => `${line.char}: ${line.line}`).join('\n'), lines });
  toast.success('참여글을 올렸어요!');
  document.querySelectorAll('.multi-acrostic-input').forEach(input => { input.value = ''; });
  await refreshList(post.id, 'acrostic');
}

async function handleRelaySubmit(post) {
  const input = document.getElementById('multi-relay-input');
  const text = input?.value.trim() || '';
  if (!text) {
    toast.warn('이어쓸 내용을 입력해주세요');
    return;
  }
  await addParticipation(post.id, 'relay', { text });
  toast.success('참여글을 올렸어요!');
  input.value = '';
  await refreshList(post.id, 'relay');
}

function setupEvents(post) {
  document.querySelectorAll('[data-multi-vote-idx]').forEach(btn => {
    btn.addEventListener('click', () => handleVote(post, Number(btn.dataset.multiVoteIdx)));
  });

  document.getElementById('multi-naming-submit')?.addEventListener('click', async () => {
    if (!requireLogin()) return;
    await handleNamingSubmit(post).catch(error => {
      console.error(error);
      toast.error('등록에 실패했어요.');
    });
  });

  document.getElementById('multi-fill-submit')?.addEventListener('click', async () => {
    if (!requireLogin()) return;
    await handleFillSubmit(post).catch(error => {
      console.error(error);
      toast.error('등록에 실패했어요.');
    });
  });

  document.getElementById('multi-acrostic-submit')?.addEventListener('click', async () => {
    if (!requireLogin()) return;
    await handleAcrosticSubmit(post).catch(error => {
      console.error(error);
      toast.error('등록에 실패했어요.');
    });
  });

  document.getElementById('multi-relay-submit')?.addEventListener('click', async () => {
    if (!requireLogin()) return;
    await handleRelaySubmit(post).catch(error => {
      console.error(error);
      toast.error('등록에 실패했어요.');
    });
  });

  document.getElementById('multi-quiz-submit')?.addEventListener('click', () => {
    const answer = document.getElementById('multi-quiz-answer')?.value.trim() || '';
    const correct = String(post.modules?.quiz?.answer || '').trim();
    if (!answer) {
      toast.warn('정답을 입력해주세요');
      return;
    }
    markQuizResult(normalizeAnswer(answer) === normalizeAnswer(correct));
  });

  document.querySelectorAll('[data-quiz-option]').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.textContent.trim();
      const correct = String(post.modules?.quiz?.answer || '').trim();
      document.querySelectorAll('[data-quiz-option]').forEach(optionBtn => optionBtn.classList.remove('selected'));
      btn.classList.add('selected');
      markQuizResult(normalizeAnswer(answer) === normalizeAnswer(correct));
    });
  });
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
      refreshList(post.id, 'acrostic'),
      refreshList(post.id, 'relay'),
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
