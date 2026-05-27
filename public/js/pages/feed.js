import { db } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, startAfter, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import {
  normalizeFeedSort, postMatchesType, postMatchesSearch, sortFeedPosts,
} from '../feed/filter.js';
import {
  renderFeedSearchBar, renderFeedFilterBar, renderFeedEmptyState,
  updateFeedFilterUI, renderFeedSummary,
} from '../feed/render.js';

const PAGE_SIZE    = 20;
const FILTER_LIMIT = 120; // 검색/호환 필터 시 서버 로드 최대치

let currentType   = '';
let currentSearch = '';
let currentSort   = 'latest';
let currentPage   = 1;
let isLoading     = false;

let cursorStack   = [];
let cursorTotal   = 0;
let cachedPosts   = [];

function useCursorMode() {
  return !currentType && !currentSearch && currentSort === 'latest';
}

export async function renderFeed() {
  isLoading = false;
  setMeta('피드');
  const el     = document.getElementById('page-content');
  if (!el) return;
  const params = getQueryParams();
  currentType   = params.type  || '';
  currentSearch = params.q     || '';
  currentSort   = normalizeFeedSort(params.sort);
  currentPage   = Math.max(1, Number(params.page || 1));

  cursorStack = [];
  cursorTotal = 0;
  cachedPosts = [];

  el.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean">
      <div class="soso-feed-toolbar">
        ${renderFeedSearchBar({ search: currentSearch })}
        ${renderFeedFilterBar({ type: currentType, search: currentSearch })}
      </div>
      <div id="feed-summary" class="soso-feed-summary feed-result-summary"></div>
      <div id="feed-list">${renderSkeletonCards(5)}</div>
      <div id="feed-pagination" class="feed-pagination"></div>
      <div id="feed-loader" class="loading-center" style="display:none"><div class="spinner"></div></div>
    </div>`;

  bindFeedEvents();
  await loadPosts();
}

function bindFeedEvents() {
  bindSearchEvents();
  bindTypeFilterEvents();
}

function bindSearchEvents() {
  const searchInput = document.getElementById('feed-search-input');
  const searchBtn   = document.getElementById('btn-feed-search');
  const clearBtn    = document.getElementById('search-clear-btn');
  const doSearch = () => {
    currentSearch = searchInput?.value.trim() || '';
    currentType   = '';
    currentPage   = 1;
    refreshFeed();
    clearBtn?.style.setProperty('display', currentSearch ? 'inline-flex' : 'none');
  };
  searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  searchBtn?.addEventListener('click', doSearch);
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSearch = '';
    currentPage   = 1;
    refreshFeed();
    clearBtn.style.display = 'none';
  });
}

function bindTypeFilterEvents() {
  document.querySelectorAll('[data-type-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType   = btn.dataset.typeFilter;
      currentSearch = '';
      currentPage   = 1;
      const si = document.getElementById('feed-search-input');
      if (si) si.value = '';
      refreshFeed();
    });
  });
}

function bindSortEvents() {
  const select = document.getElementById('feed-sort-select');
  if (!select || select.dataset.bound === '1') return;
  select.dataset.bound = '1';
  select.addEventListener('change', e => {
    currentSort = normalizeFeedSort(e.target.value || 'latest');
    currentPage = 1;
    refreshFeed();
  });
}

function refreshFeed() {
  cursorStack = [];
  cursorTotal = 0;
  cachedPosts = [];
  updateUrlState();
  updateFeedFilterUI({ type: currentType, search: currentSearch, sort: currentSort });
  loadPosts();
}

function updateUrlState() {
  const params = new URLSearchParams();
  if (currentType)                             params.set('type', currentType);
  if (currentSearch)                           params.set('q', currentSearch);
  if (currentSort && currentSort !== 'latest') params.set('sort', currentSort);
  if (currentPage > 1)                         params.set('page', String(currentPage));
  const next = params.toString() ? `#/feed?${params.toString()}` : '#/feed';
  if (window.location.hash !== next) history.replaceState(null, '', next);
}

function getLegacyTypeWhereClause(type) {
  const map = {
    vote:     ['vote', 'ox', 'crazy_court', 'multi'],
    naming:   ['naming', 'multi'],
    acrostic: ['acrostic', 'multi'],
    relay:    ['relay', 'multi'],
    quiz:     ['quiz', 'initial_game', 'multi'],
    fill:     ['fill', 'multi'],
    general:  ['general', 'anonymous', 'multi'],
  };
  const types = map[type];
  if (!types) return null;
  return types.length === 1
    ? where('type', '==', types[0])
    : where('type', 'in', types.slice(0, 10));
}

