import { auth, db } from './firebase.js';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { awardPoints } from './utils/points.js';

function getDetailId() {
  const match = (location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function isDetailPage() {
  return !!getDetailId() && !!document.querySelector('.detail-header');
}

function ensureCommentForm() {
  if (!isDetailPage()) return;
  const postId = getDetailId();
  const card = document.querySelector('#page-content .card');
  if (!card || card.querySelector('[data-safe-comment-form]')) return;

  const html = `
    <div data-safe-comment-form style="padding:20px;border-top:1px solid var(--color-border-light)">
      <div style="font-size:15px;font-weight:900;margin-bottom:10px">댓글 작성</div>
      ${auth.currentUser ? `
        <textarea id="safe-comment-text" class="form-textarea" rows="3" maxlength="500" placeholder="댓글을 입력하세요"></textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="btn btn--primary btn--sm" id="safe-comment-submit">댓글 등록</button>
        </div>` : `
        <div class="empty-state__desc" style="text-align:left;margin-bottom:10px">로그인한 회원은 댓글을 작성할 수 있어요.</div>
        <button class="btn btn--primary btn--sm" id="safe-comment-login">로그인하기</button>`}
    </div>`;

  card.insertAdjacentHTML('beforeend', html);
  document.getElementById('safe-comment-login')?.addEventListener('click', () => navigate('/login'));
  document.getElementById('safe-comment-submit')?.addEventListener('click', async () => {
    const input = document.getElementById('safe-comment-text');
    const text = input?.value.trim() || '';
    if (!text) {
      toast.warn('댓글을 입력해주세요');
      return;
    }
    const btn = document.getElementById('safe-comment-submit');
    try {
      btn.disabled = true;
      btn.textContent = '등록 중...';
      const user = auth.currentUser;
      await addDoc(collection(db, 'feeds', postId, 'comments'), {
        text,
        authorId: user.uid,
        authorName: appState.nickname || user.displayName || user.email?.split('@')[0] || '익명',
        authorPhoto: user.photoURL || '',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(1) }).catch(() => {});
      await awardPoints('comment_create', { postId, onceKey: `comment:${postId}:${Date.now()}` }).catch(() => {});
      toast.success('댓글을 등록했어요');
      input.value = '';
      location.reload();
    } catch (error) {
      console.error(error);
      toast.error(error.message || '댓글 등록에 실패했어요');
      btn.disabled = false;
      btn.textContent = '댓글 등록';
    }
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureCommentForm, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
