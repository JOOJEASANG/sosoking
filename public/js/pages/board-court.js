import { renderBoard as renderBaseBoard } from './board.js?v=20260710-ranking1';

function ensureBoardGameStyle() {
  if (document.getElementById('board-game-style')) return;
  const style = document.createElement('style');
  style.id = 'board-game-style';
  style.textContent = `
    .arena-rank-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 16px;}
    .arena-rank-tabs button{appearance:none;border:1px solid rgba(201,168,76,.32);border-radius:14px;background:rgba(201,168,76,.06);padding:10px 8px;text-align:center;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease;}
    .arena-rank-tabs button:hover{transform:translateY(-1px);border-color:rgba(201,168,76,.62);}
    .arena-rank-tabs button.active{border-color:rgba(255,223,122,.86);background:rgba(201,168,76,.18);box-shadow:0 7px 20px rgba(201,168,76,.1);}
    .arena-rank-tabs strong{display:block;color:#e8c97a;font-size:14px;font-weight:900;}
    .arena-rank-tabs span{display:block;color:rgba(255,248,236,.72);font-size:10px;margin-top:2px;font-weight:800;}
    .rank-medal{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ffdf7a,#c9a84c);color:#111827;font-weight:900;margin-right:6px;}
    #board-list .court-board-row:first-child{border-color:rgba(255,223,122,.8)!important;box-shadow:0 8px 26px rgba(201,168,76,.12);}
    #board-list .court-board-row:first-child::after{content:'TOP';position:absolute;right:12px;top:12px;color:#111827;background:#ffdf7a;border-radius:999px;padding:3px 8px;font-size:9px;font-weight:900;}
    #board-list .card{position:relative;}
    [data-theme="light"] .arena-rank-tabs button,:root:not([data-theme="dark"]) .arena-rank-tabs button{background:#fffaf0;border-color:#dfc98e;}
    [data-theme="light"] .arena-rank-tabs button.active,:root:not([data-theme="dark"]) .arena-rank-tabs button.active{background:#fff0bd;border-color:#c79e32;}
    [data-theme="light"] .arena-rank-tabs span,:root:not([data-theme="dark"]) .arena-rank-tabs span{color:#6b5431;}
  `;
  document.head.appendChild(style);
}
function decorateBoard(container) {
  ensureBoardGameStyle();
  const intro = container.querySelector('.container > div');
  if (intro && !document.getElementById('court-board-intro')) {
    intro.classList.add('court-shell');
    intro.id = 'court-board-intro';
    intro.style.padding = '20px';
    intro.insertAdjacentHTML('afterbegin', `
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:10px;">
        <div class="court-seal" style="width:52px;height:52px;font-size:24px;">🏟️</div>
        <div>
          <div class="court-kicker">SOSOKING ARENA</div>
          <div class="court-title" style="font-size:20px;">황당재판 아레나</div>
        </div>
      </div>`);
  }
  const pick = document.getElementById('today-pick')?.firstElementChild;
  if (pick && !pick.classList.contains('court-document')) {
    pick.classList.add('court-document');
  }
}

export async function renderBoard(container) {
  ensureBoardGameStyle();
  await renderBaseBoard(container);
  decorateBoard(container);
  const observer = new MutationObserver(() => decorateBoard(container));
  observer.observe(container, { childList: true, subtree: true });
  const oldCleanup = window._pageCleanup;
  window._pageCleanup = () => { observer.disconnect(); oldCleanup?.(); };
}
