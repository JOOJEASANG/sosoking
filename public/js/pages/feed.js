import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams, navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { normalizeFeedSort, postMatchesType, postMatchesSearch, sortFeedPosts } from '../feed/filter.js';
import { renderFeedSearchBar, renderFeedFilterBar, renderFeedEmptyState, updateFeedFilterUI, renderFeedSummary } from '../feed/render.js';

const PAGE_SIZE = 10;
const FETCH_LIMIT = 300;

let currentType = '';
let currentSearch = '';
let currentSort = 'latest';
let currentPage = 1;
let cachedPosts = [];
let isLoading = false;

export async function renderFeed() {
  isLoading = false;
  setMeta('피드');
  const el = document.getElementById('page-content');
  const params = getQueryParams();
  currentType = params.type || '';
  currentSearch = params.q || '';
  currentSort = normalizeFeedSort(params.sort);
  currentPage = Math.max(1, Number(params.page || 1));
  cachedPosts = [];

  el.innerHTML = `
    <div class="layout-main layout-main--full feed-page-clean">
      ${renderFeedSearchBar({ search: currentSearch })}
      ${renderFeedFilterBar({ type: currentType, search: currentSearch, sort: currentSort })}
      <div id="feed-summary" class="feed-result-summary"></div>
      <div id="feed-list">${renderSkeletonCards(5)}</div>
      <div id="feed-pagination" class="feed-pagination"></div>
      <div id="feed-loader" class="loading-center" style="display:none"><div class="spinner"></div></div>
    </div>`;

  bindFeedEvents();
  await loadPosts();
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
    currentPage = 1;
    refreshFeed();
    if (currentSearch) clearBtn?.style.setProperty('display', 'inline-flex');
  };
  searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  searchBtn?.addEventListener('click', doSearch);
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSearch = '';
    currentPage = 1;
    refreshFeed();
    clearBtn.style.display = 'none';
  });
}

function bindTypeFilterEvents() {
  document.querySelectorAll('[data-type-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.typeFilter;
      currentSearch = '';
      currentPage = 1;
      const searchInput = document.getElementById('feed-search-input');
      if (searchInput) searchInput.value = '';
      refreshFeed();
    });
  });
}

function bindSortEvents() {
  document.getElementById('feed-sort-select')?.addEventListener('change', event => {
    currentSort = normalizeFeedSort(event.target.value || 'latest');
    currentPage = 1;
    refreshFeed();
  });
}

function refreshFeed() {
  updateUrlState();
  updateFeedFilterUI({ type: currentType, search: currentSearch, sort: currentSort });
  loadPosts();
}

function updateUrlState() {
  const params = new URLSearchParams();
  if (currentType) params.set('type', currentType);
  if (currentSearch) params.set('q', currentSearch);
  if (currentSort && currentSort !== 'latest') params.set('sort', currentSort);
  if (currentPage > 1) params.set('page', String(currentPage));
  const next = params.toString() ? `#/feed?${params.toString()}` : '#/feed';
  if (window.location.hash !== next) history.replaceState(null, '', next);
}

function buildQueryConstraints() {
  return [orderBy('createdAt', 'desc'), limit(FETCH_LIMIT)];
}

async function loadPosts() {
  if (isLoading) return;
  isLoading = true;
  const loaderEl = document.getElementById('feed-loader');
  const listEl = document.getElementById('feed-list');
  if (loaderEl) loaderEl.style.display = 'flex';
  if (listEl) listEl.innerHTML = renderSkeletonCards(3);

  try {
    const snap = await getDocs(query(collection(db, 'feeds'), ...buildQueryConstraints()));
    cachedPosts = sortFeedPosts(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(post => !post.hidden)
        .filter(post => postMatchesSearch(post, currentSearch))
        .filter(post => currentSearch ? true : postMatchesType(post, currentType)),
      currentSort,
    );
    renderCurrentPage();
  } catch (error) {
    console.error('피드 로드 실패', error);
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">피드를 불러오지 못했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요.</div></div>`;
  }

  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

function renderCurrentPage() {
  const listEl = document.getElementById('feed-list');
  const summaryEl = document.getElementById('feed-summary');
  if (!listEl) return;
  const totalPages = Math.max(1, Math.ceil(cachedPosts.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pagePosts = cachedPosts.slice(start, start + PAGE_SIZE);

  if (summaryEl) {
    summaryEl.innerHTML = renderFeedSummary({ total: cachedPosts.length, page: currentPage, totalPages, search: currentSearch, type: currentType, sort: currentSort });
  }

  if (!pagePosts.length) listEl.innerHTML = renderFeedEmptyState({ search: currentSearch });
  else listEl.innerHTML = pagePosts.map(post => renderFeedCard(post)).join('');

  renderPagination(totalPages);
  updateUrlState();
}

function renderPagination(totalPages) {
  const el = document.getElementById('feed-pagination');
  if (!el) return;
  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }
  const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
  const end = Math.min(totalPages, start + 4);
  el.innerHTML = `
    <button class="feed-page-btn" data-feed-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전</button>
    <div class="feed-page-numbers">
      ${Array.from({ length: end - start + 1 }, (_, i) => start + i).map(page => `<button class="feed-page-num ${page === currentPage ? 'active' : ''}" data-feed-page="${page}">${page}</button>`).join('')}
    </div>
    <button class="feed-page-btn" data-feed-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음</button>`;
  el.querySelectorAll('[data-feed-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.feedPage;
      if (value === 'prev') currentPage -= 1;
      else if (value === 'next') currentPage += 1;
      else currentPage = Number(value || 1);
      renderCurrentPage();
      document.querySelector('.feed-page-clean')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
