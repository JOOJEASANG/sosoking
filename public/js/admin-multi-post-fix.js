import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

function moduleLabels(modules = {}) {
  const labels = [];
  if (modules.vote?.enabled) labels.push('투표');
  if (modules.naming?.enabled) labels.push('작명');
  if (modules.acrostic?.enabled) labels.push('삼행시');
  if (modules.relay?.enabled) labels.push('릴레이');
  if (modules.quiz?.enabled) labels.push('문제');
  return labels;
}

function enhanceAdminRows() {
  const table = document.querySelector('#admin-content .admin-table');
  if (!table) return;
  table.querySelectorAll('tbody tr').forEach(row => {
    if (row.dataset.multiAdminEnhanced === '1') return;
    const typeBadge = row.querySelector('td:nth-child(2) .badge');
    const type = (typeBadge?.textContent || '').trim();
    if (type !== 'multi') return;

    row.dataset.multiAdminEnhanced = '1';
    if (typeBadge) {
      typeBadge.textContent = '🧩 만능 놀이글';
      typeBadge.classList.add('badge--multi');
      typeBadge.style.fontSize = '11px';
      typeBadge.style.color = 'var(--color-primary)';
      typeBadge.style.background = 'var(--color-primary-bg)';
      typeBadge.style.border = '1px solid rgba(255,107,74,.25)';
    }

    const catCell = row.querySelector('td:nth-child(3) span');
    if (catCell) catCell.textContent = '🧩 만능';
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
    enhanceAdminRows();
    interceptAdminDelete();
  }, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
