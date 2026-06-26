import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const getAdminMemberList = httpsCallable(functions, 'getAdminMemberList');

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function dateText(ms) {
  if (!ms) return '-';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function isMemberTab() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  const title = content.querySelector('.admin-section-title')?.textContent || content.textContent || '';
  return title.includes('회원 현황');
}

function renderLoading(content) {
  content.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
}

async function renderMembers() {
  const content = document.getElementById('admin-content');
  if (!content || !isMemberTab() || content.dataset.memberListReady === '1') return;
  content.dataset.memberListReady = '1';
  renderLoading(content);

  try {
    const result = await getAdminMemberList({});
    const members = result.data?.members || [];
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <h2 class="admin-section-title">👥 회원 현황</h2>
            <div class="form-hint">관리자를 제외한 회원 목록입니다. Firebase Auth와 users 컬렉션을 합쳐 표시합니다.</div>
          </div>
          <button class="btn btn--ghost btn--sm" id="btn-admin-member-refresh">새로고침</button>
        </div>
        <div class="admin-stat-grid">
          <div class="admin-stat-card"><div class="admin-stat-card__num">${Number(result.data?.total || members.length).toLocaleString()}</div><div class="admin-stat-card__label">회원 수</div></div>
          <div class="admin-stat-card"><div class="admin-stat-card__num">${Number(result.data?.excludedAdmins || 0).toLocaleString()}</div><div class="admin-stat-card__label">제외된 관리자</div></div>
        </div>
        <div class="card" style="overflow:auto">
          <table class="admin-table">
            <thead><tr><th>회원</th><th>이메일</th><th>포인트</th><th>가입일</th><th>최근 로그인</th><th>상태</th></tr></thead>
            <tbody>
              ${members.map(member => `
                <tr>
                  <td><b>${esc(member.nickname || '회원')}</b><div style="font-family:monospace;font-size:11px;color:var(--color-text-muted)">${esc(String(member.uid || '').slice(0, 18))}…</div></td>
                  <td>${esc(member.email || '-')}</td>
                  <td>${Number(member.points || 0).toLocaleString()}P</td>
                  <td>${esc(dateText(member.createdAtMs))}</td>
                  <td>${esc(dateText(member.lastLoginAtMs))}</td>
                  <td>${member.disabled ? '<span class="badge badge--danger">비활성</span>' : '<span class="badge">정상</span>'}</td>
                </tr>`).join('') || '<tr><td colspan="6" class="admin-table__empty">표시할 회원이 없어요</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    document.getElementById('btn-admin-member-refresh')?.addEventListener('click', () => {
      content.dataset.memberListReady = '0';
      renderMembers();
    });
  } catch (error) {
    console.error('[admin-member-list-fix] failed', error);
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">회원 목록을 불러오지 못했어요</div><div class="empty-state__desc">Functions 배포 후 다시 시도해주세요.</div></div>`;
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(renderMembers, 100);
}

new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
setTimeout(schedule, 600);
