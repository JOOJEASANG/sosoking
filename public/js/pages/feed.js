import { db } from '../firebase.js';
import { collection, query, orderBy, limit, startAfter, getDocs, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getQueryParams } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const CAT_TYPES = {
  golra: ['balance','vote','battle'],
  usgyo: ['naming','acrostic','drip'],
  malhe: ['ox','relay','random_battle'],
};

const CAT_LABELS = {
  '': '전체', golra: '골라봐', usgyo: '웃겨봐', malhe: '도전봐',
};

const TYPE_LABELS = {
  balance:'밸런스게임', vote:'민심투표', battle:'선택지배틀', challenge24:'24시간챌린지', tournament:'이상형월드컵',
  naming:'미친작명소', acrostic:'삼행시짓기', drip:'한줄드립', cbattle:'댓글배틀', laugh:'웃참챌린지',
  ox:'OX퀴즈', quiz:'4지선다', relay:'막장릴레이', word_relay:'단어릴레이', random_battle:'랜덤대결',
  howto:'노하우', story:'경험담', fail:'실패담', concern:'고민/질문',
};

let lastDoc      = null;
let currentCat   = '';
let currentType  = '';
let currentSearch = '';
let isLoading    = false;

export async function renderFeed() {
  setMeta('피드 · 전체 글');
  const el = document.getElementById('page-content');
  const params = getQueryParams();
  currentCat    = params.cat  || '';
  currentType   = params.type || '';
  currentSearch = params.q    || '';
  lastDoc = null;

  el.innerHTML = `
    <div class="layout-cols">
      <div class="layout-main">
        ${renderSearchBar()}
        ${renderFilterBar()}
        <div id="feed-list">${renderSkeletonCards(5)}</div>
        <div id="feed-loader" class="loading-center" style="display:none">
          <div class="spinner"></div>
        </div>
        <div id="feed-end" style="display:none;text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">
          더 이상 글이 없어요
        </div>
      </div>
      <aside class="layout-sidebar">
        ${renderTypeFilter()}
      </aside>
    </div>`;

  await loadPosts(true);
  setupInfiniteScroll();

  // 검색 이벤트
  const searchInput = document.getElementById('feed-search-input');
  const searchBtn   = document.getElementById('btn-feed-search');

  const doSearch = () => {
    const q = searchInput?.value.trim() || '';
    currentSearch = q;
    currentCat    = '';
    currentType   = '';
    lastDoc = null;
    updateFilterUI();
    loadPosts(true);
    if (q) {
      document.getElementById('search-clear-btn')?.style.setProperty('display', 'inline-flex');
    }
  };

  searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  searchBtn?.addEventListener('click', doSearch);

  document.getElementById('search-clear-btn')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSearch = '';
    lastDoc = null;
    updateFilterUI();
    loadPosts(true);
    document.getElementById('search-clear-btn').style.display = 'none';
  });

  // 필터 클릭 이벤트
  document.querySelectorAll('[data-cat-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCat    = btn.dataset.catFilter;
      currentType   = '';
      currentSearch = '';
      if (searchInput) searchInput.value = '';
      lastDoc = null;
      updateFilterUI();
      loadPosts(true);
    });
  });
  attachTypeFilterListeners();
}

function attachTypeFilterListeners() {
  document.querySelectorAll('[data-type-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType   = btn.dataset.typeFilter;
      currentSearch = '';
      const searchInput = document.getElementById('feed-search-input');
      if (searchInput) searchInput.value = '';
      if (currentType) {
        const found = Object.entries(CAT_TYPES).find(([, types]) => types.includes(currentType));
        if (found) currentCat = found[0];
      }
      lastDoc = null;
      updateFilterUI();
      loadPosts(true);
    });
  });
}

function renderSearchBar() {
  return `
    <div class="feed-search-bar">
      <div class="feed-search-input-wrap">
        <svg class="feed-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="feed-search-input" class="feed-search-input" placeholder="제목으로 검색..." value="${escHtml(currentSearch)}" autocomplete="off">
        <button id="search-clear-btn" class="feed-search-clear" style="display:${currentSearch ? 'inline-flex' : 'none'}">✕</button>
      </div>
      <button class="btn btn--primary btn--sm" id="btn-feed-search">검색</button>
    </div>`;
}

