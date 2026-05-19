import { db } from './firebase.js';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from './components/toast.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

function statusLabel(status) {
  if (status === 'done') return '처리완료';
  if (status === 'reviewing') return '확인중';
  return '신규';
}

function typeLabel(type) {
  if (type === 'opinion') return '💡 의견';
  if (type === 'feature') return '✨ 기능제안';
  return '🐞 버그';
}

async function renderFeedbackAdmin() {
  const content = document.getElementById('admin-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(80))).catch(() => null);
  const items = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  const counts = {
    new: items.filter(i => (i.status || 'new') === 'new').length,
    reviewing: items.filter(i => i.status === 'reviewing').length,
    done: items.filter(i => i.status === 'done').length,
  };

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <h2 class="admin-section-title">💬 의견 · 버그 접수함</h2>
      <div class="admin-stat-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:var(--color-primary)">${counts.new}</div><div class="admin-stat-card__label">신규</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:#b77900">${counts.reviewing}</div><div class="admin-stat-card__label">확인중</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:var(--color-success)">${counts.done}</div><div class="admin-stat-card__label">처리완료</div></div>
      </div>
      <div class="card">
        <div class="card__body--lg">
          ${items.length ? items.map(item => `
            <div class="admin-feedback-item" data-feedback-id="${item.id}">
              <div class="admin-feedback-item__top">
                <div>
                  <div class="admin-feedback-item__title">${typeLabel(item.type)} ${esc(item.title || '(제목없음)')}</div>
                  <div class="admin-feedback-item__meta">${esc(item.reporterName || '익명')} · ${item.createdAt?.toDate?.().toLocaleString('ko-KR') || '-'}</div>
                </div>
                <span class="feedback-status-badge feedback-status-badge--${esc(item.status || 'new')}">${statusLabel(item.status || 'new')}</span>
              </div>
              <div class="admin-feedback-item__message">${esc(item.message || '').replace(/\n/g,'<br>')}</div>
              ${item.contact ? `<div class="admin-feedback-item__line"><b>연락처</b> ${esc(item.contact)}</div>` : ''}
              ${item.page?.url ? `<div class="admin-feedback-item__line"><b>페이지</b> <a href="${esc(item.page.url)}" target="_blank" rel="noopener">${esc(item.page.url)}</a></div>` : ''}
              <div class="admin-feedback-item__actions">
                <button class="btn btn--ghost btn--sm" data-feedback-status="reviewing" data-id="${item.id}">확인중</button>
                <button class="btn btn--ghost btn--sm" data-feedback-status="done" data-id="${item.id}">처리완료</button>
                <button class="btn btn--ghost btn--sm" data-feedback-delete="${item.id}" style="color:var(--color-danger)">삭제</button>
              </div>
            </div>`).join('') : `<div style="text-align:center;padding:28px;color:var(--color-text-muted);font-size:13px">접수된 의견이나 버그가 없습니다.</div>`}
        </div>
      </div>
    </div>`;

  content.querySelectorAll('[data-feedback-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'feedback', btn.dataset.id), { status: btn.dataset.feedbackStatus, updatedAt: serverTimestamp() });
        toast.success('상태를 변경했어요');
        renderFeedbackAdmin();
      } catch { toast.error('상태 변경에 실패했어요'); }
    });
  });
  content.querySelectorAll('[data-feedback-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('이 접수 항목을 삭제할까요?')) return;
      try {
        await deleteDoc(doc(db, 'feedback', btn.dataset.feedbackDelete));
        toast.success('삭제했어요');
        renderFeedbackAdmin();
      } catch { toast.error('삭제에 실패했어요'); }
    });
  });
}

function ensureAdminFeedbackMenu() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  const content = document.getElementById('admin-content');
  if (!nav || !content || nav.querySelector('[data-tab="feedback"]')) return;
  const reportsBtn = nav.querySelector('[data-tab="reports"]');
  const btn = document.createElement('button');
  btn.className = 'admin-menu-item';
  btn.dataset.tab = 'feedback';
  btn.innerHTML = `<span class="admin-menu-item__icon">💬</span><span class="admin-menu-item__label">의견·버그</span>`;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-menu-item[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
    renderFeedbackAdmin();
  });
  reportsBtn?.insertAdjacentElement('afterend', btn);
}

let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(ensureAdminFeedbackMenu, 100);
}).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(ensureAdminFeedbackMenu, 120));
setTimeout(ensureAdminFeedbackMenu, 500);
