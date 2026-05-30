import { db } from './firebase.js';
import { collection, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';

const STORE_KEY = 'sosoking:detailPostNav';
const FEED_CONTEXT_KEY = 'sosoking:feedNavContext';
const MAX_NAV_POSTS = 120;

function detailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function readJson(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch { return {}; }
}

function readContext() {
  const direct = readJson(STORE_KEY);
  const feed = readJson(FEED_CONTEXT_KEY);
  const ids = Array.isArray(direct.ids) && direct.ids.length
    ? direct.ids.filter(Boolean)
    : Array.isArray(feed.ids) ? feed.ids.filter(Boolean) : [];
  const type = direct.type ?? feed.type ?? '';
  const collectKind = direct.collectKind ?? feed.collectKind ?? '';
  return { ...feed, ...direct, ids, type, collectKind };
}

function labelForContext(ctx = {}) {
  if (ctx.type === 'tournament') return '대결방';
  if (ctx.type === 'collect') return '일반방';
  if (ctx.type === 'vote') return '토론방';
  if (ctx.type === 'quiz') return '퀴즈방';
  if (ctx.type === 'drip') return '드립방';
  return '전체글';
}

function writeStoredContext(ctx = {}) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({
      ids: Array.isArray(ctx.ids) ? ctx.ids.filter(Boolean) : [],
      type: ctx.type || '',
      collectKind: ctx.collectKind || '',
      label: labelForContext(ctx),
      savedAt: Date.now(),
    }));
  } catch {}
}

function injectMobileCommentStyle() {
  if (document.getElementById('sosoking-mobile-comment-fix')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-mobile-comment-fix';
  style.textContent = `
    @media (max-width: 640px) {
      .comment-write-box {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        width: 100% !important;
        min-width: 0 !important;
      }
      .comment-write-box #comment-guest-name,
      .comment-write-box #comment-input,
      .comment-write-box textarea,
      .comment-write-box .form-input {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }
      .comment-write-box #comment-input,
      .comment-write-box textarea {
        min-height: 108px !important;
        resize: vertical !important;
      }
      .comment-write-box #btn-comment {
        width: 100% !important;
        align-self: stretch !important;
        justify-content: center !important;
      }
    }`;
  document.head.appendChild(style);
}

function captureVisibleFeedList() {
  const list = document.getElementById('feed-list');
  if (!list) return;
  const ids = [...list.querySelectorAll('[onclick*="/detail/"]')]
    .map(el => {
      const raw = el.getAttribute('onclick') || '';
      const match = raw.match(/\/detail\/([^'"\)]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    })
    .filter(Boolean);
  if (!ids.length) return;
  const feed = readJson(FEED_CONTEXT_KEY);
  writeStoredContext({ ...feed, ids });
}

function legacyMatchesContext(post, ctx = {}) {
  if (!ctx.type) return true;
  if (post.feedType === ctx.type) return true;
  if (ctx.type === 'collect') return post.type === 'multi' && (post.subtype === 'collect' || post.modules?.collect?.enabled);
  if (ctx.type === 'vote') return post.modules?.vote?.enabled || post.subtype === 'vote';
  if (ctx.type === 'quiz') return post.modules?.quiz?.enabled || post.subtype === 'quiz';
  if (ctx.type === 'drip') return post.modules?.drip?.enabled || post.subtype === 'drip';
  return true;
}

async function fallbackIds(currentId, ctx = {}) {
  try {
    const constraints = [orderBy('createdAt', 'desc'), limit(MAX_NAV_POSTS)];
    if (ctx.type) constraints.unshift(where('feedType', '==', ctx.type));
    const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
    let posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
    if (ctx.type) posts = posts.filter(p => legacyMatchesContext(p, ctx));
    if (ctx.type === 'collect' && ctx.collectKind) {
      posts = posts.filter(p => p.modules?.collect?.kind === ctx.collectKind);
    }
    const ids = posts.map(p => p.id);
    if (ids.length) writeStoredContext({ ...ctx, ids });
    return ids.includes(currentId) ? ids : [currentId, ...ids.filter(id => id !== currentId)];
  } catch {
    return [currentId];
  }
}

function navHtml(index, total, ctx, postId) {
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;
  const label = labelForContext(ctx);
  return `
    <div class="detail-post-nav" data-detail-post-nav="1" data-for-post-id="${postId || ''}" data-detail-nav-scope="${label}">
      <button class="detail-post-nav__btn detail-post-nav__btn--prev" type="button" data-detail-nav="prev" aria-label="이전글" ${hasPrev ? '' : 'disabled'}>‹ 이전글</button>
      <button class="detail-post-nav__btn detail-post-nav__btn--list" type="button" data-detail-nav="list" aria-label="목록으로">목록으로</button>
      <button class="detail-post-nav__btn detail-post-nav__btn--next" type="button" data-detail-nav="next" aria-label="다음글" ${hasNext ? '' : 'disabled'}>다음글 ›</button>
    </div>`;
}

function goBy(ids, currentId, direction) {
  const index = ids.indexOf(currentId);
  const nextId = ids[index + direction];
  if (nextId) navigate(`/detail/${encodeURIComponent(nextId)}`);
}

function bindSwipe(ids, currentId, root) {
  if (!root || root.dataset.detailSwipeReady === '1') return;
  root.dataset.detailSwipeReady = '1';
  let startX = 0;
  let startY = 0;
  root.addEventListener('touchstart', event => {
    const t = event.touches?.[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });
  root.addEventListener('touchend', event => {
    const t = event.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0) goBy(ids, currentId, 1);
    else goBy(ids, currentId, -1);
  }, { passive: true });
}

async function ensureDetailNav() {
  injectMobileCommentStyle();
  captureVisibleFeedList();
  const currentId = detailId();
  const existingNav = document.querySelector('[data-detail-post-nav]');

  if (!currentId) {
    existingNav?.remove();
    return;
  }

  const detailRoot = document.querySelector('[data-detail-root]');
  if (!detailRoot) {
    existingNav?.remove();
    return;
  }

  // Re-use existing nav if it already belongs to this post
  const currentPostId = detailRoot.dataset.postId || '';
  if (existingNav && existingNav.dataset.forPostId === currentPostId) return;
  existingNav?.remove();

  const ctx = readContext();
  let ids = ctx.ids || [];
  if (!ids.includes(currentId)) ids = await fallbackIds(currentId, ctx);
  const index = ids.indexOf(currentId);
  if (index < 0) return;

  // Attach to body so position:fixed works regardless of parent overflow/transform
  document.body.insertAdjacentHTML('beforeend', navHtml(index, ids.length, ctx, currentPostId));
  const navEl = document.querySelector('[data-detail-post-nav]');
  navEl.querySelector('[data-detail-nav="prev"]')?.addEventListener('click', () => goBy(ids, currentId, -1));
  navEl.querySelector('[data-detail-nav="next"]')?.addEventListener('click', () => goBy(ids, currentId, 1));
  navEl.querySelector('[data-detail-nav="list"]')?.addEventListener('click', () => navigate('/feed'));
  bindSwipe(ids, currentId, detailRoot);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureDetailNav, 220);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
