import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'asia-northeast3');
const deleteCourtPost = httpsCallable(functions, 'deleteCourtPost');

function ensureAdminPolishStyle() {
  if (document.getElementById('admin-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-polish-style';
  style.textContent = `
    .admin-helper{margin:0 0 14px;padding:12px 14px;border:1px solid rgba(201,168,76,.28);border-radius:12px;background:rgba(201,168,76,.08);color:var(--cream-dim);font-size:12px;line-height:1.7;}
    .admin-helper strong{color:var(--gold);}
    .admin-table td{line-height:1.55;}
    .admin-actions .admin-btn.red{font-weight:900;}
    @media(max-width:760px){.admin-table{min-width:720px}.admin-shell{padding-bottom:100px}.admin-helper{font-size:11px}}
  `;
  document.head.appendChild(style);
}
async function completeDelete(caseId, reloadTab) {
  const text = '이 게시물과 연결된 사건, 판결문, 투표, 댓글, 신고 데이터를 모두 삭제할까요?\n삭제 후 복구할 수 없습니다.';
  if (!confirm(text)) return;
  try {
    const res = await deleteCourtPost({ caseId });
    alert(`완전 삭제 완료\n삭제 처리: ${res.data?.deleted || 0}개 항목`);
    if (typeof window._tab === 'function') window._tab(reloadTab);
    else location.reload();
  } catch (err) {
    console.error(err);
    alert((err.message || '삭제에 실패했습니다.').replace('FirebaseError: ', ''));
  }
}
function addHelper() {
  const shell = document.querySelector('.admin-shell');
  if (!shell || document.getElementById('admin-helper')) return;
  const div = document.createElement('div');
  div.id = 'admin-helper';
  div.className = 'admin-helper';
  div.innerHTML = '<strong>운영 모드</strong> · 삭제는 사건/판결/투표/댓글/신고까지 정리하는 완전삭제로 처리됩니다. 모바일에서는 표를 좌우로 밀어서 확인하세요.';
  const nav = shell.querySelector('.admin-nav');
  if (nav) nav.insertAdjacentElement('afterend', div);
  else shell.prepend(div);
}
function wrapAdminDeletes() {
  ensureAdminPolishStyle();
  addHelper();
  if (typeof window._delCase === 'function' && !window._delCase.__completeDelete) {
    const fn = id => completeDelete(id, 'cases');
    fn.__completeDelete = true;
    window._delCase = fn;
  }
  if (typeof window._delResult === 'function' && !window._delResult.__completeDelete) {
    const fn = id => completeDelete(id, 'board');
    fn.__completeDelete = true;
    window._delResult = fn;
  }
  if (typeof window._delRecord === 'function' && !window._delRecord.__completeDelete) {
    const fn = id => completeDelete(id, 'records');
    fn.__completeDelete = true;
    window._delRecord = fn;
  }
}

setInterval(wrapAdminDeletes, 300);
window.addEventListener('click', () => setTimeout(wrapAdminDeletes, 0), true);
