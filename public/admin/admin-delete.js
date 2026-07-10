import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-northeast3');
const deleteCourtPost = httpsCallable(functions, 'deleteCourtPost');
const deleteUserProfile = httpsCallable(functions, 'deleteUserProfile');

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
async function completeDelete(caseId, reloadTab = 'records') {
  const text = '이 게시물과 연결된 사건, 판결문, 투표, 댓글, 신고, 첨부 이미지 데이터를 모두 삭제할까요?\n삭제 후 복구할 수 없습니다.';
  if (!caseId || !confirm(text)) return;
  try {
    const res = await deleteCourtPost({ caseId });
    alert(`완전 삭제 완료\nFirestore 삭제: ${res.data?.deleted || 0}개\nStorage 삭제: ${res.data?.storageDeleted || 0}개`);
    if (typeof window._tab === 'function') window._tab(reloadTab);
    else location.reload();
  } catch (err) {
    console.error(err);
    alert((err.message || '삭제에 실패했습니다.').replace('FirebaseError: ', ''));
  }
}
async function completeUserProfileDelete(uid) {
  const text = '이 회원 프로필, 닉네임 예약, 등록 프로필 사진을 정리할까요?\nAuth 로그인 계정은 삭제되지 않습니다.';
  if (!uid || !confirm(text)) return;
  try {
    const res = await deleteUserProfile({ uid });
    alert(`회원 프로필 정리 완료\nFirestore 삭제: ${res.data?.deleted || 0}개\nStorage 삭제: ${res.data?.storageDeleted || 0}개`);
    if (typeof window._tab === 'function') window._tab('users');
    else location.reload();
  } catch (err) {
    console.error(err);
    alert((err.message || '회원 프로필 정리에 실패했습니다.').replace('FirebaseError: ', ''));
  }
}
function addHelper() {
  const shell = document.querySelector('.admin-shell');
  if (!shell || document.getElementById('admin-helper')) return;
  const div = document.createElement('div');
  div.id = 'admin-helper';
  div.className = 'admin-helper';
  div.innerHTML = '<strong>운영 모드</strong> · 사건 삭제는 사건/판결/투표/댓글/신고/첨부 이미지까지 정리합니다. 회원 프로필 삭제는 닉네임 예약과 프로필 사진까지 정리합니다.';
  const nav = shell.querySelector('.admin-nav');
  if (nav) nav.insertAdjacentElement('afterend', div);
  else shell.prepend(div);
}
function wrapFn(name, replacement) {
  if (typeof window[name] === 'function' && !window[name].__completeDelete) {
    const fn = replacement;
    fn.__completeDelete = true;
    window[name] = fn;
  }
}
function wrapAdminDeletes() {
  ensureAdminPolishStyle();
  addHelper();
  wrapFn('_delCase', id => completeDelete(id, 'records'));
  wrapFn('_delResult', id => completeDelete(id, 'records'));
  wrapFn('_delRecord', id => completeDelete(id, 'records'));
  wrapFn('_delUserProfile', id => completeUserProfileDelete(id));
}
function interceptInlineDelete(e) {
  const btn = e.target?.closest?.('button[onclick]');
  if (!btn) return;
  const code = btn.getAttribute('onclick') || '';
  const m = code.match(/_(del(?:Case|Result|Record|UserProfile))\(['"]([^'"]+)['"]\)/);
  if (!m?.[1] || !m?.[2]) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (m[1] === 'delUserProfile') completeUserProfileDelete(m[2]);
  else completeDelete(m[2], 'records');
}

wrapAdminDeletes();
setTimeout(wrapAdminDeletes, 0);
setTimeout(wrapAdminDeletes, 80);
setInterval(wrapAdminDeletes, 500);
window.addEventListener('click', interceptInlineDelete, true);
window.addEventListener('click', () => setTimeout(wrapAdminDeletes, 0), true);
new MutationObserver(wrapAdminDeletes).observe(document.body, { childList: true, subtree: true });
