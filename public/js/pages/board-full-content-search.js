import { renderBoard as renderBaseBoard } from './board-search-pagination.js?v=20260730-judge-board-search-1';
import { db } from '../firebase.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';

const PRIVATE_KEYS = new Set([
  'userId', 'nickname', 'caseDescription', 'email', 'phone', 'phoneNumber',
  'authorUid', 'ownerUid', 'requestId'
]);

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectPublicText(value, output = [], depth = 0) {
  if (value == null || depth > 7) return output;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    output.push(String(value));
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectPublicText(item, output, depth + 1));
    return output;
  }
  if (typeof value !== 'object') return output;
  if (typeof value.toDate === 'function' || typeof value.toMillis === 'function') return output;

  Object.entries(value).forEach(([key, child]) => {
    if (PRIVATE_KEYS.has(key)) return;
    collectPublicText(child, output, depth + 1);
  });
  return output;
}

function caseIdFromCard(card) {
  const href = card.querySelector('[data-public-result-link="true"]')?.getAttribute('href') || '';
  const prefix = '#/result/';
  if (!href.startsWith(prefix)) return '';
  try {
    return decodeURIComponent(href.slice(prefix.length));
  } catch {
    return '';
  }
}

async function enrichFullContentIndex(container) {
  const cards = Array.from(container.querySelectorAll('#board-list .card'));
  if (!cards.length) return;

  const rows = await loadSafePublicResults(db, { maxRows: 100, fallbackRows: 200 });
  const records = new Map(rows);

  cards.forEach(card => {
    const caseId = caseIdFromCard(card);
    const record = records.get(caseId);
    if (!record) return;
    const fullText = collectPublicText(record).join(' ');
    card.dataset.boardSearch = normalizeSearch(`${card.dataset.boardSearch || card.textContent || ''} ${fullText}`);
  });
}

function installFullContentSearch(container) {
  const input = container.querySelector('#board-search-input');
  const status = container.querySelector('#board-search-status');
  if (!input || input.dataset.fullContentSearch === 'true') return;

  input.dataset.fullContentSearch = 'true';
  input.placeholder = '사건명, 사건내용, 수사·변론·판결문 전체 검색';
  let indexReady = false;
  let loading = null;

  input.addEventListener('input', async () => {
    if (!normalizeSearch(input.value) || indexReady) return;
    if (!loading) {
      if (status) status.textContent = '공개 판결문 전체 내용을 검색하는 중입니다…';
      loading = enrichFullContentIndex(container)
        .catch(error => console.warn('full verdict search index load failed:', error?.code || error))
        .finally(() => {
          indexReady = true;
          loading = null;
        });
    }
    await loading;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function applyBoardRedesign(container) {
  container.classList.add('board-redesign-host');
  const intro = container.querySelector('#court-board-intro');
  if (!intro) return;

  intro.querySelector('.arena-rank-tabs')?.remove();
  const kicker = intro.querySelector('.court-kicker');
  const title = intro.querySelector('.court-title');
  if (kicker) kicker.textContent = 'SOSOKING VERDICT ARCHIVE';
  if (title) title.textContent = '공개 판결기록';

  if (!intro.querySelector('.board-redesign-description')) {
    const description = document.createElement('p');
    description.className = 'board-redesign-description';
    description.textContent = '사건명과 판결문 내용을 검색하고, 공개된 생활판결을 읽은 뒤 사건별 토론장으로 이동할 수 있습니다.';
    intro.appendChild(description);
  }
}

export async function renderBoard(container) {
  container.classList.add('board-redesign-host');
  await renderBaseBoard(container);
  installFullContentSearch(container);
  applyBoardRedesign(container);
}