async function loadPosts() {
  if (isLoading) return;
  isLoading = true;

  const loaderEl = document.getElementById('feed-loader');
  const listEl   = document.getElementById('feed-list');
  if (loaderEl) loaderEl.style.display = 'flex';
  if (listEl)   listEl.innerHTML = renderSkeletonCards(3);

  try {
    if (useCursorMode()) await loadCursorPage(currentPage);
    else await loadFilteredPosts();
    renderCurrentPage();
  } catch (err) {
    console.error('피드 로드 실패', err);
    if (listEl) listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">피드를 불러오지 못했어요</div>
        <div class="empty-state__desc">잠시 후 다시 시도해주세요.</div>
      </div>`;
  }

  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

async function fetchCursorSlice(startCursor = null) {
  const constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1)];
  if (startCursor) constraints.push(startAfter(startCursor));
  const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
  const docs = snap.docs;
  const hasNext = docs.length > PAGE_SIZE;
  const pageDocs = docs.slice(0, PAGE_SIZE);
  return {
    pageDocs,
    hasNext,
    nextCursor: pageDocs.length ? pageDocs[pageDocs.length - 1] : null,
  };
}

async function ensureCursorForPage(page) {
  const targetPage = Math.max(1, Number(page || 1));
  if (targetPage <= 1 || cursorStack[targetPage - 2]) return targetPage;

  let startCursor = null;
  for (let pageNo = 1; pageNo < targetPage; pageNo += 1) {
    if (pageNo > 1) startCursor = cursorStack[pageNo - 2] || null;
    const { pageDocs, hasNext, nextCursor } = await fetchCursorSlice(startCursor);

    if (!pageDocs.length) {
      cursorTotal = Math.max(cursorTotal, Math.max(1, pageNo - 1));
      return Math.max(1, pageNo - 1);
    }

    if (!hasNext || !nextCursor) {
      cursorTotal = Math.max(cursorTotal, pageNo);
      return pageNo;
    }

    cursorStack[pageNo - 1] = nextCursor;
    cursorTotal = Math.max(cursorTotal, pageNo + 1);
  }

  return targetPage;
}

async function loadCursorPage(page) {
  currentPage = await ensureCursorForPage(page);
  const startCursor = currentPage > 1 ? cursorStack[currentPage - 2] : null;
  const { pageDocs, hasNext, nextCursor } = await fetchCursorSlice(startCursor);

  if (hasNext && nextCursor) {
    cursorStack[currentPage - 1] = nextCursor;
    cursorTotal = Math.max(cursorTotal, currentPage + 1);
  } else {
    cursorTotal = Math.max(cursorTotal, currentPage);
  }

  cachedPosts = pageDocs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
}

async function loadFilteredPosts() {
  let posts = [];

  if (currentType && !currentSearch) {
    try {
      const snap = await getDocs(query(
        collection(db, 'feeds'),
        where('feedType', '==', currentType),
        orderBy('createdAt', 'desc'),
        limit(FILTER_LIMIT),
      ));
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
    } catch (error) {
      console.warn('[feed] feedType query failed, fallback legacy query', error);
      const constraints = [orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)];
      const typeWhere = getLegacyTypeWhereClause(currentType);
      if (typeWhere) constraints.unshift(typeWhere);
      const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
      posts = posts.filter(p => postMatchesType(p, currentType));
    }
  } else {
    const constraints = [orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)];
    const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
    posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
  }

  if (currentSearch) posts = posts.filter(p => postMatchesSearch(p, currentSearch));
  if (currentType && currentSearch) posts = posts.filter(p => postMatchesType(p, currentType));

  cachedPosts = sortFeedPosts(posts, currentSort);
}

function renderCurrentPage() {
  const listEl    = document.getElementById('feed-list');
  const summaryEl = document.getElementById('feed-summary');
  if (!listEl) return;

  if (useCursorMode()) {
    if (summaryEl) {
      summaryEl.innerHTML = renderFeedSummary({
        total: null, page: currentPage, totalPages: null,
        search: currentSearch, type: currentType, sort: currentSort,
      });
    }
    listEl.innerHTML = cachedPosts.length ? cachedPosts.map(p => renderFeedCard(p)).join('') : renderFeedEmptyState({ search: currentSearch });
    renderCursorPagination();
  } else {
    const totalPages = Math.max(1, Math.ceil(cachedPosts.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pagePosts = cachedPosts.slice(start, start + PAGE_SIZE);

    if (summaryEl) {
      summaryEl.innerHTML = renderFeedSummary({
        total: cachedPosts.length, page: currentPage, totalPages,
        search: currentSearch, type: currentType, sort: currentSort,
      });
    }
    listEl.innerHTML = pagePosts.length ? pagePosts.map(p => renderFeedCard(p)).join('') : renderFeedEmptyState({ search: currentSearch });
    renderOffsetPagination(totalPages);
  }
  bindSortEvents();
  updateUrlState();
}

function renderCursorPagination() {
  const el = document.getElementById('feed-pagination');
  if (!el) return;

  const hasPrev = currentPage > 1;
  const hasNext = cursorStack[currentPage - 1] !== undefined;
  if (!hasPrev && !hasNext) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <button class="feed-page-btn" data-cursor-page="prev" ${!hasPrev ? 'disabled' : ''}>이전</button>
    <span class="feed-page-current">${currentPage}페이지</span>
    <button class="feed-page-btn" data-cursor-page="next" ${!hasNext ? 'disabled' : ''}>다음</button>`;

  el.querySelector('[data-cursor-page="prev"]')?.addEventListener('click', async () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    await loadPosts();
    document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  el.querySelector('[data-cursor-page="next"]')?.addEventListener('click', async () => {
    currentPage += 1;
    await loadPosts();
    document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderOffsetPagination(totalPages) {
  const el = document.getElementById('feed-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
  const end   = Math.min(totalPages, start + 4);

  el.innerHTML = `
    <button class="feed-page-btn" data-feed-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전</button>
    <div class="feed-page-numbers">
      ${Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => `<button class="feed-page-num ${p === currentPage ? 'active' : ''}" data-feed-page="${p}">${p}</button>`).join('')}
    </div>
    <button class="feed-page-btn" data-feed-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음</button>`;

  el.querySelectorAll('[data-feed-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.feedPage;
      if (v === 'prev') currentPage -= 1;
      else if (v === 'next') currentPage += 1;
      else currentPage = Number(v || 1);
      renderCurrentPage();
      document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
