import { db, auth, functions } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs, deleteDoc, doc,
  getCountFromServer, where, updateDoc, addDoc, serverTimestamp,
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

  el.innerHTML = `
    <div class="admin-layout">
      <nav class="admin-sidebar">
        <div style="font-size:11px;font-weight:800;color:var(--color-text-muted);padding:8px 12px 6px;letter-spacing:0.5px">ADMIN</div>
        ${[
          { key: 'dashboard', icon: '📊', label: '대시보드' },
          { key: 'posts',     icon: '📝', label: '게시물 관리' },
          { key: 'reports',   icon: '🚨', label: '신고 관리' },
          { key: 'users',     icon: '👥', label: '회원 현황' },
          { key: 'missions',  icon: '🎯', label: '미션 관리' },
          { key: 'ai',        icon: '🤖', label: 'AI 관리' },
        ].map(m => `
          <div class="admin-menu-item ${currentTab === m.key ? 'active' : ''}" data-tab="${m.key}">
            <span>${m.icon}</span><span>${m.label}</span>
          </div>`).join('')}
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-border-light)">
          <div style="font-size:10px;color:var(--color-text-muted);padding:4px 12px;word-break:break-all">
            <div style="font-weight:700;margin-bottom:2px">내 UID</div>
            <div style="font-family:monospace;font-size:9px">${user.uid}</div>
          </div>
        </div>
      </nav>
      <div id="admin-content">
        <div class="loading-center"><div class="spinner spinner--lg"></div></div>
      </div>
    </div>`;

  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
      loadTab(currentTab);
    });
  });

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
    case 'missions':  return renderMissions(content);
    case 'ai':        return renderAiSettings(content);
  }
}

