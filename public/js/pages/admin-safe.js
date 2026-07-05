import { db, auth, functions } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { escHtml } from '../utils/helpers.js';
import { collection, query, orderBy, limit, getDocs, getCountFromServer, where, doc, updateDoc, getDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

let currentTab = 'dashboard';
let userListState = { search: '', pageToken: 0, pageSize: 30 };

function isAdminUser() { return !!appState.isAdmin; }
function adminContent() { return document.getElementById('admin-content'); }
function setActive(tab) {
  currentTab = tab;
  document.querySelectorAll('[data-admin-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.adminTab === tab));
}
function safeDate(value) {
  const date = value?.toDate?.() || value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
function typeKey(post = {}) {
  const m = post.modules || {};
  if (post.subtype === 'vote' || post.feedType === 'vote' || m.vote?.enabled || post.type === 'vote' || post.type === 'ox' || post.type === 'battle' || post.subtype === 'judgment') return 'vote';
  return 'drip';
}
function typeLabel(post = {}) {
  return typeKey(post) === 'vote' ? '토론' : '드립';
}
function aiStatusLabel(post = {}) {
  const status = post.aiCharacterPanel?.status;
  if (status === 'ready') return '<span class="badge">AI완료</span>';
  if (status === 'fallback') return '<span class="badge badge--warning">AI대체</span>';
  return '<span class="badge badge--muted">AI없음</span>';
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
    ['posts', '📝', '콘텐츠'],
    ['reports', '🚨', '신고'],
    ['users', '👥', '회원'],
    ['ai', '🤖', 'AI 운영'],
  ];
  el.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <div class="admin-brand__logo-link"><img src="/logo.svg" alt="소소킹" width="34" height="34"></div>
          <div><div class="admin-brand__title">소소킹</div><div class="admin-brand__sub">토론 · 드립 운영 패널</div></div>
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
  const voteCount = recent.filter(p => typeKey(p) === 'vote').length;
  const dripCount = recent.filter(p => typeKey(p) === 'drip').length;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="admin-page-head"><div><h2 class="admin-section-title">📊 운영 대시보드</h2><div class="form-hint">토론·드립, AI 캐릭터 패널, 신고 상태를 빠르게 확인합니다.</div></div><button class="btn btn--ghost btn--sm" id="admin-refresh-dashboard">새로고침</button></div>
      <div class="admin-stat-grid admin-stat-grid--wide">
        <div class="admin-stat-card"><div class="admin-stat-card__num">${total.toLocaleString()}</div><div class="admin-stat-card__label">총 콘텐츠</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:var(--color-success)">${today}</div><div class="admin-stat-card__label">오늘 새 글</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:${reports ? 'var(--color-danger)' : 'var(--color-text-muted)'}">${reports}</div><div class="admin-stat-card__label">미처리 신고</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num">${users.toLocaleString()}</div><div class="admin-stat-card__label">회원 문서</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:${hidden ? 'var(--color-warning)' : 'var(--color-text-muted)'}">${hidden}</div><div class="admin-stat-card__label">숨김 콘텐츠</div></div>
      </div>
      <div class="admin-operation-note"><b>운영 체크</b><span>토론/드립 문구, AI 패널 품질, 신고 글 숨김 상태를 우선 확인하세요. 삭제는 최종 정리용으로만 사용하세요.</span></div>
      <div class="card"><div class="card__body"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px"><div style="font-size:14px;font-weight:900">최근 콘텐츠</div><div class="form-hint">최근 8개 기준 · 토론 ${voteCount} / 드립 ${dripCount}</div></div>${recent.map(p => `<div class="admin-recent-post"><a href="#/detail/${p.id}" style="flex:1;color:var(--color-primary);font-weight:700">${escHtml(p.title || '(제목없음)')}</a><span>${escHtml(typeLabel(p))}</span><span>${p.aiCharacterPanel?.enabled ? 'AI있음' : 'AI없음'}</span><span>${escHtml(p.authorName || '익명')}</span></div>`).join('') || '<div class="empty-state__desc">콘텐츠가 없어요</div>'}</div></div>
    </div>`;
  document.getElementById('admin-refresh-dashboard')?.addEventListener('click', () => renderDashboard(el));
}

async function renderPosts(el) {
  const deleteOwnPost = httpsCallable(functions, 'deleteOwnPost');
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(100))).catch(() => null);
  const posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><div class="admin-page-head"><div><h2 class="admin-section-title">📝 콘텐츠 관리</h2><div class="form-hint">토론/드립 글, AI 캐릭터 패널 상태, 공개/숨김 여부를 관리합니다.</div></div><button class="btn btn--ghost btn--sm" id="admin-post-refresh">새로고침</button></div><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>콘텐츠</th><th>유형</th><th>AI</th><th>작성자</th><th>상태</th><th>날짜</th><th>작업</th></tr></thead><tbody>${posts.map(p => `<tr data-row="${p.id}"><td><a href="#/detail/${p.id}" class="admin-table__link">${escHtml(p.title || '(제목없음)')}</a><div class="admin-table__sub">${escHtml(p.id)}</div></td><td>${escHtml(typeLabel(p))}</td><td>${aiStatusLabel(p)}</td><td>${escHtml(p.authorName || '익명')}</td><td>${p.hidden ? '<span class="badge badge--warning">숨김</span>' : '<span class="badge">공개</span>'}</td><td>${escHtml(safeDate(p.createdAt))}</td><td class="admin-row-actions"><button class="btn btn--ghost btn--sm" data-edit-post="${p.id}">수정</button><button class="btn btn--ghost btn--sm" data-hide="${p.id}" data-hidden="${p.hidden ? '1' : '0'}">${p.hidden ? '공개' : '숨김'}</button><button class="btn btn--danger btn--sm" data-delete="${p.id}" data-title="${escHtml(p.title || '(제목없음)')}">삭제</button></td></tr>`).join('') || '<tr><td colspan="7" class="admin-table__empty">콘텐츠가 없어요</td></tr>'}</tbody></table></div></div>`;
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
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><div class="admin-page-head"><div><h2 class="admin-section-title">🚨 신고 관리</h2><div class="form-hint">신고 사유를 확인하고, 필요한 경우 콘텐츠를 먼저 숨긴 뒤 처리완료하세요.</div></div><button class="btn btn--ghost btn--sm" id="admin-report-refresh">새로고침</button></div><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>사유</th><th>콘텐츠</th><th>신고자</th><th>작업</th></tr></thead><tbody>${reports.map(r => `<tr data-report="${r.id}"><td>${escHtml(r.reason || '')}<div class="admin-table__sub">${escHtml(safeDate(r.createdAt))}</div></td><td>${r.postId ? `<a href="#/detail/${r.postId}">${escHtml(r.postTitle || r.postId)}</a><div class="admin-table__sub">${escHtml(r.postId)}</div>` : '-'}</td><td>${escHtml(r.reporterName || '익명')}</td><td class="admin-row-actions">${r.postId ? `<button class="btn btn--ghost btn--sm" data-hide-post="${r.postId}">콘텐츠 숨김</button>` : ''}<button class="btn btn--primary btn--sm" data-resolve="${r.id}">처리완료</button></td></tr>`).join('') || '<tr><td colspan="4" class="admin-table__empty">처리할 신고가 없어요</td></tr>'}</tbody></table></div></div>`;
  document.getElementById('admin-report-refresh')?.addEventListener('click', () => renderReports(el));
  el.querySelectorAll('[data-hide-post]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('신고된 콘텐츠를 숨김 처리할까요?')) return;
    await updateDoc(doc(db, 'feeds', btn.dataset.hidePost), { hidden: true, hiddenAt: serverTimestamp(), hiddenBy: auth.currentUser?.uid || '', hiddenReason: 'report' });
    toast.success('콘텐츠를 숨김 처리했어요');
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
  if (options.search !== undefined) { userListState.search = String(options.search || '').trim(); userListState.pageToken = 0; }
  try {
    const result = await getAdminMemberList({ pageSize: userListState.pageSize, pageToken: userListState.pageToken, search: userListState.search });
    const data = result.data || {};
    const members = data.members || [];
    const start = Number(data.total || 0) ? Number(data.pageToken || 0) + 1 : 0;
    const end = Number(data.pageToken || 0) + members.length;
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><div class="admin-page-head"><div><h2 class="admin-section-title">👥 회원 현황</h2><div class="form-hint">가입 회원, 포인트, 최근 로그인 상태를 확인합니다.</div></div><button class="btn btn--ghost btn--sm" id="admin-user-refresh">새로고침</button></div><div class="admin-stat-grid"><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.total || 0).toLocaleString()}</div><div class="admin-stat-card__label">검색 결과 회원</div></div><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.totalRegistered || data.total || 0).toLocaleString()}</div><div class="admin-stat-card__label">전체 가입 회원</div></div><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.excludedAnonymous || 0).toLocaleString()}</div><div class="admin-stat-card__label">제외된 익명</div></div><div class="admin-stat-card"><div class="admin-stat-card__num">${Number(data.excludedAdmins || 0).toLocaleString()}</div><div class="admin-stat-card__label">제외된 관리자</div></div></div><div class="card"><div class="card__body" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input class="form-input" id="admin-user-search" value="${escHtml(userListState.search)}" placeholder="닉네임, 이메일, UID 검색" style="max-width:360px"><button class="btn btn--primary btn--sm" id="admin-user-search-btn">검색</button><button class="btn btn--ghost btn--sm" id="admin-user-clear-btn">초기화</button><span class="form-hint">${start.toLocaleString()}-${end.toLocaleString()} / ${Number(data.total || 0).toLocaleString()}명 · 한 페이지 ${Number(data.pageSize || userListState.pageSize)}명</span></div></div><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>회원</th><th>이메일</th><th>가입방식</th><th>포인트</th><th>가입일</th><th>최근 로그인</th><th>상태</th></tr></thead><tbody>${members.map(u => `<tr><td><b>${escHtml(u.nickname || '회원')}</b><div class="admin-table__sub">${escHtml(String(u.uid || '').slice(0,18))}…</div></td><td>${escHtml(u.email || '-')}</td><td>${escHtml(u.provider || '-')}</td><td>${Number(u.points || 0).toLocaleString()}P</td><td>${u.createdAtMs ? safeDate(new Date(u.createdAtMs)) : '-'}</td><td>${u.lastLoginAtMs ? safeDate(new Date(u.lastLoginAtMs)) : '-'}</td><td>${u.disabled ? '<span class="badge badge--danger">비활성</span>' : '<span class="badge">정상</span>'}</td></tr>`).join('') || '<tr><td colspan="7" class="admin-table__empty">회원 데이터가 없어요</td></tr>'}</tbody></table></div><div class="admin-page-head"><button class="btn btn--ghost btn--sm" id="admin-user-prev" ${data.prevPageToken === null || data.prevPageToken === undefined ? 'disabled' : ''}>이전</button><div class="form-hint">${data.scannedAll ? '' : '회원이 매우 많으면 일부만 검색될 수 있습니다.'}</div><button class="btn btn--ghost btn--sm" id="admin-user-next" ${data.nextPageToken === null || data.nextPageToken === undefined ? 'disabled' : ''}>다음</button></div></div>`;
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
  const generateAiContentNow = httpsCallable(functions, 'generateAiContentNow');
  const generateAllAiContentNow = httpsCallable(functions, 'generateAllAiContentNow');
  let enabled = true;
  let features = { characterPanel: true, imageAnalysis: true };
  try {
    const snap = await getDoc(doc(db, 'config', 'ai'));
    if (snap.exists()) {
      const data = snap.data();
      enabled = data.enabled !== false;
      features = { characterPanel: true, imageAnalysis: true, ...(data.features || {}) };
    }
  } catch {}
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;max-width:860px"><div class="admin-page-head"><div><h2 class="admin-section-title">🤖 AI 운영</h2><div class="form-hint">운영봇 사회자, AI 캐릭터 패널, 토론/드립 자동 샘플 생성을 관리합니다.</div></div></div><div class="admin-operation-note"><b>현재 구조</b><span>AI는 글 작성 후 제목·내용·이미지를 읽고 운영봇 사회자 멘트와 캐릭터별 토론/드립 패널을 생성합니다.</span></div><div class="card"><div class="card__body" style="display:flex;flex-direction:column;gap:12px"><label style="display:flex;gap:10px;align-items:center;font-weight:900"><input type="checkbox" id="ai-enabled" ${enabled ? 'checked' : ''}> AI 기능 사용</label><label style="display:flex;gap:10px;align-items:center;font-weight:900"><input type="checkbox" id="ai-character-panel" ${features.characterPanel !== false ? 'checked' : ''}> AI 캐릭터 패널 생성</label><label style="display:flex;gap:10px;align-items:center;font-weight:900"><input type="checkbox" id="ai-image-analysis" ${features.imageAnalysis !== false ? 'checked' : ''}> 첨부 이미지 분석 반영</label><div class="form-hint">AI 캐릭터 패널은 Gemini API 키 또는 서버 AI 설정을 사용합니다. 운영봇은 공개 캐릭터 목록에서는 숨기고 사회자 기능만 유지합니다.</div><button class="btn btn--primary" id="btn-ai-save" style="align-self:flex-start">설정 저장</button></div></div><div class="card"><div class="card__body" style="display:flex;flex-direction:column;gap:12px"><div style="font-size:14px;font-weight:900">자동 샘플 콘텐츠</div><div class="form-hint">초기 사이트가 비어 보이지 않도록 운영봇 이름으로 토론/드립 샘플을 생성합니다.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--ghost btn--sm" id="btn-ai-vote">토론 샘플 생성</button><button class="btn btn--ghost btn--sm" id="btn-ai-drip">드립 샘플 생성</button><button class="btn btn--primary btn--sm" id="btn-ai-all">토론+드립 생성</button></div></div></div></div>`;
  document.getElementById('btn-ai-save')?.addEventListener('click', async () => {
    await saveAiConfig({
      enabled: document.getElementById('ai-enabled')?.checked !== false,
      features: {
        characterPanel: document.getElementById('ai-character-panel')?.checked !== false,
        imageAnalysis: document.getElementById('ai-image-analysis')?.checked !== false,
      },
    });
    toast.success('AI 설정을 저장했어요');
  });
  document.getElementById('btn-ai-vote')?.addEventListener('click', async () => {
    const res = await generateAiContentNow({ preset: 'vote' });
    toast.success('토론 샘플을 생성했어요');
    if (res.data?.docId) navigate(`/detail/${res.data.docId}`);
  });
  document.getElementById('btn-ai-drip')?.addEventListener('click', async () => {
    const res = await generateAiContentNow({ preset: 'drip' });
    toast.success('드립 샘플을 생성했어요');
    if (res.data?.docId) navigate(`/detail/${res.data.docId}`);
  });
  document.getElementById('btn-ai-all')?.addEventListener('click', async () => {
    const res = await generateAllAiContentNow({});
    toast.success(`샘플 ${res.data?.total || 0}개를 생성했어요`);
    loadTab('posts');
  });
}
