// admin-reports-panel.js
// 관리자 전용 신고 처리 패널

import { db, functions } from './firebase.js';
import {
  collection, query, orderBy, limit, getDocs, doc, getDoc, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

function currentPath() {
  return (window.location.hash.slice(1) || '/').split('?')[0] || '/';
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function fmtDate(value) {
  try {
    const d = value?.toDate?.() || value;
    if (!d) return '-';
    return new Date(d).toLocaleString('ko-KR');
  } catch { return '-'; }
}

function reportPostId(report) {
  return report.postId || report.feedId || report.targetId || report.targetPostId || report.feedPostId || report.post?.id || '';
}

function reportStatus(report) {
  return report.status || report.state || (report.processed ? 'processed' : 'open');
}

function statusBadge(status) {
  const done = ['done', 'processed', 'closed', 'resolved'].includes(String(status || '').toLowerCase());
  return done
    ? '<span class="badge badge--success">처리완료</span>'
    : '<span class="badge badge--danger">대기</span>';
}

async function loadReports() {
  try {
    const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn('[admin reports] direct query failed, fallback callable', error);
    const res = await httpsCallable(functions, 'listAdminCollectionDocs')({ collection: 'reports', limit: 100 });
    return (res.data?.docs || []).map(item => ({ id: item.id, ...(item.data || {}) }));
  }
}

async function loadPostSummary(postId) {
  if (!postId) return null;
  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch { return null; }
}

function ensureReportsNav() {
  if (currentPath() !== '/admin') return;
  if (document.getElementById('admin-reports-tab')) return;
  const nav = document.querySelector('.admin-nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'admin-reports-tab';
  btn.className = 'admin-menu-item';
  btn.type = 'button';
  btn.innerHTML = '<span class="admin-menu-item__icon">🚨</span><span class="admin-menu-item__label admin-label-full">신고 처리</span><span class="admin-menu-item__label admin-label-short">신고</span>';
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-menu-item').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    renderReportsPanel();
  });

  const divider = nav.querySelector('.admin-nav-divider');
  nav.insertBefore(btn, divider || null);
}

async function renderReportsPanel() {
  const content = document.getElementById('admin-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';

  let reports = [];
  try {
    reports = await loadReports();
  } catch (error) {
    content.innerHTML = `<div class="admin-section"><div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">신고 목록을 불러오지 못했어요</div><div class="empty-state__desc">${esc(error.message || '잠시 후 다시 시도해주세요.')}</div></div></div>`;
    return;
  }

  const openCount = reports.filter(r => !['done', 'processed', 'closed', 'resolved'].includes(String(reportStatus(r)).toLowerCase())).length;
  const rows = await Promise.all(reports.map(async r => {
    const postId = reportPostId(r);
    const post = await loadPostSummary(postId);
    const title = post?.title || post?.desc || r.title || r.reason || '(제목 없음)';
    return { report: r, postId, post, title };
  }));

  content.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-head">
        <h2 class="admin-section-title">🚨 신고 처리</h2>
        <button class="btn btn--ghost btn--sm" id="btn-reports-refresh">새로고침</button>
      </div>
      <div class="admin-stat-grid" style="margin-bottom:16px">
        <div class="admin-stat-card"><div class="admin-stat-card__icon">🚨</div><div class="admin-stat-card__num">${reports.length}</div><div class="admin-stat-card__label">최근 신고</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__icon">⏳</div><div class="admin-stat-card__num" style="color:var(--color-danger)">${openCount}</div><div class="admin-stat-card__label">처리 대기</div></div>
      </div>
      <div class="card"><div class="card__body">
        <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px">최근 신고 100개 기준 · 숨김/삭제/처리완료 가능</div>
        <div class="admin-table-wrap" style="overflow:auto">
          <table class="admin-table" style="width:100%;min-width:760px">
            <thead><tr><th>상태</th><th>신고 내용</th><th>대상 게시글</th><th>신고자</th><th>일시</th><th style="text-align:center">처리</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map(({ report, postId, post, title }) => `
                <tr data-report-row="${esc(report.id)}">
                  <td>${statusBadge(reportStatus(report))}</td>
                  <td><b>${esc(report.reason || report.category || report.type || '신고')}</b><div style="font-size:12px;color:var(--color-text-muted);max-width:220px;white-space:normal">${esc(report.detail || report.description || report.memo || '')}</div></td>
                  <td><div style="font-weight:800;max-width:260px;white-space:normal">${esc(title)}</div><div style="font-size:11px;color:var(--color-text-muted)">${postId ? `ID: ${esc(postId)}` : '게시글 ID 없음'} ${post?.hidden ? '· 숨김 상태' : ''}</div></td>
                  <td style="font-size:12px">${esc(report.reporterName || report.reporterEmail || report.reporterId || report.uid || '-')}</td>
                  <td style="font-size:12px;color:var(--color-text-muted)">${esc(fmtDate(report.createdAt || report.createdAtMs))}</td>
                  <td style="text-align:center;white-space:nowrap">
                    <button class="btn btn--ghost btn--sm" data-report-hide-post="${esc(postId)}" data-report-id="${esc(report.id)}" ${postId ? '' : 'disabled'}>숨김</button>
                    <button class="btn btn--danger btn--sm" data-report-delete-post="${esc(postId)}" data-report-id="${esc(report.id)}" ${postId ? '' : 'disabled'}>삭제</button>
                    <button class="btn btn--ghost btn--sm" data-report-done="${esc(report.id)}">완료</button>
                  </td>
                </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--color-text-muted)">접수된 신고가 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div></div>
    </div>`;

  content.querySelector('#btn-reports-refresh')?.addEventListener('click', renderReportsPanel);
  bindReportActions(content);
}

async function markReportDone(reportId, action, extra = {}) {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'processed',
    processedAction: action,
    processedAt: serverTimestamp(),
    ...extra,
  });
}

function bindReportActions(root) {
  root.querySelectorAll('[data-report-hide-post]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.reportHidePost;
      const reportId = btn.dataset.reportId;
      if (!postId) return;
      btn.disabled = true;
      try {
        await updateDoc(doc(db, 'feeds', postId), { hidden: true, hideReason: '신고 처리', updatedAt: serverTimestamp() });
        if (reportId) await markReportDone(reportId, 'hide', { postId });
        toast.success('신고 게시글을 숨김 처리했어요');
        renderReportsPanel();
      } catch (error) {
        toast.error(error.message || '숨김 처리 실패');
        btn.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-report-delete-post]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.reportDeletePost;
      const reportId = btn.dataset.reportId;
      if (!postId) return;
      if (!confirm('신고 대상 게시글과 하위 데이터를 모두 삭제할까요? 되돌릴 수 없습니다.')) return;
      btn.disabled = true;
      try {
        await httpsCallable(functions, 'deleteFeedPostDeep')({ postId });
        if (reportId) await markReportDone(reportId, 'delete', { postId });
        toast.success('신고 게시글을 삭제했어요');
        renderReportsPanel();
      } catch (error) {
        toast.error(error.message || '삭제 처리 실패');
        btn.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-report-done]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reportId = btn.dataset.reportDone;
      btn.disabled = true;
      try {
        await markReportDone(reportId, 'done');
        toast.success('신고를 처리 완료로 표시했어요');
        renderReportsPanel();
      } catch (error) {
        toast.error(error.message || '처리 완료 실패');
        btn.disabled = false;
      }
    });
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureReportsNav, 160);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
