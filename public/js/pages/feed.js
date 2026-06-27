import { db } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, startAfter, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams, navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { getPublicAiResidents } from '../ai-residents.js';
import {
  normalizeFeedSort, postMatchesType, postMatchesSearch, sortFeedPosts, isTournamentPost,
} from '../feed/filter.js';
import {
  renderFeedSearchBar, renderFeedFilterBar, renderFeedEmptyState,
  updateFeedFilterUI, renderFeedSummary,
} from '../feed/render.js';

const PAGE_SIZE    = 20;
const FILTER_LIMIT = 120;
const NAV_CONTEXT_KEY = 'sosoking:feedNavContext';

const BOARD_FILTERS = [
  { key: '',        icon: '✨', label: '전체',   write: 'collect' },
  { key: 'collect', icon: '📝', label: '일반글', write: 'collect' },
  { key: 'vote',    icon: '🗳️', label: '투표',   write: 'vote' },
  { key: 'quiz',    icon: '🧠', label: '퀴즈',   write: 'quiz' },
  { key: 'drip',    icon: '🤣', label: '드립',   write: 'drip' },
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

function currentBoardFilter() {
  return BOARD_FILTERS.find(item => item.key === currentType) || BOARD_FILTERS[0];
}

function useCursorMode() {
  return !currentType && !currentSearch && currentSort === 'latest';
}

function isAllowedFeedPost(post) {
  return !post.hidden && !isTournamentPost(post);
}

function renderBoardTabs() {
  return `
    <div class="soso-room-tabs" aria-label="게시판 필터">
      ${BOARD_FILTERS.map(item => `<button type="button" class="soso-room-tab ${currentType === item.key ? 'active' : ''}" data-type-filter="${item.key}"><span>${item.icon}</span>${item.label}</button>`).join('')}
    </div>`;
}

function renderBoardHead() {
  return `
    <div class="soso-room-head">
      <div class="soso-room-head__label">📋 통합 게시판</div>
      <div class="soso-room-head__title">소소킹 게시판</div>
      <div class="soso-room-head__desc">일반글, 투표, 퀴즈, 드립을 한 곳에서 보고 올립니다.</div>
      <div class="soso-room-head__action">
        <button class="btn btn--primary btn--sm" type="button" id="room-write-btn">글쓰기</button>
      </div>
    </div>`;
}

function renderAiResidentsIntro() {
  const residents = getPublicAiResidents();
  return `
    <section class="soso-ai-residents" aria-label="AI 캐릭터 소개" style="margin:14px 0;padding:16px;border:1px solid var(--color-border,#e5e7eb);border-radius:18px;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(236,72,153,.06));">
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;">
        <div>
          <div style="font-size:13px;font-weight:900;color:var(--color-primary,#6366f1);margin-bottom:4px;">AI 캐릭터 커뮤니티 준비중</div>
          <div style="font-size:20px;font-weight:950;color:var(--color-text-primary,#111827);line-height:1.25;">글을 올리면 성격 다른 캐릭터들이 댓글로 같이 놀 예정이에요</div>
          <div style="font-size:13px;color:var(--color-text-secondary,#6b7280);margin-top:6px;">자동 댓글은 한 글마다 2~3명만 참여하게 만들어 비용과 오류를 줄입니다.</div>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" id="ai-residents-write-btn">캐릭터에게 말 걸 글쓰기</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
        ${residents.map(resident => `
          <div style="padding:10px;border-radius:14px;background:rgba(255,255,255,.72);border:1px solid rgba(148,163,184,.28);">
            <div style="display:flex;align-items:center;gap:7px;font-weight:950;color:var(--color-text-primary,#111827);"><span style="font-size:20px">${resident.emoji}</span>${resident.name}</div>
            <div style="font-size:12px;font-weight:800;color:var(--color-text-secondary,#6b7280);margin-top:3px;">${resident.role} · ${resident.mbti || ''}</div>
            <div style="font-size:11px;color:var(--color-text-muted,#9ca3af);margin-top:4px;line-height:1.35;">${resident.specialty}</div>
            <div style="font-size:11px;color:var(--color-primary,#6366f1);margin-top:6px;line-height:1.35;">${(resident.catchphrases || []).slice(0, 1).join('')}</div>
          </div>`).join('')}
      </div>
    </section>`;
}

export async function renderFeed() {
  isLoading = false;
  setMeta('소소킹 게시판');
  const el     = document.getElementById('page-content');
  const params = getQueryParams();
  currentType   = params.type  || '';
  currentSearch = params.q     || '';
  currentSort   = normalizeFeedSort(params.sort);
  currentPage   = Math.max(1, Number(params.page || 1));

  if (currentType === 'tournament') currentType = '';

  cursorStack = [];
  cursorTotal = 0;
  cachedPosts = [];
  lastDisplayPosts = [];

  el.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean">
      <div class="soso-feed-toolbar">
        ${renderBoardTabs()}
        ${renderBoardHead()}
        ${renderAiResidentsIntro()}
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
    const item = currentBoardFilter();
    navigate(`/write?type=multi&preset=${item.write || 'collect'}`);
  });
  document.getElementById('ai-residents-write-btn')?.addEventListener('click', () => {
    navigate('/write?type=multi&preset=collect');
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
          <div class="empty-state__title">게시판을 불러오지 못했어요</div>
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

  cachedPosts = pageDocs.map(d => ({ id: d.id, ...d.data() })).filter(isAllowedFeedPost);
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
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(isAllowedFeedPost);
    } catch (error) {
      console.warn('[feed] feedType query failed, fallback legacy query', error);
      const constraints = [orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)];
      const typeWhere = getLegacyTypeWhereClause(currentType);
      if (typeWhere) constraints.unshift(typeWhere);
      const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(isAllowedFeedPost);
      posts = posts.filter(p => postMatchesType(p, currentType));
    }
  } else {
    const constraints = [orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)];
    const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
    posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(isAllowedFeedPost);
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
