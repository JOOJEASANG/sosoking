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
const FILTER_LIMIT = 500;
const NAV_CONTEXT_KEY = 'sosoking:feedNavContext';
const PLAZA_TYPES = ['citizen_speech', 'ai_judge'];

const ROOMS = [
  { key: '', icon: '🏛️', label: '전체여론', title: '전체여론', desc: '정당 홍보·공약 토론·정치 의견·헌재 기록을 한 번에 봅니다.' },
  { key: 'citizen_speech', icon: '🗣️', label: '시민발언', title: '시민발언', desc: '정당 홍보, 공약 토론, 정치 의견을 모아봅니다.', path: '/write' },
  { key: 'ai_judge', icon: '⚖️', label: '헌재기록', title: '헌재기록', desc: '헌법재판소 AI 재판관 판결 기록입니다.', path: '/constitutional-court' },
];

let currentType        = '';
let currentSearch      = '';
let currentSort        = 'latest';
let currentPage        = 1;
let isLoading          = false;
let cursorStack   = [];
let cursorTotal   = 0;
let cachedPosts   = [];
let lastDisplayPosts = [];

function useCursorMode() {
  return !currentType && !currentSearch && currentSort === 'latest';
}

function renderRoomTabs() {
  const activeRoom = ROOMS.find(r => r.key === currentType) || ROOMS[0];
  const descBar = activeRoom.key
    ? `<div class="soso-room-desc">
        <span class="soso-room-desc__icon">${activeRoom.icon}</span>
        <span class="soso-room-desc__text">${activeRoom.desc}</span>
        ${activeRoom.path ? `<a class="soso-room-desc__cta" href="#${activeRoom.path}">${activeRoom.key === 'citizen_speech' ? '작성하기 →' : '직접 해보기 →'}</a>` : ''}
      </div>`
    : '';
  return `
    <div class="soso-room-tabs-wrap">
      <div class="soso-room-tabs" role="tablist" aria-label="시민광장 보기">
        ${ROOMS.map(room => `
          <button type="button" role="tab"
            class="soso-room-tab ${currentType === room.key ? 'active' : ''}"
            data-type-filter="${room.key}"
            aria-selected="${currentType === room.key}">
            <span class="soso-room-tab__icon">${room.icon}</span>
            <span class="soso-room-tab__label">${room.label}</span>
          </button>`).join('')}
      </div>
      ${descBar}
    </div>`;
}

export async function renderFeed() {
  isLoading = false;
  setMeta('소소킹 시민광장');
  const el     = document.getElementById('page-content');
  const params = getQueryParams();
  currentType   = params.type === 'tournament' ? '' : (params.type || '');
  currentSearch = params.q     || '';
  currentSort   = normalizeFeedSort(params.sort);
  currentPage   = Math.max(1, Number(params.page || 1));

  cursorStack = [];
  cursorTotal = 0;
  cachedPosts = [];
  lastDisplayPosts = [];

  el.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean">
      <div class="feed-earn-bar">
        <span class="feed-earn-bar__label">⚡ 정치력 획득</span>
        <a class="feed-earn-bar__item" href="#/battle">배틀 댓글 <b>+10P</b></a>
        <span class="feed-earn-bar__sep">·</span>
        <a class="feed-earn-bar__item" href="#/write">시민발언 <b>+20P</b></a>
        <span class="feed-earn-bar__sep">·</span>
        <span class="feed-earn-bar__item">시민토론 <b>+10P</b></span>
      </div>
      <div class="soso-feed-toolbar">
        ${renderRoomTabs()}
        ${renderFeedSearchBar({ search: currentSearch })}
        ${renderFeedFilterBar({ type: currentType, search: currentSearch })}
      </div>
      <div id="feed-summary" class="soso-feed-summary feed-result-summary"></div>
      <div id="feed-list" class="soso-feed-list">${renderSkeletonCards(5)}</div>
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
    currentPage   = 1;
    refreshFeed();
    clearBtn?.style.setProperty('display', currentSearch ? 'inline-flex' : 'none');
  };
  let debounceTimer = null;
  searchInput?.addEventListener('input', () => {
    clearBtn?.style.setProperty('display', searchInput.value.trim() ? 'inline-flex' : 'none');
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 420);
  });
  searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(debounceTimer); doSearch(); } });
  searchBtn?.addEventListener('click', () => { clearTimeout(debounceTimer); doSearch(); });
  clearBtn?.addEventListener('click', () => {
    clearTimeout(debounceTimer);
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
      currentPage   = 1;
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
  lastDisplayPosts = [];
  updateUrlState();
  updateFeedFilterUI({ type: currentType, search: currentSearch, sort: currentSort });
  document.querySelectorAll('.soso-room-tab').forEach(btn => {
    const active = btn.dataset.typeFilter === currentType;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });
  const activeRoom = ROOMS.find(r => r.key === currentType) || ROOMS[0];
  const descEl = document.querySelector('.soso-room-desc');
  if (activeRoom.key) {
    const html = `<span class="soso-room-desc__icon">${activeRoom.icon}</span>
      <span class="soso-room-desc__text">${activeRoom.desc}</span>
      ${activeRoom.path ? `<a class="soso-room-desc__cta" href="#${activeRoom.path}">${activeRoom.key === 'citizen_speech' ? '작성하기 →' : '직접 해보기 →'}</a>` : ''}`;
    if (descEl) { descEl.innerHTML = html; descEl.hidden = false; }
    else {
      const wrap = document.querySelector('.soso-room-tabs-wrap');
      if (wrap) { const d = document.createElement('div'); d.className = 'soso-room-desc'; d.innerHTML = html; wrap.appendChild(d); }
    }
  } else {
    if (descEl) descEl.hidden = true;
  }
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
    ai_judge: ['ai_judge'],
    citizen_speech: ['citizen_speech'],
  };
  const types = map[type];
  if (!types) return null;
  return types.length === 1 ? where('type', '==', types[0]) : where('type', 'in', types.slice(0, 10));
}

