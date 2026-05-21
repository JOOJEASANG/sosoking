import { db } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, startAfter, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams, navigate } from '../router.js';
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
const FILTER_LIMIT = 120; // 필터/검색/정렬 시 서버 로드 최대치

// ─ 상태 ─
let currentType   = '';
let currentSearch = '';
let currentSort   = 'latest';
let currentPage   = 1;
let isLoading     = false;

// 커서 모드 (일반 탐색)
let cursorStack   = []; // cursorStack[i] = 페이지 i+1의 마지막 DocumentSnapshot
let cursorTotal   = 0;  // 커서 모드에서 현재까지 확인된 페이지 수

// 캐시 모드 (필터/검색/정렬)
let cachedPosts   = [];

// ─ 커서 모드 여부 ─
function useCursorMode() {
  return !currentType && !currentSearch && currentSort === 'latest';
}

export async function renderFeed() {
  isLoading = false;
  setMeta('피드');
  const el     = document.getElementById('page-content');
  const params = getQueryParams();
  currentType   = params.type  || '';
  currentSearch = params.q     || '';
  currentSort   = normalizeFeedSort(params.sort);
  currentPage   = Math.max(1, Number(params.page || 1));

  // 상태 초기화
  cursorStack = [];
  cursorTotal = 0;
  cachedPosts = [];

  el.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean">
      <div class="soso-feed-toolbar">
        ${renderFeedSearchBar({ search: currentSearch })}
        ${renderFeedFilterBar({ type: currentType, search: currentSearch, sort: currentSort })}
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
  bindSortEvents();
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
  document.getElementById('feed-sort-select')?.addEventListener('change', e => {
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
  if (currentType)                           params.set('type', currentType);
  if (currentSearch)                         params.set('q', currentSearch);
  if (currentSort && currentSort !== 'latest') params.set('sort', currentSort);
  if (currentPage > 1)                       params.set('page', String(currentPage));
  const next = params.toString() ? `#/feed?${params.toString()}` : '#/feed';
  if (window.location.hash !== next) history.replaceState(null, '', next);
}

// ─ 타입 → Firestore where 조건 매핑 ─
function getTypeWhereClause(type) {
  // 새 멀티글은 type='multi' + subtype/modules 조합이라 서버 where만으로는 누락될 수 있습니다.
  // 정확한 분류는 postMatchesType()에서 클라이언트 기준으로 한 번 더 처리합니다.
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

// ─ 메인 로드 ─
async function loadPosts() {
  if (isLoading) return;
  isLoading = true;

  const loaderEl = document.getElementById('feed-loader');
  const listEl   = document.getElementById('feed-list');
  if (loaderEl) loaderEl.style.display = 'flex';
  if (listEl)   listEl.innerHTML = renderSkeletonCards(3);

  try {
    if (useCursorMode()) {
      await loadCursorPage(currentPage);
    } else {
      await loadFilteredPosts();
    }
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

// ─ 커서 페이지네이션 (일반 탐색, 최신순, 필터 없음) ─
async function loadCursorPage(page) {
  // 이전 페이지 커서 가져오기
  const startCursor = page > 1 ? cursorStack[page - 2] : null;

  const constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1)];
  if (startCursor) constraints.push(startAfter(startCursor));

  const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
  const docs = snap.docs;

  // 다음 페이지 존재 여부
  const hasNext = docs.length > PAGE_SIZE;
  const pageDocs = docs.slice(0, PAGE_SIZE);

  // 커서 저장 (다음 페이지 시작점)
  if (hasNext && pageDocs.length > 0) {
    cursorStack[page - 1] = pageDocs[pageDocs.length - 1];
    cursorTotal = Math.max(cursorTotal, page + 1);
  } else {
    cursorTotal = Math.max(cursorTotal, page);
  }

  cachedPosts = pageDocs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.hidden);
}

// ─ 필터/정렬/검색 모드 (최대 FILTER_LIMIT건) ─
async function loadFilteredPosts() {
  const constraints = [orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)];

  // 검색 없이 타입 필터만 있는 경우 서버사이드 where 추가
  if (currentType && !currentSearch) {
    const typeWhere = getTypeWhereClause(currentType);
    if (typeWhere) constraints.unshift(typeWhere);
  }

  const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
  let posts = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.hidden);

  if (currentSearch)  posts = posts.filter(p => postMatchesSearch(p, currentSearch));
  if (currentType)    posts = posts.filter(p => postMatchesType(p, currentType));

  cachedPosts = sortFeedPosts(posts, currentSort);
}

// ─ 렌더링 ─
function renderCurrentPage() {
  const listEl      = document.getElementById('feed-list');
  const summaryEl   = document.getElementById('feed-summary');
  if (!listEl) return;

  if (useCursorMode()) {
    // 커서 모드: cachedPosts가 이미 현재 페이지 데이터
    if (summaryEl) {
      summaryEl.innerHTML = renderFeedSummary({
        total: null, page: currentPage,
        totalPages: null, search: currentSearch,
        type: currentType, sort: currentSort,
      });
    }
    listEl.innerHTML = cachedPosts.length
      ? cachedPosts.map(p => renderFeedCard(p)).join('')
      : renderFeedEmptyState({ search: currentSearch });
    renderCursorPagination();
  } else {
    // 캐시 모드: 클라이언트 페이지네이션
    const totalPages = Math.max(1, Math.ceil(cachedPosts.length / PAGE_SIZE));
    currentPage      = Math.min(Math.max(1, currentPage), totalPages);
    const start      = (currentPage - 1) * PAGE_SIZE;
    const pagePosts  = cachedPosts.slice(start, start + PAGE_SIZE);

    if (summaryEl) {
      summaryEl.innerHTML = renderFeedSummary({
        total: cachedPosts.length, page: currentPage,
        totalPages, search: currentSearch,
        type: currentType, sort: currentSort,
      });
    }
    listEl.innerHTML = pagePosts.length
      ? pagePosts.map(p => renderFeedCard(p)).join('')
      : renderFeedEmptyState({ search: currentSearch });
    renderOffsetPagination(totalPages);
  }
  updateUrlState();
}

// ─ 커서 페이지네이션 UI ─
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

// ─ 오프셋 페이지네이션 UI (필터/정렬 모드) ─
function renderOffsetPagination(totalPages) {
  const el = document.getElementById('feed-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
  const end   = Math.min(totalPages, start + 4);

  el.innerHTML = `
    <button class="feed-page-btn" data-feed-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전</button>
    <div class="feed-page-numbers">
      ${Array.from({ length: end - start + 1 }, (_, i) => start + i)
        .map(p => `<button class="feed-page-num ${p === currentPage ? 'active' : ''}" data-feed-page="${p}">${p}</button>`)
        .join('')}
    </div>
    <button class="feed-page-btn" data-feed-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음</button>`;

  el.querySelectorAll('[data-feed-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.feedPage;
      if (v === 'prev')      currentPage -= 1;
      else if (v === 'next') currentPage += 1;
      else                   currentPage = Number(v || 1);
      renderCurrentPage();
      document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}