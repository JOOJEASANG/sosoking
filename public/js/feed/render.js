import { escHtml } from '../utils/helpers.js';
import { FILTER_TYPES, SORT_LABELS, TYPE_LABELS } from './filter.js';

export function renderFeedSearchBar({ search = '' } = {}) {
  return `
    <div class="soso-feed-search" role="search">
      <div class="soso-feed-search__input-wrap">
        <svg class="soso-feed-search__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="feed-search-input" class="soso-feed-search__input" placeholder="제목·본문·태그 검색" value="${escHtml(search)}" autocomplete="off" inputmode="search">
        <button id="search-clear-btn" class="soso-feed-search__clear" type="button" aria-label="검색어 지우기" style="display:${search ? 'inline-flex' : 'none'}">✕</button>
      </div>
      <button class="soso-feed-search__button" id="btn-feed-search" type="button">검색</button>
    </div>`;
}

export function renderFeedFilterBar({ type = '', search = '' } = {}) {
  return `
    <div class="soso-feed-controls">
      <div class="soso-feed-chips" id="cat-filters" aria-label="피드 유형 필터">
        <button class="soso-feed-chip ${!type && !search ? 'active' : ''}" data-type-filter="" type="button">전체</button>
        ${FILTER_TYPES.map(key => `
          <button class="soso-feed-chip ${type === key && !search ? 'active' : ''}" data-type-filter="${key}" type="button">
            ${TYPE_LABELS[key]}
          </button>`).join('')}
      </div>
    </div>
    ${search ? `<div class="soso-feed-search-label">🔍 "<strong>${escHtml(search)}</strong>" 검색 결과 · 검색 중에는 유형 필터가 자동 해제됩니다.</div>` : ''}`;
}

export function renderFeedSortSelect({ sort = 'latest' } = {}) {
  return `
    <label class="soso-feed-sort soso-feed-sort--summary" aria-label="피드 정렬">
      <span>정렬</span>
      <select id="feed-sort-select">
        ${Object.entries(SORT_LABELS).map(([key, label]) => `<option value="${key}" ${sort === key ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </label>`;
}

export function renderFeedSummary({ total = 0, page = 1, totalPages = 1, search = '', type = '', sort = 'latest' } = {}) {
  const label = search ? `검색 ${escHtml(search)}` : (type ? TYPE_LABELS[type] || '필터' : '전체');
  const sortControl = renderFeedSortSelect({ sort });
  if (total === null) return `<div class="soso-feed-summary__inner"><div class="soso-feed-summary__meta"><span>${label}</span><span>${page}페이지</span></div>${sortControl}</div>`;
  if (!total) return `<div class="soso-feed-summary__inner"><div class="soso-feed-summary__meta"><span>${label}</span><b>0개</b></div>${sortControl}</div>`;
  return `<div class="soso-feed-summary__inner"><div class="soso-feed-summary__meta"><span>${label}</span><b>${Number(total).toLocaleString()}개</b><span>${page}/${totalPages ?? '?'}페이지</span></div>${sortControl}</div>`;
}

export function renderFeedEmptyState({ search = '' } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${search ? '🔍' : '🌱'}</div>
      <div class="empty-state__title">${search ? `"${escHtml(search)}" 검색 결과가 없어요` : '아직 아무 글도 없어요'}</div>
      <div class="empty-state__desc">${search ? '다른 검색어나 유형명으로 다시 찾아보세요.' : '첫 번째 피드 글을 올려볼까요?'}</div>
      ${search
        ? `<button class="btn btn--ghost" style="margin-top:16px" onclick="navigate('/feed')">전체 피드 보기</button>`
        : `<button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write?type=multi')">+ 글쓰기</button>`}
    </div>`;
}

export function updateFeedFilterUI({ type = '', search = '', sort = 'latest' } = {}) {
  document.querySelectorAll('[data-type-filter]').forEach(b => {
    b.classList.toggle('active', b.dataset.typeFilter === type && !search);
  });
  const select = document.getElementById('feed-sort-select');
  if (select) select.value = sort;
}