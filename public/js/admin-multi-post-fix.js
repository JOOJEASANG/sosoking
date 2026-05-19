import { db, functions } from './firebase.js';
import { collection, getDocs, limit, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const TYPE_META = [
  { key: 'vote', icon: '🗳️', label: '골라봐', module: 'vote' },
  { key: 'initial_game', icon: '🔤', label: '초성게임', module: 'quiz' },
  { key: 'naming', icon: '😜', label: '미친작명소', module: 'naming' },
  { key: 'crazy_court', icon: '⚖️', label: '억까재판', module: 'vote' },
  { key: 'relay', icon: '🎭', label: '막장릴레이', module: 'relay' },
  { key: 'acrostic', icon: '✍️', label: '삼행시짓기', module: 'acrostic' },
];

function moduleLabels(modules = {}) {
  const labels = [];
  if (modules.vote?.enabled) labels.push('투표');
  if (modules.naming?.enabled) labels.push('작명');
  if (modules.acrostic?.enabled) labels.push('삼행시');
  if (modules.relay?.enabled) labels.push('릴레이');
  if (modules.quiz?.enabled) labels.push('문제');
  return labels;
}

function labelForType(type) {
  const found = TYPE_META.find(t => t.key === type);
  if (found) return `${found.icon} ${found.label}`;
  if (type === 'multi') return '🧩 만능 놀이글';
  return type || '';
}

function categoryLabel(cat, type) {
  if (type === 'multi' || cat === 'multi') return '🧩 만능';
  return { golra:'🎯 골라봐', usgyo:'😂 웃겨봐', malhe:'🎮 도전봐' }[cat] || cat || '';
}

function getMultiModuleChipsFromTitleCell(row, labels) {
  const cell = row.querySelector('.admin-table__title-cell');
  if (!cell || !labels.length || cell.querySelector('.admin-multi-module-chips')) return;
  cell.insertAdjacentHTML('beforeend', `
    <div class="admin-multi-module-chips">
      ${labels.map(label => `<span>${label}</span>`).join('')}
    </div>`);
}

async function fetchRecentPostsForAdmin() {
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(300))).catch(() => null);
  return snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
}

function countByTypeAndMulti(posts) {
  return TYPE_META.map(meta => {
    const count = posts.filter(post => {
      if (post.hidden) return false;
      if (post.type === meta.key) return true;
      if (post.type === 'multi') return !!post.modules?.[meta.module]?.enabled;
      return false;
    }).length;
    return { ...meta, count };
  });
}

async function enhanceDashboardStats() {
  const grid = document.querySelector('#admin-content .admin-type-grid');
  if (!grid || grid.dataset.multiDashboardEnhanced === '1') return;
  grid.dataset.multiDashboardEnhanced = '1';

  const posts = await fetchRecentPostsForAdmin();
  if (!posts.length) return;
  const counts = countByTypeAndMulti(posts);

  grid.innerHTML = counts.map(t => `
    <div class="admin-type-card admin-type-card--${t.key === 'vote' || t.key === 'initial_game' ? 'golra' : t.key === 'naming' || t.key === 'crazy_court' ? 'usgyo' : 'malhe'}">
      <div class="admin-type-card__icon">${t.icon}</div>
      <div class="admin-type-card__count">${t.count.toLocaleString()}</div>
      <div class="admin-type-card__name">${t.label}</div>
    </div>`).join('');

  const title = grid.closest('.card')?.querySelector('[style*="font-size:14px"]');
  if (title) title.textContent = '🎮 유형별 게시물 현황 · 만능 놀이글 포함';
}

async function enhanceAdminRows() {
  const table = document.querySelector('#admin-content .admin-table');
  if (!table) return;

  const posts = await fetchRecentPostsForAdmin();
  const postMap = new Map(posts.map(post => [post.id, post]));

  table.querySelectorAll('tbody tr[data-post-row]').forEach(row => {
    if (row.dataset.multiAdminEnhanced === '1') return;
    const postId = row.dataset.postRow;
    const post = postMap.get(postId);
    const typeBadge = row.querySelector('td:nth-child(2) .badge');
    const rawType = (typeBadge?.textContent || post?.type || '').trim();
    const type = post?.type || rawType;

    row.dataset.multiAdminEnhanced = '1';
    if (typeBadge) {
      typeBadge.textContent = labelForType(type);
      typeBadge.classList.add(type === 'multi' ? 'badge--multi' : 'badge--type-fixed');
      typeBadge.style.fontSize = '11px';
      if (type === 'multi') {
        typeBadge.style.color = 'var(--color-primary)';
        typeBadge.style.background = 'var(--color-primary-bg)';
        typeBadge.style.border = '1px solid rgba(255,107,74,.25)';
      }
    }

    const catCell = row.querySelector('td:nth-child(3) span');
    if (catCell) catCell.textContent = categoryLabel(post?.cat, type);

    if (type === 'multi') getMultiModuleChipsFromTitleCell(row, moduleLabels(post?.modules || {}));
  });
}

function interceptAdminDelete() {
  const table = document.querySelector('#admin-content .admin-table');
  if (!table || table.dataset.multiDeleteIntercept === '1') return;
  table.dataset.multiDeleteIntercept = '1';

  table.addEventListener('click', async e => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    const row = btn.closest('[data-post-row]');
    const typeText = row?.querySelector('td:nth-child(2) .badge')?.textContent || '';
    if (!typeText.includes('만능') && !typeText.includes('multi')) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    const postId = btn.dataset.delete;
    if (!postId) return;
    if (!confirm('만능 놀이글을 삭제할까요? 참여글과 답글까지 함께 정리됩니다.')) return;

    try {
      btn.disabled = true;
      btn.textContent = '삭제중';
      const fn = httpsCallable(functions, 'deleteOwnPost');
      await fn({ postId });
      toast.success('만능 놀이글과 하위 데이터를 삭제했어요');
      row?.remove();
    } catch (error) {
      console.error(error);
      toast.error(error.message || '삭제에 실패했어요');
      btn.disabled = false;
      btn.textContent = '삭제';
    }
  }, true);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    enhanceDashboardStats();
    enhanceAdminRows();
    interceptAdminDelete();
  }, 180);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
