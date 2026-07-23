import { db, auth, functions } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { escHtml } from '../utils/helpers.js';
import { collection, query, orderBy, limit, getDocs, getCountFromServer, where, doc, updateDoc, getDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

let currentTab = 'dashboard';
let userListState = { search: '', pageToken: 0, pageSize: 30 };

function isAdminUser() {
  return !!appState.isAdmin;
}

function setActive(tab) {
  currentTab = tab;
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.adminTab === tab);
  });
}

function adminContent() {
  return document.getElementById('admin-content');
}

function safeDate(value) {
  const date = value?.toDate?.() || value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function typeLabel(post = {}) {
  const m = post.modules || {};
  if (post.anonymous || m.anonymous?.enabled || post.subtype === 'anonymous') return '익명비밀글';
  if (post.subtype === 'fill' || m.fill?.enabled) return '빈칸 채우기';
  if (post.subtype === 'naming' || m.naming?.enabled) return '미친작명소';
  if (post.subtype === 'acrostic' || m.acrostic?.enabled) return '삼행시';
  if (post.subtype === 'relay' || m.relay?.enabled) return '막장릴레이';
  if (post.subtype === 'quiz' || m.quiz?.enabled) return '미친퀴즈';
  if (post.subtype === 'vote' || post.subtype === 'ox' || m.vote?.enabled) return '투표/판정';
  return post.typeLabel || '일반글';
}

function confirmDelete(title, id) {
  const keyword = '삭제';
  const value = prompt(`정말 삭제할까요?\n\n${title || id}\n\n되돌릴 수 없습니다. 계속하려면 '${keyword}'를 입력하세요.`);
  return value === keyword;
}

function renderAdminShell(el) {
  const user = appState.user || auth.currentUser;
  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '관리자';
  const menus = [
    ['dashboard', '📊', '대시보드'],
    ['posts', '📝', '게시물'],
    ['reports', '🚨', '신고'],
    ['users', '👥', '회원'],
    ['ai', '🤖', 'AI관리'],
  ];
  el.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <div class="admin-brand__logo-link"><img src="/logo.svg" alt="소소킹" width="34" height="34"></div>
          <div><div class="admin-brand__title">소소킹</div><div class="admin-brand__sub">관리자 패널</div></div>
        </div>
        <nav class="admin-nav">
          ${menus.map(([key, icon, label]) => `<button class="admin-menu-item ${currentTab === key ? 'active' : ''}" data-admin-tab="${key}"><span class="admin-menu-item__icon">${icon}</span><span class="admin-menu-item__label">${label}</span></button>`).join('')}
        </nav>
        <div class="admin-sidebar__footer">
          <div class="admin-profile-card"><div class="admin-profile-card__avatar"><span>${escHtml((nickname[0] || '관'))}</span></div><div class="admin-profile-card__info"><div class="admin-profile-card__name">${escHtml(nickname)}</div><div class="admin-profile-card__role">🔑 관리자</div></div></div>
        </div>
      </aside>
      <main id="admin-content"><div class="loading-center"><div class="spinner spinner--lg"></div></div></main>
    </div>`;
  document.querySelectorAll('[data-admin-tab]').forEach(btn => btn.addEventListener('click', () => loadTab(btn.dataset.adminTab)));
}

export async function renderAdmin() {
  const el = document.getElementById('page-content');

  if (auth.currentUser && !appState.user) {
    el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
    return;
  }

  if (!appState.user) { navigate('/login'); return; }
  if (!isAdminUser()) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔒</div><div class="empty-state__title">관리자 전용 페이지예요</div></div>`;
    return;
  }
  renderAdminShell(el);
  await loadTab(currentTab);
}

