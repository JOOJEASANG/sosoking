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

function cleanupHomeMissionExtras() {
  const hiddenLabels = ['이번 주 위기 투표', '대통령에게 질문'];
  let removed = false;

  document.querySelectorAll('.home-mission, .home-missions button, button[data-path]').forEach(button => {
    const label = button.querySelector?.('.home-mission__label')?.textContent?.trim() || button.textContent?.trim() || '';
    const path = button.getAttribute?.('data-path') || '';
    const shouldHide = hiddenLabels.some(text => label.includes(text)) || path.includes('scroll=crisis');
    if (shouldHide) {
      button.remove();
      removed = true;
    }
  });

  const missionBox = document.querySelector('.home-missions');
  if (!missionBox) return;

  const missions = [...missionBox.querySelectorAll('.home-mission')];
  const done = missions.filter(el => el.classList.contains('home-mission--done')).length;
  const count = missionBox.querySelector('.home-missions__count');
  if (count) {
    const allDone = missions.length > 0 && done === missions.length;
    count.textContent = `${done}/${missions.length} 완료${allDone ? ' 🎉' : ''}`;
    count.classList.toggle('home-missions__count--all', allDone);
  }

  const rewardLabel = missionBox.querySelector('.home-missions__head span[style*="font-size:10px"]');
  if (rewardLabel) rewardLabel.textContent = '핵심 일정만 표시';

  if (removed) missionBox.dataset.politicalExtrasCleaned = '1';
}

function cleanupPoliticalExtras() {
  cleanupElectionExtras();
  cleanupNewsExtras();
  cleanupHomeMissionExtras();
}

let timer = null;
function scheduleCleanup() {
  clearTimeout(timer);
  timer = setTimeout(cleanupPoliticalExtras, 20);
}

window.addEventListener('hashchange', scheduleCleanup);
window.addEventListener('popstate', scheduleCleanup);
window.addEventListener('sosoking:extensions-ready', scheduleCleanup);
window.addEventListener('load', scheduleCleanup);

function observeBody() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', observeBody, { once: true });
    return;
  }
  new MutationObserver(scheduleCleanup).observe(document.body, { childList: true, subtree: true, characterData: true });
  scheduleCleanup();

  let runs = 0;
  const interval = setInterval(() => {
    cleanupPoliticalExtras();
    runs += 1;
    if (runs >= 120) clearInterval(interval);
  }, 250);
}

observeBody();
