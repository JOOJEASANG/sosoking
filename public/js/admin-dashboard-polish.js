// admin-dashboard-polish.js
// 관리자 화면의 현재 서비스 구조 안내를 보강합니다.

function pathNow() {
  return (window.location.hash.slice(1) || '/').split('?')[0] || '/';
}

function addPanel() {
  if (pathNow() !== '/admin') return;
  if (document.getElementById('admin-current-system-panel')) return;
  const content = document.getElementById('admin-content');
  if (!content || !content.firstElementChild || content.querySelector('.loading-center')) return;
  const panel = document.createElement('div');
  panel.id = 'admin-current-system-panel';
  panel.className = 'admin-section';
  panel.style.cssText = 'margin-bottom:16px';
  panel.innerHTML = `
    <div class="admin-section-head">
      <h2 class="admin-section-title">🏛️ 현재 시스템 빠른 점검</h2>
    </div>
    <div class="admin-stat-grid" style="margin-bottom:14px">
      <a class="admin-stat-card" href="#/republic" style="text-decoration:none;color:inherit"><div class="admin-stat-card__icon">🏛️</div><div class="admin-stat-card__num" style="font-size:17px">공화국</div><div class="admin-stat-card__label">허브</div></a>
      <a class="admin-stat-card" href="#/battle" style="text-decoration:none;color:inherit"><div class="admin-stat-card__icon">⚔️</div><div class="admin-stat-card__num" style="font-size:17px">배틀</div><div class="admin-stat-card__label">일일 투표</div></a>
      <a class="admin-stat-card" href="#/election" style="text-decoration:none;color:inherit"><div class="admin-stat-card__icon">👑</div><div class="admin-stat-card__num" style="font-size:17px">대선</div><div class="admin-stat-card__label">후보·포고령</div></a>
      <a class="admin-stat-card" href="#/congress" style="text-decoration:none;color:inherit"><div class="admin-stat-card__icon">🏛️</div><div class="admin-stat-card__num" style="font-size:17px">국회</div><div class="admin-stat-card__label">법안·탄핵</div></a>
      <a class="admin-stat-card" href="#/constitutional-court" style="text-decoration:none;color:inherit"><div class="admin-stat-card__icon">⚖️</div><div class="admin-stat-card__num" style="font-size:17px">헌재</div><div class="admin-stat-card__label">심판</div></a>
    </div>`;
  content.insertBefore(panel, content.firstElementChild);
}

function normalizeCopy() {
  if (pathNow() !== '/admin') return;
  const pairs = [
    ['AI킹 서비스별 사용 현황', 'AI·자동 생성 기능 사용 현황'],
    ['이번달 AI 사용', '이번달 자동 생성'],
    ['오늘 AI 사용', '오늘 자동 생성'],
    ['판결소', '헌법재판소'],
  ];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let value = node.nodeValue || '';
    pairs.forEach(([from, to]) => { value = value.split(from).join(to); });
    node.nodeValue = value;
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => { addPanel(); normalizeCopy(); }, 160);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
