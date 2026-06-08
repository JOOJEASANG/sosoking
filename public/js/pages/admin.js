import { db, auth, functions } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, deleteDoc, doc,
  getCountFromServer, where, updateDoc, serverTimestamp,
  Timestamp, getDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import {
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { appState } from '../state.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

function isAdmin() { return !!appState.isAdmin; }
import { renderSidebar } from '../components/sidebar.js';

let currentTab = 'dashboard';

export async function renderAdmin() {
  const el = document.getElementById('page-content');
  const user = appState.user;

  if (!user) { navigate('/login'); return; }
  if (!isAdmin()) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔒</div>
        <div class="empty-state__title">관리자 전용 페이지예요</div>
      </div>`;
    return;
  }

  const TOP_MENUS = [
    { key: 'dashboard', icon: '📊', label: '대시보드', short: '통계' },
    { key: 'ai',        icon: '🤖', label: 'AI 관리',  short: 'AI' },
    { key: 'reports',   icon: '🚨', label: '신고·의견', short: '신고' },
    { key: 'users',     icon: '👥', label: '회원관리', short: '회원' },
    { key: 'posts',     icon: '📝', label: '게시글관리', short: '게시글' },
  ];
  const BOTTOM_MENUS = [
    { key: 'myinfo', icon: '👤', label: '내 정보', short: '내정보' },
  ];
  const MENUS = [...TOP_MENUS, ...BOTTOM_MENUS];

  const renderMenuItem = (m, isBottom = false) => `
    <button class="admin-menu-item${isBottom ? ' admin-menu-item--bottom' : ''} ${currentTab === m.key ? 'active' : ''}" data-tab="${m.key}">
      <span class="admin-menu-item__icon">${m.icon}</span>
      ${m.short
        ? `<span class="admin-menu-item__label admin-label-full">${m.label}</span><span class="admin-menu-item__label admin-label-short">${m.short}</span>`
        : `<span class="admin-menu-item__label">${m.label}</span>`
      }
    </button>`;

  const nickname = appState.nickname || user.displayName || user.email?.split('@')[0] || '관리자';
  const avatarHTML = user.photoURL
    ? `<img src="${user.photoURL}" alt="" class="admin-profile-card__avatar-img">`
    : `<span>${(nickname[0] || '관')}</span>`;

  el.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <a href="#/" class="admin-brand__logo-link" id="admin-brand-home">
            <img src="/logo.svg" alt="소소킹" width="34" height="34">
          </a>
          <div>
            <div class="admin-brand__title">소소킹</div>
            <div class="admin-brand__sub">관리자 패널</div>
          </div>
        </div>
        <nav class="admin-nav">
          ${TOP_MENUS.map(m => renderMenuItem(m)).join('')}
          <div class="admin-nav-divider"></div>
          ${BOTTOM_MENUS.map(m => renderMenuItem(m, true)).join('')}
        </nav>
        <div class="admin-sidebar__footer">
          <div class="admin-profile-card">
            <div class="admin-profile-card__avatar">${avatarHTML}</div>
            <div class="admin-profile-card__info">
              <div class="admin-profile-card__name">${escHtml(nickname)}</div>
              <div class="admin-profile-card__role">🔑 관리자</div>
            </div>
          </div>
          <button class="admin-goto-site-btn" id="btn-goto-site">🏠 사이트 홈으로</button>
        </div>
      </aside>
      <main id="admin-content">
        <div class="loading-center"><div class="spinner spinner--lg"></div></div>
      </main>
    </div>`;

  document.querySelectorAll('.admin-menu-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.admin-menu-item[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
      loadTab(currentTab);
    });
  });

  document.getElementById('btn-goto-site')?.addEventListener('click', () => navigate('/'));
  document.getElementById('admin-brand-home')?.addEventListener('click', (e) => { e.preventDefault(); navigate('/'); });

  await loadTab(currentTab);
}

async function loadTab(tab) {
  const content = document.getElementById('admin-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  switch (tab) {
    case 'dashboard': return renderDashboard(content);
    case 'reports':   return renderReports(content);
    case 'users':     return renderUsers(content);
    case 'ai':        return renderAiSettings(content);
    case 'posts':     return renderAdminPosts(content);
    case 'myinfo':    return renderMyInfo(content);
  }
}