function renderFilterBar() {
  return `
    <div class="feed-filters" id="cat-filters">
      ${Object.entries(CAT_LABELS).map(([key, label]) => `
        <button class="filter-chip ${currentCat === key && !currentSearch ? 'active' : ''}" data-cat-filter="${key}">
          ${label}
        </button>`).join('')}
    </div>
    ${currentSearch ? `<div class="feed-search-label">🔍 "<strong>${escHtml(currentSearch)}</strong>" 검색 결과</div>` : ''}`;
}

function renderTypeFilter() {
  const cat = currentCat || null;
  const groups = cat ? { [cat]: CAT_TYPES[cat] } : CAT_TYPES;
  return `
    <div class="sidebar-widget">
      <div class="sidebar-widget__title">🗂 유형 필터</div>
      ${Object.entries(groups).map(([catKey, types]) => `
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--color-text-muted);margin-bottom:6px">
            ${{ golra:'골라봐', usgyo:'웃겨봐', malhe:'도전봐' }[catKey]}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${types.map(t => `
              <button class="filter-chip ${currentType === t ? 'active' : ''}" data-type-filter="${t}" style="font-size:11px">
                ${TYPE_LABELS[t]}
              </button>`).join('')}
          </div>
        </div>`).join('')}
      ${currentType ? `<button class="btn btn--ghost btn--sm btn--full" data-type-filter="">전체 보기</button>` : ''}
    </div>`;
}

function updateFilterUI() {
  document.querySelectorAll('[data-cat-filter]').forEach(b => {
    b.classList.toggle('active', b.dataset.catFilter === currentCat && !currentSearch);
  });
  // 카테고리가 바뀌면 사이드바 유형 필터도 다시 그림
  const sidebar = document.querySelector('.layout-sidebar');
  if (sidebar) {
    sidebar.innerHTML = renderTypeFilter();
    attachTypeFilterListeners();
  }
}

async function loadPosts(reset = false) {
  if (isLoading) return;
  isLoading = true;

  const loaderEl = document.getElementById('feed-loader');
  const listEl   = document.getElementById('feed-list');
  const endEl    = document.getElementById('feed-end');

  if (loaderEl) loaderEl.style.display = 'flex';

  try {
    let constraints;

    if (currentSearch) {
      // 제목 prefix 검색 — orderBy('title') 필수
      const qEnd = currentSearch.slice(0, -1) + String.fromCharCode(currentSearch.charCodeAt(currentSearch.length - 1) + 1);
      constraints = [
        where('title', '>=', currentSearch),
        where('title', '<',  qEnd),
        orderBy('title'),
        limit(30),
      ];
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
    } else {
      constraints = [orderBy('createdAt', 'desc'), limit(15)];
      if (currentType)     constraints.unshift(where('type', '==', currentType));
      else if (currentCat) constraints.unshift(where('cat',  '==', currentCat));
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'feeds'), ...constraints);
    const snap = await getDocs(q);

    if (reset && listEl) listEl.innerHTML = '';

    if (snap.empty && reset) {
      if (listEl) listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">${currentSearch ? '🔍' : '🌱'}</div>
          <div class="empty-state__title">${currentSearch ? '검색 결과가 없어요' : '아직 글이 없어요'}</div>
          <div class="empty-state__desc">${currentSearch ? '다른 검색어로 시도해보세요' : '첫 번째 놀이판을 열어보세요!'}</div>
          ${!currentSearch ? `<button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write')">만들기</button>` : ''}
        </div>`;
      if (endEl) endEl.style.display = 'block';
    } else {
      snap.docs.filter(d => !d.data().hidden).forEach(d => {
        const html = renderFeedCard({ id: d.id, ...d.data() });
        if (listEl) listEl.insertAdjacentHTML('beforeend', html);
      });
      lastDoc = snap.docs[snap.docs.length - 1];
      const pageSize = currentSearch ? 30 : 15;
      if (snap.docs.length < pageSize && endEl) endEl.style.display = 'block';
    }
  } catch (e) {
    console.error('피드 로드 실패', e);
  }

  if (loaderEl) loaderEl.style.display = 'none';
  isLoading = false;
}

function setupInfiniteScroll() {
  const sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  document.getElementById('feed-list')?.after(sentinel);

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !isLoading) loadPosts(false);
  }, { rootMargin: '200px' });

  observer.observe(sentinel);
}

