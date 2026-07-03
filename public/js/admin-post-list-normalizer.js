const TYPE_LABELS = {
  vote: '골라봐',
  initial_game: '초성게임',
  naming: '미친작명소',
  crazy_court: '억까재판',
  relay: '막장릴레이',
  acrostic: '삼행시짓기',
};

const TYPE_ICONS = {
  vote: '🗳️',
  initial_game: '🔤',
  naming: '😜',
  crazy_court: '⚖️',
  relay: '🎭',
  acrostic: '✍️',
};

function cleanText(value) {
  return String(value || '').trim();
}

function isPostsAdminTable(table) {
  const headers = [...table.querySelectorAll('thead th')].map(th => cleanText(th.textContent));
  return headers.includes('제목') && headers.includes('유형') && headers.includes('카테고리') && headers.includes('작업');
}

function normalizeTypeCell(cell) {
  if (!cell || cell.dataset.typeNormalized === '1') return;
  const raw = cleanText(cell.textContent);
  const key = Object.keys(TYPE_LABELS).find(type => raw === type || raw.includes(type));
  if (!key) {
    cell.innerHTML = `<span class="badge badge--gray" style="font-size:10px">${raw || '기타'}</span>`;
    cell.dataset.typeNormalized = '1';
    return;
  }

  cell.innerHTML = `
    <span class="badge badge--gray" style="font-size:11px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap">
      <span>${TYPE_ICONS[key]}</span><span>${TYPE_LABELS[key]}</span>
    </span>`;
  cell.dataset.typeNormalized = '1';
}

function removeCategoryColumn(table) {
  if (!isPostsAdminTable(table)) return;

  const headers = [...table.querySelectorAll('thead th')];
  const categoryIndex = headers.findIndex(th => cleanText(th.textContent) === '카테고리');
  const typeIndex = headers.findIndex(th => cleanText(th.textContent) === '유형');
  if (categoryIndex === -1 || typeIndex === -1) return;

  headers[typeIndex].style.width = '120px';
  headers[typeIndex].textContent = '유형';
  headers[categoryIndex].remove();

  table.querySelectorAll('tbody tr').forEach(row => {
    const cells = [...row.children];
    const emptyCell = row.querySelector('.admin-table__empty');
    if (emptyCell) {
      emptyCell.colSpan = 5;
      return;
    }

    normalizeTypeCell(cells[typeIndex]);
    cells[categoryIndex]?.remove();
  });

  table.dataset.postTypeUnified = '1';
}

function normalizeAdminPostList(root = document) {
  const content = root.querySelector?.('#admin-content') || document.getElementById('admin-content');
  if (!content || !content.textContent.includes('게시물 관리')) return;

  content.querySelectorAll('table.admin-table').forEach(table => {
    if (table.dataset.postTypeUnified === '1') {
      table.querySelectorAll('tbody tr').forEach(row => normalizeTypeCell(row.children[1]));
      return;
    }
    removeCategoryColumn(table);
  });
}

let timer = null;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => normalizeAdminPostList(), 60);
});

if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(() => normalizeAdminPostList(), 120));
setTimeout(() => normalizeAdminPostList(), 300);
