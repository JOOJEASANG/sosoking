import { renderBoard as renderBaseBoard } from './board.js?v=20260709-desc1';

function ensureBoardGameStyle() {
  if (document.getElementById('board-game-style')) return;
  const style = document.createElement('style');
  style.id = 'board-game-style';
  style.textContent = `
    .arena-rank-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 16px;}
    .arena-rank-tabs button{border:1px solid rgba(201,168,76,.25);background:rgba(255,255,255,.035);color:var(--cream-dim);border-radius:999px;padding:10px 8px;font-size:12px;font-weight:900;cursor:pointer;}
    .arena-rank-tabs button.active{background:linear-gradient(180deg,#f4db8b,#c9a84c);color:#151515;border-color:#c9a84c;}
    .board-arena-banner{border:1px solid rgba(201,168,76,.45);border-radius:22px;background:radial-gradient(circle at 50% 0%,rgba(201,168,76,.15),transparent 42%),rgba(28,36,64,.76);padding:18px;margin-bottom:14px;text-align:center;}
    .board-arena-banner strong{display:block;font-family:var(--font-serif);font-size:21px;color:var(--gold);margin-bottom:6px;}
    .board-arena-banner span{font-size:12px;color:var(--cream-dim);line-height:1.7;}
    [data-theme="light"] .board-arena-banner,:root:not([data-theme="dark"]) .board-arena-banner{background:#fffaf0!important;border-color:#e2d3af!important;}
    [data-theme="light"] .board-arena-banner span,:root:not([data-theme="dark"]) .board-arena-banner span{color:#6b5431!important;}
  `;
  document.head.appendChild(style);
}
function decorateBoard(container) {
  ensureBoardGameStyle();
  const list = container.querySelector('#board-list');
  const top = container.querySelector('#today-pick');
  if (!list || document.getElementById('board-arena-banner')) return;
  top?.insertAdjacentHTML('beforebegin', `
    <div id="board-arena-banner" class="board-arena-banner">
      <strong>방청석 공개 기록실</strong>
      <span>사건내용을 보고 마음이 움직이면 판결문을 열람해 원고 편, 피고 편, 너무했다 표를 남겨보세요.</span>
    </div>`);
}

export async function renderBoard(container) {
  await renderBaseBoard(container);
  decorateBoard(container);
}
