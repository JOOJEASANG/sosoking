import { auth, db } from './firebase.js';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { appState } from './state.js';
import { toast } from './components/toast.js';

function esc(value) {
  return String(value || '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
function postId() {
  const match = (location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
function timeText(value) {
  const date = value?.toDate?.() || value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '방금';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return '방금';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return date.toLocaleDateString('ko-KR');
}
function repliesRef(post, comment) {
  return collection(db, 'feeds', post, 'comments', comment, 'replies');
}
function renderReplies(items) {
  if (!items.length) return '<div class="participant-replies__empty">아직 답글이 없습니다.</div>';
  return items.map(item => `
    <div class="participant-reply">
      <div class="participant-reply__avatar">${esc((item.authorName || '?')[0])}</div>
      <div class="participant-reply__body">
        <div class="participant-reply__meta"><b>${esc(item.authorName || '익명')}</b><span>${timeText(item.createdAt)}</span></div>
        <div class="participant-reply__text">${esc(item.text || '').replace(/\n/g, '<br>')}</div>
      </div>
    </div>`).join('');
}
async function refresh(box, post, comment) {
  const list = box.querySelector('.participant-replies__list');
  list.innerHTML = '<div class="participant-replies__empty">불러오는 중...</div>';
  try {
    const snap = await getDocs(query(repliesRef(post, comment), orderBy('createdAt', 'asc')));
    list.innerHTML = renderReplies(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
  } catch {
    list.innerHTML = '<div class="participant-replies__empty">답글을 불러오지 못했습니다.</div>';
  }
}
function createReplyBox(card, post, comment) {
  let box = card.querySelector(':scope > .participant-replies');
  if (box) return box;
  box = document.createElement('div');
  box.className = 'participant-replies';
  box.innerHTML = `
    <div class="participant-replies__list"></div>
    <div class="participant-replies__form">
      <input class="participant-replies__input" maxlength="500" placeholder="답글을 입력하세요">
      <button class="participant-replies__submit" type="button">등록</button>
    </div>`;
  card.appendChild(box);
  const input = box.querySelector('.participant-replies__input');
  const button = box.querySelector('.participant-replies__submit');
  const send = async () => {
    if (!auth.currentUser) return navigate('/login');
    const text = input.value.trim();
    if (!text) return toast.warn('답글을 입력해주세요.');
    button.disabled = true;
    try {
      await addDoc(repliesRef(post, comment), {
        text: text.slice(0, 500),
        authorId: auth.currentUser.uid,
        authorName: appState.nickname || auth.currentUser.displayName || '익명',
        authorPhoto: auth.currentUser.isAnonymous ? '' : (auth.currentUser.photoURL || ''),
        createdAt: serverTimestamp(),
      });
      input.value = '';
      toast.success('답글을 등록했어요.');
      await refresh(box, post, comment);
    } catch {
      toast.error('답글 등록에 실패했어요.');
    } finally {
      button.disabled = false;
    }
  };
  button.addEventListener('click', send);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });
  return box;
}
function bindReplies() {
  const post = postId();
  if (!post) return;
  document.querySelectorAll('[data-comment-id]').forEach(card => {
    if (card.dataset.replyReady === '1') return;
    const comment = card.dataset.commentId;
    if (!comment || comment.startsWith('temp-')) return;
    const actions = card.querySelector('.likeable-comment__actions, .comment-item__meta');
    if (!actions) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'participant-reply-toggle';
    button.textContent = '답글';
    button.addEventListener('click', async () => {
      const box = createReplyBox(card, post, comment);
      box.classList.toggle('open');
      if (box.classList.contains('open')) await refresh(box, post, comment);
    });
    actions.appendChild(button);
    card.dataset.replyReady = '1';
  });
}
let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(bindReplies, 160); }
window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
schedule();