async function loadTab(tab) {
  setActive(tab);
  const el = adminContent();
  if (!el) return;
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
  try {
    if (tab === 'dashboard') return renderDashboard(el);
    if (tab === 'posts') return renderPosts(el);
    if (tab === 'reports') return renderReports(el);
    if (tab === 'users') return renderUsers(el);
    if (tab === 'ai') return renderAi(el);
  } catch (error) {
    console.error('[admin-safe] tab failed', tab, error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">관리자 탭을 불러오지 못했어요</div><div style="font-size:12px;white-space:pre-wrap;text-align:left;max-width:720px;margin-top:10px">${escHtml(error.stack || error.message || error)}</div></div>`;
  }
}

async function renderDashboard(el) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [totalSnap, todaySnap, hiddenSnap, reportSnap, userSnap, recentSnap] = await Promise.all([
    getCountFromServer(collection(db, 'feeds')).catch(() => null),
    getDocs(query(collection(db, 'feeds'), where('createdAt', '>=', Timestamp.fromDate(todayStart)), limit(99))).catch(() => null),
    getCountFromServer(query(collection(db, 'feeds'), where('hidden', '==', true))).catch(() => null),
    getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', false))).catch(() => null),
    getCountFromServer(collection(db, 'users')).catch(() => null),
    getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(8))).catch(() => null),
  ]);
  const total = totalSnap?.data?.().count || 0;
  const today = todaySnap?.size || 0;
  const hidden = hiddenSnap?.data?.().count || 0;
  const reports = reportSnap?.data?.().count || 0;
  const users = userSnap?.data?.().count || 0;
  const recent = recentSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="admin-page-head"><div><h2 class="admin-section-title">📊 대시보드</h2><div class="form-hint">운영자가 바로 확인해야 할 주요 상태입니다.</div></div><button class="btn btn--ghost btn--sm" id="admin-refresh-dashboard">새로고침</button></div>
      <div class="admin-stat-grid admin-stat-grid--wide">
        <div class="admin-stat-card"><div class="admin-stat-card__num">${total.toLocaleString()}</div><div class="admin-stat-card__label">총 게시물</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:var(--color-success)">${today}</div><div class="admin-stat-card__label">오늘 새 글</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:${reports ? 'var(--color-danger)' : 'var(--color-text-muted)'}">${reports}</div><div class="admin-stat-card__label">미처리 신고</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num">${users.toLocaleString()}</div><div class="admin-stat-card__label">회원 문서</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:${hidden ? 'var(--color-warning)' : 'var(--color-text-muted)'}">${hidden}</div><div class="admin-stat-card__label">숨김 게시물</div></div>
      </div>
      <div class="admin-operation-note"><b>운영 체크</b><span>신고 → 게시물 숨김 → 처리완료 순서로 관리하고, 삭제는 최종 정리용으로만 사용하세요.</span></div>
      <div class="card"><div class="card__body"><div style="font-size:14px;font-weight:800;margin-bottom:12px">최근 게시물</div>${recent.map(p => `<div class="admin-recent-post"><a href="#/detail/${p.id}" style="flex:1;color:var(--color-primary);font-weight:700">${escHtml(p.title || '(제목없음)')}</a><span>${escHtml(typeLabel(p))}</span><span>${escHtml(p.authorName || '익명')}</span></div>`).join('') || '<div class="empty-state__desc">게시물이 없어요</div>'}</div></div>
    </div>`;
  document.getElementById('admin-refresh-dashboard')?.addEventListener('click', () => renderDashboard(el));
}

async function renderPosts(el) {
  const deleteOwnPost = httpsCallable(functions, 'deleteOwnPost');
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(80))).catch(() => null);
  const posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><div class="admin-page-head"><div><h2 class="admin-section-title">📝 게시물 관리</h2><div class="form-hint">숨김은 복구 가능, 삭제는 되돌릴 수 없습니다.</div></div><button class="btn btn--ghost btn--sm" id="admin-post-refresh">새로고침</button></div><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>게시물</th><th>유형</th><th>작성자</th><th>상태</th><th>날짜</th><th>작업</th></tr></thead><tbody>${posts.map(p => `<tr data-row="${p.id}"><td><a href="#/detail/${p.id}" class="admin-table__link">${escHtml(p.title || '(제목없음)')}</a><div class="admin-table__sub">${escHtml(p.id)}</div></td><td>${escHtml(typeLabel(p))}</td><td>${escHtml(p.authorName || '익명')}</td><td>${p.hidden ? '<span class="badge badge--warning">숨김</span>' : '<span class="badge">공개</span>'}</td><td>${escHtml(safeDate(p.createdAt))}</td><td class="admin-row-actions"><button class="btn btn--ghost btn--sm" data-edit-post="${p.id}">수정</button><button class="btn btn--ghost btn--sm" data-hide="${p.id}" data-hidden="${p.hidden ? '1' : '0'}">${p.hidden ? '공개' : '숨김'}</button><button class="btn btn--danger btn--sm" data-delete="${p.id}" data-title="${escHtml(p.title || '(제목없음)')}">삭제</button></td></tr>`).join('') || '<tr><td colspan="6" class="admin-table__empty">게시물이 없어요</td></tr>'}</tbody></table></div></div>`;
  document.getElementById('admin-post-refresh')?.addEventListener('click', () => renderPosts(el));
  el.querySelectorAll('[data-edit-post]').forEach(btn => btn.addEventListener('click', () => navigate(`/write?edit=${encodeURIComponent(btn.dataset.editPost)}`)));
  el.querySelectorAll('[data-hide]').forEach(btn => btn.addEventListener('click', async () => {
    const nextHidden = btn.dataset.hidden !== '1';
    await updateDoc(doc(db, 'feeds', btn.dataset.hide), { hidden: nextHidden, hiddenAt: nextHidden ? serverTimestamp() : null, hiddenBy: auth.currentUser?.uid || '' });
    toast.success(nextHidden ? '숨김 처리했어요' : '공개로 변경했어요');
    renderPosts(el);
  }));
  el.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDelete(btn.dataset.title, btn.dataset.delete)) return;
    btn.disabled = true;
    const result = await deleteOwnPost({ postId: btn.dataset.delete });
    const counts = result.data?.counts || {};
    const childCount = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
    toast.success(`삭제했어요${childCount ? ` · 하위 ${childCount}건 정리` : ''}`);
    renderPosts(el);
  }));
}

