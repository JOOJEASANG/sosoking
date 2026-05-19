import { db } from './firebase.js';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

  filterWrap.querySelectorAll('[data-post-cat]').forEach(btn => btn.remove());
  filterWrap.insertAdjacentHTML('beforeend', `
    <span class="admin-clean-filter-note">피드 게시물은 일반글/투표/작명/삼행시/퀴즈 형식으로 통합 관리됩니다.</span>
  `);
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

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    simplifyDashboard();
    simplifyPostFilters();
    normalizePostTable();
  }, 260);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 900);
