import { db } from '../firebase.js';
import { collection, query, orderBy, limit, startAfter, getDocs, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams, navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const FILTER_TYPES = ['general', 'vote', 'ox', 'fill', 'naming', 'acrostic', 'quiz', 'anonymous'];

const TYPE_LABELS = {
  general: '일반글',
  multi: '피드 글',
  vote: '투표/판정',
  ox: 'OX판정',
  fill: '채우기',
  naming: '미친작명소',
  acrostic: '삼행시',
  quiz: '퀴즈',
  anonymous: '익명',
  initial_game: '퀴즈',
  crazy_court: '투표/판정',
};

const SORT_LABELS = {
  latest: '최신순',
  popular: '인기순',
  comments: '댓글순',
  views: '조회순',
  participation: '참여순',
};

let lastDoc       = null;
let currentType   = '';
let currentSearch = '';
let currentSort   = 'latest';
let isLoading     = false;
let scrollObserver = null;

export async function renderFeed() {
  setMeta('피드');
  isLoading = false;
  if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
  const el = document.getElementById('page-content');
  const params = getQueryParams();
  currentType   = params.type || '';
  currentSearch = params.q || '';
  currentSort   = SORT_LABELS[params.sort] ? params.sort : 'latest';
  lastDoc = null;

  el.innerHTML = `
    <div class="layout-main layout-main--full feed-page-clean">
      ${renderSearchBar()}
      ${renderFilterBar()}
      <div id="feed-list">${renderSkeletonCards(5)}</div>
      <div id="feed-loader" class="loading-center" style="display:none">
        <div class="spinner"></div>
      </div>
      <div id="feed-end" style="display:none;text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">
        여기까지 다 봤어요 👀
      </div>
    </div>`;

  document.getElementById('btn-feed-write')?.addEventListener('click', () => navigate('/write?type=multi'));

  await loadPosts(true);
  setupInfiniteScroll();

  const searchInput = document.getElementById('feed-search-input');
  const searchBtn   = document.getElementById('btn-feed-search');

  const doSearch = () => {
    const q = searchInput?.value.trim() || '';
    currentSearch = q;
    currentType   = '';
    lastDoc = null;
    updateUrlState();
    updateFilterUI();
    loadPosts(true);
    if (q) document.getElementById('search-clear-btn')?.style.setProperty('display', 'inline-flex');
  };

  searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  searchBtn?.addEventListener('click', doSearch);

  document.getElementById('search-clear-btn')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSearch = '';
    lastDoc = null;
    updateUrlState();
    updateFilterUI();
    loadPosts(true);
    document.getElementById('search-clear-btn').style.display = 'none';
  });

  attachTypeFilterListeners();
  attachSortListeners();
}

function updateUrlState() {
  const params = new URLSearchParams();
  if (currentType) params.set('type', currentType);
  if (currentSearch) params.set('q', currentSearch);
  if (currentSort && currentSort !== 'latest') params.set('sort', currentSort);
  const next = params.toString() ? `#/feed?${params.toString()}` : '#/feed';
  if (window.location.hash !== next) history.replaceState(null, '', next);
}

function attachTypeFilterListeners() {
  document.querySelectorAll('[data-type-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType   = btn.dataset.typeFilter;
      currentSearch = '';
      const searchInput = document.getElementById('feed-search-input');
      if (searchInput) searchInput.value = '';
      lastDoc = null;
      updateUrlState();
      updateFilterUI();
      loadPosts(true);
    });
  });
}

function attachSortListeners() {
  document.querySelectorAll('[data-feed-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.feedSort || 'latest';
      lastDoc = null;
      updateUrlState();
      updateFilterUI();
      loadPosts(true);
    });
  });
}

function renderSearchBar() {
  return `
    <div class="feed-search-bar feed-search-bar--compact">
      <div class="feed-search-input-wrap feed-search-input-wrap--compact">
        <svg class="feed-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="feed-search-input" class="feed-search-input" placeholder="검색" value="${escHtml(currentSearch)}" autocomplete="off">
        <button id="search-clear-btn" class="feed-search-clear" style="display:${currentSearch ? 'inline-flex' : 'none'}">✕</button>
      </div>
      <button class="btn btn--ghost btn--sm feed-search-btn" id="btn-feed-search">검색</button>
      <button class="btn btn--primary btn--sm feed-write-plus-btn" id="btn-feed-write">+ 피드 만들기</button>
    </div>`;
}

function renderFilterBar() {
  return `
    <div class="feed-control-wrap">
      <div class="feed-filters feed-filters--compact" id="cat-filters">
        <button class="filter-chip ${!currentType && !currentSearch ? 'active' : ''}" data-type-filter="">전체</button>
        ${FILTER_TYPES.map(type => `
          <button class="filter-chip ${currentType === type && !currentSearch ? 'active' : ''}" data-type-filter="${type}">
            ${TYPE_LABELS[type]}
          </button>`).join('')}
      </div>
      <div class="feed-sort-chips" aria-label="피드 정렬">
        ${Object.entries(SORT_LABELS).map(([key, label]) => `
          <button class="feed-sort-chip ${currentSort === key ? 'active' : ''}" data-feed-sort="${key}">${label}</button>`).join('')}
      </div>
    </div>
    ${currentSearch ? `<div class="feed-search-label">🔍 "<strong>${escHtml(currentSearch)}</strong>" 검색 결과</div>` : ''}`;
}

