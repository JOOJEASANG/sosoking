import { db, auth, functions } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, startAfter, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
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

import { toast } from '../components/toast.js';

const PAGE_SIZE    = 20;
const FILTER_LIMIT = 500;
const NAV_CONTEXT_KEY = 'sosoking:feedNavContext';

const ROOMS = [
  { key: '',             icon: '✨', label: '전체',   title: '전체',   desc: '판결소·창작소·토론왕 콘텐츠를 한 번에 봅니다.' },
  { key: 'ai_judge',     icon: '⚖️', label: '판결소', title: '판결소', desc: '억울한 상황 → 5인 캐릭터가 각자 판결합니다.', path: '/ai-judge' },
  { key: 'ai_translate', icon: '✨', label: '창작소', title: '창작소', desc: '번역하기 + 이름짓기 두 가지를 한 곳에서.', path: '/ai-translate' },
  { key: 'ai_debate',    icon: '🗣️', label: '토론왕', title: '토론왕', desc: '매일 한 주제로 캐릭터 6인이 벌이는 말싸움 구경.' },
];

const AI_TYPES = ['ai_judge', 'ai_translate', 'ai_naming', 'ai_debate'];

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
        ${activeRoom.path ? `<a class="soso-room-desc__cta" href="#${activeRoom.path}">직접 해보기 →</a>` : ''}
      </div>`
    : '';
  return `
    <div class="soso-room-tabs-wrap">
      <div class="soso-room-tabs" role="tablist" aria-label="방별 보기">
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
  setMeta('소소킹 피드');
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
      <div class="soso-feed-toolbar">
        ${renderRoomTabs()}
        ${renderFeedSearchBar({ search: currentSearch })}
        ${renderFeedFilterBar({ type: currentType, search: currentSearch })}
      </div>
      <div id="debate-topic-form-area"></div>
      <div id="feed-summary" class="soso-feed-summary feed-result-summary"></div>
      <div id="feed-list" class="soso-feed-list">${renderSkeletonCards(5)}</div>
      <div id="feed-pagination" class="feed-pagination"></div>
      <div id="feed-loader" class="loading-center" style="display:none"><div class="spinner"></div></div>
    </div>`;

  bindFeedEvents();
  renderDebateTopicForm();
  await loadPosts();
}

function bindFeedEvents() {
  bindSearchEvents();
  bindTypeFilterEvents();
}

function renderDebateTopicForm() {
  const area = document.getElementById('debate-topic-form-area');
  if (!area) return;
  if (currentType !== 'ai_debate') { area.innerHTML = ''; return; }

  const loggedIn = !!auth.currentUser;
  area.innerHTML = `
    <div class="debate-topic-form card" style="margin-bottom:14px">
      <div class="card__body" style="padding:14px 16px">
        <div style="font-size:13px;font-weight:800;margin-bottom:10px">💬 주제 직접 올리기 <span style="font-weight:400;color:var(--color-text-muted);font-size:11px">하루 3개 · 유저끼리 토론</span></div>
        <input id="user-debate-input" class="form-input" style="font-size:13px;margin-bottom:8px;width:100%"
          placeholder="${loggedIn ? '토론 주제를 입력하세요 (예: 부먹 vs 찍먹 뭐가 맞아?)' : '로그인 후 주제를 올릴 수 있어요'}"
          maxlength="100" ${!loggedIn ? 'disabled' : ''}>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input id="user-debate-option-a" class="form-input" style="flex:1;font-size:13px"
            placeholder="🔴 A편 선택지" maxlength="40" ${!loggedIn ? 'disabled' : ''}>
          <input id="user-debate-option-b" class="form-input" style="flex:1;font-size:13px"
            placeholder="🔵 B편 선택지" maxlength="40" ${!loggedIn ? 'disabled' : ''}>
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button id="user-debate-submit" class="btn btn--primary btn--sm" ${!loggedIn ? 'disabled' : ''}>올리기</button>
        </div>
      </div>
    </div>`;

  if (!loggedIn) return;
  const input = area.querySelector('#user-debate-input');
  const optionA = area.querySelector('#user-debate-option-a');
  const optionB = area.querySelector('#user-debate-option-b');
  const btn = area.querySelector('#user-debate-submit');
  btn?.addEventListener('click', async () => {
    const topic = input?.value.trim();
    if (!topic || topic.length < 3) { toast.warn('주제를 3자 이상 입력해주세요'); return; }
    const oA = optionA?.value.trim() || '';
    const oB = optionB?.value.trim() || '';
    if ((oA && !oB) || (!oA && oB)) { toast.warn('A편·B편 선택지를 둘 다 입력해주세요'); return; }
    btn.disabled = true; btn.textContent = '올리는 중...';
    try {
      const res = await httpsCallable(functions, 'createUserDebateTopic')({ topic, optionA: oA, optionB: oB });
      toast.success('주제가 올라갔어요! 🗣️');
      navigate(`/detail/${res.data.postId}`);
    } catch (e) {
      toast.error(e.message || '올리기 실패');
    } finally {
      btn.disabled = false; btn.textContent = '올리기';
    }
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
  // 탭 active + desc 업데이트
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
      ${activeRoom.path ? `<a class="soso-room-desc__cta" href="#${activeRoom.path}">직접 해보기 →</a>` : ''}`;
    if (descEl) { descEl.innerHTML = html; descEl.hidden = false; }
    else {
      const wrap = document.querySelector('.soso-room-tabs-wrap');
      if (wrap) { const d = document.createElement('div'); d.className = 'soso-room-desc'; d.innerHTML = html; wrap.appendChild(d); }
    }
  } else {
    if (descEl) descEl.hidden = true;
  }
  renderDebateTopicForm();
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
    ai_judge:     ['ai_judge'],
    ai_translate: ['ai_translate', 'ai_naming'],
    ai_debate:    ['ai_debate'],
  };
  const types = map[type];
  if (!types) return null;
  return types.length === 1 ? where('type', '==', types[0]) : where('type', 'in', types.slice(0, 10));
}

