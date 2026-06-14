// court-consistency-fix.js
// 헌법재판소 화면의 AI 재판관 의견 버튼 문구를 실제 동작에 맞게 보정합니다.

function currentPath() {
  return (window.location.hash.slice(1) || '/').split('?')[0] || '/';
}

function normalizeCourtCopy() {
  if (currentPath() !== '/constitutional-court') return;
  const btn = document.getElementById('btn-ai-verdict');
  if (btn && btn.textContent.includes('AI 재판관 의견 생성')) {
    btn.textContent = '🏛️ AI 재판관 의견 보기/생성';
  }
  document.querySelectorAll('.court-verdict__desc').forEach(el => {
    if (el.textContent.includes('AI 재판관 3인이')) {
      el.textContent = 'AI 재판관 3인의 탄핵심판 의견을 확인하거나 새로 생성합니다.';
    }
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(normalizeCourtCopy, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
