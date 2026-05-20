import { escHtml } from '../utils/helpers.js';
import { FILTER_TYPES, SORT_LABELS, TYPE_LABELS } from './filter.js';

export function renderFeedSearchBar({ search = '' } = {}) {
  return `
    <div class="feed-search-bar feed-search-bar--compact">
      <div class="feed-search-input-wrap feed-search-input-wrap--compact">
        <svg class="feed-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="feed-search-input" class="feed-search-input" placeholder="제목, 본문, 태그, 유형 검색" value="${escHtml(search)}" autocomplete="off">
        <button id="search-clear-btn" class="feed-search-clear" style="display:${search ? 'inline-flex' : 'none'}">✕</button>
      </div>
      <button class="btn btn--ghost btn--sm feed-search-btn" id="btn-feed-search">검색</button>
      <button class="btn btn--primary btn--sm feed-write-plus-btn" id="btn-feed-write">+ 피드 만들기</button>
    </div>`;
}

export function renderFeedFilterBar({ type = '', search = '', sort = 'latest' } = {}) {
  return `
    <div class="feed-control-wrap feed-control-wrap--with-sort">
      <div class="feed-filters feed-filters--compact" id="cat-filters">
        <button class="filter-chip ${!type && !search ? 'active' : ''}" data-type-filter="">전체</button>
        ${FILTER_TYPES.map(key => `
          <button class="filter-chip ${type === key && !search ? 'active' : ''}" data-type-filter="${key}">
            ${TYPE_LABELS[key]}
          </button>`).join('')}
      </div>
      <label class="feed-sort-dropdown" aria-label="피드 정렬">
        <span>정렬</span>
        <select id="feed-sort-select">
          ${Object.entries(SORT_LABELS).map(([key, label]) => `<option value="${key}" ${sort === key ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
    </div>
    ${search ? `<div class="feed-search-label">🔍 "<strong>${escHtml(search)}</strong>" 검색 결과 · 검색 중에는 유형 필터가 자동 해제됩니다.</div>` : ''}`;
}

export function renderFeedSummary({ total = 0, page = 1, totalPages = 1, search = '', type = '', sort = 'latest' } = {}) {
  const label = search ? `검색 ${escHtml(search)}` : (type ? TYPE_LABELS[type] || '필터' : '전체');
  const sortLabel = SORT_LABELS[sort] || SORT_LABELS.latest;
  if (!total) return `<div class="feed-result-summary__inner"><span>${label}</span><b>0개</b><span>${sortLabel}</span></div>`;
  return `<div class="feed-result-summary__inner"><span>${label}</span><b>${Number(total).toLocaleString()}개</b><span>${page}/${totalPages}페이지</span><span>${sortLabel}</span></div>`;
}

export function renderFeedEmptyState({ search = '' } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${search ? '🔍' : '🌱'}</div>
      <div class="empty-state__title">${search ? `"${escHtml(search)}" 검색 결과가 없어요` : '아직 아무 글도 없어요'}</div>
      <div class="empty-state__desc">${search ? '다른 검색어나 유형명으로 다시 찾아보세요.' : '첫 번째 피드 글을 올려볼까요?'}</div>
      ${!search ? `<button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write?type=multi')">+ 피드 만들기</button>` : `<button class="btn btn--ghost" style="margin-top:16px" onclick="navigate('/feed')">전체 피드 보기</button>`}
    </div>`;
}

export function updateFeedFilterUI({ type = '', search = '', sort = 'latest' } = {}) {
  document.querySelectorAll('[data-type-filter]').forEach(b => {
    b.classList.toggle('active', b.dataset.typeFilter === type && !search);
  });
  const select = document.getElementById('feed-sort-select');
  if (select) select.value = sort;
}
