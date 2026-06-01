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
const NAV_CONTEXT_KEY = 'sosoking:feedNavContext';

const ROOMS = [
  { key: '',             icon: '✨', label: '전체',      title: '전체',      desc: '모든 콘텐츠를 한 번에 봅니다.' },
  { key: 'tournament',   icon: '🏆', label: '끝판왕',    title: '끝판왕',    desc: '토너먼트 대결로 최후의 1위를 가려보세요!' },
  { key: 'ai_judge',     icon: '⚖️', label: '미친판사',  title: '미친판사',  desc: '7명의 이상한 판사가 당신의 상황을 판결합니다.' },
  { key: 'ai_translate', icon: '🌍', label: '미친번역사', title: '미친번역사', desc: '텍스트를 북한말·사투리·급식체 등으로 변환합니다.' },
  { key: 'ai_match',     icon: '💘', label: 'AI궁합',    title: 'AI궁합',    desc: 'AI가 두 가지의 궁합 점수를 분석해 드립니다.' },
  { key: 'ai_naming',    icon: '🎭', label: 'AI작명소',  title: 'AI작명소',  desc: '설명하면 웃기고 그럴듯한 이름 5개를 지어드립니다.' },
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
        <button class="btn btn--primary btn--sm" type="button" id="room-write-btn">${room.label === '전체' ? '올리기' : `${room.label} 올리기`}</button>
      </div>
    </div>`;
}

export async function renderFeed() {
  isLoading = false;
  setMeta('소소킹 피드');
  const el     = document.getElementById('page-content');
  const params = getQueryParams();
  currentType   = params.type  || '';
  currentSearch = params.q     || '';
  currentSort   = normalizeFeedSort(params.sort);
  currentPage   = Math.max(1, Number(params.page || 1));

  cursorStack = [];
  cursorTotal = 0;
  cachedPosts = [];
  lastDisplayPosts = [];

  el.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean">
      <div class="soso-feed-toolbar">
        ${renderRoomTabs()}
        ${renderRoomHead()}
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
    tournament:   ['multi', 'tournament'],
    ai_judge:     ['ai_judge'],
    ai_translate: ['ai_translate'],
    ai_match:     ['ai_match'],
    ai_naming:    ['ai_naming'],
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
  if (listEl) {
    listEl.classList.remove('is-empty');
    listEl.innerHTML = renderSkeletonCards(3);
  }

  try {
    if (useCursorMode()) await loadCursorPage(currentPage);
    else await loadFilteredPosts();
    renderCurrentPage();
  } catch (err) {
    console.error('피드 로드 실패', err);
    if (listEl) {
      listEl.classList.add('is-empty');
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <div class="empty-state__title">모음을 불러오지 못했어요</div>
          <div class="empty-state__desc">잠시 후 다시 시도해주세요.</div>
        </div>`;
    }
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

function persistNavContext(posts) {
  lastDisplayPosts = posts || [];
  try {
    sessionStorage.setItem(NAV_CONTEXT_KEY, JSON.stringify({
      ids: lastDisplayPosts.map(p => p.id).filter(Boolean),
      page: currentPage,
      type: currentType,
      search: currentSearch,
      sort: currentSort,
      href: window.location.hash || '#/feed',
      savedAt: Date.now(),
    }));
    sessionStorage.setItem('sosoking:detailPostNav', JSON.stringify({
      ids: lastDisplayPosts.map(p => p.id).filter(Boolean),
      savedAt: Date.now(),
    }));
  } catch {}
}

function renderCurrentPage() {
  const listEl    = document.getElementById('feed-list');
  const summaryEl = document.getElementById('feed-summary');
  if (!listEl) return;

  const displayPosts = cachedPosts;

  if (useCursorMode()) {
    if (summaryEl) {
      summaryEl.innerHTML = renderFeedSummary({
        total: null, page: currentPage, totalPages: null,
        search: currentSearch, type: currentType, sort: currentSort,
      });
    }
    persistNavContext(displayPosts);
    listEl.classList.toggle('is-empty', !displayPosts.length);
    listEl.innerHTML = displayPosts.length ? displayPosts.map(p => renderFeedCard(p)).join('') : renderFeedEmptyState({ search: currentSearch });
    renderCursorPagination();
  } else {
    const totalPages = Math.max(1, Math.ceil(displayPosts.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pagePosts = displayPosts.slice(start, start + PAGE_SIZE);

    if (summaryEl) {
      summaryEl.innerHTML = renderFeedSummary({
        total: displayPosts.length, page: currentPage, totalPages,
        search: currentSearch, type: currentType, sort: currentSort,
      });
    }
    persistNavContext(pagePosts);
    listEl.classList.toggle('is-empty', !pagePosts.length);
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
    <button class="feed-page-btn" data-cursor-page="prev" ${!hasPrev ? 'disabled' : ''}>이전 페이지</button>
    <span class="feed-page-current">${currentPage}페이지</span>
    <button class="feed-page-btn" data-cursor-page="next" ${!hasNext ? 'disabled' : ''}>다음 페이지</button>`;

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
    <button class="feed-page-btn" data-feed-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전 페이지</button>
    <div class="feed-page-numbers">
      ${Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => `<button class="feed-page-num ${p === currentPage ? 'active' : ''}" data-feed-page="${p}">${p}</button>`).join('')}
    </div>
    <button class="feed-page-btn" data-feed-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음 페이지</button>`;

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
