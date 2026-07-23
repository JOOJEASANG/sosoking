import { auth, db } from './firebase.js';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, updateDoc, increment, doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { appState } from './state.js';
import { toast } from './components/toast.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

function getDetailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function timeText(value) {
  const date = value?.toDate?.() || value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '방금';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return date.toLocaleDateString('ko-KR');
}

function targetType(el) {
  if (el.classList.contains('acrostic-card')) return 'acrostics';
  return 'comments';
}

function targetId(el) {
  return el.dataset.commentId || el.dataset.acrosticId || '';
}

function replyCollection(postId, type, id) {
  return collection(db, 'feeds', postId, type, id, 'replies');
}

function renderReplies(replies) {
  if (!replies.length) return `<div class="participant-replies__empty">아직 답글이 없습니다.</div>`;
  return replies.map(r => `
    <div class="participant-reply" data-reply-id="${esc(r.id)}">
      <div class="participant-reply__avatar">${esc((r.authorName || '?')[0])}</div>
      <div class="participant-reply__body">
        <div class="participant-reply__meta"><b>${esc(r.authorName || '익명')}</b><span>${timeText(r.createdAt)}</span></div>
        <div class="participant-reply__text">${esc(r.text || '').replace(/\n/g, '<br>')}</div>
      </div>
    </div>`).join('');
}

async function fetchReplies(postId, type, id) {
  const snap = await getDocs(query(replyCollection(postId, type, id), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function refreshReplies(box, postId, type, id) {
  const list = box.querySelector('.participant-replies__list');
  if (!list) return;
  list.innerHTML = `<div class="participant-replies__empty">불러오는 중...</div>`;
  try {
    const replies = await fetchReplies(postId, type, id);
    list.innerHTML = renderReplies(replies);
    const count = box.closest('[data-comment-id], [data-acrostic-id]')?.querySelector('[data-reply-count]');
    if (count) count.textContent = replies.length ? replies.length : '';
  } catch {
    list.innerHTML = `<div class="participant-replies__empty">답글을 불러오지 못했어요.</div>`;
  }
}

function ensureReplyBox(card, postId) {
  const type = targetType(card);
  const id = targetId(card);
  if (!id || id.startsWith('temp-')) return null;
  let box = card.querySelector(':scope > .participant-replies');
  if (box) return box;

  box = document.createElement('div');
  box.className = 'participant-replies';
  box.innerHTML = `
    <div class="participant-replies__list"></div>
    <div class="participant-replies__form">
      <input class="participant-replies__input" maxlength="300" placeholder="답글을 입력하세요">
      <button class="participant-replies__submit" type="button">등록</button>
    </div>`;
  card.appendChild(box);

  const input = box.querySelector('.participant-replies__input');
  const submit = box.querySelector('.participant-replies__submit');
  const send = async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const text = input.value.trim();
    if (!text) { toast.warn('답글을 입력해주세요'); return; }
    submit.disabled = true;
    submit.textContent = '등록 중';
    try {
      await addDoc(replyCollection(postId, type, id), {
        text,
        authorId: auth.currentUser.uid,
        authorName: appState.nickname || auth.currentUser.displayName || '익명',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'feeds', postId, type, id), { replyCount: increment(1) }).catch(() => {});
      input.value = '';
      toast.success('답글을 남겼어요');
      await refreshReplies(box, postId, type, id);
    } catch (error) {
      console.error(error);
      toast.error('답글 등록에 실패했어요');
    } finally {
      submit.disabled = false;
      submit.textContent = '등록';
    }
  };
  submit.addEventListener('click', send);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  return box;
}

function addReplyActions() {
  const postId = getDetailId();
  if (!postId) return;

  document.querySelectorAll('.likeable-comment, .comment-item, .cbattle-comment, .acrostic-card').forEach(card => {
    if (card.dataset.replyActionReady === '1') return;
    const id = targetId(card);
    if (!id || id.startsWith('temp-')) return;

    const actions = card.querySelector('.likeable-comment__actions')
      || card.querySelector('.comment-item__meta')
      || card.querySelector('.cbattle-comment__meta')
      || card.querySelector('.acrostic-card__footer');
    if (!actions) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'participant-reply-toggle';
    btn.innerHTML = `답글 <b data-reply-count>${Number(card.dataset.replyCount || 0) || ''}</b>`;
    btn.addEventListener('click', async () => {
      const box = ensureReplyBox(card, postId);
      if (!box) return;
      const willOpen = !box.classList.contains('open');
      box.classList.toggle('open', willOpen);
      if (willOpen) {
        btn.classList.add('active');
        await refreshReplies(box, postId, targetType(card), id);
        box.querySelector('.participant-replies__input')?.focus();
      } else {
        btn.classList.remove('active');
      }
    });
    actions.appendChild(btn);
    card.dataset.replyActionReady = '1';
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(addReplyActions, 160);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 600);
