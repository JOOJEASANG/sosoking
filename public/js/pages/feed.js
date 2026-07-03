import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams, navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { getPublicAiResidents } from '../ai-residents.js';
import { normalizeFeedSort, postMatchesType, postMatchesSearch, sortFeedPosts } from '../feed/filter.js';
import { renderFeedSearchBar, renderFeedFilterBar, renderFeedEmptyState, updateFeedFilterUI, renderFeedSummary } from '../feed/render.js';

const PAGE_SIZE = 20;
const QUERY_LIMIT = 160;
const NAV_CONTEXT_KEY = 'sosoking:feedNavContext';

const GAME_FILTERS = [
  { key: '', icon: '✨', label: '전체', write: 'judgment' },
  { key: 'judgment', icon: '⚖️', label: '판결', write: 'judgment' },
  { key: 'consult', icon: '🫠', label: '상담', write: 'consult' },
  { key: 'vote', icon: '🗳️', label: '토론', write: 'vote' },
  { key: 'drip', icon: '😂', label: '드립', write: 'drip' },
];

let currentType = '';
let currentSearch = '';
let currentSort = 'latest';
let currentPage = 1;
let cachedPosts = [];
let isLoading = false;

function normalizeGameType(value = '') {
  const key = String(value || '').trim();
  if (key === 'collect' || key === 'general' || key === 'category') return 'judgment';
  if (key === 'quiz' || key === 'initial_game') return 'consult';
  if (GAME_FILTERS.some(item => item.key === key)) return key;
  return '';
}

function currentGameFilter() {
  return GAME_FILTERS.find(item => item.key === currentType) || GAME_FILTERS[0];
}

function renderGameTabs() {
  return `<div class="soso-room-tabs" aria-label="게임 필터">${GAME_FILTERS.map(item => `<button type="button" class="soso-room-tab ${currentType === item.key ? 'active' : ''}" data-type-filter="${item.key}"><span>${item.icon}</span>${item.label}</button>`).join('')}</div>`;
}

function renderGameHead() {
  return `
    <div class="soso-room-head">
      <div class="soso-room-head__label">🎮 AI 캐릭터 게임 커뮤니티</div>
      <div class="soso-room-head__title">판결 · 상담 · 토론 · 드립</div>
      <div class="soso-room-head__desc">사소한 이야기도 8명의 AI 캐릭터가 끼어들면 게임이 됩니다.</div>
      <div class="soso-room-head__action"><button class="btn btn--primary btn--sm" type="button" id="room-write-btn">게임 열기</button></div>
    </div>`;
}

function renderAiResidentsIntro() {
  const residents = getPublicAiResidents();
  return `
    <section class="soso-ai-residents" aria-label="AI 캐릭터 소개" style="margin:14px 0;padding:16px;border:1px solid var(--color-border,#e5e7eb);border-radius:18px;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(236,72,153,.06));">
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px;">
        <div>
          <div style="font-size:13px;font-weight:900;color:var(--color-primary,#6366f1);margin-bottom:4px;">8명 캐릭터 대기중</div>
          <div style="font-size:20px;font-weight:950;color:var(--color-text-primary,#111827);line-height:1.25;">게임을 열면 성격 다른 캐릭터들이 댓글로 끼어듭니다</div>
          <div style="font-size:13px;color:var(--color-text-secondary,#6b7280);margin-top:6px;">판결·상담·토론·드립에 맞춰 어울리는 캐릭터가 자연스럽게 참여합니다.</div>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" id="ai-residents-write-btn">캐릭터에게 판결받기</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:4px 2px 2px;">
        ${residents.map(resident => `
          <div style="padding:14px;border-radius:16px;min-height:92px;background:rgba(255,255,255,.72);border:1px solid rgba(148,163,184,.28);">
            <div style="display:flex;align-items:center;gap:7px;font-weight:950;color:var(--color-text-primary,#111827);"><span style="font-size:20px">${resident.emoji}</span>${resident.name}</div>
            <div style="font-size:12px;font-weight:800;color:var(--color-text-secondary,#6b7280);margin-top:5px;">${resident.role} · ${resident.mbti || ''}</div>
            <div style="font-size:11px;color:var(--color-text-muted,#9ca3af);margin-top:6px;line-height:1.35;">${resident.specialty}</div>
            <div style="font-size:11px;color:var(--color-primary,#6366f1);margin-top:8px;line-height:1.35;">${(resident.catchphrases || []).slice(0, 1).join('')}</div>
          </div>`).join('')}
      </div>
    </section>`;
}

export async function renderFeed() {
  const el = document.getElementById('page-content');
  const params = getQueryParams();
  currentType = normalizeGameType(params.type || '');
  currentSearch = params.q || '';
  currentSort = normalizeFeedSort(params.sort);
  currentPage = Math.max(1, Number(params.page || 1));
  cachedPosts = [];
  isLoading = false;
  setMeta('소소킹 게임', '판결·상담·토론·드립 AI 캐릭터 게임');

  el.innerHTML = `
    <div class="soso-feed-page layout-main layout-main--full feed-page-clean">
      <div class="soso-feed-toolbar">
        ${renderGameTabs()}
        ${renderGameHead()}
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
  document.getElementById('room-write-btn')?.addEventListener('click', () => navigate(`/write?type=multi&preset=${currentGameFilter().write || 'judgment'}`));
  document.getElementById('ai-residents-write-btn')?.addEventListener('click', () => navigate('/write?type=multi&preset=judgment'));
  document.querySelectorAll('[data-type-filter]').forEach(btn => btn.addEventListener('click', () => {
    currentType = btn.dataset.typeFilter || '';
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
    console.error('게임 목록 로드 실패', error);
    if (listEl) {
      listEl.classList.add('is-empty');
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">게임을 불러오지 못했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요.</div></div>';
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
