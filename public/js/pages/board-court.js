import { renderBoard as renderBaseBoard } from './board.js?v=20260702-15';

function ensureBoardGameStyle() {
  if (document.getElementById('board-game-style')) return;
  const style = document.createElement('style');
  style.id = 'board-game-style';
  style.textContent = `
    .arena-rank-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 16px;}
    .arena-rank-tabs div{border:1px solid var(--border);border-radius:14px;background:linear-gradient(135deg,rgba(231,76,60,.10),var(--gold-dim));padding:10px 8px;text-align:center;}
    .arena-rank-tabs strong{display:block;color:var(--gold);font-size:14px;font-weight:900;}
    .arena-rank-tabs span{display:block;color:var(--text-muted,var(--cream-dim));font-size:10px;margin-top:2px;font-weight:800;}
    .rank-medal{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--gold-light),#ff7166);color:#120d05;font-weight:900;margin-right:6px;}
    .court-board-row:nth-child(1){border-color:var(--gold)!important;box-shadow:0 8px 26px rgba(201,168,76,.12);}
    .court-board-row:nth-child(1)::after{content:'KING';position:absolute;right:12px;top:12px;color:#120d05;background:var(--gold-light);border-radius:999px;padding:3px 8px;font-size:9px;font-weight:900;}
    #board-list .card{position:relative;}
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
        <div class="court-seal" style="width:52px;height:52px;font-size:24px;">👑</div>
        <div>
          <div class="court-kicker">SOSOKING KING ARENA</div>
          <div class="court-title" style="font-size:20px;">소소킹 공개 기록</div>
        </div>
      </div>
      <div class="arena-rank-tabs">
        <div><strong>킹</strong><span>소소킹감</span></div>
        <div><strong>인기</strong><span>시민 의견</span></div>
        <div><strong>최신</strong><span>방금 편성</span></div>
      </div>`);
  }
  const pick = document.getElementById('today-pick')?.firstElementChild;
  if (pick && !pick.classList.contains('court-document')) {
    pick.classList.add('court-document');
    pick.insertAdjacentHTML('afterbegin', `<div class="court-stamp" style="margin-bottom:8px;">오늘의 KING</div>`);
  }
  document.querySelectorAll('#board-list .card').forEach((card, idx) => {
    if (card.classList.contains('court-board-row')) return;
    card.classList.add('court-board-row');
    card.style.borderLeft = '3px solid var(--gold)';
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : String(idx + 1);
    card.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:7px;"><span class="rank-medal">${medal}</span> SOSO KING RECORD</div>`);
  });
}

export async function renderBoard(container) {
  await renderBaseBoard(container);
  decorateBoard(container);
  setTimeout(() => decorateBoard(container), 250);
}
