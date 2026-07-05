import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams, navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { normalizeFeedSort, postMatchesType, postMatchesSearch, sortFeedPosts } from '../feed/filter.js';
import { renderFeedEmptyState, updateFeedFilterUI, renderFeedSummary } from '../feed/render.js';

const PAGE_SIZE = 20;
const QUERY_LIMIT = 160;
const NAV_CONTEXT_KEY = 'sosoking:feedNavContext';

const CONTENT_FILTERS = [
  { key: '', icon: '✨', label: '전체', write: 'drip' },
  { key: 'vote', icon: '🗳️', label: '토론', write: 'vote' },
  { key: 'drip', icon: '😂', label: '드립', write: 'drip' },
];

let currentType = '';
let currentSearch = '';
let currentSort = 'latest';
let currentPage = 1;
let cachedPosts = [];
let isLoading = false;

function normalizeContentType(value = '') {
  const key = String(value || '').trim();
  if (key === 'vote' || key === 'debate' || key === 'discussion' || key === 'ox') return 'vote';
  if (key === 'drip' || key === 'naming' || key === 'translation' || key === 'translate') return 'drip';
  return CONTENT_FILTERS.some(item => item.key === key) ? key : '';
}

export async function renderFeed() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const params = getQueryParams();
  currentType = normalizeContentType(params.type || '');
  currentSearch = params.q || '';
  currentSort = normalizeFeedSort(params.sort);
  currentPage = Math.max(1, Number(params.page || 1));
  cachedPosts = [];
  isLoading = false;
  setMeta('소소킹 커뮤니티', '소소킹 토론과 드립 글 목록');

  el.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean feed-page-list-only">
      <div id="feed-summary" class="soso-feed-summary feed-result-summary"></div>
      <div id="feed-list" class="soso-feed-list">${renderSkeletonCards(5)}</div>
      <div id="feed-pagination" class="feed-pagination"></div>
      <div id="feed-loader" class="loading-center" style="display:none"><div class="spinner"></div></div>
    </div>`;

  bindFeedEvents();
  await loadPosts();
}

function bindFeedEvents() {
  document.querySelectorAll('[data-type-filter]').forEach(btn => btn.addEventListener('click', () => {
    currentType = normalizeContentType(btn.dataset.typeFilter || '');
    currentPage = 1;
    refreshFeed();
  }));

  const searchInput = document.getElementById('feed-search-input');
  const searchBtn = document.getElementById('btn-feed-search');
  const clearBtn = document.getElementById('search-clear-btn');
  let debounceTimer = null;
  const doSearch = () => {
    currentSearch = searchInput?.value.trim() || '';
    currentPage = 1;
    refreshFeed();
    clearBtn?.style.setProperty('display', currentSearch ? 'inline-flex' : 'none');
  };
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
    currentPage = 1;
    refreshFeed();
    clearBtn.style.display = 'none';
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

async function loadPosts() {
  if (isLoading) return;
  isLoading = true;
  const loaderEl = document.getElementById('feed-loader');
  const listEl = document.getElementById('feed-list');
  if (loaderEl) loaderEl.style.display = 'flex';
  if (listEl) {
    listEl.classList.remove('is-empty');
    listEl.innerHTML = renderSkeletonCards(3);
  }

  try {
    const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(QUERY_LIMIT)));
    let posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(post => !post.hidden);
    if (currentSearch) posts = posts.filter(post => postMatchesSearch(post, currentSearch));
    if (currentType) posts = posts.filter(post => postMatchesType(post, currentType));
    cachedPosts = sortFeedPosts(posts, currentSort);
    renderCurrentPage();
  } catch (error) {
    console.error('콘텐츠 목록 로드 실패', error);
    if (listEl) {
      listEl.classList.add('is-empty');
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">글 목록을 불러오지 못했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요.</div></div>';
    }
  }

  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

function persistNavContext(posts) {
  try {
    sessionStorage.setItem(NAV_CONTEXT_KEY, JSON.stringify({ ids: posts.map(p => p.id).filter(Boolean), page: currentPage, type: currentType, search: currentSearch, sort: currentSort, href: window.location.hash || '#/feed', savedAt: Date.now() }));
    sessionStorage.setItem('sosoking:detailPostNav', JSON.stringify({ ids: posts.map(p => p.id).filter(Boolean), savedAt: Date.now() }));
  } catch {}
}

function renderCurrentPage() {
  const listEl = document.getElementById('feed-list');
  const summaryEl = document.getElementById('feed-summary');
  if (!listEl) return;
  const totalPages = Math.max(1, Math.ceil(cachedPosts.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pagePosts = cachedPosts.slice(start, start + PAGE_SIZE);
  if (summaryEl) summaryEl.innerHTML = renderFeedSummary({ total: cachedPosts.length, page: currentPage, totalPages, search: currentSearch, type: currentType, sort: currentSort });
  persistNavContext(pagePosts);
  listEl.classList.toggle('is-empty', !pagePosts.length);
  listEl.innerHTML = pagePosts.length ? pagePosts.map(post => renderFeedCard(post)).join('') : renderFeedEmptyState({ search: currentSearch });
  renderPagination(totalPages);
  bindSortEvents();
  updateUrlState();
}

function renderPagination(totalPages) {
  const el = document.getElementById('feed-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
  const end = Math.min(totalPages, start + 4);
  el.innerHTML = `
    <button class="feed-page-btn" data-feed-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전 페이지</button>
    <div class="feed-page-numbers">${Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => `<button class="feed-page-num ${p === currentPage ? 'active' : ''}" data-feed-page="${p}">${p}</button>`).join('')}</div>
    <button class="feed-page-btn" data-feed-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음 페이지</button>`;
  el.querySelectorAll('[data-feed-page]').forEach(btn => btn.addEventListener('click', () => {
    const value = btn.dataset.feedPage;
    if (value === 'prev') currentPage -= 1;
    else if (value === 'next') currentPage += 1;
    else currentPage = Number(value || 1);
    renderCurrentPage();
    document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
