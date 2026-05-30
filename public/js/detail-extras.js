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
  // 기존 댓글 섹션이 이미 있으면 중복 추가하지 않음
  if (document.getElementById('comment-write') || document.querySelector('.comment-section')) return;

  const loggedIn = !!auth.currentUser;
  const html = `
    <div data-safe-comment-form class="detail-comment-box">
      <div class="detail-comment-box__head">
        <div>
          <div class="detail-comment-box__title">댓글로 의견 남기기</div>
          <div class="detail-comment-box__desc">댓글로 의견을 남기고 다른 사람들과 이야기를 이어갈 수 있어요.</div>
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
      window.dispatchEvent(new Event('hashchange'));
    } catch (error) {
      console.error(error);
      toast.error(error.message || '댓글 등록에 실패했어요');
      btn.disabled = false;
      btn.textContent = '댓글 등록';
    }
  });
}

function safeVideoId(value) {
  const raw = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(raw) ? raw : '';
}

function extractYoutubeId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.match(/(?:youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (direct) return direct[1];
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') return safeVideoId(url.pathname.split('/').filter(Boolean)[0]);
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (url.pathname.startsWith('/watch')) return safeVideoId(url.searchParams.get('v'));
      if (url.pathname.startsWith('/shorts/')) return safeVideoId(url.pathname.split('/')[2]);
      if (url.pathname.startsWith('/embed/')) return safeVideoId(url.pathname.split('/')[2]);
    }
  } catch {}
  return '';
}

function findVideoId(post = {}) {
  const youtube = post.modules?.youtube || {};
  return safeVideoId(youtube.videoId)
    || extractYoutubeId(youtube.url)
    || extractYoutubeId(youtube.embedUrl)
    || extractYoutubeId(post.youtubeUrl)
    || extractYoutubeId(post.videoUrl)
    || extractYoutubeId(post.desc)
    || '';
}

function renderYoutube(id) {
  const src = `https://www.youtube.com/embed/${id}`;
  return `
    <div class="detail-youtube-wrap detail-youtube-wrap--fallback" data-youtube-fallback="${id}">
      <iframe class="detail-youtube-frame" src="${src}" title="YouTube video player" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
}

async function ensureYoutube() {
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root || !root.querySelector('.detail-header')) return;
  if (root.querySelector('.detail-youtube-wrap')) return;
  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    const id = findVideoId(post);
    if (!id) return;
    const anchor = root.querySelector('.detail-gallery') || root.querySelector('.detail-header');
    anchor?.insertAdjacentHTML('afterend', renderYoutube(id));
  } catch (error) {
    console.warn('[detail-extras] youtube fallback failed', error);
  }
}

function runDetailExtras() {
  ensureCommentForm();
  ensureYoutube();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runDetailExtras, 160);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
