import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-northeast3');
const deleteCourtPost = httpsCallable(functions, 'deleteCourtPost');

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

function wrapAdminDeletes() {
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
}

setInterval(wrapAdminDeletes, 300);
window.addEventListener('click', () => setTimeout(wrapAdminDeletes, 0), true);
