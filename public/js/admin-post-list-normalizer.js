const FEED_TYPE_META = {
  // 현재 feedType / typeLabel 값
  vote:         { label: '투표·판정', icon: '🗳️' },
  naming:       { label: '작명',      icon: '😜' },
  drip:         { label: '드립',      icon: '🤣' },
  quiz:         { label: '퀴즈',      icon: '🧠' },
  general:      { label: '일반',      icon: '📝' },
  // type: 'multi' (신규 multi-write 공통 타입)
  multi:        { label: '피드',      icon: '📝' },
  // 한국어 typeLabel 직접 매핑 (multi-write 저장 시 preset.label)
  '투표·판정':  { label: '투표·판정', icon: '🗳️' },
  '작명':       { label: '작명',      icon: '😜' },
  '드립':       { label: '드립',      icon: '🤣' },
  '퀴즈':       { label: '퀴즈',      icon: '🧠' },
  '일반':       { label: '일반',      icon: '📝' },
  // 레거시 타입 값
  ox:           { label: '투표',      icon: '🗳️' },
  balance:      { label: '투표',      icon: '🗳️' },
  battle:       { label: '투표',      icon: '🗳️' },
  crazy_court:  { label: '투표',      icon: '🗳️' },
  cbattle:      { label: '드립',      icon: '🤣' },
  initial_game: { label: '퀴즈',      icon: '🧠' },
  relay:        { label: '릴레이',    icon: '🎭' },
  acrostic:     { label: '행시',      icon: '✍️' },
  fill:         { label: '빈칸',      icon: '🧩' },
  anonymous:    { label: '일반',      icon: '📝' },
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
  const meta = FEED_TYPE_META[raw];
  if (!meta) {
    cell.innerHTML = `<span class="badge badge--gray" style="font-size:10px">${raw || '기타'}</span>`;
    cell.dataset.typeNormalized = '1';
    return;
  }

  cell.innerHTML = `
    <span class="badge badge--gray" style="font-size:11px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap">
      <span>${meta.icon}</span><span>${meta.label}</span>
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
  if (!content) return;
  // 탭 이름이 '데이터관리' 또는 구버전 '게시물 관리' 모두 지원
  const text = content.textContent;
  if (!text.includes('데이터관리') && !text.includes('게시물 관리')) return;

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