/* ── 대시보드 ── */
async function renderDashboard(el) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [totalSnap, golraSnap, usgyoSnap, malheSnap, todaySnap, missionSnap, recentSnap, reportSnap] = await Promise.all([
    getCountFromServer(collection(db, 'feeds')).catch(() => null),
    getCountFromServer(query(collection(db, 'feeds'), where('cat', '==', 'golra'))).catch(() => null),
    getCountFromServer(query(collection(db, 'feeds'), where('cat', '==', 'usgyo'))).catch(() => null),
    getCountFromServer(query(collection(db, 'feeds'), where('cat', '==', 'malhe'))).catch(() => null),
    getDocs(query(collection(db, 'feeds'), where('createdAt', '>=', Timestamp.fromDate(todayStart)), limit(99))).catch(() => null),
    getDocs(query(collection(db, 'missions'), where('active', '==', true), orderBy('createdAt', 'desc'), limit(1))).catch(() => null),
    getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(5))).catch(() => null),
    getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', false))).catch(() => null),
  ]);

  const total   = totalSnap?.data?.().count ?? 0;
  const golra   = golraSnap?.data?.().count ?? 0;
  const usgyo   = usgyoSnap?.data?.().count ?? 0;
  const malhe   = malheSnap?.data?.().count ?? 0;
  const today   = todaySnap?.size ?? 0;
  const pending = reportSnap?.data?.().count ?? 0;
  const mission = missionSnap?.empty ? null : { id: missionSnap.docs[0].id, ...missionSnap.docs[0].data() };
  const recent  = recentSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:24px">
      <div>
        <div style="font-size:20px;font-weight:900;letter-spacing:-0.5px;margin-bottom:16px">📊 대시보드</div>
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
          <div class="admin-stat-card">
            <div class="admin-stat-card__num" style="font-size:14px;color:${mission ? 'var(--color-success)' : 'var(--color-text-muted)'}">${mission ? '✅ 운영중' : '없음'}</div>
            <div class="admin-stat-card__label">오늘 미션</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">📂 카테고리별 통계</div>
          ${[
            { key: 'golra', label: '🎯 골라봐', count: golra, color: 'var(--color-golra)' },
            { key: 'usgyo', label: '😂 웃겨봐', count: usgyo, color: 'var(--color-usgyo)' },
            { key: 'malhe', label: '💬 말해봐', count: malhe, color: 'var(--color-malhe)' },
          ].map(c => `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              <div style="width:70px;font-size:13px;font-weight:700">${c.label}</div>
              <div style="flex:1;background:var(--color-surface-2);border-radius:4px;height:10px;overflow:hidden">
                <div style="height:100%;background:${c.color};width:${total > 0 ? Math.round(c.count/total*100) : 0}%;transition:width 0.5s"></div>
              </div>
              <div style="width:60px;text-align:right;font-size:12px;font-weight:700;color:${c.color}">${c.count.toLocaleString()}건</div>
            </div>`).join('')}
        </div>
      </div>

      ${mission ? `
        <div class="card" style="border:2px solid var(--color-primary)">
          <div class="card__body">
            <div style="font-size:14px;font-weight:800;margin-bottom:8px">🎯 진행 중인 미션</div>
            <div style="font-size:16px;font-weight:700">${escHtml(mission.title || '')}</div>
            ${mission.desc ? `<div style="font-size:13px;color:var(--color-text-secondary);margin-top:4px">${escHtml(mission.desc)}</div>` : ''}
            <div style="margin-top:12px;display:flex;gap:8px">
              <button class="btn btn--ghost btn--sm" data-mission-edit="${mission.id}" data-tab-switch="missions">미션 관리 →</button>
            </div>
          </div>
        </div>` : `
        <div class="card" style="border:2px dashed var(--color-border)">
          <div class="card__body" style="text-align:center;padding:24px">
            <div style="font-size:32px;margin-bottom:8px">🎯</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:4px">오늘 미션이 없어요</div>
            <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:12px">미션을 등록하면 사용자들이 참여할 수 있어요</div>
            <button class="btn btn--primary btn--sm" data-tab-switch="missions">미션 등록하기 →</button>
          </div>
        </div>`}

      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">🕐 최근 게시물</div>
          ${recent.map(p => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--color-border-light)">
              <span style="font-size:11px;padding:3px 7px;border-radius:99px;background:var(--color-surface-2);font-weight:700">${p.type || ''}</span>
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
  let constraints = [orderBy('createdAt', 'desc'), limit(30)];
  if (catFilter) constraints.unshift(where('cat', '==', catFilter));

  const snap = await getDocs(query(collection(db, 'feeds'), ...constraints)).catch(() => null);
  let posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  if (searchQ) {
    const q = searchQ.toLowerCase();
    posts = posts.filter(p => (p.title || '').toLowerCase().includes(q) || (p.authorName || '').toLowerCase().includes(q));
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="font-size:20px;font-weight:900;letter-spacing:-0.5px">📝 게시물 관리</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="admin-post-search" class="form-input" style="max-width:220px;font-size:13px" placeholder="제목/작성자 검색" value="${escHtml(searchQ)}">
        <button class="btn btn--primary btn--sm" id="btn-post-search">검색</button>
        ${[
          { key: '', label: '전체' },
          { key: 'golra', label: '골라봐' },
          { key: 'usgyo', label: '웃겨봐' },
          { key: 'malhe', label: '말해봐' },
        ].map(c => `<button class="filter-chip ${catFilter === c.key ? 'active' : ''}" data-post-cat="${c.key}">${c.label}</button>`).join('')}
      </div>
      <div class="card" style="overflow:auto">
        <table style="width:100%;font-size:13px;border-collapse:collapse;min-width:600px">
          <thead>
            <tr style="border-bottom:2px solid var(--color-border);text-align:left;background:var(--color-surface-2)">
              <th style="padding:10px 12px">제목</th>
              <th style="padding:10px 12px;width:80px">유형</th>
              <th style="padding:10px 12px;width:80px">카테고리</th>
              <th style="padding:10px 12px;width:80px">작성자</th>
              <th style="padding:10px 12px;width:60px">상태</th>
              <th style="padding:10px 12px;width:120px">작업</th>
            </tr>
          </thead>
          <tbody>
            ${posts.length === 0 ? `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--color-text-muted)">게시물이 없어요</td></tr>` :
              posts.map(p => `
                <tr style="border-bottom:1px solid var(--color-border-light)" data-post-row="${p.id}">
                  <td style="padding:10px 12px;max-width:280px">
                    <a href="#/detail/${p.id}" style="color:var(--color-primary);font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.title || '(제목없음)')}</a>
                  </td>
                  <td style="padding:10px 12px"><span class="badge badge--gray" style="font-size:10px">${p.type || ''}</span></td>
                  <td style="padding:10px 12px"><span style="font-size:12px">${{ golra:'🎯 골라봐', usgyo:'😂 웃겨봐', malhe:'💬 말해봐' }[p.cat] || p.cat || ''}</span></td>
                  <td style="padding:10px 12px;font-size:12px;color:var(--color-text-secondary)">${escHtml(p.authorName || '익명')}</td>
                  <td style="padding:10px 12px">
                    ${p.hidden
                      ? `<span style="font-size:11px;color:var(--color-danger);font-weight:700">숨김</span>`
                      : `<span style="font-size:11px;color:var(--color-success);font-weight:700">공개</span>`}
                  </td>
                  <td style="padding:10px 12px">
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

/* ── 신고 관리 ── */
async function renderReports(el) {
  const [pendingSnap, resolvedSnap] = await Promise.all([
    getDocs(query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc'), limit(30))).catch(() => null),
    getDocs(query(collection(db, 'reports'), where('resolved', '==', true), orderBy('createdAt', 'desc'), limit(10))).catch(() => null),
  ]);

  const pending  = pendingSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
  const resolved = resolvedSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  const renderRow = (r, isDone) => `
    <tr style="border-bottom:1px solid var(--color-border-light)" data-report-row="${r.id}">
      <td style="padding:10px 12px;font-size:12px">${escHtml(r.reason || '')}</td>
      <td style="padding:10px 12px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${r.postId ? `<a href="#/detail/${r.postId}" style="color:var(--color-primary)">${escHtml(r.postTitle || r.postId)}</a>` : '-'}
      </td>
      <td style="padding:10px 12px;font-size:12px;color:var(--color-text-muted)">${escHtml(r.reporterName || '익명')}</td>
      <td style="padding:10px 12px">
        ${!isDone ? `
          <div style="display:flex;gap:6px">
            <button class="btn btn--ghost btn--sm" data-view-post="${r.postId}" style="font-size:11px">글 보기</button>
            <button class="btn btn--primary btn--sm" data-resolve="${r.id}" style="font-size:11px">처리완료</button>
            ${r.postId ? `<button class="btn btn--danger btn--sm" data-delete-post="${r.postId}" data-resolve="${r.id}" style="font-size:11px">글 삭제</button>` : ''}
          </div>` : `<span style="font-size:11px;color:var(--color-text-muted)">처리완료</span>`}
      </td>
    </tr>`;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="font-size:20px;font-weight:900;letter-spacing:-0.5px">🚨 신고 관리</div>
      <div style="display:flex;gap:12px">
        <div class="admin-stat-card" style="flex:1">
          <div class="admin-stat-card__num" style="color:${pending.length > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'}">${pending.length}</div>
          <div class="admin-stat-card__label">미처리 신고</div>
        </div>
        <div class="admin-stat-card" style="flex:1">
          <div class="admin-stat-card__num" style="color:var(--color-success)">${resolved.length}</div>
          <div class="admin-stat-card__label">처리완료 (최근)</div>
        </div>
      </div>

      <div class="card">
        <div class="card__body--lg">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">⚠️ 처리 대기 (${pending.length}건)</div>
          ${pending.length === 0 ? `<div style="text-align:center;padding:24px;color:var(--color-text-muted);font-size:13px">처리할 신고가 없어요 ✅</div>` : `
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid var(--color-border);text-align:left;background:var(--color-surface-2)">
                <th style="padding:10px 12px">사유</th>
                <th style="padding:10px 12px">게시물</th>
                <th style="padding:10px 12px">신고자</th>
                <th style="padding:10px 12px;width:200px">작업</th>
              </tr>
            </thead>
            <tbody>${pending.map(r => renderRow(r, false)).join('')}</tbody>
          </table>`}
        </div>
      </div>

      ${resolved.length > 0 ? `
        <div class="card">
          <div class="card__body--lg">
            <div style="font-size:14px;font-weight:800;margin-bottom:12px;color:var(--color-text-muted)">✅ 처리 완료 (최근 ${resolved.length}건)</div>
            <table style="width:100%;font-size:13px;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:2px solid var(--color-border);text-align:left;background:var(--color-surface-2)">
                  <th style="padding:10px 12px">사유</th>
                  <th style="padding:10px 12px">게시물</th>
                  <th style="padding:10px 12px">신고자</th>
                  <th style="padding:10px 12px">상태</th>
                </tr>
              </thead>
              <tbody>${resolved.map(r => renderRow(r, true)).join('')}</tbody>
            </table>
          </div>
        </div>` : ''}
    </div>`;

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
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:20px;font-weight:900;letter-spacing:-0.5px">👥 회원 현황</div>
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
}

/* ── 미션 관리 ── */
async function renderMissions(el) {
  const snap = await getDocs(query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(20))).catch(() => null);
  const missions = snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="font-size:20px;font-weight:900;letter-spacing:-0.5px">🎯 미션 관리</div>

      <!-- 등록 폼 -->
      <div class="card" style="border:2px solid var(--color-primary)">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">➕ 새 미션 등록</div>
          <div class="form-group">
            <label class="form-label">미션 제목 <span class="required">*</span></label>
            <input id="mission-title" class="form-input" placeholder="오늘의 미션 제목을 입력하세요" maxlength="80">
          </div>
          <div class="form-group">
            <label class="form-label">미션 설명</label>
            <textarea id="mission-desc" class="form-textarea" placeholder="미션 설명 (선택)" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">연결 카테고리</label>
            <select id="mission-cat" class="form-select">
              <option value="">전체 (카테고리 무관)</option>
              <option value="golra">🎯 골라봐</option>
              <option value="usgyo">😂 웃겨봐</option>
              <option value="malhe">💬 말해봐</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">마감일 (시즌 미션용, 선택)</label>
            <input type="datetime-local" id="mission-end-date" class="form-input">
          </div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600">
              <input type="checkbox" id="mission-active" checked style="width:16px;height:16px"> 즉시 활성화
            </label>
          </div>
          <div style="margin-top:16px">
            <button class="btn btn--primary" id="btn-add-mission">등록하기</button>
          </div>
        </div>
      </div>

      <!-- 미션 목록 -->
      <div class="card">
        <div class="card__body--lg">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">📋 미션 목록</div>
          ${missions.length === 0 ? `<div style="text-align:center;padding:24px;color:var(--color-text-muted);font-size:13px">등록된 미션이 없어요</div>` :
            `<div style="display:flex;flex-direction:column;gap:10px">
              ${missions.map(m => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius-md);background:var(--color-${m.active ? 'primary' : 'surface-2'});${m.active ? 'background:var(--color-primary-bg);border:2px solid var(--color-primary)' : 'background:var(--color-surface-2);border:1px solid var(--color-border-light)'}" data-mission-row="${m.id}">
                  <div style="flex:1">
                    <div style="font-size:14px;font-weight:700;${m.active ? 'color:var(--color-primary)' : ''}">${escHtml(m.title || '')}</div>
                    ${m.desc ? `<div style="font-size:12px;color:var(--color-text-muted);margin-top:2px">${escHtml(m.desc)}</div>` : ''}
                    ${m.cat ? `<div style="font-size:11px;margin-top:4px"><span style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:99px;padding:2px 8px">${{ golra:'🎯 골라봐', usgyo:'😂 웃겨봐', malhe:'💬 말해봐' }[m.cat] || m.cat}</span></div>` : ''}
                    ${m.endDate ? `<div style="font-size:11px;color:var(--color-warning);margin-top:4px">⏰ 마감: ${new Date(m.endDate.toDate()).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0">
                    <button class="btn btn--sm ${m.active ? 'btn--ghost' : 'btn--primary'}" data-toggle-mission="${m.id}" data-active="${m.active ? '1' : '0'}" style="font-size:11px">${m.active ? '비활성화' : '활성화'}</button>
                    <button class="btn btn--danger btn--sm" data-delete-mission="${m.id}" style="font-size:11px">삭제</button>
                  </div>
                </div>`).join('')}
            </div>`}
        </div>
      </div>
    </div>`;

  document.getElementById('btn-add-mission')?.addEventListener('click', async () => {
    const title      = document.getElementById('mission-title')?.value.trim();
    const desc       = document.getElementById('mission-desc')?.value.trim()    || '';
    const cat        = document.getElementById('mission-cat')?.value             || '';
    const active     = document.getElementById('mission-active')?.checked        ?? true;
    const endDateVal = document.getElementById('mission-end-date')?.value;
    if (!title) { toast.error('미션 제목을 입력해주세요'); return; }
    const missionData = { title, desc, cat, active, createdAt: serverTimestamp() };
    if (endDateVal) missionData.endDate = Timestamp.fromDate(new Date(endDateVal));
    try {
      await addDoc(collection(db, 'missions'), missionData);
      toast.success('미션을 등록했어요 🎯');
      renderMissions(el);
    } catch { toast.error('등록에 실패했어요'); }
  });

  el.querySelectorAll('[data-toggle-mission]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleMission;
      const nowActive = btn.dataset.active === '1';
      try {
        await updateDoc(doc(db, 'missions', id), { active: !nowActive });
        toast.success(nowActive ? '비활성화했어요' : '활성화했어요');
        renderMissions(el);
      } catch { toast.error('변경에 실패했어요'); }
    });
  });

  el.querySelectorAll('[data-delete-mission]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('이 미션을 삭제할까요?')) return;
      try {
        await deleteDoc(doc(db, 'missions', btn.dataset.deleteMission));
        toast.success('삭제됐어요');
        btn.closest('[data-mission-row]')?.remove();
      } catch { toast.error('삭제에 실패했어요'); }
    });
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
      <div style="font-size:20px;font-weight:900;letter-spacing:-0.5px">🤖 AI 관리 — Gemini 2.5 Flash</div>

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
            <button class="btn btn--primary btn--sm" id="btn-trigger-mission">🎯 미션 지금 생성</button>
            <button class="btn btn--ghost btn--sm" id="btn-trigger-report">📊 주간 보고서 지금 생성</button>
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
  el.querySelector('#btn-trigger-mission')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-trigger-mission');
    const result = el.querySelector('#ai-trigger-result');
    btn.disabled = true;
    btn.textContent = '생성 중...';
    try {
      const triggerFn = httpsCallable(functions, 'adminTriggerMission');
      const res = await triggerFn({});
      result.textContent = `✅ 미션 생성 완료: "${res.data.title}"`;
      toast.success('새 미션이 생성됐어요 🎯');
    } catch (e) {
      result.textContent = '❌ ' + (e.message || '생성에 실패했어요');
      toast.error(e.message || '생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '🎯 미션 지금 생성';
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