function updateFilterUI() {
  document.querySelectorAll('[data-type-filter]').forEach(b => {
    b.classList.toggle('active', b.dataset.typeFilter === currentType && !currentSearch);
  });
  document.querySelectorAll('[data-feed-sort]').forEach(b => {
    b.classList.toggle('active', b.dataset.feedSort === currentSort);
  });
}

function getPostTypeKey(post) {
  if (post.subtype && TYPE_LABELS[post.subtype]) return post.subtype;
  if (post.anonymous || post.modules?.anonymous?.enabled) return 'anonymous';
  if (post.modules?.vote?.ox) return 'ox';
  if (post.modules?.fill?.enabled) return 'fill';
  if (post.modules?.vote?.enabled || post.type === 'vote' || post.type === 'crazy_court') return 'vote';
  if (post.modules?.naming?.enabled || post.type === 'naming') return 'naming';
  if (post.modules?.acrostic?.enabled || post.type === 'acrostic') return 'acrostic';
  if (post.modules?.quiz?.enabled || post.type === 'quiz' || post.type === 'initial_game') return 'quiz';
  if (post.type === 'multi') return 'general';
  return post.type || 'general';
}

function postMatchesCurrentType(post) {
  if (!currentType) return true;
  return getPostTypeKey(post) === currentType;
}

function sortScore(post) {
  const reactions = Number(post.reactions?.total || 0);
  const comments = Number(post.commentCount || 0);
  const views = Number(post.viewCount || 0);
  const participation = comments + Number(post.acrosticCount || 0);
  if (currentSort === 'popular') return reactions * 3 + comments * 2 + views * 0.2 + participation;
  if (currentSort === 'comments') return comments;
  if (currentSort === 'views') return views;
  if (currentSort === 'participation') return participation + reactions;
  const date = post.createdAt?.toDate?.() || post.createdAt;
  return date instanceof Date ? date.getTime() : 0;
}

function sortPosts(posts) {
  return posts.sort((a, b) => {
    const diff = sortScore(b) - sortScore(a);
    if (diff) return diff;
    const ad = a.createdAt?.toDate?.() || a.createdAt;
    const bd = b.createdAt?.toDate?.() || b.createdAt;
    return (bd instanceof Date ? bd.getTime() : 0) - (ad instanceof Date ? ad.getTime() : 0);
  });
}

async function loadPosts(reset = false) {
  if (isLoading) return;
  isLoading = true;

  const loaderEl = document.getElementById('feed-loader');
  const listEl   = document.getElementById('feed-list');
  const endEl    = document.getElementById('feed-end');

  if (loaderEl) loaderEl.style.display = 'flex';
  if (reset && endEl) endEl.style.display = 'none';

  try {
    let constraints;
    let pageSize;

    if (currentSearch) {
      const qEnd = currentSearch.slice(0, -1) + String.fromCharCode(currentSearch.charCodeAt(currentSearch.length - 1) + 1);
      pageSize = 40;
      constraints = [
        where('title', '>=', currentSearch),
        where('title', '<',  qEnd),
        orderBy('title'),
        limit(pageSize),
      ];
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
    } else {
      pageSize = currentType || currentSort !== 'latest' ? 80 : 15;
      constraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'feeds'), ...constraints);
    const snap = await getDocs(q);

    if (reset && listEl) listEl.innerHTML = '';

    const visibleDocs = sortPosts(snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(post => !post.hidden)
      .filter(post => currentSearch ? true : postMatchesCurrentType(post)));

    if (snap.empty && reset) {
      if (listEl) listEl.innerHTML = renderEmptyState();
      if (endEl) endEl.style.display = 'block';
    } else {
      visibleDocs.forEach(post => {
        const html = renderFeedCard(post);
        if (listEl) listEl.insertAdjacentHTML('beforeend', html);
      });

      if (visibleDocs.length === 0 && reset && listEl) {
        listEl.innerHTML = renderEmptyState();
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < pageSize && endEl) endEl.style.display = 'block';
    }
  } catch (e) {
    console.error('피드 로드 실패', e);
    if (reset && listEl) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">피드를 불러오지 못했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요.</div></div>`;
    }
  }

  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${currentSearch ? '🔍' : '🌱'}</div>
      <div class="empty-state__title">${currentSearch ? `"${escHtml(currentSearch)}" 검색 결과가 없어요` : '아직 아무 글도 없어요'}</div>
      <div class="empty-state__desc">${currentSearch ? '다른 검색어는 어때요?' : '첫 번째 피드 글을 올려볼까요?'}</div>
      ${!currentSearch ? `<button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write?type=multi')">+ 피드 만들기</button>` : ''}
    </div>`;
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
