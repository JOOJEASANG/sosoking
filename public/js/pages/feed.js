import { getQueryParams, navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { fetchFeeds, fetchHotPosts } from '../services/feed-service.js';

const PAGE_SIZE = 20;
const FILTERS = [
  { key: '', icon: '✨', label: '전체', preset: 'judgment' },
  { key: 'judgment', icon: '⚖️', label: '판결', preset: 'judgment' },
  { key: 'consult', icon: '🫠', label: '상담', preset: 'consult' },
  { key: 'vote', icon: '🗳️', label: '토론', preset: 'vote' },
  { key: 'drip', icon: '😂', label: '드립', preset: 'drip' },
];

let currentType = '';
let currentSearch = '';
let currentSort = 'latest';
let currentPage = 1;
let pages = new Map();
let cursors = new Map([[1, null]]);
let hasMore = false;
let loading = false;

function normalizeType(value) {
  const key = String(value || '').trim();
  return FILTERS.some(item => item.key === key) ? key : '';
}
function escapeText(value) {
  return String(value || '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
function matchesSearch(post, search) {
  if (!search) return true;
  const needle = search.toLowerCase().replace(/\s+/g, '');
  const text = [post.title, post.desc, post.authorName, ...(post.tags || [])].join(' ').toLowerCase().replace(/\s+/g, '');
  return text.includes(needle);
}
function selectedFilter() {
  return FILTERS.find(item => item.key === currentType) || FILTERS[0];
}
function updateHash() {
  const params = new URLSearchParams();
  if (currentType) params.set('type', currentType);
  if (currentSearch) params.set('q', currentSearch);
  if (currentSort !== 'latest') params.set('sort', currentSort);
  if (currentPage > 1) params.set('page', String(currentPage));
  const hash = params.toString() ? `#/feed?${params}` : '#/feed';
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
function resetData() {
  currentPage = 1;
  pages = new Map();
  cursors = new Map([[1, null]]);
  hasMore = false;
}

export async function renderFeed() {
  const root = document.getElementById('page-content');
  if (!root) return;
  const params = getQueryParams();
  currentType = normalizeType(params.type);
  currentSearch = String(params.q || '').trim();
  currentSort = params.sort === 'popular' ? 'popular' : 'latest';
  currentPage = Math.max(1, Number(params.page || 1));
  pages = new Map();
  cursors = new Map([[1, null]]);
  setMeta('소소킹 커뮤니티', '판결, 상담, 토론, 드립에 AI 캐릭터와 회원이 함께 참여합니다.');
  root.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean">
      <div class="soso-room-tabs">${FILTERS.map(item => `<button type="button" class="soso-room-tab ${currentType === item.key ? 'active' : ''}" data-feed-type="${item.key}"><span>${item.icon}</span>${item.label}</button>`).join('')}</div>
      <section class="soso-room-head">
        <div><div class="soso-room-head__label">🎭 AI 캐릭터 참여 커뮤니티</div><div class="soso-room-head__title">판결 · 상담 · 토론 · 드립</div></div>
        <button class="btn btn--primary btn--sm" type="button" data-feed-write>글쓰기</button>
      </section>
      <div class="soso-feed-toolbar-row" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
        <input id="feed-search-input" class="form-input" style="flex:1;min-width:180px" value="${escapeText(currentSearch)}" placeholder="제목, 내용, 태그 검색">
        <select id="feed-sort-select" class="form-select"><option value="latest" ${currentSort === 'latest' ? 'selected' : ''}>최신순</option><option value="popular" ${currentSort === 'popular' ? 'selected' : ''}>인기순</option></select>
        <button type="button" class="btn btn--ghost" data-feed-search>검색</button>
      </div>
      <div id="feed-summary" class="soso-feed-summary"></div>
      <div id="feed-list" class="soso-feed-list">${renderSkeletonCards(5)}</div>
      <div id="feed-pagination" class="feed-pagination"></div>
    </div>`;
  bindEvents(root);
  await goToPage(currentPage);
}

function bindEvents(root) {
  root.querySelectorAll('[data-feed-type]').forEach(button => button.addEventListener('click', async () => {
    currentType = button.dataset.feedType || '';
    root.querySelectorAll('[data-feed-type]').forEach(item => item.classList.toggle('active', item === button));
    resetData();
    updateHash();
    await goToPage(1);
  }));
  root.querySelector('[data-feed-write]')?.addEventListener('click', () => navigate(`/write?type=multi&preset=${selectedFilter().preset}`));
  const searchInput = root.querySelector('#feed-search-input');
  const applySearch = async () => {
    currentSearch = searchInput?.value.trim() || '';
    resetData();
    updateHash();
    await goToPage(1);
  };
  root.querySelector('[data-feed-search]')?.addEventListener('click', applySearch);
  searchInput?.addEventListener('keydown', event => { if (event.key === 'Enter') applySearch(); });
  root.querySelector('#feed-sort-select')?.addEventListener('change', async event => {
    currentSort = event.target.value === 'popular' ? 'popular' : 'latest';
    resetData();
    updateHash();
    await goToPage(1);
  });
}

async function loadSearchResults() {
  const loaded = [];
  let cursor = null;
  for (let index = 0; index < 5; index += 1) {
    const result = await fetchFeeds({ subtype: currentType, lastDoc: cursor, pageSize: 40 });
    loaded.push(...result.posts);
    cursor = result.lastDoc;
    if (!result.hasMore) break;
  }
  return loaded.filter(post => matchesSearch(post, currentSearch));
}

async function loadPopularResults() {
  const posts = await fetchHotPosts(100);
  return posts.filter(post => (!currentType || post.subtype === currentType) && matchesSearch(post, currentSearch));
}

async function ensureLatestPage(page) {
  for (let number = 1; number <= page; number += 1) {
    if (pages.has(number)) continue;
    const cursor = cursors.get(number) || null;
    const result = await fetchFeeds({ subtype: currentType, lastDoc: cursor, pageSize: PAGE_SIZE });
    pages.set(number, result.posts);
    cursors.set(number + 1, result.lastDoc);
    if (number === page) hasMore = result.hasMore;
    if (!result.hasMore && number < page) break;
  }
}

async function goToPage(page) {
  if (loading) return;
  loading = true;
  const list = document.getElementById('feed-list');
  const summary = document.getElementById('feed-summary');
  if (list) list.innerHTML = renderSkeletonCards(4);
  try {
    let posts;
    let totalPages = null;
    if (currentSearch) {
      const all = currentSort === 'popular' ? await loadPopularResults() : await loadSearchResults();
      totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, page), totalPages);
      posts = all.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
      hasMore = currentPage < totalPages;
    } else if (currentSort === 'popular') {
      const all = await loadPopularResults();
      totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, page), totalPages);
      posts = all.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
      hasMore = currentPage < totalPages;
    } else {
      currentPage = Math.max(1, page);
      await ensureLatestPage(currentPage);
      posts = pages.get(currentPage) || [];
    }
    list.innerHTML = posts.length ? posts.map(renderFeedCard).join('') : '<div class="empty-state"><div class="empty-state__title">조건에 맞는 글이 없습니다.</div></div>';
    summary.textContent = currentSearch ? `“${currentSearch}” 검색 결과 · ${currentPage}페이지` : `${selectedFilter().label} · ${currentSort === 'popular' ? '인기순' : '최신순'}`;
    renderPagination(totalPages);
    updateHash();
  } catch (error) {
    console.error('[feed]', error);
    list.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">글을 불러오지 못했습니다.</div></div>';
  } finally {
    loading = false;
  }
}

function renderPagination(totalPages) {
  const root = document.getElementById('feed-pagination');
  if (!root) return;
  const previous = currentPage > 1;
  const next = totalPages ? currentPage < totalPages : hasMore;
  root.innerHTML = `<button class="feed-page-btn" type="button" data-page-prev ${previous ? '' : 'disabled'}>이전</button><span class="feed-page-status">${currentPage}페이지</span><button class="feed-page-btn" type="button" data-page-next ${next ? '' : 'disabled'}>다음</button>`;
  root.querySelector('[data-page-prev]')?.addEventListener('click', () => goToPage(currentPage - 1));
  root.querySelector('[data-page-next]')?.addEventListener('click', () => goToPage(currentPage + 1));
}