function onlyAiPosts(posts) {
  return posts.filter(p => AI_TYPES.includes(p.feedType || p.type));
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
    console.error('피드 로드 실패', err);
    if (listEl) {
      listEl.classList.add('is-empty');
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">피드를 불러오지 못했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요.</div></div>`;
    }
  }
  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

async function loadCursorPage(page) {
  const startCursor = page > 1 ? cursorStack[page - 2] : null;
  const constraints = [where('type', 'in', AI_TYPES), orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1)];
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
      console.warn('[feed] feedType query failed, fallback legacy query', error);
      const constraints = [orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)];
      const typeWhere = getLegacyTypeWhereClause(currentType);
      if (typeWhere) constraints.unshift(typeWhere);
      const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
      posts = posts.filter(p => postMatchesType(p, currentType));
    }
  } else {
    const snap = await getDocs(query(collection(db, 'feeds'), where('type', 'in', AI_TYPES), orderBy('createdAt', 'desc'), limit(FILTER_LIMIT)));
    posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
  }
  posts = onlyAiPosts(posts);
  if (currentSearch) posts = posts.filter(p => postMatchesSearch(p, currentSearch));
  if (currentType && currentSearch) posts = posts.filter(p => postMatchesType(p, currentType));
  cachedPosts = sortFeedPosts(posts, currentSort);
}

function persistNavContext(posts) {
  lastDisplayPosts = posts || [];
  try {
    sessionStorage.setItem(NAV_CONTEXT_KEY, JSON.stringify({ ids: lastDisplayPosts.map(p => p.id).filter(Boolean), page: currentPage, type: currentType, search: currentSearch, sort: currentSort, href: window.location.hash || '#/feed', savedAt: Date.now() }));
    sessionStorage.setItem('sosoking:detailPostNav', JSON.stringify({ ids: lastDisplayPosts.map(p => p.id).filter(Boolean), savedAt: Date.now() }));
  } catch {}
}

function renderCurrentPage() {
  const listEl = document.getElementById('feed-list');
  const summaryEl = document.getElementById('feed-summary');
  if (!listEl) return;
  const displayPosts = cachedPosts;
  if (useCursorMode()) {
    if (summaryEl) summaryEl.innerHTML = renderFeedSummary({ total: null, page: currentPage, totalPages: null, search: currentSearch, type: currentType, sort: currentSort });
    persistNavContext(displayPosts);
    listEl.classList.toggle('is-empty', !displayPosts.length);
    listEl.innerHTML = displayPosts.length ? displayPosts.map(p => renderFeedCard(p)).join('') : renderFeedEmptyState({ search: currentSearch });
    renderCursorPagination();
  } else {
    const totalPages = Math.max(1, Math.ceil(displayPosts.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pagePosts = displayPosts.slice(start, start + PAGE_SIZE);
    if (summaryEl) summaryEl.innerHTML = renderFeedSummary({ total: displayPosts.length, page: currentPage, totalPages, search: currentSearch, type: currentType, sort: currentSort });
    persistNavContext(pagePosts);
    listEl.classList.toggle('is-empty', !pagePosts.length);
    listEl.innerHTML = pagePosts.length ? pagePosts.map(p => renderFeedCard(p)).join('') : renderFeedEmptyState({ search: currentSearch });
    renderOffsetPagination(totalPages);
  }
  bindSortEvents(); updateUrlState();
}

function renderCursorPagination() {
  const el = document.getElementById('feed-pagination');
  if (!el) return;
  const hasPrev = currentPage > 1;
  const hasNext = cursorStack[currentPage - 1] !== undefined;
  if (!hasPrev && !hasNext) { el.innerHTML = ''; return; }
  el.innerHTML = `<button class="feed-page-btn" data-cursor-page="prev" ${!hasPrev ? 'disabled' : ''}>이전 페이지</button><span class="feed-page-current">${currentPage}페이지</span><button class="feed-page-btn" data-cursor-page="next" ${!hasNext ? 'disabled' : ''}>다음 페이지</button>`;
  el.querySelector('[data-cursor-page="prev"]')?.addEventListener('click', async () => { if (currentPage <= 1) return; currentPage -= 1; await loadPosts(); document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  el.querySelector('[data-cursor-page="next"]')?.addEventListener('click', async () => { currentPage += 1; await loadPosts(); document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

function renderOffsetPagination(totalPages) {
  const el = document.getElementById('feed-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
  const end = Math.min(totalPages, start + 4);
  el.innerHTML = `<button class="feed-page-btn" data-feed-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전 페이지</button><div class="feed-page-numbers">${Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => `<button class="feed-page-num ${p === currentPage ? 'active' : ''}" data-feed-page="${p}">${p}</button>`).join('')}</div><button class="feed-page-btn" data-feed-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음 페이지</button>`;
  el.querySelectorAll('[data-feed-page]').forEach(btn => btn.addEventListener('click', () => { const v = btn.dataset.feedPage; if (v === 'prev') currentPage -= 1; else if (v === 'next') currentPage += 1; else currentPage = Number(v || 1); renderCurrentPage(); document.querySelector('.soso-feed-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
}
