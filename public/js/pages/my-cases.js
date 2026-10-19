import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { signOut, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml, escapeAttr } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const deleteOwnCourtPost = httpsCallable(functions, 'deleteOwnCourtPost');

const STATUS = {
  pending:    { label: '접수 완료',   color: '#c9a84c', dot: '🟡' },
  processing: { label: '재판 진행 중', color: '#4a9eff', dot: '🔵' },
  completed:  { label: '판결 완료',   color: '#27ae60', dot: '🟢' },
  error:      { label: '오류',        color: '#e74c3c', dot: '🔴' },
  blocked:    { label: '접수 차단',   color: '#e74c3c', dot: '⛔' },
  hidden:     { label: '숨김',        color: '#999', dot: '⚫' }
};

function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _emptyState() {
  return `
    <div style="text-align:center;padding:46px 0;">
      <div style="font-size:52px;margin-bottom:16px;">😤</div>
      <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;margin-bottom:8px;">아직 접수한 사건이 없습니다</div>
      <div style="font-size:13px;color:var(--cream-dim);margin-bottom:28px;">억울한 일이 없다면 축하드립니다.<br>있다면 생활법정은 이미 개정 준비 중입니다.</div>
      <a href="#/submit" class="btn btn-primary" style="display:inline-flex;width:auto;padding:14px 32px;">⚖️ 첫 사건 접수하기</a>
    </div>`;
}

async function _logout() {
  await signOut(auth);
  await signInAnonymously(auth).catch(() => {});
  showToast('로그아웃되었습니다.', 'success');
  location.hash = '#/';
}

function _deleteErrorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('permission-denied')) return '본인이 접수한 사건만 삭제할 수 있습니다.';
  if (code.includes('unauthenticated')) return '로그인 상태를 확인한 뒤 다시 시도해주세요.';
  if (code.includes('failed-precondition')) return '정상적인 로그인 화면에서 다시 시도해주세요.';
  return '사건을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function _removeCaseRow(container, caseId) {
  const row = container.querySelector(`[data-case-row="${CSS.escape(caseId)}"]`);
  row?.remove();

  const rows = container.querySelectorAll('[data-case-row]');
  const count = rows.length;
  const countElement = container.querySelector('#mycases-total-count');
  if (countElement) countElement.textContent = `총 ${count}건의 사건이 있습니다`;

  if (count === 0) {
    const list = container.querySelector('[data-case-list]');
    if (list) list.innerHTML = _emptyState();
  }
  container.dispatchEvent(new CustomEvent('sosoking:case-deleted', { detail: { caseId, remaining: count } }));
}

function _bindDeleteButtons(container) {
  container.querySelectorAll('[data-delete-case]').forEach(button => {
    button.addEventListener('click', async () => {
      const caseId = button.dataset.deleteCase || '';
      const caseTitle = button.dataset.caseTitle || '선택한 사건';
      if (!caseId) return;

      const confirmed = window.confirm(
        `“${caseTitle}” 사건을 영구 삭제할까요?\n\n판결문, 공개 링크, 투표, 댓글과 신고 기록도 함께 삭제되며 복구할 수 없습니다.`
      );
      if (!confirmed) return;

      const oldText = button.textContent;
      button.disabled = true;
      button.textContent = '삭제 중...';
      try {
        await deleteOwnCourtPost({ caseId });
        _removeCaseRow(container, caseId);
        showToast('사건과 관련 기록을 삭제했습니다.', 'success');
      } catch (error) {
        console.error('own case deletion failed:', error);
        if (String(error?.code || '').includes('not-found')) {
          _removeCaseRow(container, caseId);
          showToast('이미 삭제된 사건입니다.', 'info');
          return;
        }
        button.disabled = false;
        button.textContent = oldText;
        showToast(_deleteErrorMessage(error), 'error');
      }
    });
  });
}

export async function renderMyCases(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/auth" class="back-btn">‹</a>
        <span class="logo">📋 내 사건 내역</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="loading-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;

  const user = auth.currentUser;
  const inner = container.querySelector('.container');
  if (!user || user.isAnonymous) {
    inner.innerHTML = `
      <div style="text-align:center;padding:60px 0;color:var(--cream-dim);">
        로그인 후 내 사건을 확인할 수 있습니다.<br>
        <a href="#/auth" class="btn btn-primary" style="margin-top:16px;">로그인하기</a>
      </div>`;
    return;
  }

  let docs = [];
  try {
    const snap = await getDocs(query(collection(db, 'cases'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50)));
    docs = snap.docs;
  } catch (error) {
    console.error(error);
    inner.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--cream-dim);">사건 목록을 불러오지 못했습니다.<br><span style="font-size:12px;opacity:.7;">${escapeHtml(error.message || '')}</span></div>`;
    return;
  }

  const header = `
    <div class="card" style="padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div style="min-width:0;">
        <div style="font-size:11px;color:#27ae60;font-weight:900;margin-bottom:3px;">● 로그인됨</div>
        <div style="font-size:13px;color:var(--cream-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(user.email || user.displayName || '로그인 계정')}</div>
      </div>
      <button id="mycases-logout" class="btn btn-ghost" style="width:auto;padding:10px 14px;white-space:nowrap;">로그아웃</button>
    </div>`;

  if (docs.length === 0) {
    inner.innerHTML = `${header}${_emptyState()}`;
    inner.querySelector('#mycases-logout')?.addEventListener('click', _logout);
    return;
  }

  inner.innerHTML = `
    ${header}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:16px;">
      <div id="mycases-total-count" style="font-size:13px;color:var(--cream-dim);">총 ${docs.length}건의 사건이 있습니다</div>
      <a href="#/auth" style="font-size:12px;color:var(--gold);text-decoration:none;">내 프로필 →</a>
    </div>
    <div data-case-list style="display:flex;flex-direction:column;gap:10px;">
      ${docs.map(document => _caseRow(document.id, document.data())).join('')}
    </div>`;
  inner.querySelector('#mycases-logout')?.addEventListener('click', _logout);
  _bindDeleteButtons(container);
}

function _caseRow(id, c) {
  const st = STATUS[c.status] || STATUS.pending;
  const href = c.status === 'completed'
    ? `#/verdict/${encodeURIComponent(id)}`
    : (c.status === 'processing' || c.status === 'pending')
      ? `#/trial/${encodeURIComponent(id)}`
      : '';
  const actionLabel = c.status === 'completed' ? '판결문 보기 →' : '재판장 입장 →';

  return `
    <article class="card" data-case-row="${escapeAttr(id)}" style="border-left:3px solid ${st.color};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div style="font-weight:700;font-size:15px;flex:1;">${escapeHtml(c.caseTitle || '제목 없음')}</div>
        <div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(_fmtDate(c.createdAt))}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span style="font-size:12px;color:${st.color};font-weight:700;">${st.dot} ${escapeHtml(st.label)}</span>
        <span style="font-size:12px;color:var(--cream-dim);">억울지수 ${escapeHtml(c.grievanceIndex || '?')}/10</span>
      </div>
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap;">
        ${href ? `<a href="${escapeAttr(href)}" class="btn btn-ghost" style="width:auto;padding:8px 12px;font-size:12px;text-decoration:none;">${actionLabel}</a>` : ''}
        <button type="button" class="btn btn-ghost" data-delete-case="${escapeAttr(id)}" data-case-title="${escapeAttr(c.caseTitle || '제목 없음')}" style="width:auto;padding:8px 12px;font-size:12px;color:#e77;border-color:rgba(231,76,60,.45);">사건 삭제</button>
      </div>
    </article>`;
}