function onlyPlazaPosts(posts) {
  return posts.filter(p => PLAZA_TYPES.includes(p.feedType || p.type || p.subtype));
}

async function loadPosts() {
  if (isLoading) return;
  isLoading = true;
  const loaderEl = document.getElementById('feed-loader');
  const listEl   = document.getElementById('feed-list');
  if (loaderEl) loaderEl.style.display = 'flex';
  if (listEl) { listEl.classList.remove('is-empty'); listEl.innerHTML = renderSkeletonCards(3); }

  try {
    if (useCursorMode()) await loadCursorPage(currentPage);
    else await loadFilteredPosts();
    renderCurrentPage();
  } catch (err) {
    console.error('시민광장 로드 실패', err);
    if (listEl) {
      listEl.classList.add('is-empty');
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">시민광장을 불러오지 못했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요.</div></div>`;
    }
  }
  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

async function loadCursorPage(page) {
  const startCursor = page > 1 ? cursorStack[page - 2] : null;
  const constraints = [where('type', 'in', PLAZA_TYPES), orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1)];
  if (startCursor) constraints.push(startAfter(startCursor));
  const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
  const docs = snap.docs;
  const hasNext = docs.length > PAGE_SIZE;
  const pageDocs = docs.slice(0, PAGE_SIZE);
  if (hasNext && pageDocs.length > 0) {
    cursorStack[page - 1] = pageDocs[pageDocs.length - 1];
    cursorTotal = Math.max(cursorTotal, page + 1);
  } else cursorTotal = Math.max(cursorTotal, page);
  cachedPosts = pageDocs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
}

async function loadFilteredPosts() {
  let posts = [];
  if (currentType && !currentSearch) {
    try {
      const snap = await getDocs(query(collection(db, 'feeds'), where('feedType', '==', currentType), orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)));
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
    } catch (error) {
      const legacy = getLegacyTypeWhereClause(currentType);
      if (!legacy) throw error;
      const snap = await getDocs(query(collection(db, 'feeds'), legacy, orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)));
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
    }
  } else {
    const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)));
    posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
  }
  if (currentType) posts = posts.filter(post => postMatchesType(post, currentType));
  else posts = onlyPlazaPosts(posts);
  if (currentSearch) posts = posts.filter(post => postMatchesSearch(post, currentSearch));
  posts = sortFeedPosts(posts, currentSort);
  cachedPosts = posts;
  cursorTotal = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
}

function renderCurrentPage() {
  const listEl = document.getElementById('feed-list');
  const summaryEl = document.getElementById('feed-summary');
  const paginationEl = document.getElementById('feed-pagination');
  if (!listEl) return;
  bindSortEvents();
  let displayPosts = cachedPosts;
  if (!useCursorMode()) {
    const start = (currentPage - 1) * PAGE_SIZE;
    displayPosts = cachedPosts.slice(start, start + PAGE_SIZE);
  }
  lastDisplayPosts = displayPosts;
  if (summaryEl) {
    summaryEl.innerHTML = renderFeedSummary({
      posts: displayPosts,
      total: useCursorMode() ? null : cachedPosts.length,
      page: currentPage,
      totalPages: cursorTotal,
      type: currentType,
      search: currentSearch,
      sort: currentSort,
    });
  }
  if (!displayPosts.length) {
    listEl.classList.add('is-empty');
    listEl.innerHTML = renderFeedEmptyState({ search: currentSearch, type: currentType });
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }
  listEl.classList.remove('is-empty');
  listEl.innerHTML = displayPosts.map(renderFeedCard).join('');
  bindFeedCardClicks();
  renderPagination();
}

function bindFeedCardClicks() {
  document.querySelectorAll('.feed-card').forEach((card, index) => {
    card.addEventListener('click', e => {
      if (e.target.closest('button,a')) return;
      const id = card.dataset.id;
      if (!id) return;
      sessionStorage.setItem(NAV_CONTEXT_KEY, JSON.stringify({
        ids: lastDisplayPosts.map(p => p.id),
        currentIndex: index,
        page: currentPage,
        type: currentType,
        search: currentSearch,
        sort: currentSort,
        savedAt: Date.now(),
      }));
      navigate(`/detail/${id}`);
    });
  });
}

function renderPagination() {
  const paginationEl = document.getElementById('feed-pagination');
  if (!paginationEl) return;
  if (cursorTotal <= 1) { paginationEl.innerHTML = ''; return; }
  paginationEl.innerHTML = `
    <button class="btn btn--outline btn--sm" id="feed-prev" ${currentPage <= 1 ? 'disabled' : ''}>이전</button>
    <span class="feed-pagination__info">${currentPage} / ${cursorTotal}</span>
    <button class="btn btn--outline btn--sm" id="feed-next" ${currentPage >= cursorTotal ? 'disabled' : ''}>다음</button>`;
  paginationEl.querySelector('#feed-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage -= 1; updateUrlState(); loadPosts(); }
  });
  paginationEl.querySelector('#feed-next')?.addEventListener('click', () => {
    if (currentPage < cursorTotal) { currentPage += 1; updateUrlState(); loadPosts(); }
  });
}
