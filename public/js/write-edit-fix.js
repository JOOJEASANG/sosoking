// write-edit-fix.js
//
// 레거시 수정 화면 보정 파일입니다.
// 실제 수정 화면 렌더링은 더 최신 구조인 write-edit-router-fix.js에서 담당합니다.
// 이 파일이 예전처럼 별도 렌더링을 수행하면 수정 화면이 두 번 그려지고,
// 빈칸 채우기/익명비밀글/투표 설정이 서로 덮어씌워질 수 있어 호환 shim으로만 유지합니다.

function notifyWriteEditRouter() {
  if (!(location.hash || '').startsWith('#/write')) return;
  window.dispatchEvent(new CustomEvent('sosoking:render-write-edit'));
}

window.addEventListener('hashchange', notifyWriteEditRouter);
window.addEventListener('sosoking:render-multi-write', notifyWriteEditRouter);
setTimeout(notifyWriteEditRouter, 300);
