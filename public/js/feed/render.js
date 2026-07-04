import { escHtml } from '../utils/helpers.js';
import { SORT_LABELS, TYPE_LABELS } from './filter.js';

export function renderFeedSearchBar({ search = '' } = {}) {
  return `
    <div class="soso-feed-search" role="search">
      <div class="soso-feed-search__input-wrap">
        <svg class="soso-feed-search__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="feed-search-input" class="soso-feed-search__input" placeholder="업로드된 글 검색" value="${escHtml(search)}" autocomplete="off" inputmode="search">
        <button id="search-clear-btn" class="soso-feed-search__clear" type="button" aria-label="검색어 지우기" style="display:${search ? 'inline-flex' : 'none'}">✕</button>
      </div>
      <button class="soso-feed-search__button" id="btn-feed-search" type="button">검색</button>
    </div>`;
}

export function renderFeedFilterBar({ search = '' } = {}) {
  return search ? `<div class="soso-feed-search-label">검색 결과: <strong>${escHtml(search)}</strong></div>` : '';
}

export function renderFeedSortSelect({ sort = 'latest' } = {}) {
  return `
    <label class="soso-feed-sort soso-feed-sort--summary" aria-label="글 정렬">
      <span>정렬</span>
      <select id="feed-sort-select">
        ${Object.entries(SORT_LABELS).map(([key, label]) => `<option value="${key}" ${sort === key ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </label>`;
}

export function renderFeedSummary({ total = 0, page = 1, totalPages = 1, search = '', type = '', sort = 'latest' } = {}) {
  const label = search ? `검색 ${escHtml(search)}` : (type ? TYPE_LABELS[type] || '필터' : '전체 글');
  const sortControl = renderFeedSortSelect({ sort });
  if (total === null) return `<div class="soso-feed-summary__inner"><div class="soso-feed-summary__meta"><span>${label}</span><span>${page}페이지</span></div>${sortControl}</div>`;
  if (!total) return `<div class="soso-feed-summary__inner"><div class="soso-feed-summary__meta"><span>${label}</span><b>0개</b></div>${sortControl}</div>`;
  return `<div class="soso-feed-summary__inner"><div class="soso-feed-summary__meta"><span>${label}</span><b>${Number(total).toLocaleString()}개</b><span>${page}/${totalPages ?? '?'}페이지</span></div>${sortControl}</div>`;
}

export function renderFeedEmptyState({ search = '' } = {}) {
  const title = search ? `검색 결과가 없어요` : '아직 업로드된 글이 없어요';
  const desc = search ? '다른 검색어로 다시 찾아보세요.' : '첫 번째 글을 작성해보세요.';
  const buttonText = search ? '전체 글 보기' : '+ 글쓰기';
  const target = search ? '#/feed' : '#/write?type=multi&preset=judgment';
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${search ? '🔍' : '📝'}</div>
      <div class="empty-state__title">${title}</div>
      <div class="empty-state__desc">${desc}</div>
      <a class="btn btn--primary" style="margin-top:16px" href="${target}">${buttonText}</a>
    </div>`;
}

export function updateFeedFilterUI({ sort = 'latest' } = {}) {
  const select = document.getElementById('feed-sort-select');
  if (select) select.value = sort;
}
