import { db, auth, functions } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, deleteDoc, doc,
  getCountFromServer, where, updateDoc, serverTimestamp,
  Timestamp, getDoc, setDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import {
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { appState } from '../state.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { isAdmin } from '../app.js';
import { escHtml } from '../utils/helpers.js';
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
    { key: 'posts',     icon: '🗂️', label: '데이터관리', short: '데이터' },
    { key: 'reports',   icon: '🚨', label: '신고·의견', short: '신고' },
    { key: 'users',     icon: '👥', label: '회원관리', short: '회원' },
    { key: 'ai',        icon: '🤖', label: 'AI 관리', short: 'AI' },
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
    case 'posts':     return renderPosts(content);
    case 'reports':   return renderReports(content);
    case 'users':     return renderUsers(content);
    case 'ai':        return renderAiSettings(content);
    case 'myinfo':    return renderMyInfo(content);
  }
}

/* ── 대시보드 ── */
async function renderDashboard(el) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const TYPE_META = [
    { feedType: 'vote',    icon: '🗳️', label: '투표·판정', legacyTypes: ['vote', 'ox', 'crazy_court', 'balance', 'battle'] },
    { feedType: 'naming',  icon: '😜', label: '작명',      legacyTypes: ['naming'] },
    { feedType: 'drip',    icon: '🤣', label: '드립',      legacyTypes: ['drip', 'cbattle'] },
    { feedType: 'quiz',    icon: '🧠', label: '퀴즈',      legacyTypes: ['quiz', 'initial_game'] },
    { feedType: 'general', icon: '📝', label: '일반',      legacyTypes: ['general', 'anonymous', 'relay', 'acrostic', 'fill'] },
  ];

  const [totalSnap, todaySnap, recentSnap, reportSnap, ...allTypeSnaps] = await Promise.all([
    getCountFromServer(collection(db, 'feeds')).catch(() => null),
    getDocs(query(collection(db, 'feeds'), where('createdAt', '>=', Timestamp.fromDate(todayStart)), limit(99))).catch(() => null),
    getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(5))).catch(() => null),
    getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', false))).catch(() => null),
    ...TYPE_META.map(t => getCountFromServer(query(collection(db, 'feeds'), where('feedType', '==', t.feedType))).catch(() => null)),
    ...TYPE_META.map(t => getCountFromServer(query(collection(db, 'feeds'), where('type', 'in', t.legacyTypes))).catch(() => null)),
  ]);

  const total   = totalSnap?.data?.().count ?? 0;
  const today   = todaySnap?.size ?? 0;
  const pending = reportSnap?.data?.().count ?? 0;
  const recent  = recentSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
  const feedTypeSnaps  = allTypeSnaps.slice(0, TYPE_META.length);
  const legacySnaps    = allTypeSnaps.slice(TYPE_META.length);
  const typeCounts = TYPE_META.map((t, i) => ({
    ...t,
    count: (feedTypeSnaps[i]?.data?.().count ?? 0) + (legacySnaps[i]?.data?.().count ?? 0),
  }));

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:24px">
      <div>
        <h2 class="admin-section-title">📊 대시보드</h2>
        <div class="admin-stat-grid">
          <div class="admin-stat-card">
            <div class="admin-stat-card__num">${total.toLocaleString()}</div>
            <div class="admin-stat-card__label">총 게시물</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="color:var(--color-success)">${today}</div>
            <div class="admin-stat-card__label">오늘 새 글</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="color:${pending > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'}">${pending}</div>
            <div class="admin-stat-card__label">미처리 신고</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:14px">🎮 유형별 게시물 현황</div>
          <div class="admin-type-grid">
            ${typeCounts.map(t => `
              <div class="admin-type-card admin-type-card--multi">
                <div class="admin-type-card__icon">${t.icon}</div>
                <div class="admin-type-card__count">${t.count.toLocaleString()}</div>
                <div class="admin-type-card__name">${t.label}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">🕐 최근 게시물</div>
          ${recent.map(p => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--color-border-light)">
              <span style="font-size:11px;padding:3px 7px;border-radius:99px;background:var(--color-surface-2);font-weight:700">${escHtml(p.typeLabel || p.feedType || p.type || '')}</span>
              <a href="#/detail/${p.id}" style="flex:1;font-size:13px;font-weight:600;color:var(--color-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.title || '(제목없음)')}</a>
              <span style="font-size:11px;color:var(--color-text-muted);white-space:nowrap">${escHtml(p.authorName || '익명')}</span>
            </div>`).join('')}
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

