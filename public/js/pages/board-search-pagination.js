import { renderBoard as renderBaseBoard } from './board-court.js?v=20260730-discussion-court-1';

const PAGE_SIZE = 10;

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageButton(page, currentPage) {
  const active = page === currentPage;
  return `<button type="button" class="btn ${active ? 'btn-primary' : 'btn-ghost'}" data-board-page="${page}" ${active ? 'aria-current="page"' : ''} style="min-width:40px;padding:9px 11px;">${page}</button>`;
}

function installBoardSearchPagination(container) {
  const boardList = container.querySelector('#board-list');
  const todayPick = container.querySelector('#today-pick');
  const recordsHost = Array.from(boardList?.children || []).find(element => element.querySelector(':scope > .card'));
  if (!boardList || !recordsHost || container.querySelector('#board-search-panel')) return;

  const cards = Array.from(recordsHost.children).filter(element => element.classList.contains('card'));
  if (!cards.length) return;

  cards.forEach(card => {
    card.dataset.boardSearch = normalizeSearch(card.textContent);
  });

  const intro = todayPick?.previousElementSibling;
  const panel = document.createElement('div');
  panel.id = 'board-search-panel';
  panel.className = 'court-shell';
  panel.style.cssText = 'padding:14px;margin:0 0 16px;';
  panel.innerHTML = `
    <label for="board-search-input" style="display:block;font-size:12px;font-weight:900;color:var(--gold);margin-bottom:8px;">판결기록 검색</label>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="board-search-input" type="search" autocomplete="off" placeholder="사건명, 판결내용, 판사유형 검색" style="width:100%;min-width:0;padding:12px 13px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font:inherit;">
      <button type="button" id="board-search-clear" class="btn btn-ghost" style="display:none;white-space:nowrap;">초기화</button>
    </div>
    <div id="board-search-status" aria-live="polite" style="font-size:11px;color:var(--cream-dim);margin-top:8px;"></div>`;

  if (intro?.parentElement) intro.insertAdjacentElement('afterend', panel);
  else boardList.insertAdjacentElement('beforebegin', panel);

  const pagination = document.createElement('nav');
  pagination.id = 'board-pagination';
  pagination.setAttribute('aria-label', '판결기록 페이지');
  pagination.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin-top:18px;';
  boardList.insertAdjacentElement('afterend', pagination);

  const empty = document.createElement('div');
  empty.id = 'board-search-empty';
  empty.style.cssText = 'display:none;text-align:center;padding:42px 10px;color:var(--cream-dim);font-size:14px;';
  empty.innerHTML = '<div style="font-size:38px;margin-bottom:10px;" aria-hidden="true">🔍</div>검색 조건에 맞는 판결기록이 없습니다.';
  recordsHost.insertAdjacentElement('afterend', empty);

  const input = panel.querySelector('#board-search-input');
  const clearButton = panel.querySelector('#board-search-clear');
  const status = panel.querySelector('#board-search-status');
  let currentPage = 1;

  function render() {
    const keyword = normalizeSearch(input?.value);
    const filtered = keyword
      ? cards.filter(card => card.dataset.boardSearch.includes(keyword))
      : cards;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = new Set(filtered.slice(start, start + PAGE_SIZE));

    cards.forEach(card => {
      card.hidden = !visible.has(card);
    });

    recordsHost.style.display = filtered.length ? 'flex' : 'none';
    empty.style.display = filtered.length ? 'none' : 'block';
    if (todayPick) todayPick.style.display = keyword ? 'none' : '';
    if (clearButton) clearButton.style.display = keyword ? '' : 'none';

    if (status) {
      status.textContent = keyword
        ? `검색 결과 ${filtered.length}건 · ${currentPage}/${totalPages}페이지`
        : `공개 판결기록 ${cards.length}건 · 10개씩 ${currentPage}/${totalPages}페이지`;
    }

    if (filtered.length <= PAGE_SIZE) {
      pagination.innerHTML = '';
      return;
    }

    pagination.innerHTML = `
      <button type="button" class="btn btn-ghost" data-board-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''} style="padding:9px 12px;">이전</button>
      ${Array.from({ length: totalPages }, (_, index) => pageButton(index + 1, currentPage)).join('')}
      <button type="button" class="btn btn-ghost" data-board-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''} style="padding:9px 12px;">다음</button>`;
  }

  input?.addEventListener('input', () => {
    currentPage = 1;
    render();
  });
  clearButton?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    currentPage = 1;
    input.focus();
    render();
  });
  pagination.addEventListener('click', event => {
    const button = event.target.closest('[data-board-page]');
    if (!button || button.disabled) return;
    currentPage = Number(button.dataset.boardPage) || 1;
    render();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  render();
}

export async function renderBoard(container) {
  await renderBaseBoard(container);
  installBoardSearchPagination(container);
}