async function renderReports(el) {
  const snap = await getDocs(query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc'), limit(80))).catch(() => null);
  const reports = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><div class="admin-page-head"><div><h2 class="admin-section-title">🚨 신고 관리</h2><div class="form-hint">신고 사유를 확인하고, 필요한 경우 게시물을 먼저 숨긴 뒤 처리완료하세요.</div></div><button class="btn btn--ghost btn--sm" id="admin-report-refresh">새로고침</button></div><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>사유</th><th>게시물</th><th>신고자</th><th>작업</th></tr></thead><tbody>${reports.map(r => `<tr data-report="${r.id}"><td>${escHtml(r.reason || '')}<div class="admin-table__sub">${escHtml(safeDate(r.createdAt))}</div></td><td>${r.postId ? `<a href="#/detail/${r.postId}">${escHtml(r.postTitle || r.postId)}</a><div class="admin-table__sub">${escHtml(r.postId)}</div>` : '-'}</td><td>${escHtml(r.reporterName || '익명')}</td><td class="admin-row-actions">${r.postId ? `<button class="btn btn--ghost btn--sm" data-hide-post="${r.postId}">게시물 숨김</button>` : ''}<button class="btn btn--primary btn--sm" data-resolve="${r.id}">처리완료</button></td></tr>`).join('') || '<tr><td colspan="4" class="admin-table__empty">처리할 신고가 없어요</td></tr>'}</tbody></table></div></div>`;
  document.getElementById('admin-report-refresh')?.addEventListener('click', () => renderReports(el));
  el.querySelectorAll('[data-hide-post]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('신고된 게시물을 숨김 처리할까요?')) return;
    await updateDoc(doc(db, 'feeds', btn.dataset.hidePost), { hidden: true, hiddenAt: serverTimestamp(), hiddenBy: auth.currentUser?.uid || '', hiddenReason: 'report' });
    toast.success('게시물을 숨김 처리했어요');
  }));
  el.querySelectorAll('[data-resolve]').forEach(btn => btn.addEventListener('click', async () => {
    await updateDoc(doc(db, 'reports', btn.dataset.resolve), { resolved: true, resolvedAt: serverTimestamp(), resolvedBy: auth.currentUser?.uid || '' });
    toast.success('처리했어요');
    renderReports(el);
  }));
}

async function renderUsers(el, options = {}) {
  const getAdminMemberList = httpsCallable(functions, 'getAdminMemberList');
  if (options.pageToken !== undefined) userListState.pageToken = Number(options.pageToken) || 0;
  if (options.search !== undefined) {
    userListState.search = String(options.search || '').trim();
    userListState.pageToken = 0;
  }
  try {
    const result = await getAdminMemberList({ pageSize: userListState.pageSize, pageToken: userListState.pageToken, search: userListState.search });
    const data = result.data || {};
    const members = data.members || [];
    const start = Number(data.total || 0) ? Number(data.pageToken || 0) + 1 : 0;
    const end = Number(data.pageToken || 0) + members.length;
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><div class="admin-page-head"><div><h2 class="admin-section-title">👥 회원 현황</h2><div class="form-hint">익명 로그인과 관리자를 제외한 가입 회원 목록입니다.</div></div><button class="btn btn--ghost btn--sm" id="admin-user-refresh">새로고침</button></div><div class="admin-stat-grid"><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.total || 0).toLocaleString()}</div><div class="admin-stat-card__label">검색 결과 회원</div></div><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.totalRegistered || data.total || 0).toLocaleString()}</div><div class="admin-stat-card__label">전체 가입 회원</div></div><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.excludedAnonymous || 0).toLocaleString()}</div><div class="admin-stat-card__label">제외된 익명</div></div><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.excludedAdmins || 0).toLocaleString()}</div><div class="admin-stat-card__label">제외된 관리자</div></div></div><div class="card"><div class="card__body" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input class="form-input" id="admin-user-search" value="${escHtml(userListState.search)}" placeholder="닉네임, 이메일, UID 검색" style="max-width:360px"><button class="btn btn--primary btn--sm" id="admin-user-search-btn">검색</button><button class="btn btn--ghost btn--sm" id="admin-user-clear-btn">초기화</button><span class="form-hint">${start.toLocaleString()}-${end.toLocaleString()} / ${Number(data.total || 0).toLocaleString()}명 · 한 페이지 ${Number(data.pageSize || userListState.pageSize)}명</span></div></div><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>회원</th><th>이메일</th><th>가입방식</th><th>포인트</th><th>가입일</th><th>최근 로그인</th><th>상태</th></tr></thead><tbody>${members.map(u => `<tr><td><b>${escHtml(u.nickname || '회원')}</b><div class="admin-table__sub">${escHtml(String(u.uid || '').slice(0,18))}…</div></td><td>${escHtml(u.email || '-')}</td><td>${escHtml(u.provider || '-')}</td><td>${Number(u.points || 0).toLocaleString()}P</td><td>${u.createdAtMs ? safeDate(new Date(u.createdAtMs)) : '-'}</td><td>${u.lastLoginAtMs ? safeDate(new Date(u.lastLoginAtMs)) : '-'}</td><td>${u.disabled ? '<span class="badge badge--danger">비활성</span>' : '<span class="badge">정상</span>'}</td></tr>`).join('') || '<tr><td colspan="7" class="admin-table__empty">회원 데이터가 없어요</td></tr>'}</tbody></table></div><div class="admin-page-head"><button class="btn btn--ghost btn--sm" id="admin-user-prev" ${data.prevPageToken === null || data.prevPageToken === undefined ? 'disabled' : ''}>이전</button><div class="form-hint">${data.scannedAll ? '' : '회원이 매우 많으면 일부만 검색될 수 있습니다.'}</div><button class="btn btn--ghost btn--sm" id="admin-user-next" ${data.nextPageToken === null || data.nextPageToken === undefined ? 'disabled' : ''}>다음</button></div></div>`;
    const searchInput = document.getElementById('admin-user-search');
    const submitSearch = () => renderUsers(el, { search: searchInput?.value || '' });
    document.getElementById('admin-user-refresh')?.addEventListener('click', () => renderUsers(el));
    document.getElementById('admin-user-search-btn')?.addEventListener('click', submitSearch);
    document.getElementById('admin-user-clear-btn')?.addEventListener('click', () => renderUsers(el, { search: '' }));
    searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') submitSearch(); });
    document.getElementById('admin-user-prev')?.addEventListener('click', () => renderUsers(el, { pageToken: data.prevPageToken }));
    document.getElementById('admin-user-next')?.addEventListener('click', () => renderUsers(el, { pageToken: data.nextPageToken }));
  } catch (error) {
    console.error(error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">회원 목록을 불러오지 못했어요</div><div class="empty-state__desc">functions 배포 후 다시 시도해주세요.</div></div>`;
  }
}

async function renderAi(el) {
  const saveAiConfig = httpsCallable(functions, 'saveAiConfig');
  let enabled = true;
  let features = {};
  try {
    const snap = await getDoc(doc(db, 'config', 'ai'));
    if (snap.exists()) {
      const data = snap.data();
      enabled = data.enabled !== false;
      features = data.features || {};
    }
  } catch {}
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;max-width:760px"><h2 class="admin-section-title">🤖 AI 관리</h2><div class="admin-operation-note"><b>현재 정책</b><span>AI 미션 자동생성은 제거했고, 최소 AI 사용 여부만 관리합니다.</span></div><div class="card"><div class="card__body"><label style="display:flex;gap:10px;align-items:center;font-weight:900"><input type="checkbox" id="ai-enabled" ${enabled ? 'checked' : ''}> AI 기능 사용</label><div class="form-hint" style="margin-top:10px">AI 댓글과 자동 콘텐츠는 Firebase Secret Manager의 GEMINI_API_KEY를 사용합니다. API 키는 Firestore에 저장하지 않습니다.</div><button class="btn btn--primary" id="btn-ai-save" style="margin-top:14px">설정 저장</button></div></div></div>`;
  document.getElementById('btn-ai-save')?.addEventListener('click', async () => {
    await saveAiConfig({ enabled: document.getElementById('ai-enabled')?.checked !== false, features });
    toast.success('AI 설정을 저장했어요');
  });
}
