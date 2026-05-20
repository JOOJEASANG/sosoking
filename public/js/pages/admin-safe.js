import { db, auth, functions } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { escHtml } from '../utils/helpers.js';
import { collection, query, orderBy, limit, getDocs, getCountFromServer, where, doc, updateDoc, deleteDoc, getDoc, setDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

let currentTab = 'dashboard';

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
          <a href="#/" class="admin-brand__logo-link" id="admin-safe-home"><img src="/logo.svg" alt="소소킹" width="34" height="34"></a>
          <div><div class="admin-brand__title">소소킹</div><div class="admin-brand__sub">관리자 패널</div></div>
        </div>
        <nav class="admin-nav">
          ${menus.map(([key, icon, label]) => `<button class="admin-menu-item ${currentTab === key ? 'active' : ''}" data-admin-tab="${key}"><span class="admin-menu-item__icon">${icon}</span><span class="admin-menu-item__label">${label}</span></button>`).join('')}
        </nav>
        <div class="admin-sidebar__footer">
          <div class="admin-profile-card"><div class="admin-profile-card__avatar"><span>${escHtml((nickname[0] || '관'))}</span></div><div class="admin-profile-card__info"><div class="admin-profile-card__name">${escHtml(nickname)}</div><div class="admin-profile-card__role">🔑 관리자</div></div></div>
          <button class="admin-goto-site-btn" id="admin-safe-goto-site">🏠 사이트 홈으로</button>
        </div>
      </aside>
      <main id="admin-content"><div class="loading-center"><div class="spinner spinner--lg"></div></div></main>
    </div>`;
  document.getElementById('admin-safe-home')?.addEventListener('click', e => { e.preventDefault(); navigate('/'); });
  document.getElementById('admin-safe-goto-site')?.addEventListener('click', () => navigate('/'));
  document.querySelectorAll('[data-admin-tab]').forEach(btn => btn.addEventListener('click', () => loadTab(btn.dataset.adminTab)));
}

export async function renderAdmin() {
  const el = document.getElementById('page-content');
  const user = appState.user || auth.currentUser;
  if (!user) { navigate('/login'); return; }
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
  const [totalSnap, todaySnap, reportSnap, recentSnap] = await Promise.all([
    getCountFromServer(collection(db, 'feeds')).catch(() => null),
    getDocs(query(collection(db, 'feeds'), where('createdAt', '>=', Timestamp.fromDate(todayStart)), limit(99))).catch(() => null),
    getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', false))).catch(() => null),
    getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(8))).catch(() => null),
  ]);
  const total = totalSnap?.data?.().count || 0;
  const today = todaySnap?.size || 0;
  const reports = reportSnap?.data?.().count || 0;
  const recent = recentSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px">
      <h2 class="admin-section-title">📊 대시보드</h2>
      <div class="admin-stat-grid">
        <div class="admin-stat-card"><div class="admin-stat-card__num">${total.toLocaleString()}</div><div class="admin-stat-card__label">총 게시물</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:var(--color-success)">${today}</div><div class="admin-stat-card__label">오늘 새 글</div></div>
        <div class="admin-stat-card"><div class="admin-stat-card__num" style="color:${reports ? 'var(--color-danger)' : 'var(--color-text-muted)'}">${reports}</div><div class="admin-stat-card__label">미처리 신고</div></div>
      </div>
      <div class="card"><div class="card__body"><div style="font-size:14px;font-weight:800;margin-bottom:12px">최근 게시물</div>${recent.map(p => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-border-light)"><a href="#/detail/${p.id}" style="flex:1;color:var(--color-primary);font-weight:700">${escHtml(p.title || '(제목없음)')}</a><span style="font-size:12px;color:var(--color-text-muted)">${escHtml(p.authorName || '익명')}</span></div>`).join('') || '<div class="empty-state__desc">게시물이 없어요</div>'}</div></div>
    </div>`;
}

async function renderPosts(el) {
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(50))).catch(() => null);
  const posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><h2 class="admin-section-title">📝 게시물 관리</h2><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>제목</th><th>작성자</th><th>상태</th><th>작업</th></tr></thead><tbody>${posts.map(p => `<tr data-row="${p.id}"><td><a href="#/detail/${p.id}" class="admin-table__link">${escHtml(p.title || '(제목없음)')}</a></td><td>${escHtml(p.authorName || '익명')}</td><td>${p.hidden ? '숨김' : '공개'}</td><td><button class="btn btn--ghost btn--sm" data-hide="${p.id}" data-hidden="${p.hidden ? '1' : '0'}">${p.hidden ? '공개' : '숨김'}</button> <button class="btn btn--danger btn--sm" data-delete="${p.id}">삭제</button></td></tr>`).join('') || '<tr><td colspan="4" class="admin-table__empty">게시물이 없어요</td></tr>'}</tbody></table></div></div>`;
  el.querySelectorAll('[data-hide]').forEach(btn => btn.addEventListener('click', async () => {
    await updateDoc(doc(db, 'feeds', btn.dataset.hide), { hidden: btn.dataset.hidden !== '1' });
    toast.success('변경했어요');
    renderPosts(el);
  }));
  el.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('이 게시물을 삭제할까요?')) return;
    await deleteDoc(doc(db, 'feeds', btn.dataset.delete));
    toast.success('삭제했어요');
    renderPosts(el);
  }));
}

