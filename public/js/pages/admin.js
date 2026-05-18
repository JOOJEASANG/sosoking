import { db, auth, functions } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, deleteDoc, doc,
  getCountFromServer, where, updateDoc, serverTimestamp,
  Timestamp, getDoc, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { appState } from '../state.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { isAdmin } from '../app.js';
import { escHtml } from '../utils/helpers.js';

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

  const MENUS = [
    { key: 'dashboard', icon: '📊', label: '대시보드' },
    { key: 'posts',     icon: '📝', label: '게시물' },
    { key: 'reports',   icon: '🚨', label: '신고' },
    { key: 'users',     icon: '👥', label: '회원' },
    { key: 'ai',        icon: '🤖', label: 'AI 운영' },
    { key: 'write',     icon: '➕', label: '글쓰기', route: '/write' },
  ];

  el.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <div class="admin-brand__logo">⚙️</div>
          <div>
            <div class="admin-brand__title">소소킹</div>
            <div class="admin-brand__sub">ADMIN</div>
          </div>
        </div>
        <nav class="admin-nav">
          ${MENUS.map(m => `
            <button class="admin-menu-item ${currentTab === m.key ? 'active' : ''}" data-tab="${m.key}"${m.route ? ` data-route="${m.route}"` : ''}>
              <span class="admin-menu-item__icon">${m.icon}</span>
              <span class="admin-menu-item__label">${m.label}</span>
            </button>`).join('')}
        </nav>
        <div class="admin-sidebar__footer">
          <button class="admin-goto-site-btn" id="btn-goto-site">🏠 사이트로 가기</button>
          <button class="admin-goto-site-btn admin-write-site-btn" id="btn-admin-write">➕ 글쓰기</button>
          <div class="admin-uid-label">UID</div>
          <div class="admin-uid">${user.uid}</div>
        </div>
      </aside>
      <main id="admin-content">
        <div class="loading-center"><div class="spinner spinner--lg"></div></div>
      </main>
    </div>`;

  document.querySelectorAll('.admin-menu-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.route) {
        navigate(btn.dataset.route);
        return;
      }
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.admin-menu-item[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
      loadTab(currentTab);
    });
  });

  document.getElementById('btn-goto-site')?.addEventListener('click', () => navigate('/'));
  document.getElementById('btn-admin-write')?.addEventListener('click', () => navigate('/write'));

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
  }
}

async function renderDashboard(content) {
  const [posts, reports, users] = await Promise.all([
    getCountFromServer(collection(db, 'feeds')).catch(() => ({ data: () => ({ count: 0 }) })),
    getCountFromServer(collection(db, 'reports')).catch(() => ({ data: () => ({ count: 0 }) })),
    getCountFromServer(collection(db, 'users')).catch(() => ({ data: () => ({ count: 0 }) })),
  ]);

  const typeRows = await getDocs(query(collection(db, 'feeds'), limit(500))).catch(() => ({ docs: [] }));
  const typeCounts = {};
  typeRows.docs.forEach(d => {
    const t = d.data().type || 'unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="admin-section-title">📊 대시보드</div>
      <div class="admin-stat-grid">
        ${statCard('전체 게시물', posts.data().count, '📝')}
        ${statCard('신고', reports.data().count, '🚨')}
        ${statCard('회원', users.data().count, '👥')}
      </div>
      <div class="card"><div class="card__body--lg">
        <h3 style="margin-bottom:12px">유형별 게시물</h3>
        <div class="admin-type-grid">
          ${['vote','initial_game','naming','crazy_court','relay','acrostic'].map(t => `
            <div class="admin-type-card">
              <div class="admin-type-card__icon">${typeIcon(t)}</div>
              <div class="admin-type-card__count">${typeCounts[t] || 0}</div>
              <div class="admin-type-card__name">${typeLabel(t)}</div>
            </div>`).join('')}
        </div>
      </div></div>
    </div>`;
}

function statCard(label, count, icon) {
  return `<div class="admin-stat-card"><div style="font-size:24px">${icon}</div><div class="admin-stat-card__num">${count}</div><div class="admin-stat-card__label">${label}</div></div>`;
}

function typeLabel(t) {
  return ({ vote:'골라킹', initial_game:'초성게임', naming:'미친작명소', crazy_court:'억까재판', relay:'막장킹', acrostic:'삼행시' })[t] || t;
}
function typeIcon(t) {
  return ({ vote:'🗳️', initial_game:'🔤', naming:'😜', crazy_court:'⚖️', relay:'🎭', acrostic:'✍️' })[t] || '📄';
}

