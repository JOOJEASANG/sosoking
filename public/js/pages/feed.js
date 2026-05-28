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
const FILTER_LIMIT = 120;

const ROOMS = [
  { key: '',        icon: '✨', label: '전체',   title: '전체 모음', desc: '유튜브, 웃긴그림, 토론, 퀴즈, 드립을 한 번에 봅니다.', write: 'collect' },
  { key: 'collect', icon: '📌', label: '모음방', title: '모음방', desc: '유튜브 쇼츠, 웃긴그림, 링크를 짧게 모아봅니다.', write: 'collect' },
  { key: 'vote',    icon: '🗳️', label: '토론방', title: '토론방', desc: '찬성/반대, 밸런스, 선택지로 빠르게 의견을 모읍니다.', write: 'vote' },
  { key: 'quiz',    icon: '🧠', label: '퀴즈방', title: '퀴즈방', desc: '짧은 문제를 보고 바로 맞히는 공간입니다.', write: 'quiz' },
  { key: 'drip',    icon: '🤣', label: '드립방', title: '드립방', desc: '제목 없이 오늘의 한줄만 모아보는 공간입니다.', write: 'drip' },
];

let currentType   = '';
let currentSearch = '';
let currentSort   = 'latest';
let currentPage   = 1;
let isLoading     = false;

let cursorStack   = [];
let cursorTotal   = 0;
let cachedPosts   = [];

function currentRoom() {
  return ROOMS.find(room => room.key === currentType) || ROOMS[0];
}

function useCursorMode() {
  return !currentType && !currentSearch && currentSort === 'latest';
}

function renderRoomTabs() {
  return `
    <div class="soso-room-tabs" aria-label="방별 보기">
      ${ROOMS.map(room => `<button type="button" class="soso-room-tab ${currentType === room.key ? 'active' : ''}" data-type-filter="${room.key}"><span>${room.icon}</span>${room.label}</button>`).join('')}
    </div>`;
}

function renderRoomHead() {
  const room = currentRoom();
  return `
    <div class="soso-room-head">
      <div class="soso-room-head__label">${room.icon} ${room.label}</div>
      <div class="soso-room-head__title">${room.title}</div>
      <div class="soso-room-head__desc">${room.desc}</div>
      <div class="soso-room-head__action">
        <button class="btn btn--primary btn--sm" type="button" id="room-write-btn">${room.label === '전체' ? '모음 올리기' : `${room.label} 올리기`}</button>
      </div>
    </div>`;
}

export async function renderFeed() {
  isLoading = false;
  setMeta('소소킹 모음방');
  const el     = document.getElementById('page-content');
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
        ${renderRoomTabs()}
        ${renderRoomHead()}
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
  bindRoomWriteEvent();
}

function bindRoomWriteEvent() {
  document.getElementById('room-write-btn')?.addEventListener('click', () => {
    const room = currentRoom();
    navigate(`/write?type=multi&preset=${room.write || 'collect'}`);
  });
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
    collect:  ['multi', 'general', 'anonymous'],
    vote:     ['vote', 'ox', 'crazy_court', 'multi'],
    quiz:     ['quiz', 'initial_game', 'multi'],
    drip:     ['multi'],
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
        <div class="empty-state__title">모음을 불러오지 못했어요</div>
        <div class="empty-state__desc">잠시 후 다시 시도해주세요.</div>
      </div>`;
  }

  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

async function loadCursorPage(page) {
  const startCursor = page > 1 ? cursorStack[page - 2] : null;
  const constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1)];
  if (startCursor) constraints.push(startAfter(startCursor));

  const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
  const docs = snap.docs;
  const hasNext = docs.length > PAGE_SIZE;
  const pageDocs = docs.slice(0, PAGE_SIZE);

  if (hasNext && pageDocs.length > 0) {
    cursorStack[page - 1] = pageDocs[pageDocs.length - 1];
    cursorTotal = Math.max(cursorTotal, page + 1);
  } else {
    cursorTotal = Math.max(cursorTotal, page);
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