/* ── 게시물 관리 ── */
async function renderPosts(el, searchQ = '', catFilter = '') {
  let constraints = [orderBy('createdAt', 'desc'), limit(50)];
  if (catFilter) constraints.unshift(where('cat', '==', catFilter));

  const [snap, hiddenSnap, totalSnap] = await Promise.all([
    getDocs(query(collection(db, 'feeds'), ...constraints)).catch(() => null),
    getCountFromServer(query(collection(db, 'feeds'), where('hidden', '==', true))).catch(() => null),
    getCountFromServer(collection(db, 'feeds')).catch(() => null),
  ]);
  let posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
  const totalCount  = totalSnap?.data?.().count ?? 0;
  const hiddenCount = hiddenSnap?.data?.().count ?? 0;

  if (searchQ) {
    const q = searchQ.toLowerCase();
    posts = posts.filter(p => (p.title || '').toLowerCase().includes(q) || (p.authorName || '').toLowerCase().includes(q));
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <h2 class="admin-section-title">🗂️ 데이터관리</h2>
      <div class="admin-stat-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="admin-stat-card">
          <div class="admin-stat-card__num">${totalCount.toLocaleString()}</div>
          <div class="admin-stat-card__label">전체 게시물</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__num" style="color:var(--color-danger)">${hiddenCount}</div>
          <div class="admin-stat-card__label">숨김 처리</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__num" style="color:var(--color-success)">${(totalCount - hiddenCount).toLocaleString()}</div>
          <div class="admin-stat-card__label">공개 중</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="admin-post-search" class="form-input" style="max-width:220px;font-size:13px" placeholder="제목/작성자 검색" value="${escHtml(searchQ)}">
        <button class="btn btn--primary btn--sm" id="btn-post-search">검색</button>
        ${[
          { key: '', label: '전체' },
          { key: 'multi', label: '📝 피드(신규)' },
          { key: 'golra', label: '🎯 골라봐(구)' },
          { key: 'usgyo', label: '😂 웃겨봐(구)' },
          { key: 'malhe', label: '🎮 도전봐(구)' },
        ].map(c => `<button class="filter-chip ${catFilter === c.key ? 'active' : ''}" data-post-cat="${c.key}">${c.label}</button>`).join('')}
      </div>
      <div class="card" style="overflow:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>제목</th>
              <th style="width:80px">유형</th>
              <th style="width:80px">카테고리</th>
              <th style="width:80px">작성자</th>
              <th style="width:60px">상태</th>
              <th style="width:120px">작업</th>
            </tr>
          </thead>
          <tbody>
            ${posts.length === 0 ? `<tr><td colspan="6" class="admin-table__empty">게시물이 없어요</td></tr>` :
              posts.map(p => `
                <tr data-post-row="${p.id}">
                  <td class="admin-table__title-cell">
                    <a href="#/detail/${p.id}" class="admin-table__link">${escHtml(p.title || '(제목없음)')}</a>
                  </td>
                  <td><span class="badge badge--gray" style="font-size:10px">${escHtml(p.typeLabel || p.feedType || p.type || '')}</span></td>
                  <td><span style="font-size:12px">${{ multi:'📝 피드', golra:'🎯 골라봐', usgyo:'😂 웃겨봐', malhe:'🎮 도전봐' }[p.cat] || escHtml(p.cat || '')}</span></td>
                  <td class="admin-table__muted">${escHtml(p.authorName || '익명')}</td>
                  <td>
                    ${p.hidden
                      ? `<span class="admin-status admin-status--hidden">숨김</span>`
                      : `<span class="admin-status admin-status--visible">공개</span>`}
                  </td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn--ghost btn--sm" data-hide="${p.id}" data-hidden="${p.hidden ? '1' : '0'}" style="font-size:11px">${p.hidden ? '공개' : '숨김'}</button>
                      <button class="btn btn--danger btn--sm" data-delete="${p.id}" style="font-size:11px">삭제</button>
                    </div>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('btn-post-search')?.addEventListener('click', () => {
    const q = document.getElementById('admin-post-search')?.value.trim() || '';
    renderPosts(el, q, catFilter);
  });
  document.getElementById('admin-post-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      renderPosts(el, e.target.value.trim(), catFilter);
    }
  });
  el.querySelectorAll('[data-post-cat]').forEach(btn => {
    btn.addEventListener('click', () => renderPosts(el, searchQ, btn.dataset.postCat));
  });
  el.querySelectorAll('[data-hide]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.hide;
      const nowHidden = btn.dataset.hidden === '1';
      try {
        await updateDoc(doc(db, 'feeds', id), { hidden: !nowHidden });
        toast.success(nowHidden ? '공개했어요' : '숨겼어요');
        renderPosts(el, searchQ, catFilter);
      } catch { toast.error('변경에 실패했어요'); }
    });
  });
  el.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('이 게시물을 완전히 삭제할까요? 복구할 수 없어요.')) return;
      try {
        await deleteDoc(doc(db, 'feeds', btn.dataset.delete));
        toast.success('삭제됐어요');
        btn.closest('[data-post-row]')?.remove();
      } catch { toast.error('삭제에 실패했어요'); }
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
            <div class="admin-stat-card__num" style="color:#b77900">${fbCounts.reviewing}</div>
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
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(100))).catch(() => null);
  const posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  // Deduplicate by authorId
  const userMap = new Map();
  for (const p of posts) {
    if (!p.authorId) continue;
    if (!userMap.has(p.authorId)) {
      userMap.set(p.authorId, { uid: p.authorId, name: p.authorName || '익명', photo: p.authorPhoto || '', posts: 0, lastPost: null });
    }
    const u = userMap.get(p.authorId);
    u.posts++;
    if (!u.lastPost || p.createdAt?.toDate?.() > u.lastPost) u.lastPost = p.createdAt?.toDate?.() ?? null;
  }
  const users = [...userMap.values()].sort((a, b) => b.posts - a.posts);

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">

      <details class="admin-accordion" id="admin-myinfo-acc">
        <summary class="admin-accordion__summary">
          <span>👤 내 정보 설정</span>
          <svg class="admin-accordion__chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="admin-accordion__body" id="admin-myinfo-body">
          <div style="padding:24px;text-align:center"><div class="spinner spinner--sm"></div></div>
        </div>
      </details>

      <div style="display:flex;align-items:center;justify-content:space-between">
        <h2 class="admin-section-title">👥 회원 현황</h2>
        <div style="font-size:13px;color:var(--color-text-muted)">최근 100개 게시물 기준</div>
      </div>
      <div class="admin-stat-grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="admin-stat-card">
          <div class="admin-stat-card__num">${users.length}</div>
          <div class="admin-stat-card__label">활동 회원 수</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__num">${posts.length}</div>
          <div class="admin-stat-card__label">분석된 게시물</div>
        </div>
      </div>
      <div class="card" style="overflow:auto">
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid var(--color-border);text-align:left;background:var(--color-surface-2)">
              <th style="padding:10px 12px">닉네임</th>
              <th style="padding:10px 12px;width:80px">게시물 수</th>
              <th style="padding:10px 12px">마지막 글</th>
              <th style="padding:10px 12px">UID</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u, i) => `
              <tr style="border-bottom:1px solid var(--color-border-light)">
                <td style="padding:10px 12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    ${u.photo ? `<img src="${u.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" loading="lazy">` : `<div style="width:28px;height:28px;border-radius:50%;background:var(--color-surface-2);display:flex;align-items:center;justify-content:center;font-size:14px">👤</div>`}
                    <span style="font-weight:700">${escHtml(u.name)}</span>
                    ${i === 0 ? `<span style="font-size:10px;background:#FFB800;color:#fff;border-radius:99px;padding:2px 6px;font-weight:800">TOP</span>` : ''}
                  </div>
                </td>
                <td style="padding:10px 12px;font-weight:800;color:var(--color-primary)">${u.posts}</td>
                <td style="padding:10px 12px;font-size:12px;color:var(--color-text-muted)">${u.lastPost ? u.lastPost.toLocaleDateString('ko-KR') : '-'}</td>
                <td style="padding:10px 12px;font-size:10px;font-family:monospace;color:var(--color-text-muted)">${u.uid.slice(0, 12)}…</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('admin-myinfo-acc')?.addEventListener('toggle', async function () {
    if (!this.open) return;
    const body = document.getElementById('admin-myinfo-body');
    if (body.dataset.loaded) return;
    body.dataset.loaded = '1';
    await renderMyInfo(body);
  });
}

/* ── AI 설정 ── */
async function renderAiSettings(el) {
  // Load current AI config from Firestore
  let aiConfig = { enabled: true, apiKey: '', features: {}, usage: {} };
  try {
    const snap = await getDoc(doc(db, 'config', 'ai'));
    if (snap.exists()) {
      const d = snap.data();
      aiConfig = {
        enabled: d.enabled !== false,
        apiKey: d.apiKey ? '●'.repeat(8) + d.apiKey.slice(-4) : '',
        features: d.features || {},
        usage: d.usage || {},
      };
    }
  } catch {}

  // Calculate today's usage
  const today = new Date().toISOString().slice(0, 10);
  const todayUsage = aiConfig.usage?.[today]?.requests || 0;

  // Load recent AI reports
  let reports = [];
  try {
    const rSnap = await getDocs(query(collection(db, 'ai_reports'), orderBy('createdAt', 'desc'), limit(5)));
    reports = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}

  const featureList = [
    { key: 'moderation',  label: '🛡️ 게시물 자동 검토', desc: '새 게시물 AI 모더레이션 (욕설·비방 자동 숨김)' },
    { key: 'autoReport',  label: '📋 신고 자동 처리',   desc: '접수된 신고 AI 분석 후 명백한 위반 자동 처리' },
    { key: 'autoMission', label: '🎯 미션 자동 생성',   desc: '매일 오전 7시 AI가 오늘의 미션 자동 생성' },
    { key: 'weeklyReport',label: '📊 주간 보고서',      desc: '매주 월요일 AI가 활동 보고서 자동 작성' },
  ];

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:24px;max-width:700px">
      <h2 class="admin-section-title">🤖 AI 관리</h2>

      <!-- API 키 설정 -->
      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:4px">🔑 Gemini API 키</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:12px">
            Google AI Studio에서 발급한 API 키를 입력하세요. 저장 후 마스킹 표시됩니다.
          </div>
          <div style="display:flex;gap:8px">
            <input type="password" id="ai-api-key-input" class="form-input" placeholder="${aiConfig.apiKey || 'AIza...'}"
              style="flex:1;font-family:monospace;font-size:13px" autocomplete="new-password">
            <button class="btn btn--primary btn--sm" id="btn-save-api-key">저장</button>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--color-text-muted)">
            💡 키는 Firestore에 암호화 없이 저장됩니다. 관리자 전용 문서(config/ai)에만 보관돼요.
          </div>
        </div>
      </div>

      <!-- 오늘 사용량 -->
      <div class="admin-stat-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="admin-stat-card">
          <div class="admin-stat-card__num" style="color:var(--color-primary)">${todayUsage}</div>
          <div class="admin-stat-card__label">오늘 AI 요청 수</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__num" style="font-size:14px;color:${aiConfig.enabled ? 'var(--color-success)' : 'var(--color-danger)'}">
            ${aiConfig.enabled ? '✅ 활성' : '⛔ 비활성'}
          </div>
          <div class="admin-stat-card__label">AI 운영 상태</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__num" style="font-size:14px">1,500</div>
          <div class="admin-stat-card__label">일일 무료 한도</div>
        </div>
      </div>

      <!-- 기능 ON/OFF -->
      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">⚙️ AI 기능 설정</div>
          <div style="display:flex;flex-direction:column;gap:12px" id="ai-feature-list">
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
          <button class="btn btn--ghost btn--sm" id="btn-save-features" style="margin-top:12px">기능 설정 저장</button>
        </div>
      </div>

      <!-- 수동 실행 -->
      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:4px">⚡ 수동 실행</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:14px">
            스케줄 없이 지금 바로 AI 작업을 실행할 수 있어요.
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" id="btn-trigger-all-content">✏️ AI 게시글 생성</button>
            <button class="btn btn--ghost btn--sm" id="btn-trigger-report">📊 주간 보고서 지금 생성</button>
          </div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-top:6px">
            💡 게시글 생성은 타입별 1개씩. 오늘 이미 생성된 타입은 건너뜀
          </div>
          <div id="ai-trigger-result" style="margin-top:10px;font-size:12px;color:var(--color-text-muted)"></div>
        </div>
      </div>

      <!-- 최근 AI 보고서 -->
      ${reports.length > 0 ? `
        <div class="card">
          <div class="card__body">
            <div style="font-size:14px;font-weight:800;margin-bottom:12px">📄 최근 AI 보고서</div>
            ${reports.map(r => `
              <div style="padding:12px;background:var(--color-surface-2);border-radius:var(--radius-md);margin-bottom:8px">
                <div style="font-size:13px;font-weight:700;margin-bottom:4px">${escHtml(r.title || '보고서')}</div>
                <div style="font-size:12px;color:var(--color-text-secondary);line-height:1.6">${escHtml(r.summary || '')}</div>
                ${r.highlights?.length ? `<ul style="font-size:11px;color:var(--color-text-muted);margin:8px 0 0 16px">${r.highlights.map(h => `<li>${escHtml(h)}</li>`).join('')}</ul>` : ''}
                ${r.nextWeekSuggestion ? `<div style="margin-top:8px;font-size:11px;color:var(--color-primary)">💡 ${escHtml(r.nextWeekSuggestion)}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}
    </div>`;

  // Save API key
  el.querySelector('#btn-save-api-key')?.addEventListener('click', async () => {
    const key = el.querySelector('#ai-api-key-input')?.value.trim();
    if (!key || key.length < 10) { toast.error('유효한 API 키를 입력해주세요'); return; }
    try {
      const saveFn = httpsCallable(functions, 'saveAiConfig');
      await saveFn({ apiKey: key, enabled: aiConfig.enabled, features: aiConfig.features });
      toast.success('API 키가 저장됐어요 🔑');
      el.querySelector('#ai-api-key-input').value = '';
      el.querySelector('#ai-api-key-input').placeholder = '●'.repeat(8) + key.slice(-4);
    } catch (e) { toast.error(e.message || '저장에 실패했어요'); }
  });

  // Save features
  el.querySelector('#btn-save-features')?.addEventListener('click', async () => {
    const features = {};
    el.querySelectorAll('.ai-feature-toggle').forEach(cb => {
      features[cb.dataset.feature] = cb.checked;
      cb.nextElementSibling.textContent = cb.checked ? '켜짐' : '꺼짐';
    });
    try {
      const saveFn = httpsCallable(functions, 'saveAiConfig');
      await saveFn({ features, enabled: features.moderation || features.autoMission || features.weeklyReport || features.autoReport });
      toast.success('설정이 저장됐어요 ✅');
    } catch (e) { toast.error(e.message || '저장에 실패했어요'); }
  });

  // Trigger mission
  el.querySelector('#btn-trigger-all-content')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-trigger-all-content');
    const result = el.querySelector('#ai-trigger-result');
    if (!confirm('AI 게시글 9개를 생성할까요? (오늘 이미 생성된 타입은 건너뜁니다)')) return;
    btn.disabled = true;
    btn.textContent = '생성 중... (최대 2분 소요)';
    result.textContent = '⏳ 9개 타입 순차 생성 중입니다...';
    try {
      const fn = httpsCallable(functions, 'generateAllAiContentNow', { timeout: 550000 });
      const res = await fn({ force: false });
      const { ok = 0, skipped = 0, total = 0, results = [] } = res.data || {};
      const typeLabels = { vote:'골라킹', initial_game:'초성게임', naming:'미친작명소', crazy_court:'억까재판', quiz:'미친퀴즈', relay:'막장킹', acrostic:'삼행시짓기' };
      const detail = results.map(r => r.ok ? `✅ ${typeLabels[r.type]||r.type}` : r.skipped ? `⏭ ${typeLabels[r.type]||r.type}(건너뜀)` : `❌ ${typeLabels[r.type]||r.type}`).join(' · ');
      result.innerHTML = `✅ 완료 — 생성 ${ok}개 / 건너뜀 ${skipped}개 / 전체 ${total}개<br><span style="color:var(--color-text-muted)">${detail}</span>`;
      toast.success(`AI 게시글 ${ok}개 생성 완료! 🎉`);
    } catch (e) {
      result.textContent = '❌ ' + (e.message || '생성에 실패했어요');
      toast.error(e.message || '생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '✏️ AI 게시글 7개 생성';
    }
  });

  // Trigger report
  el.querySelector('#btn-trigger-report')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-trigger-report');
    const result = el.querySelector('#ai-trigger-result');
    btn.disabled = true;
    btn.textContent = '생성 중...';
    try {
      const triggerFn = httpsCallable(functions, 'adminTriggerReport');
      const res = await triggerFn({});
      result.textContent = `✅ 보고서 생성 완료: "${res.data.title}"`;
      toast.success('주간 보고서가 생성됐어요 📊');
      setTimeout(() => renderAiSettings(el), 1000);
    } catch (e) {
      result.textContent = '❌ ' + (e.message || '생성에 실패했어요');
      toast.error(e.message || '생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '📊 주간 보고서 지금 생성';
    }
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

      <div class="admin-myinfo-grid">

        <!-- 왼쪽: 프로필 + 계정 정보 -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card__body--lg">
              <div class="admin-myinfo-section-title">🙋 내 프로필</div>
              <div class="admin-myinfo-profile-row">
                <div class="admin-myinfo-avatar">${avatarHTML}</div>
                <div>
                  <div style="font-size:16px;font-weight:900;color:var(--color-text-primary)">${escHtml(nickname)}</div>
                  <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px">${escHtml(user.email || '')}</div>
                  <span class="admin-myinfo-role-badge">🔑 관리자</span>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
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
                <span class="admin-myinfo-row__value" style="color:var(--color-primary)">🔑 관리자</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 오른쪽: 닉네임 변경 -->
        <div>
          <div class="card">
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

