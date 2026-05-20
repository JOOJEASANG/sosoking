import { db } from '../firebase.js';
import { collection, query, orderBy, limit, startAfter, getDocs, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams, navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { normalizeFeedSort, postMatchesType, sortFeedPosts } from '../feed/filter.js';
import { renderFeedSearchBar, renderFeedFilterBar, renderFeedEmptyState, updateFeedFilterUI } from '../feed/render.js';

let lastDoc        = null;
let currentType    = '';
let currentSearch  = '';
let currentSort    = 'latest';
let isLoading      = false;
let scrollObserver = null;

export async function renderFeed() {
  setMeta('피드');
  resetFeedState();

  const el = document.getElementById('page-content');
  const params = getQueryParams();
  currentType   = params.type || '';
  currentSearch = params.q || '';
  currentSort   = normalizeFeedSort(params.sort);

  el.innerHTML = `
    <div class="layout-main layout-main--full feed-page-clean">
      ${renderFeedSearchBar({ search: currentSearch })}
      ${renderFeedFilterBar({ type: currentType, search: currentSearch, sort: currentSort })}
      <div id="feed-list">${renderSkeletonCards(5)}</div>
      <div id="feed-loader" class="loading-center" style="display:none"><div class="spinner"></div></div>
      <div id="feed-end" style="display:none;text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">여기까지 다 봤어요 👀</div>
    </div>`;

  bindFeedEvents();
  await loadPosts(true);
  setupInfiniteScroll();
}

function resetFeedState() {
  isLoading = false;
  lastDoc = null;
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }
}

function bindFeedEvents() {
  document.getElementById('btn-feed-write')?.addEventListener('click', () => navigate('/write?type=multi'));
  bindSearchEvents();
  bindTypeFilterEvents();
  bindSortEvents();
}

function bindSearchEvents() {
  const searchInput = document.getElementById('feed-search-input');
  const searchBtn = document.getElementById('btn-feed-search');
  const clearBtn = document.getElementById('search-clear-btn');

  const doSearch = () => {
    currentSearch = searchInput?.value.trim() || '';
    currentType = '';
    refreshFeed();
    if (currentSearch) clearBtn?.style.setProperty('display', 'inline-flex');
  };

  searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  searchBtn?.addEventListener('click', doSearch);
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSearch = '';
    refreshFeed();
    clearBtn.style.display = 'none';
  });
}

function bindTypeFilterEvents() {
  document.querySelectorAll('[data-type-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.typeFilter;
      currentSearch = '';
      const searchInput = document.getElementById('feed-search-input');
      if (searchInput) searchInput.value = '';
      refreshFeed();
    });
  });
}

function bindSortEvents() {
  document.querySelectorAll('[data-feed-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = normalizeFeedSort(btn.dataset.feedSort || 'latest');
      refreshFeed();
    });
  });
}

function refreshFeed() {
  lastDoc = null;
  updateUrlState();
  updateFeedFilterUI({ type: currentType, search: currentSearch, sort: currentSort });
  loadPosts(true);
}

function updateUrlState() {
  const params = new URLSearchParams();
  if (currentType) params.set('type', currentType);
  if (currentSearch) params.set('q', currentSearch);
  if (currentSort && currentSort !== 'latest') params.set('sort', currentSort);
  const next = params.toString() ? `#/feed?${params.toString()}` : '#/feed';
  if (window.location.hash !== next) history.replaceState(null, '', next);
}

function buildFeedQueryConstraints(reset) {
  if (currentSearch) {
    const qEnd = currentSearch.slice(0, -1) + String.fromCharCode(currentSearch.charCodeAt(currentSearch.length - 1) + 1);
    const constraints = [where('title', '>=', currentSearch), where('title', '<', qEnd), orderBy('title'), limit(40)];
    if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
    return { constraints, pageSize: 40 };
  }

  const pageSize = currentType || currentSort !== 'latest' ? 80 : 15;
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
  if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
  return { constraints, pageSize };
}

async function loadPosts(reset = false) {
  if (isLoading) return;
  isLoading = true;

  const loaderEl = document.getElementById('feed-loader');
  const listEl = document.getElementById('feed-list');
  const endEl = document.getElementById('feed-end');

  if (loaderEl) loaderEl.style.display = 'flex';
  if (reset && endEl) endEl.style.display = 'none';

  try {
    const { constraints, pageSize } = buildFeedQueryConstraints(reset);
    const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));

    if (reset && listEl) listEl.innerHTML = '';

    const visiblePosts = sortFeedPosts(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(post => !post.hidden)
        .filter(post => currentSearch ? true : postMatchesType(post, currentType)),
      currentSort,
    );

    renderFeedResults({ snap, visiblePosts, listEl, endEl, reset, pageSize });
  } catch (e) {
    console.error('피드 로드 실패', e);
    if (reset && listEl) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">피드를 불러오지 못했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요.</div></div>`;
    }
  }

  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

function renderFeedResults({ snap, visiblePosts, listEl, endEl, reset, pageSize }) {
  if (snap.empty && reset) {
    if (listEl) listEl.innerHTML = renderFeedEmptyState({ search: currentSearch });
    if (endEl) endEl.style.display = 'block';
    return;
  }

  visiblePosts.forEach(post => {
    if (listEl) listEl.insertAdjacentHTML('beforeend', renderFeedCard(post));
  });

  if (visiblePosts.length === 0 && reset && listEl) {
    listEl.innerHTML = renderFeedEmptyState({ search: currentSearch });
  }

  lastDoc = snap.docs[snap.docs.length - 1];
  if (snap.docs.length < pageSize && endEl) endEl.style.display = 'block';
}

function setupInfiniteScroll() {
  const sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  document.getElementById('feed-list')?.after(sentinel);

  scrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !isLoading) loadPosts(false);
  }, { rootMargin: '200px' });

  scrollObserver.observe(sentinel);
}