/* ── 대시보드 ── */
async function renderDashboard(el) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const todayStr   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const AI_FEATURES = [
    { key: 'judge',     icon: '⚖️', label: '판결소', cat: 'primary' },
    { key: 'translate', icon: '✨', label: '창작소',  cat: 'golra'  },
    { key: 'match',     icon: '💘', label: '궁합소',  cat: 'usgyo'  },
    { key: 'naming',    icon: '✨', label: '작명',    cat: 'malhe'  },
    { key: 'consult',   icon: '💬', label: '상담소',  cat: 'teal'   },
  ];

  const [totalSnap, todaySnap, recentSnap, reportSnap, monthUsageSnap, todayUsageSnap] = await Promise.all([
    getCountFromServer(collection(db, 'feeds')).catch(() => null),
    getDocs(query(collection(db, 'feeds'), where('createdAt', '>=', Timestamp.fromDate(todayStart)), limit(99))).catch(() => null),
    getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(5))).catch(() => null),
    getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', false))).catch(() => null),
    getDocs(query(collection(db, 'ai_king_usage'), where('date', '>=', monthStart), where('date', '<=', todayStr), limit(2000))).catch(() => null),
    getDocs(query(collection(db, 'ai_king_usage'), where('date', '==', todayStr), limit(500))).catch(() => null),
  ]);

  const total   = totalSnap?.data?.().count ?? 0;
  const todayPosts = todaySnap?.size ?? 0;
  const pending = reportSnap?.data?.().count ?? 0;
  const recent  = recentSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  // AI킹 이번달 서비스별 사용량 집계
  const monthByFeature = {};
  let monthTotal = 0;
  for (const d of (monthUsageSnap?.docs ?? [])) {
    const data = d.data();
    monthByFeature[data.feature] = (monthByFeature[data.feature] || 0) + (data.count || 0);
    monthTotal += (data.count || 0);
  }
  const todayByFeature = {};
  let todayAiTotal = 0;
  for (const d of (todayUsageSnap?.docs ?? [])) {
    const data = d.data();
    todayByFeature[data.feature] = (todayByFeature[data.feature] || 0) + (data.count || 0);
    todayAiTotal += (data.count || 0);
  }

  const aiCounts = AI_FEATURES.map(f => ({
    ...f,
    count: monthByFeature[f.key] || 0,
    today: todayByFeature[f.key] || 0,
  }));

  const FEED_TYPE_LABEL = {
    tournament: '대결방', vote: '토론방', drip: '드립방',
    collect: '일반방', general: '일반', fill: '빈칸', naming: '작명',
    acrostic: '행시', relay: '릴레이',
  };

  el.innerHTML = `
    <div class="admin-dashboard">
      <h2 class="admin-section-title">📊 대시보드</h2>

      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__icon">🤖</div>
          <div class="admin-stat-card__num">${monthTotal.toLocaleString()}</div>
          <div class="admin-stat-card__label">이번달 AI 사용</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__icon">✨</div>
          <div class="admin-stat-card__num" style="color:var(--color-success)">${todayAiTotal}</div>
          <div class="admin-stat-card__label">오늘 AI 사용</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__icon">🚨</div>
          <div class="admin-stat-card__num" style="color:${pending > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${pending}</div>
          <div class="admin-stat-card__label">미처리 신고</div>
        </div>
      </div>

      <div class="card admin-dashboard-card">
        <div class="card__body">
          <div class="admin-card-head">🤖 AI킹 서비스별 사용 현황</div>
          <div class="admin-type-grid admin-type-grid--4">
            ${aiCounts.map(f => `
              <div class="admin-type-card admin-type-card--${f.cat}">
                <div class="admin-type-card__icon">${f.icon}</div>
                <div class="admin-type-card__count">${f.count.toLocaleString()}</div>
                <div class="admin-type-card__name">${f.label}</div>
                <div class="admin-type-card__today">오늘 ${f.today}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card admin-dashboard-card">
        <div class="card__body">
          <div class="admin-card-head">🕐 최근 게시물</div>
          <div class="admin-recent-list">
            ${recent.length ? recent.map(p => `
              <div class="admin-recent-item">
                <span class="admin-recent-item__type">${escHtml(FEED_TYPE_LABEL[p.feedType || p.type] || p.feedType || p.type || '—')}</span>
                <a href="#/detail/${p.id}" class="admin-recent-item__title">${escHtml(p.title || '(제목없음)')}</a>
                <span class="admin-recent-item__author">${escHtml(p.authorName || '익명')}</span>
              </div>`).join('') : '<div class="admin-empty-note">최근 게시물이 없습니다</div>'}
          </div>
        </div>
      </div>
    </div>`;

  el.querySelectorAll('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tabSwitch;
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
      loadTab(currentTab);
    });
  });
}

/* ── 신고·의견 관리 ── */
async function renderReports(el, _subtab) {
  let subtab = _subtab || 'reports';

  // --- 신고 데이터 ---
  const [pendingSnap, resolvedSnap, feedbackSnap] = await Promise.all([
    getDocs(query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc'), limit(30))).catch(() => null),
    getDocs(query(collection(db, 'reports'), where('resolved', '==', true), orderBy('createdAt', 'desc'), limit(10))).catch(() => null),
    getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(80))).catch(() => null),
  ]);

  const pending  = pendingSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
  const resolved = resolvedSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
  const feedbacks = feedbackSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
  const fbCounts = {
    new: feedbacks.filter(i => (i.status || 'new') === 'new').length,
    reviewing: feedbacks.filter(i => i.status === 'reviewing').length,
    done: feedbacks.filter(i => i.status === 'done').length,
  };

  const statusLabel = s => s === 'done' ? '처리완료' : s === 'reviewing' ? '확인중' : '신규';
  const typeLabel = t => t === 'opinion' ? '💡 의견' : t === 'feature' ? '✨ 기능제안' : '🐞 버그';

  const renderReportRow = (r, isDone) => `
    <tr data-report-row="${r.id}">
      <td>${escHtml(r.reason || '')}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${r.postId ? `<a href="#/detail/${r.postId}" style="color:var(--color-primary)">${escHtml(r.postTitle || r.postId)}</a>` : '-'}
      </td>
      <td style="color:var(--color-text-muted)">${escHtml(r.reporterName || '익명')}</td>
      <td>
        ${!isDone ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn--ghost btn--sm" data-view-post="${r.postId}" style="font-size:11px">글 보기</button>
            <button class="btn btn--primary btn--sm" data-resolve="${r.id}" style="font-size:11px">처리완료</button>
            ${r.postId ? `<button class="btn btn--danger btn--sm" data-delete-post="${r.postId}" data-resolve="${r.id}" style="font-size:11px">글 삭제</button>` : ''}
          </div>` : `<span style="font-size:11px;color:var(--color-text-muted)">처리완료</span>`}
      </td>
    </tr>`;

  const renderFeedbackItem = item => `
    <div class="admin-feedback-item" data-feedback-id="${escHtml(item.id)}">
      <div class="admin-feedback-item__top">
        <div>
          <div class="admin-feedback-item__title">${typeLabel(item.type)} ${escHtml(item.title || '(제목없음)')}</div>
          <div class="admin-feedback-item__meta">${escHtml(item.reporterName || '익명')} · ${item.createdAt?.toDate?.().toLocaleString('ko-KR') || '-'}</div>
        </div>
        <span class="feedback-status-badge feedback-status-badge--${escHtml(item.status || 'new')}">${statusLabel(item.status || 'new')}</span>
      </div>
      <div class="admin-feedback-item__message">${escHtml(item.message || '').replace(/\n/g, '<br>')}</div>
      ${item.contact ? `<div class="admin-feedback-item__line"><b>연락처</b> ${escHtml(item.contact)}</div>` : ''}
      ${item.page?.url ? `<div class="admin-feedback-item__line"><b>페이지</b> <a href="${escHtml(item.page.url)}" target="_blank" rel="noopener" style="color:var(--color-primary);word-break:break-all">${escHtml(item.page.url)}</a></div>` : ''}
      <div class="admin-feedback-item__actions">
        <button class="btn btn--ghost btn--sm" data-feedback-status="reviewing" data-id="${escHtml(item.id)}">확인중</button>
        <button class="btn btn--ghost btn--sm" data-feedback-status="done" data-id="${escHtml(item.id)}">처리완료</button>
        <button class="btn btn--ghost btn--sm" data-feedback-delete="${escHtml(item.id)}" style="color:var(--color-danger)">삭제</button>
      </div>
    </div>`;

  el.innerHTML = `
    <div class="admin-reports-wrap">
      <h2 class="admin-section-title">🚨 신고·의견 관리</h2>

      <!-- 서브탭 -->
      <div class="admin-sub-tabs">
        <button class="admin-sub-tab ${subtab === 'reports' ? 'active' : ''}" data-subtab="reports">
          🚨 신고
          ${pending.length > 0 ? `<span class="admin-sub-tab__badge">${pending.length}</span>` : ''}
        </button>
        <button class="admin-sub-tab ${subtab === 'feedback' ? 'active' : ''}" data-subtab="feedback">
          💬 의견·버그
          ${fbCounts.new > 0 ? `<span class="admin-sub-tab__badge">${fbCounts.new}</span>` : ''}
        </button>
      </div>

      <!-- 신고 탭 -->
      <div id="subtab-reports" style="display:${subtab === 'reports' ? 'flex' : 'none'};flex-direction:column;gap:16px;margin-top:20px">
        <div class="admin-stat-grid" style="grid-template-columns:repeat(2,1fr)">
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="color:${pending.length > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'}">${pending.length}</div>
            <div class="admin-stat-card__label">미처리 신고</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="color:var(--color-success)">${resolved.length}</div>
            <div class="admin-stat-card__label">처리완료 (최근)</div>
          </div>
        </div>
        <div class="card">
          <div class="card__body--lg" style="overflow-x:auto">
            <div style="font-size:14px;font-weight:800;margin-bottom:12px">⚠️ 처리 대기 (${pending.length}건)</div>
            ${pending.length === 0 ? `<div style="text-align:center;padding:24px;color:var(--color-text-muted);font-size:13px">처리할 신고가 없어요 ✅</div>` : `
            <table class="admin-table">
              <thead><tr>
                <th>사유</th><th>게시물</th><th>신고자</th><th style="width:200px">작업</th>
              </tr></thead>
              <tbody>${pending.map(r => renderReportRow(r, false)).join('')}</tbody>
            </table>`}
          </div>
        </div>
        ${resolved.length > 0 ? `
        <div class="card">
          <div class="card__body--lg" style="overflow-x:auto">
            <div style="font-size:14px;font-weight:800;margin-bottom:12px;color:var(--color-text-muted)">✅ 처리 완료 (최근 ${resolved.length}건)</div>
            <table class="admin-table">
              <thead><tr>
                <th>사유</th><th>게시물</th><th>신고자</th><th>상태</th>
              </tr></thead>
              <tbody>${resolved.map(r => renderReportRow(r, true)).join('')}</tbody>
            </table>
          </div>
        </div>` : ''}
      </div>

      <!-- 의견·버그 탭 -->
      <div id="subtab-feedback" style="display:${subtab === 'feedback' ? 'flex' : 'none'};flex-direction:column;gap:16px;margin-top:20px">
        <div class="admin-stat-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="color:var(--color-primary)">${fbCounts.new}</div>
            <div class="admin-stat-card__label">신규</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="color:var(--color-warning-text)">${fbCounts.reviewing}</div>
            <div class="admin-stat-card__label">확인중</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="color:var(--color-success)">${fbCounts.done}</div>
            <div class="admin-stat-card__label">처리완료</div>
          </div>
        </div>
        <div class="card">
          <div class="card__body--lg">
            ${feedbacks.length
              ? feedbacks.map(renderFeedbackItem).join('')
              : '<div style="text-align:center;padding:28px;color:var(--color-text-muted);font-size:13px">접수된 의견이나 버그가 없습니다.</div>'}
          </div>
        </div>
      </div>
    </div>`;

  // 서브탭 전환
  el.querySelectorAll('[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => renderReports(el, btn.dataset.subtab));
  });

  // 신고 처리
  el.querySelectorAll('[data-resolve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reportId = btn.dataset.resolve;
      const postId   = btn.dataset.deletePost;
      try {
        if (postId) {
          if (!confirm('신고된 글을 삭제하고 신고를 처리할까요?')) return;
          await deleteDoc(doc(db, 'feeds', postId));
        }
        await updateDoc(doc(db, 'reports', reportId), { resolved: true, resolvedAt: serverTimestamp() });
        toast.success('처리완료했어요');
        btn.closest('[data-report-row]')?.remove();
      } catch { toast.error('처리에 실패했어요'); }
    });
  });

  // 의견·버그 상태 변경
  el.querySelectorAll('[data-feedback-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'feedback', btn.dataset.id), { status: btn.dataset.feedbackStatus, updatedAt: serverTimestamp() });
        toast.success('상태를 변경했어요');
        renderReports(el, 'feedback');
      } catch { toast.error('상태 변경에 실패했어요'); }
    });
  });

  // 의견·버그 삭제
  el.querySelectorAll('[data-feedback-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('이 접수 항목을 삭제할까요?')) return;
      try {
        await deleteDoc(doc(db, 'feedback', btn.dataset.feedbackDelete));
        toast.success('삭제했어요');
        renderReports(el, 'feedback');
      } catch { toast.error('삭제에 실패했어요'); }
    });
  });
}

