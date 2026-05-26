// admin-ai-write-type-force.js
// 이전에 AI 관리 화면에 별도 글쓰기 유형 패널을 강제로 끼워 넣던 보정 모듈입니다.
// 현재 AI 관리 화면은 admin-ai-minimal-actions.js의 단일 패널만 사용합니다.
// 삭제된 글쓰기 유형(행시, 릴레이 등)이 다시 노출되지 않도록 기존 강제 패널을 제거합니다.

function removeLegacyForcePanel() {
  document.querySelectorAll('[data-ai-write-type-force]').forEach(panel => panel.remove());
}

function schedule() {
  setTimeout(removeLegacyForcePanel, 80);
}

document.addEventListener('click', schedule, true);
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
schedule();
