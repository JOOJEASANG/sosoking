import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-northeast3');
const deleteCourtPost = httpsCallable(functions, 'deleteCourtPost');
const deleteUserProfile = httpsCallable(functions, 'deleteUserProfile');
const setCaseVisibility = httpsCallable(functions, 'setCaseVisibility');

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
function ensureHelper() {
  const shell = document.querySelector('.admin-shell');
  const nav = shell?.querySelector('.admin-nav');
  if (!shell || !nav || document.getElementById('admin-helper')) return;
  const div = document.createElement('div');
  div.id = 'admin-helper';
  div.className = 'admin-helper';
  div.innerHTML = '<strong>운영 모드</strong> · 공개 전환은 개인정보 재검사를 거치며, 사건 삭제는 사건/판결/투표/댓글/신고/첨부 이미지까지 함께 정리합니다. 회원 프로필 삭제는 닉네임 예약과 프로필 사진까지 정리합니다.';
  nav.insertAdjacentElement('afterend', div);
}
async function completeDelete(caseId) {
  const text = '이 게시물과 연결된 사건, 판결문, 투표, 댓글, 신고, 첨부 이미지 데이터를 모두 삭제할까요?\n삭제 후 복구할 수 없습니다.';
  if (!caseId || !confirm(text)) return;
  try {
    const res = await deleteCourtPost({ caseId });
    alert(`완전 삭제 완료\nFirestore 삭제: ${res.data?.deleted || 0}개\nStorage 삭제: ${res.data?.storageDeleted || 0}개`);
    if (typeof window._tab === 'function') window._tab('records');
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
async function secureVisibility(caseId, isPublic) {
  if (!caseId) return;
  try {
    await setCaseVisibility({ caseId, isPublic });
    alert(isPublic ? '개인정보 검사를 통과해 공개했습니다.' : '비공개로 전환했습니다.');
    if (typeof window._tab === 'function') window._tab('records');
    else location.reload();
  } catch (err) {
    console.error(err);
    alert((err.message || '공개 상태를 변경하지 못했습니다.').replace('FirebaseError: ', ''));
  }
}
function interceptInlineAction(event) {
  const button = event.target?.closest?.('button[onclick]');
  if (!button) return;
  const code = button.getAttribute('onclick') || '';

  const visibilityMatch = code.match(/_recordPublic\(['"]([^'"]+)['"],\s*(true|false)\)/);
  if (visibilityMatch) {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    Promise.resolve(secureVisibility(visibilityMatch[1], visibilityMatch[2] === 'true'))
      .finally(() => { button.disabled = false; });
    return;
  }

  const deleteMatch = code.match(/_(del(?:Case|Result|Record|UserProfile))\(['"]([^'"]+)['"]\)/);
  if (!deleteMatch?.[1] || !deleteMatch?.[2]) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.disabled = true;
  const action = deleteMatch[1] === 'delUserProfile'
    ? completeUserProfileDelete(deleteMatch[2])
    : completeDelete(deleteMatch[2]);
  Promise.resolve(action).finally(() => { button.disabled = false; });
}

ensureAdminPolishStyle();
setTimeout(ensureHelper, 300);
window.addEventListener('click', event => {
  interceptInlineAction(event);
  setTimeout(ensureHelper, 0);
}, true);