async function renderPosts(content) {
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(30)));
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="admin-section-title">📝 게시물 관리</div>
      <div class="card" style="overflow:auto">
        <table class="admin-table">
          <thead><tr><th>유형</th><th>제목</th><th>작성자</th><th>상태</th><th>관리</th></tr></thead>
          <tbody>${snap.docs.map(d => rowPost(d.id, d.data())).join('') || `<tr><td colspan="5" class="admin-table__empty">게시물이 없습니다.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
  content.querySelectorAll('[data-hide-post]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.hidePost;
    await updateDoc(doc(db, 'feeds', id), { hidden: true, updatedAt: serverTimestamp() });
    toast('숨김 처리했습니다.');
    renderPosts(content);
  }));
  content.querySelectorAll('[data-unhide-post]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.unhidePost;
    await updateDoc(doc(db, 'feeds', id), { hidden: false, updatedAt: serverTimestamp() });
    toast('공개 처리했습니다.');
    renderPosts(content);
  }));
}

function rowPost(id, p) {
  const hidden = p.hidden === true;
  return `<tr>
    <td>${typeIcon(p.type)} ${typeLabel(p.type)}</td>
    <td><a class="admin-table__link" href="#/post/${id}">${escHtml(p.title || '(제목 없음)')}</a></td>
    <td>${escHtml(p.authorName || p.authorId || '-')}</td>
    <td><span class="admin-status ${hidden ? 'admin-status--hidden' : 'admin-status--visible'}">${hidden ? '숨김' : '공개'}</span></td>
    <td>${hidden ? `<button class="btn btn--sm btn--secondary" data-unhide-post="${id}">공개</button>` : `<button class="btn btn--sm btn--danger" data-hide-post="${id}">숨김</button>`}</td>
  </tr>`;
}

async function renderReports(content) {
  const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(30))).catch(() => ({ docs: [] }));
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="admin-section-title">🚨 신고 관리</div>
      <div class="card" style="overflow:auto">
        <table class="admin-table">
          <thead><tr><th>대상</th><th>사유</th><th>신고자</th><th>상태</th><th>관리</th></tr></thead>
          <tbody>${snap.docs.map(d => rowReport(d.id, d.data())).join('') || `<tr><td colspan="5" class="admin-table__empty">신고가 없습니다.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function rowReport(id, r) {
  return `<tr>
    <td>${escHtml(r.targetType || '-')} / ${escHtml(r.targetId || '-')}</td>
    <td>${escHtml(r.reason || '-')}</td>
    <td>${escHtml(r.reporterId || '-')}</td>
    <td>${escHtml(r.status || 'open')}</td>
    <td><span class="admin-table__muted">검토</span></td>
  </tr>`;
}

async function renderUsers(content) {
  const snap = await getDocs(query(collection(db, 'users'), limit(50))).catch(() => ({ docs: [] }));
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="admin-section-title">👥 회원 관리</div>
      <div class="card" style="overflow:auto">
        <table class="admin-table">
          <thead><tr><th>닉네임</th><th>UID</th><th>상태</th></tr></thead>
          <tbody>${snap.docs.map(d => {
            const u = d.data();
            return `<tr><td>${escHtml(u.nickname || '-')}</td><td>${d.id}</td><td>${u.banned ? '차단' : '정상'}</td></tr>`;
          }).join('') || `<tr><td colspan="3" class="admin-table__empty">회원이 없습니다.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

async function renderAiSettings(content) {
  const cfgRef = doc(db, 'site_settings', 'config');
  const cfgSnap = await getDoc(cfgRef).catch(() => null);
  const cfg = cfgSnap?.exists() ? cfgSnap.data() : {};

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="admin-section-title">🤖 AI 운영관리</div>
      <div class="card"><div class="card__body--lg" style="display:flex;flex-direction:column;gap:14px">
        <label class="form-label">AI 게시글 자동 생성</label>
        <select class="form-select" id="aiContentEnabled">
          <option value="true" ${cfg.aiContentEnabled !== false ? 'selected' : ''}>사용</option>
          <option value="false" ${cfg.aiContentEnabled === false ? 'selected' : ''}>중지</option>
        </select>
        <label class="form-label">AI 미션 자동 생성</label>
        <select class="form-select" id="aiMissionEnabled">
          <option value="true" ${cfg.aiMissionEnabled !== false ? 'selected' : ''}>사용</option>
          <option value="false" ${cfg.aiMissionEnabled === false ? 'selected' : ''}>중지</option>
        </select>
        <label class="form-label">일일 AI 생성 한도</label>
        <input class="form-input" id="aiDailyLimit" type="number" min="0" max="100" value="${Number(cfg.aiDailyLimit ?? 20)}">
        <button class="btn btn--primary" id="btn-save-ai-settings">저장</button>
      </div></div>
      <div class="card"><div class="card__body--lg" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn--secondary" id="btn-generate-ai-content">AI 게시글 1개 생성</button>
        <button class="btn btn--secondary" id="btn-generate-all-ai-content">6개 유형 모두 생성</button>
        <button class="btn btn--secondary" id="btn-generate-ai-mission">AI 미션 생성</button>
      </div></div>
    </div>`;

  document.getElementById('btn-save-ai-settings')?.addEventListener('click', async () => {
    await setDoc(cfgRef, {
      aiContentEnabled: document.getElementById('aiContentEnabled').value === 'true',
      aiMissionEnabled: document.getElementById('aiMissionEnabled').value === 'true',
      aiDailyLimit: Number(document.getElementById('aiDailyLimit').value || 0),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    toast('AI 운영 설정을 저장했습니다.');
  });

  document.getElementById('btn-generate-ai-content')?.addEventListener('click', () => callAdminFunction('generateAiContentNow'));
  document.getElementById('btn-generate-all-ai-content')?.addEventListener('click', () => callAdminFunction('generateAllAiContentNow'));
  document.getElementById('btn-generate-ai-mission')?.addEventListener('click', () => callAdminFunction('generateAiMissionNow'));
}

async function callAdminFunction(name) {
  try {
    const fn = httpsCallable(functions, name);
    await fn({ force: true });
    toast('실행했습니다.');
  } catch (e) {
    console.error(e);
    toast(e.message || '실행에 실패했습니다.');
  }
}
