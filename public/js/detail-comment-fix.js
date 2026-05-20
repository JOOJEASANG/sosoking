import { auth, db } from './firebase.js';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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

async function getAuthorName(user) {
  const cached = appState.nickname || user.displayName || user.email?.split('@')[0] || '';
  if (cached && cached !== '익명') return cached;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.exists() ? snap.data() : {};
    const nickname = data.nickname || data.displayName || data.name || cached || user.email?.split('@')[0] || '익명';
    appState.nickname = nickname;
    return nickname;
  } catch {
    return cached || '익명';
  }
}

function ensureCommentForm() {
  if (!isDetailPage()) return;
  const postId = getDetailId();
  const card = document.querySelector('#page-content .card');
  if (!card || card.querySelector('[data-safe-comment-form]')) return;

  const loggedIn = !!auth.currentUser;
  const html = `
    <div data-safe-comment-form class="detail-comment-box">
      <div class="detail-comment-box__head">
        <div>
          <div class="detail-comment-box__title">댓글로 의견 남기기</div>
          <div class="detail-comment-box__desc">투표/판정 글은 댓글로 토론까지 이어갈 수 있어요.</div>
        </div>
      </div>
      ${loggedIn ? `
        <textarea id="safe-comment-text" class="form-textarea" rows="3" maxlength="500" placeholder="댓글을 입력하세요. 비방이나 개인정보 노출은 피해주세요."></textarea>
        <div class="detail-comment-box__actions">
          <span class="form-hint">등록하면 닉네임이 함께 표시됩니다.</span>
          <button class="btn btn--primary btn--sm" id="safe-comment-submit">댓글 등록</button>
        </div>` : `
        <div class="detail-login-cta">
          <div><b>로그인하면 참여할 수 있어요</b><span>댓글, 답글, 참여글 등록과 포인트 적립이 가능합니다.</span></div>
          <button class="btn btn--primary btn--sm" id="safe-comment-login">로그인하기</button>
        </div>`}
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
      const authorName = await getAuthorName(user);
      await addDoc(collection(db, 'feeds', postId, 'comments'), {
        text,
        authorId: user.uid,
        authorName,
        authorEmail: user.email || '',
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
