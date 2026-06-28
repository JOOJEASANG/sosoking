function normalizeSingleBoardUi() {
  document.querySelectorAll('[data-type-filter="drip"], a[href*="type=drip"], [data-room-nav="drip"]').forEach(el => {
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  });

  document.querySelectorAll('.soso-room-head__label').forEach(el => {
    if (/통합|게시판/.test(el.textContent || '')) el.textContent = '📋 일반게시판';
  });
  document.querySelectorAll('.soso-room-head__desc').forEach(el => {
    if (/드립|투표|퀴즈|일반글/.test(el.textContent || '')) {
      el.textContent = '선택하지 않으면 일반글, 투표 선택 시 찬반토론, 퀴즈 선택 시 퀴즈 옵션이 열립니다.';
    }
  });
}

let singleBoardTimer = null;
function scheduleSingleBoardNormalize() {
  clearTimeout(singleBoardTimer);
  singleBoardTimer = setTimeout(normalizeSingleBoardUi, 80);
}

window.addEventListener('hashchange', scheduleSingleBoardNormalize);
window.addEventListener('sosoking:render-multi-write', scheduleSingleBoardNormalize);
new MutationObserver(scheduleSingleBoardNormalize).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(scheduleSingleBoardNormalize, 300);
