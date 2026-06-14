// election-consistency-fix.js
// 대선 화면의 안내 문구가 서버 보상 로직과 어긋나지 않도록 보정합니다.

function currentPath() {
  return (window.location.hash.slice(1) || '/').split('?')[0] || '/';
}

function normalizeElectionCopy() {
  if (currentPath() !== '/election') return;
  const banner = document.querySelector('.elec-day-banner');
  if (banner && banner.innerHTML.includes('+10P 특별 보너스')) {
    banner.innerHTML = '⚡ 오늘 대선 마감! 지금 투표하고 <b>정치력 보상</b>을 받으세요 🎉';
  }

  document.querySelectorAll('.elec-impeach-box__badge').forEach(el => {
    if (el.textContent.includes('불신임 투표')) el.textContent = '🏛️ 탄핵소추 청원';
  });
  document.querySelectorAll('.elec-impeach-box__desc').forEach(el => {
    el.innerHTML = el.innerHTML
      .replaceAll('불신임 투표를 발의할 수 있습니다', '국회 탄핵소추 청원을 발의할 수 있습니다')
      .replaceAll('공식 불신임 투표가 시작됩니다', '공식 탄핵소추 절차가 시작됩니다');
  });
  document.querySelectorAll('.elec-impeach-signed').forEach(el => {
    el.textContent = el.textContent.replace('불신임', '탄핵소추');
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(normalizeElectionCopy, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