/* ── 회원 현황 ── */
async function renderUsers(el) {
  const fmtDate = (ms) => {
    if (!ms) return '-';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ko-KR') + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  let data = null;
  let loadError = null;
  try {
    const res = await httpsCallable(functions, 'getAdminMemberList')({ pageSize: 100 });
    data = res.data;
  } catch (e) {
    loadError = e;
  }

  const members = data?.members || [];
  const total = data?.total ?? members.length;
  const excludedAdmins = data?.excludedAdmins ?? 0;

  const accordion = `
      <details class="admin-accordion" id="admin-myinfo-acc">
        <summary class="admin-accordion__summary">
          <span>👤 내 정보 설정</span>
          <svg class="admin-accordion__chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="admin-accordion__body" id="admin-myinfo-body">
          <div style="padding:24px;text-align:center"><div class="spinner spinner--sm"></div></div>
        </div>
      </details>`;

  if (loadError) {
    console.error('[renderUsers] getAdminMemberList failed', loadError);
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        ${accordion}
        <h2 class="admin-section-title">👥 회원관리</h2>
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <div class="empty-state__title">회원 목록을 불러오지 못했어요</div>
          <div class="empty-state__desc">${escHtml(loadError.message || 'Functions 배포 후 다시 시도해주세요.')}</div>
          <button class="btn btn--ghost btn--sm" id="btn-users-retry" style="margin-top:12px">다시 시도</button>
        </div>
      </div>`;
    el.querySelector('#btn-users-retry')?.addEventListener('click', () => renderUsers(el));
    bindMyInfoAccordion();
    return;
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${accordion}

      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <h2 class="admin-section-title">👥 회원관리</h2>
        <button class="btn btn--ghost btn--sm" id="btn-users-refresh">새로고침</button>
      </div>
      <div class="admin-stat-grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="admin-stat-card">
          <div class="admin-stat-card__num">${total.toLocaleString()}</div>
          <div class="admin-stat-card__label">전체 회원</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__num" style="color:var(--color-text-muted)">${excludedAdmins.toLocaleString()}</div>
          <div class="admin-stat-card__label">제외된 관리자</div>
        </div>
      </div>
      <div class="card" style="overflow:auto">
        ${members.length === 0 ? `<div style="text-align:center;padding:32px;color:var(--color-text-muted);font-size:13px">표시할 회원이 없어요</div>` : `
        <table class="admin-table">
          <thead>
            <tr><th>회원</th><th>이메일</th><th style="width:90px">포인트</th><th>가입일</th><th>최근 로그인</th><th style="width:70px">상태</th></tr>
          </thead>
          <tbody>
            ${members.map(m => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    ${m.photoURL ? `<img src="${escHtml(m.photoURL)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover" loading="lazy">` : `<div style="width:28px;height:28px;border-radius:50%;background:var(--color-surface-2);display:flex;align-items:center;justify-content:center;font-size:14px">👤</div>`}
                    <div style="min-width:0">
                      <div style="font-weight:700">${escHtml(m.nickname || '회원')}</div>
                      <div style="font-family:monospace;font-size:10px;color:var(--color-text-muted)">${escHtml(String(m.uid || '').slice(0, 14))}…</div>
                    </div>
                  </div>
                </td>
                <td style="font-size:12px;color:var(--color-text-secondary)">${escHtml(m.email || '-')}</td>
                <td style="font-weight:800;color:var(--color-primary)">${Number(m.points || 0).toLocaleString()}P</td>
                <td style="font-size:12px;color:var(--color-text-muted)">${escHtml(fmtDate(m.createdAtMs))}</td>
                <td style="font-size:12px;color:var(--color-text-muted)">${escHtml(fmtDate(m.lastLoginAtMs))}</td>
                <td>${m.disabled ? '<span style="font-size:11px;font-weight:700;color:var(--color-danger)">비활성</span>' : '<span style="font-size:11px;font-weight:700;color:var(--color-success)">정상</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;

  el.querySelector('#btn-users-refresh')?.addEventListener('click', () => renderUsers(el));
  bindMyInfoAccordion();
}

function bindMyInfoAccordion() {
  document.getElementById('admin-myinfo-acc')?.addEventListener('toggle', async function () {
    if (!this.open) return;
    const body = document.getElementById('admin-myinfo-body');
    if (!body || body.dataset.loaded) return;
    body.dataset.loaded = '1';
    await renderMyInfo(body);
  });
}

/* ── AI 관리 ── */
async function renderAiSettings(el) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  // 운영 텍스트 AI(판사·번역·궁합·작명)에 쓰는 모델만. GPT는 이미지 생성 전용이라 제외.
  // Estimated cost per request by model (USD) — approximate based on avg ~400 input / 300 output tokens
  const COST_PER_USE = { claude: 0.0010, gemini: 0.0005 };
  const MODEL_NAMES  = { claude: 'Claude Haiku 4.5', gemini: 'Gemini 2.5 Flash' };
  const GEMINI_FREE_DAILY_BY_MODEL = { 'gemini-2.5-flash': 250, 'gemini-2.0-flash': 1500 };

  // Load AI킹 config + usage stats in parallel
  let aiKingConfig = { activeModel: 'claude', claudeModel: 'claude-haiku-4-5-20251001', geminiModel: 'gemini-2.5-flash', openaiModel: 'gpt-image-1', pointsPerUse: 100, dailyFreeLimit: 3, monthlyCap: 10 };
  let aiConfig = { enabled: true, features: {} };
  let todayDocs = [];
  let monthDocs = [];

  await Promise.all([
    getDoc(doc(db, 'config', 'ai_king')).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      aiKingConfig = {
        // GPT는 운영 모델 선택지가 아니므로, 과거에 openai로 저장돼 있었다면 claude로 되돌림
        activeModel: (d.activeModel === 'openai' ? 'claude' : d.activeModel) || 'claude',
        claudeModel: d.claudeModel || 'claude-haiku-4-5-20251001',
        claudeKeyMasked: d.claudeApiKey ? '●'.repeat(8) + d.claudeApiKey.slice(-4) : '',
        geminiModel: d.geminiModel || 'gemini-2.5-flash',
        geminiKeyMasked: d.geminiApiKey ? '●'.repeat(8) + d.geminiApiKey.slice(-4) : '',
        openaiModel: d.openaiModel || 'gpt-image-1',
        openaiKeyMasked: d.openaiApiKey ? '●'.repeat(8) + d.openaiApiKey.slice(-4) : '',
        pointsPerUse: d.pointsPerUse ?? 100,
        dailyFreeLimit: d.dailyFreeLimit ?? 3,
        monthlyCap: d.monthlyCap ?? 10,
      };
    }).catch(() => {}),
    getDoc(doc(db, 'config', 'ai')).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      aiConfig = { enabled: d.enabled !== false, features: d.features || {} };
    }).catch(() => {}),
    getDocs(query(collection(db, 'ai_king_usage'), where('date', '==', today), limit(500))).then(snap => {
      todayDocs = snap.docs.map(d => d.data());
    }).catch(() => {}),
    getDocs(query(collection(db, 'ai_king_usage'), where('date', '>=', monthStart), where('date', '<=', today), limit(2000))).then(snap => {
      monthDocs = snap.docs.map(d => d.data());
    }).catch(() => {}),
  ]);

  const geminiFreeDailyLimit = GEMINI_FREE_DAILY_BY_MODEL[aiKingConfig.geminiModel] ?? 250;

  const FEATURES = [
    { key: 'judge',     label: '⚖️ 판결소' },
    { key: 'translate', label: '✨ 창작소' },
    { key: 'match',     label: '💘 궁합소' },
    { key: 'naming',    label: '✨ 작명(구)' },
    { key: 'consult',   label: '💬 상담소' },
  ];

  // Today stats
  const todayByFeature = {};
  const todayByUser = {};
  let todayTotal = 0;
  for (const d of todayDocs) {
    todayByFeature[d.feature] = (todayByFeature[d.feature] || 0) + (d.count || 0);
    if (d.userId) todayByUser[d.userId] = (todayByUser[d.userId] || 0) + (d.count || 0);
    todayTotal += (d.count || 0);
  }
  const topUsers = Object.entries(todayByUser).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Monthly stats + cost
  let monthTotal = 0;
  for (const d of monthDocs) monthTotal += (d.count || 0);
  const costPerUse = COST_PER_USE[aiKingConfig.activeModel] || 0.001;
  // Gemini free tier: subtract free daily allowance from billed count
  let billedUses = monthTotal;
  if (aiKingConfig.activeModel === 'gemini') {
    const dayOfMonth = parseInt(today.slice(8, 10));
    const freeThisMonth = geminiFreeDailyLimit * dayOfMonth;
    billedUses = Math.max(0, monthTotal - freeThisMonth);
  }
  const monthCostUSD = billedUses * costPerUse;
  const monthCostKRW = Math.round(monthCostUSD * 1370);
  const cap = aiKingConfig.monthlyCap;
  const capPct = cap > 0 ? Math.min(100, Math.round((monthCostUSD / cap) * 100)) : 0;
  const isOver = monthCostUSD >= cap;
  const isNear = capPct >= 80 && !isOver;
  const dayOfMonth = parseInt(today.slice(8, 10));
  const daysInMonth = new Date(parseInt(today.slice(0, 4)), parseInt(today.slice(5, 7)), 0).getDate();
  const projectedUSD = dayOfMonth > 0 ? ((monthCostUSD / dayOfMonth) * daysInMonth) : 0;

  const featureList = [
    { key: 'moderation', label: '🛡️ 게시물 자동 검토', desc: '새 게시물 AI 모더레이션 (욕설·비방 자동 숨김)' },
    { key: 'autoReport', label: '📋 신고 자동 처리',   desc: '접수된 신고 AI 분석 후 명백한 위반 자동 처리' },
  ];

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:24px;max-width:740px">
      <h2 class="admin-section-title">🤖 AI 관리</h2>

      <!-- 비용 관리 -->
      <div class="card" style="${isOver ? 'border-color:var(--color-danger)!important' : isNear ? 'border-color:#b77900!important' : ''}">
        <div class="card__body">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:15px;font-weight:900">💰 이번 달 비용 관리</div>
            <span style="font-size:11px;padding:3px 8px;border-radius:99px;font-weight:800;background:${isOver ? 'rgba(239,68,68,.12)' : isNear ? 'rgba(255,184,0,.12)' : 'var(--color-surface-2)'};color:${isOver ? 'var(--color-danger)' : isNear ? 'var(--color-warning-text)' : 'var(--color-text-muted)'}">${today.slice(0, 7)}</span>
          </div>
          <div class="admin-stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
            <div class="admin-stat-card">
              <div class="admin-stat-card__num" style="font-size:13px;color:var(--color-primary)">${MODEL_NAMES[aiKingConfig.activeModel] || aiKingConfig.activeModel}</div>
              <div class="admin-stat-card__label">사용 모델</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-card__num">${monthTotal.toLocaleString()}</div>
              <div class="admin-stat-card__label">이번 달 총 사용</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-card__num" style="color:${isOver ? 'var(--color-danger)' : isNear ? 'var(--color-warning-text)' : 'var(--color-text-primary)'}">$${monthCostUSD.toFixed(3)}</div>
              <div class="admin-stat-card__label">추정 비용 (≈₩${monthCostKRW.toLocaleString()})</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-card__num" style="color:var(--color-text-muted)">$${projectedUSD.toFixed(2)}</div>
              <div class="admin-stat-card__label">월말 예상</div>
            </div>
          </div>
          <div style="margin-bottom:${isOver || isNear ? 10 : 14}px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-bottom:5px">
              <span>예산 대비 사용률</span>
              <span>$${monthCostUSD.toFixed(3)} / $${cap} (${capPct}%)</span>
            </div>
            <div style="height:8px;border-radius:999px;background:var(--color-surface-2);overflow:hidden">
              <div style="height:100%;width:${capPct}%;background:${isOver ? 'var(--color-danger)' : isNear ? '#FFB800' : 'var(--color-primary)'};transition:width .3s"></div>
            </div>
          </div>
          ${isOver ? `<div style="padding:9px 12px;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);font-size:12px;font-weight:700;color:var(--color-danger);margin-bottom:12px">🚨 이번 달 예산 한도($${cap})를 초과했어요. AI 전체 중지 또는 한도를 조정해주세요.</div>` : isNear ? `<div style="padding:9px 12px;border-radius:10px;background:rgba(255,184,0,.1);border:1px solid rgba(255,184,0,.25);font-size:12px;font-weight:700;color:var(--color-warning-text);margin-bottom:12px">⚠️ 예산의 ${capPct}%를 사용했어요. 잔여 한도: $${(cap - monthCostUSD).toFixed(3)}</div>` : ''}
          <div style="display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid var(--color-border);flex-wrap:wrap">
            <div style="font-size:12px;font-weight:700">월 예산 한도</div>
            <div style="display:flex;align-items:center;gap:4px">
              <span style="font-size:13px;color:var(--color-text-muted)">$</span>
              <input type="number" class="form-input" id="monthly-cap" value="${cap}" min="0.5" max="500" step="0.5" style="width:80px;font-size:13px">
            </div>
            <span style="font-size:11px;color:var(--color-text-muted)">≈₩${Math.round(cap * 1370).toLocaleString()}/월</span>
            <span style="font-size:11px;color:var(--color-text-muted);margin-left:auto">${MODEL_NAMES[aiKingConfig.activeModel]} 기준 건당 약 $${costPerUse.toFixed(4)}${aiKingConfig.activeModel === 'gemini' ? ` · 일 ${geminiFreeDailyLimit.toLocaleString()}건 무료` : ''}</span>
          </div>
        </div>
      </div>

      <!-- 오늘 사용량 -->
      <div class="card">
        <div class="card__body">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:15px;font-weight:900">📊 오늘 사용량</div>
            <div style="font-size:11px;color:var(--color-text-muted)">${today}</div>
          </div>
          <div class="admin-stat-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:${topUsers.length ? 16 : 0}px">
            <div class="admin-stat-card" style="background:var(--color-primary-bg)">
              <div class="admin-stat-card__num" style="color:var(--color-primary)">${todayTotal}</div>
              <div class="admin-stat-card__label">전체</div>
            </div>
            ${FEATURES.map(f => `
              <div class="admin-stat-card">
                <div class="admin-stat-card__num">${todayByFeature[f.key] || 0}</div>
                <div class="admin-stat-card__label" style="font-size:10px">${f.label}</div>
              </div>`).join('')}
          </div>
          ${topUsers.length > 0 ? `
            <div style="font-size:12px;font-weight:800;color:var(--color-text-secondary);margin-bottom:8px">오늘 TOP ${topUsers.length} 사용자</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${topUsers.map(([uid, cnt], i) => `
                <div style="display:flex;align-items:center;gap:10px;font-size:12px">
                  <span style="width:18px;height:18px;border-radius:50%;background:var(--color-surface-2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${i + 1}</span>
                  <span style="flex:1;font-family:monospace;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${uid.slice(0, 16)}…</span>
                  <span style="font-weight:800;color:var(--color-primary)">${cnt}회</span>
                </div>`).join('')}
            </div>` : `<div style="font-size:13px;color:var(--color-text-muted);text-align:center;padding:8px 0">오늘 사용 기록이 없어요</div>`}
        </div>
      </div>

      <!-- AI 모델 및 API 설정 -->
      <div class="card">
        <div class="card__body">
          <div style="font-size:15px;font-weight:900;margin-bottom:4px">🎮 운영 AI 모델</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:16px">AI킹(판사·번역사·궁합·작명소)에 쓰는 텍스트 모델이에요. 하나만 골라서 운영해요.</div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
            ${[
              { id: 'claude', icon: '🟣', label: 'Claude Haiku 4.5', sub: '권장 · 건당 $0.001' },
              { id: 'gemini', icon: '🔵', label: 'Gemini 2.5 Flash', sub: '무료 250/일 · 건당 $0.0005' },
            ].map(m => `
              <label class="admin-model-radio ${aiKingConfig.activeModel === m.id ? 'active' : ''}">
                <input type="radio" name="ai-model" value="${m.id}" ${aiKingConfig.activeModel === m.id ? 'checked' : ''} style="display:none">
                <span style="font-size:18px">${m.icon}</span>
                <div>
                  <div style="font-size:13px;font-weight:700">${m.label}</div>
                  <div style="font-size:11px;opacity:0.7">${m.sub}</div>
                </div>
              </label>`).join('')}
          </div>

          <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:18px">
            <div class="admin-key-row">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="font-size:12px;font-weight:700;color:#6C5CE7">🟣 Claude API Key (Anthropic)</span>
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style="font-size:11px;color:var(--color-primary);text-decoration:underline">키 발급 →</a>
              </div>
              <input type="password" class="form-input" id="key-claude" placeholder="${aiKingConfig.claudeKeyMasked || 'sk-ant-api03-...'}" style="width:100%;font-size:13px;font-family:monospace;margin-bottom:6px" autocomplete="new-password">
              <select class="form-input" id="model-claude" style="font-size:12px;width:100%">
                <option value="claude-haiku-4-5-20251001" ${aiKingConfig.claudeModel === 'claude-haiku-4-5-20251001' ? 'selected' : ''}>Haiku 4.5 (추천 · 저렴)</option>
                <option value="claude-sonnet-4-6" ${aiKingConfig.claudeModel === 'claude-sonnet-4-6' ? 'selected' : ''}>Sonnet 4.6 (고성능)</option>
              </select>
            </div>
            <div class="admin-key-row">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="font-size:12px;font-weight:700;color:#0984e3">🔵 Gemini API Key (Google AI Studio)</span>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="font-size:11px;color:var(--color-primary);text-decoration:underline">키 발급 →</a>
              </div>
              <input type="password" class="form-input" id="key-gemini" placeholder="${aiKingConfig.geminiKeyMasked || 'AIzaSy...'}" style="width:100%;font-size:13px;font-family:monospace;margin-bottom:6px" autocomplete="new-password">
              <select class="form-input" id="model-gemini" style="font-size:12px;width:100%">
                <option value="gemini-2.5-flash" ${aiKingConfig.geminiModel === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (추천 · 무료 250건/일)</option>
                <option value="gemini-2.0-flash" ${aiKingConfig.geminiModel === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash (무료 1,500건/일)</option>
              </select>
            </div>
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--color-border)">
            <div style="flex:1;min-width:130px">
              <div style="font-size:12px;font-weight:700;margin-bottom:4px">🆓 1인 1일 무료 한도</div>
              <div style="display:flex;align-items:center;gap:5px">
                <input type="number" class="form-input" id="daily-free-limit" value="${aiKingConfig.dailyFreeLimit}" min="1" max="50" style="width:65px;font-size:13px">
                <span style="font-size:12px;color:var(--color-text-muted)">회 / 기능</span>
              </div>
            </div>
            <div style="flex:1;min-width:130px">
              <div style="font-size:12px;font-weight:700;margin-bottom:4px">💰 추가 사용권 포인트</div>
              <div style="display:flex;align-items:center;gap:5px">
                <input type="number" class="form-input" id="points-per-use" value="${aiKingConfig.pointsPerUse}" min="10" max="500" style="width:65px;font-size:13px">
                <span style="font-size:12px;color:var(--color-text-muted)">P / 1회</span>
              </div>
            </div>
            <div style="display:flex;align-items:flex-end">
              <button class="btn btn--primary" id="btn-save-ai-king-config">설정 저장</button>
            </div>
          </div>
          <div id="ai-king-config-result" style="font-size:12px;margin-top:8px;color:var(--color-text-muted)"></div>
        </div>
      </div>

      <!-- GPT 이미지 생성 (전용) -->
      <div class="card">
        <div class="card__body">
          <div style="font-size:15px;font-weight:900;margin-bottom:4px">🖼️ GPT 이미지 생성</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:14px">GPT(OpenAI)는 운영 텍스트 AI에는 쓰지 않고, <b>이미지 생성에만</b> 사용해요. 키만 저장해두면 이미지 기능 출시 때 바로 연결돼요.</div>
          <div class="admin-key-row">
            <div style="font-size:12px;font-weight:700;color:#00b894;margin-bottom:4px">🟢 OpenAI API Key</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <input type="password" class="form-input" id="key-openai" placeholder="${aiKingConfig.openaiKeyMasked || 'sk-...'}" style="flex:1;min-width:200px;font-size:12px;font-family:monospace" autocomplete="new-password">
              <select class="form-input" id="model-openai" style="font-size:12px;min-width:160px">
                <option value="gpt-image-1" ${aiKingConfig.openaiModel === 'gpt-image-1' ? 'selected' : ''}>gpt-image-1 (이미지)</option>
                <option value="dall-e-3" ${aiKingConfig.openaiModel === 'dall-e-3' ? 'selected' : ''}>DALL·E 3</option>
              </select>
              <button class="btn btn--ghost" id="btn-save-openai-key">저장</button>
            </div>
            <div id="openai-key-result" style="font-size:12px;margin-top:8px;color:var(--color-text-muted)"></div>
          </div>
        </div>
      </div>

      <!-- 운영 기능 설정 -->
      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:2px">⚙️ 운영 기능</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:14px">AI킹 외 사이트 자동화 기능을 관리해요.</div>
          <div style="display:flex;flex-direction:column;gap:4px" id="ai-feature-list">
            ${featureList.map(f => `
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--color-border-light)">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:700">${f.label}</div>
                  <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">${f.desc}</div>
                </div>
                <label style="display:flex;align-items:center;gap:6px;flex-shrink:0;cursor:pointer">
                  <input type="checkbox" class="ai-feature-toggle" data-feature="${f.key}"
                    ${aiConfig.features[f.key] !== false ? 'checked' : ''}>
                  <span style="font-size:12px">${aiConfig.features[f.key] !== false ? '켜짐' : '꺼짐'}</span>
                </label>
              </div>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
            <button class="btn btn--ghost btn--sm" id="btn-save-features">저장</button>
            <button class="btn btn--danger btn--sm" id="btn-ai-emergency-stop" style="margin-left:auto">🚨 AI 전체 중지</button>
          </div>
        </div>
      </div>

      <!-- 수동 실행 -->
      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:4px">🗣️ AI 티격태격</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:14px">매일 오전 10시 자동 생성돼요. 지금 바로 만들거나 주제를 직접 넣을 수도 있어요.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="debate-topic-input" type="text" placeholder="주제 직접 입력 (비우면 오늘의 주제)" maxlength="100"
              style="flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--color-border);border-radius:8px;font-size:13px">
            <button class="btn btn--primary btn--sm" id="btn-trigger-debate">🗣️ 지금 생성</button>
          </div>
          <div id="ai-trigger-result" style="margin-top:10px;font-size:12px;color:var(--color-text-muted)"></div>
        </div>
      </div>

    </div>`;

  // 모델 라디오 스타일 + 비용 안내 실시간 업데이트
  el.querySelectorAll('input[name="ai-model"]').forEach(radio => {
    radio.addEventListener('change', () => {
      el.querySelectorAll('.admin-model-radio').forEach(l => l.classList.toggle('active', l.querySelector('input').value === radio.value));
    });
  });

  // 설정 저장 (모델 + API키 + 한도 + 예산)
  el.querySelector('#btn-save-ai-king-config')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-save-ai-king-config');
    const result = el.querySelector('#ai-king-config-result');
    btn.disabled = true; btn.textContent = '저장 중...';
    try {
      const saveFn = httpsCallable(functions, 'saveAiKingConfig');
      const payload = {
        activeModel:    el.querySelector('input[name="ai-model"]:checked')?.value || 'claude',
        claudeModel:    el.querySelector('#model-claude')?.value,
        geminiModel:    el.querySelector('#model-gemini')?.value,
        pointsPerUse:   parseInt(el.querySelector('#points-per-use')?.value) || 100,
        dailyFreeLimit: parseInt(el.querySelector('#daily-free-limit')?.value) || 3,
        monthlyCap:     parseFloat(el.querySelector('#monthly-cap')?.value) || 10,
      };
      const claudeKey = el.querySelector('#key-claude')?.value.trim();
      const geminiKey = el.querySelector('#key-gemini')?.value.trim();
      if (claudeKey) payload.claudeApiKey = claudeKey;
      if (geminiKey) payload.geminiApiKey = geminiKey;
      await saveFn(payload);
      toast.success('AI 설정이 저장됐어요 ✅');
      result.textContent = `✅ ${new Date().toLocaleTimeString('ko-KR')} 저장 완료 — 모델: ${MODEL_NAMES[payload.activeModel]}, 무료 ${payload.dailyFreeLimit}회/일, 월 예산 $${payload.monthlyCap}`;
      if (claudeKey) { el.querySelector('#key-claude').value = ''; el.querySelector('#key-claude').placeholder = '●'.repeat(8) + claudeKey.slice(-4); }
      if (geminiKey) { el.querySelector('#key-gemini').value = ''; el.querySelector('#key-gemini').placeholder = '●'.repeat(8) + geminiKey.slice(-4); }
    } catch (e) {
      result.textContent = '❌ ' + (e.message || '저장 실패');
      toast.error(e.message || '저장에 실패했어요');
    } finally { btn.disabled = false; btn.textContent = '설정 저장'; }
  });

  // GPT 이미지 생성 키 저장 (운영 모델과 분리)
  el.querySelector('#btn-save-openai-key')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-save-openai-key');
    const result = el.querySelector('#openai-key-result');
    const openaiKey = el.querySelector('#key-openai')?.value.trim();
    const openaiModel = el.querySelector('#model-openai')?.value;
    if (!openaiKey && !openaiModel) { result.textContent = '저장할 내용이 없어요'; return; }
    btn.disabled = true; btn.textContent = '저장 중...';
    try {
      const payload = { openaiModel };
      if (openaiKey) payload.openaiApiKey = openaiKey;
      await httpsCallable(functions, 'saveAiKingConfig')(payload);
      toast.success('GPT 이미지 설정이 저장됐어요 ✅');
      result.textContent = `✅ ${new Date().toLocaleTimeString('ko-KR')} 저장 완료`;
      if (openaiKey) { el.querySelector('#key-openai').value = ''; el.querySelector('#key-openai').placeholder = '●'.repeat(8) + openaiKey.slice(-4); }
    } catch (e) {
      result.textContent = '❌ ' + (e.message || '저장 실패');
      toast.error(e.message || '저장에 실패했어요');
    } finally { btn.disabled = false; btn.textContent = '저장'; }
  });

  // 운영 기능 저장
  el.querySelector('#btn-save-features')?.addEventListener('click', async () => {
    const features = {};
    el.querySelectorAll('.ai-feature-toggle').forEach(cb => {
      features[cb.dataset.feature] = cb.checked;
      cb.nextElementSibling.textContent = cb.checked ? '켜짐' : '꺼짐';
    });
    try {
      await httpsCallable(functions, 'saveAiConfig')({ features, enabled: Object.values(features).some(Boolean) });
      toast.success('운영 기능 설정이 저장됐어요 ✅');
    } catch (e) { toast.error(e.message || '저장에 실패했어요'); }
  });

  // AI 전체 중지
  el.querySelector('#btn-ai-emergency-stop')?.addEventListener('click', async () => {
    if (!confirm('AI 기능을 전체 중지할까요? 판사·번역·궁합·작명 등 사용자 기능이 모두 비활성화됩니다.')) return;
    try {
      const allOff = Object.fromEntries(featureList.map(f => [f.key, false]));
      await httpsCallable(functions, 'saveAiConfig')({ features: allOff, enabled: false });
      toast.success('AI 전체 중지됐어요');
      setTimeout(() => renderAiSettings(el), 600);
    } catch (e) { toast.error(e.message || '중지에 실패했어요'); }
  });

  // AI 티격태격 수동 생성
  el.querySelector('#btn-trigger-debate')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-trigger-debate');
    const result = el.querySelector('#ai-trigger-result');
    const topic = el.querySelector('#debate-topic-input')?.value.trim() || '';
    btn.disabled = true; btn.textContent = '생성 중...';
    try {
      const res = await httpsCallable(functions, 'generateDebateNow')(topic ? { topic } : {});
      result.innerHTML = `✅ 생성 완료: "${escHtml(res.data.topic || '')}" — <a href="#/detail/${escHtml(res.data.postId)}">바로 보기</a>`;
      toast.success('AI 티격태격이 생성됐어요 🗣️');
    } catch (e) {
      result.textContent = '❌ ' + (e.message || '생성에 실패했어요');
      toast.error(e.message || '생성에 실패했어요');
    } finally { btn.disabled = false; btn.textContent = '🗣️ 지금 생성'; }
  });
}

