import { db } from './firebase.js';
import { collection, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';

const STORE_KEY = 'sosoking:detailPostNav';
const MAX_NAV_POSTS = 120;

function detailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function readStoredIds() {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
    return Array.isArray(data.ids) ? data.ids.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ ids: ids.filter(Boolean), savedAt: Date.now() }));
  } catch {}
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
  if (ids.length) writeStoredIds(ids);
}

async function fallbackIds(currentId) {
  try {
    const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(MAX_NAV_POSTS)));
    const ids = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.hidden)
      .map(p => p.id);
    if (ids.length) writeStoredIds(ids);
    return ids.includes(currentId) ? ids : [currentId, ...ids.filter(id => id !== currentId)];
  } catch {
    return [currentId];
  }
}

function navHtml(index, total) {
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;
  return `
    <div class="detail-post-nav" data-detail-post-nav="1">
      <button class="detail-post-nav__btn detail-post-nav__btn--prev" type="button" data-detail-nav="prev" ${hasPrev ? '' : 'disabled'}>← 이전글</button>
      <div class="detail-post-nav__count">${total ? `${index + 1} / ${total}` : '글 이동'}</div>
      <button class="detail-post-nav__btn detail-post-nav__btn--next" type="button" data-detail-nav="next" ${hasNext ? '' : 'disabled'}>다음글 →</button>
    </div>
    <div class="detail-swipe-hint">모바일에서는 화면을 좌우로 밀어 이전글/다음글을 볼 수 있어요.</div>`;
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
  captureVisibleFeedList();
  const currentId = detailId();
  if (!currentId) return;
  const detailRoot = document.querySelector('[data-detail-root]');
  if (!detailRoot || detailRoot.querySelector('[data-detail-post-nav]')) return;

  let ids = readStoredIds();
  if (!ids.includes(currentId)) ids = await fallbackIds(currentId);
  const index = ids.indexOf(currentId);
  if (index < 0) return;

  detailRoot.insertAdjacentHTML('afterbegin', navHtml(index, ids.length));
  detailRoot.querySelector('[data-detail-nav="prev"]')?.addEventListener('click', () => goBy(ids, currentId, -1));
  detailRoot.querySelector('[data-detail-nav="next"]')?.addEventListener('click', () => goBy(ids, currentId, 1));
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
