// political-extra-cleanup.js
// 현재 핵심 루프에서 제외하기로 한 보조 정치 기능을 화면에서 제거합니다.
// 서버 함수와 기존 데이터는 보존하여 배포 위험을 낮춥니다.

function currentPath() {
  return (window.location.hash.slice(1) || window.location.pathname || '/').split('?')[0] || '/';
}

function removeElement(selector) {
  document.querySelectorAll(selector).forEach(el => el.remove());
}

function cleanupElectionExtras() {
  const path = currentPath();
  if (path !== '/election') return;

  // 대통령에게 질문 / 대정부 질문 섹션 제거
  removeElement('#elec-qa-section');
  removeElement('.elec-qa-section');
  removeElement('.elec-qa-item');
  removeElement('.elec-qa-form');
}

function cleanupNewsExtras() {
  const path = currentPath();
  if (path !== '/news') return;

  // 소소신문의 대정부 질의응답, 이번 주 국정 위기 국민투표 제거
  removeElement('#news-qa-slot');
  removeElement('#news-crisis-slot');
  removeElement('.news-qa-highlight');
  removeElement('.news-crisis');
}

function cleanupPoliticalExtras() {
  cleanupElectionExtras();
  cleanupNewsExtras();
}

let timer = null;
function scheduleCleanup() {
  clearTimeout(timer);
  timer = setTimeout(cleanupPoliticalExtras, 80);
}

window.addEventListener('hashchange', scheduleCleanup);
window.addEventListener('popstate', scheduleCleanup);
window.addEventListener('sosoking:extensions-ready', scheduleCleanup);

function observeBody() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', observeBody, { once: true });
    return;
  }
  new MutationObserver(scheduleCleanup).observe(document.body, { childList: true, subtree: true });
  scheduleCleanup();
}

observeBody();