/* ── 내 정보 설정 ── */
async function renderMyInfo(el) {
  const user = appState.user;
  if (!user) return;

  const userSnap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  const nickname = appState.nickname || user.displayName || user.email?.split('@')[0] || '관리자';
  const isGoogle = user.providerData?.some(p => p.providerId === 'google.com');

  const avatarHTML = user.photoURL
    ? `<img src="${user.photoURL}" alt="" class="admin-myinfo-avatar-img">`
    : `<span>${nickname[0] || '관'}</span>`;

  el.innerHTML = `
    <div class="admin-myinfo">
      <h2 class="admin-section-title">👤 내 정보 설정</h2>

      <!-- 프로필 -->
      <div class="card admin-myinfo-block">
        <div class="card__body--lg">
          <div class="admin-myinfo-section-title">🙋 내 프로필</div>
          <div class="admin-myinfo-profile-row">
            <div class="admin-myinfo-avatar">${avatarHTML}</div>
            <div>
              <div style="font-size:17px;font-weight:950;color:var(--color-text-primary);letter-spacing:-.3px">${escHtml(nickname)}</div>
              <div style="font-size:12px;color:var(--color-text-muted);margin-top:3px">${escHtml(user.email || '')}</div>
              <span class="admin-myinfo-role-badge">🔑 관리자</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 닉네임 변경 -->
      <div class="card admin-myinfo-block">
        <div class="card__body--lg">
          <div class="admin-myinfo-section-title">✏️ 닉네임 변경</div>
          <div class="form-group">
            <label class="form-label">새 닉네임 <span class="required">*</span></label>
            <input id="admin-new-nickname" class="form-input" type="text"
              value="${escHtml(nickname)}"
              placeholder="2~12자, 한글/영문/숫자/_"
              maxlength="12">
            <div class="form-hint">2~12자, 한글·영문·숫자·_(밑줄)만 사용 가능해요</div>
            <div id="admin-nickname-feedback" style="font-size:12px;margin-top:6px;min-height:18px"></div>
          </div>
          <button class="btn btn--primary btn--sm" id="btn-admin-save-nickname">저장하기</button>
        </div>
      </div>

      <!-- 계정 정보 -->
      <div class="card admin-myinfo-block">
        <div class="card__body--lg">
          <div class="admin-myinfo-section-title">🔐 계정 정보</div>
          <div class="admin-myinfo-row">
            <span class="admin-myinfo-row__label">이메일</span>
            <span class="admin-myinfo-row__value">${escHtml(user.email || '—')}</span>
          </div>
          <div class="admin-myinfo-row">
            <span class="admin-myinfo-row__label">로그인 방식</span>
            <span class="admin-myinfo-row__value">${isGoogle ? '구글 소셜 로그인' : '이메일/비밀번호'}</span>
          </div>
          <div class="admin-myinfo-row">
            <span class="admin-myinfo-row__label">권한</span>
            <span class="admin-myinfo-row__value" style="color:var(--color-primary);font-weight:900">🔑 관리자</span>
          </div>
        </div>
      </div>

    </div>`;

  const input    = el.querySelector('#admin-new-nickname');
  const feedback = el.querySelector('#admin-nickname-feedback');
  const saveBtn  = el.querySelector('#btn-admin-save-nickname');
  const NICK_RE  = /^[가-힣a-zA-Z0-9_]{2,12}$/;

  input?.addEventListener('input', () => {
    const v = input.value.trim();
    if (!v) { feedback.textContent = ''; return; }
    if (!NICK_RE.test(v)) {
      feedback.style.color = 'var(--color-danger)';
      feedback.textContent = '2~12자, 한글·영문·숫자·_ 만 가능해요';
    } else {
      feedback.style.color = 'var(--color-success)';
      feedback.textContent = '사용 가능한 형식이에요';
    }
  });

  saveBtn?.addEventListener('click', async () => {
    const newNick = input?.value.trim();
    if (!newNick) { toast.error('닉네임을 입력해주세요'); return; }
    if (!NICK_RE.test(newNick)) { toast.error('닉네임 형식이 맞지 않아요'); return; }
    if (newNick === nickname) { toast.info('현재 닉네임과 같아요'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    try {
      const nickDoc = await getDoc(doc(db, 'nicknames', newNick));
      if (nickDoc.exists() && nickDoc.data().uid !== user.uid) {
        toast.error('이미 사용 중인 닉네임이에요');
        return;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'nicknames', newNick), { uid: user.uid, createdAt: serverTimestamp() });
      if (nickname && nickname !== newNick) {
        batch.delete(doc(db, 'nicknames', nickname));
      }
      batch.update(doc(db, 'users', user.uid), { nickname: newNick, updatedAt: serverTimestamp() });
      await batch.commit();

      await updateProfile(user, { displayName: newNick });
      if (appState.user) appState.user.displayName = newNick;
      appState.nickname = newNick;
      renderSidebar();

      feedback.style.color = 'var(--color-success)';
      feedback.textContent = '저장됐어요!';
      toast.success('닉네임이 변경됐어요 ✨');

      // 사이드바 프로필 카드 이름도 즉시 갱신
      const profileName = document.querySelector('.admin-profile-card__name');
      if (profileName) profileName.textContent = newNick;
    } catch (e) {
      console.error(e);
      toast.error('저장에 실패했어요. 다시 시도해주세요');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장하기';
    }
  });
}

/* ── 게시글관리 ── */
async function renderAdminPosts(el) {
  const POST_TYPE_LABELS = {
    ai_judge: '⚖️ 판결소', ai_translate: '✨ 창작소',
    ai_match: '💘 궁합소', ai_naming: '✨ 창작소(구)', ai_consult: '💬 상담소',
    vote: '🗳️ 토론방', drip: '🤣 드립방',
    collect: '📌 일반방', general: '📝 일반',
  };
  function postTypeLabel(post) {
    const key = post.type || post.feedType || post.subtype || 'general';
    return POST_TYPE_LABELS[key] || `📝 ${key}`;
  }
  function dateFmt(v) {
    try { const d = v?.toDate?.() || v; return d ? new Date(d).toLocaleString('ko-KR') : '-'; } catch { return '-'; }
  }

  el.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(100))).catch(() => null);
  const posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];

  el.innerHTML = `
    <div class="admin-posts-panel">
      <h2 class="admin-section-title">📝 게시글관리</h2>
      <div class="card"><div class="card__body">
        <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px">최신 게시글 100개 기준 · 숨김/해제 작업 가능</div>
        <div class="admin-table-wrap" style="overflow:auto">
          <table class="admin-table" style="width:100%;min-width:680px">
            <thead><tr>
              <th style="text-align:left;width:110px">유형</th>
              <th style="text-align:left">제목</th>
              <th style="text-align:left;width:90px">작성자</th>
              <th style="text-align:left;width:130px">작성일</th>
              <th style="text-align:center;width:60px">상태</th>
              <th style="text-align:center;width:80px">작업</th>
            </tr></thead>
            <tbody>
              ${posts.length ? posts.map(post => `
                <tr data-admin-post-row="${escHtml(post.id)}">
                  <td><span style="font-size:12px">${escHtml(postTypeLabel(post))}</span></td>
                  <td><a href="#/detail/${escHtml(post.id)}" style="color:var(--color-primary)">${escHtml(post.title || post.desc || '(제목 없음)')}</a></td>
                  <td style="font-size:12px">${escHtml(post.authorName || post.authorEmail || post.authorId || '익명')}</td>
                  <td style="font-size:12px">${escHtml(dateFmt(post.createdAt))}</td>
                  <td style="text-align:center">${post.hidden
                    ? '<span class="badge badge--danger">숨김</span>'
                    : '<span class="badge badge--success">공개</span>'}</td>
                  <td style="text-align:center;white-space:nowrap">
                    <button class="btn btn--ghost btn--sm" data-admin-toggle-post="${escHtml(post.id)}" data-hidden="${post.hidden ? '1' : '0'}">${post.hidden ? '해제' : '숨김'}</button>
                    <button class="btn btn--danger btn--sm" data-admin-delete-post="${escHtml(post.id)}" style="margin-left:4px">삭제</button>
                  </td>
                </tr>`).join('')
              : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--color-text-muted)">게시글이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div></div>
    </div>`;

  el.querySelectorAll('[data-admin-toggle-post]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.adminTogglePost;
      const hide = btn.dataset.hidden !== '1';
      btn.disabled = true;
      try {
        await updateDoc(doc(db, 'feeds', id), {
          hidden: hide, hideReason: hide ? '관리자 숨김' : '',
          updatedAt: serverTimestamp(),
        });
        toast.success(hide ? '게시글을 숨김 처리했어요' : '게시글 숨김을 해제했어요');
        renderAdminPosts(el);
      } catch { toast.error('처리에 실패했어요'); btn.disabled = false; }
    });
  });

  el.querySelectorAll('[data-admin-delete-post]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.adminDeletePost;
      if (!confirm('이 게시글을 완전히 삭제할까요? 되돌릴 수 없어요.')) return;
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, 'feeds', id));
        toast.success('게시글을 삭제했어요');
        renderAdminPosts(el);
      } catch { toast.error('삭제에 실패했어요'); btn.disabled = false; }
    });
  });
}

