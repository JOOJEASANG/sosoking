import { db } from './firebase.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const FEED_META = [
  { key: 'general', icon: '📝', label: '일반글' },
  { key: 'vote', icon: '🗳️', label: '투표/판정' },
  { key: 'naming', icon: '😜', label: '미친작명소' },
  { key: 'acrostic', icon: '✍️', label: '삼행시' },
  { key: 'quiz', icon: '🧠', label: '퀴즈' },
];

function moduleKey(post) {
  if (post.subtype) return post.subtype;
  const modules = post.modules || {};
  if (modules.vote?.enabled) return 'vote';
  if (modules.naming?.enabled) return 'naming';
  if (modules.acrostic?.enabled) return 'acrostic';
  if (modules.quiz?.enabled) return 'quiz';
  return 'general';
}

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

async function fetchPosts() {
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(300))).catch(() => null);
  return snap?.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden) || [];
}

async function simplifyDashboard() {
  const content = document.getElementById('admin-content');
  if (!content) return;
  const grid = content.querySelector('.admin-type-grid');
  if (!grid || grid.dataset.cleanDashboard === '1') return;
  grid.dataset.cleanDashboard = '1';

  const title = grid.closest('.card')?.querySelector('[style*="font-size:14px"]');
  if (title) title.textContent = '🧩 피드 형식별 현황';

  const posts = await fetchPosts();
  const counts = Object.fromEntries(FEED_META.map(m => [m.key, 0]));
  posts.forEach(post => { counts[moduleKey(post)] = (counts[moduleKey(post)] || 0) + 1; });

  grid.innerHTML = FEED_META.map(meta => `
    <div class="admin-type-card admin-type-card--multi-clean">
      <div class="admin-type-card__icon">${meta.icon}</div>
      <div class="admin-type-card__count">${(counts[meta.key] || 0).toLocaleString()}</div>
      <div class="admin-type-card__name">${meta.label}</div>
    </div>`).join('');
}

function simplifyPostFilters() {
  const content = document.getElementById('admin-content');
  if (!content) return;
  const filterWrap = content.querySelector('[data-post-cat]')?.parentElement;
  if (!filterWrap || filterWrap.dataset.cleanFilters === '1') return;
  filterWrap.dataset.cleanFilters = '1';
  filterWrap.classList.add('admin-post-toolbar');

  const searchInput = filterWrap.querySelector('#admin-post-search');
  const searchButton = filterWrap.querySelector('#btn-post-search');
  if (searchInput) {
    searchInput.classList.add('admin-post-toolbar__search');
    searchInput.removeAttribute('style');
  }
  if (searchButton) {
    searchButton.classList.add('admin-post-toolbar__button');
  }

  filterWrap.querySelectorAll('[data-post-cat]').forEach(btn => btn.remove());
  filterWrap.querySelectorAll('.admin-clean-filter-note').forEach(note => note.remove());
}

function normalizePostTable() {
  const table = document.querySelector('#admin-content .admin-table');
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr[data-post-row]');
  rows.forEach(row => {
    const typeBadge = row.querySelector('td:nth-child(2) .badge');
    if (typeBadge && !typeBadge.dataset.cleanLabel) {
      const text = typeBadge.textContent || '';
      const fixed = text
        .replace('multi', '피드 글')
        .replace('vote', '투표/판정')
        .replace('naming', '미친작명소')
        .replace('acrostic', '삼행시')
        .replace('quiz', '퀴즈')
        .replace('initial_game', '퀴즈')
        .replace('crazy_court', '투표/판정')
        .replace('relay', '피드 글');
      typeBadge.textContent = fixed || '피드 글';
      typeBadge.dataset.cleanLabel = '1';
    }
    const catCell = row.querySelector('td:nth-child(3) span');
    if (catCell && !catCell.dataset.cleanLabel) {
      catCell.textContent = '피드';
      catCell.dataset.cleanLabel = '1';
    }
  });
}

async function normalizeUserEmailColumn() {
  const content = document.getElementById('admin-content');
  if (!content) return;
  const title = [...content.querySelectorAll('.admin-section-title')].find(el => el.textContent.includes('회원'));
  if (!title) return;
  const table = title.parentElement?.parentElement?.querySelector('table');
  if (!table || table.dataset.emailNormalized === '1') return;
  table.dataset.emailNormalized = '1';

  const uidHeader = [...table.querySelectorAll('thead th')].find(th => th.textContent.trim() === 'UID');
  if (uidHeader) uidHeader.textContent = '메일';

  const feedSnap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(300))).catch(() => null);
  const emailByName = new Map();
  const uidByName = new Map();
  for (const d of feedSnap?.docs || []) {
    const p = d.data() || {};
    const name = p.authorName || '';
    if (!name) continue;
    const email = p.authorEmail || p.email || p.userEmail || '';
    if (email) emailByName.set(name, email);
    if (p.authorId) uidByName.set(name, p.authorId);
  }

  const rows = table.querySelectorAll('tbody tr');
  for (const row of rows) {
    const name = row.querySelector('td:first-child span[style*="font-weight"]')?.textContent?.trim() || '';
    const cell = row.querySelector('td:last-child');
    if (!cell || cell.dataset.emailReady === '1') continue;
    let email = emailByName.get(name) || '';

    if (!email) {
      const uid = uidByName.get(name);
      if (uid) {
        const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
        const data = userSnap?.exists?.() ? userSnap.data() : {};
        email = data.email || data.userEmail || data.loginEmail || '';
      }
    }

    cell.dataset.emailReady = '1';
    cell.style.fontSize = '12px';
    cell.style.fontFamily = 'inherit';
    cell.style.color = email ? 'var(--color-text-secondary)' : 'var(--color-text-muted)';
    cell.textContent = email || '메일 없음';
    cell.title = email || '메일 정보 없음';
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    simplifyDashboard();
    simplifyPostFilters();
    normalizePostTable();
    normalizeUserEmailColumn();
  }, 260);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 900);