async function renderReports(el) {
  const snap = await getDocs(query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc'), limit(50))).catch(() => null);
  const reports = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><h2 class="admin-section-title">🚨 신고 관리</h2><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>사유</th><th>게시물</th><th>신고자</th><th>작업</th></tr></thead><tbody>${reports.map(r => `<tr data-report="${r.id}"><td>${escHtml(r.reason || '')}</td><td>${r.postId ? `<a href="#/detail/${r.postId}">${escHtml(r.postTitle || r.postId)}</a>` : '-'}</td><td>${escHtml(r.reporterName || '익명')}</td><td><button class="btn btn--primary btn--sm" data-resolve="${r.id}">처리완료</button></td></tr>`).join('') || '<tr><td colspan="4" class="admin-table__empty">처리할 신고가 없어요</td></tr>'}</tbody></table></div></div>`;
  el.querySelectorAll('[data-resolve]').forEach(btn => btn.addEventListener('click', async () => {
    await updateDoc(doc(db, 'reports', btn.dataset.resolve), { resolved: true, resolvedAt: serverTimestamp() });
    toast.success('처리했어요');
    renderReports(el);
  }));
}

async function renderUsers(el) {
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(100))).catch(() => null);
  const map = new Map();
  (snap?.docs || []).forEach(d => {
    const p = d.data();
    if (!p.authorId) return;
    const old = map.get(p.authorId) || { uid: p.authorId, name: p.authorName || '익명', count: 0 };
    old.count += 1;
    map.set(p.authorId, old);
  });
  const users = [...map.values()].sort((a, b) => b.count - a.count);
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px"><h2 class="admin-section-title">👥 회원 현황</h2><div class="card" style="overflow:auto"><table class="admin-table"><thead><tr><th>닉네임</th><th>게시물 수</th><th>UID</th></tr></thead><tbody>${users.map(u => `<tr><td>${escHtml(u.name)}</td><td>${u.count}</td><td style="font-family:monospace;font-size:11px">${escHtml(u.uid.slice(0, 16))}…</td></tr>`).join('') || '<tr><td colspan="3" class="admin-table__empty">회원 데이터가 없어요</td></tr>'}</tbody></table></div></div>`;
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
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;max-width:720px"><h2 class="admin-section-title">🤖 AI 관리</h2><div class="card"><div class="card__body"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="ai-enabled" ${enabled ? 'checked' : ''}> AI 기능 사용</label><div class="form-hint" style="margin-top:10px">API 키는 Firestore에 저장하지 않고 Firebase Secret Manager의 GEMINI_API_KEY를 사용합니다.</div><button class="btn btn--primary" id="btn-ai-save" style="margin-top:14px">설정 저장</button></div></div></div>`;
  document.getElementById('btn-ai-save')?.addEventListener('click', async () => {
    await saveAiConfig({ enabled: document.getElementById('ai-enabled')?.checked !== false, features });
    toast.success('AI 설정을 저장했어요');
  });
}
