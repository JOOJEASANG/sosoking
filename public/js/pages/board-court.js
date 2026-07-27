import { renderBoard as renderBaseBoard } from './board.js?v=20260728-audit-1';

function ensureBoardGameStyle() {
  if (document.getElementById('board-game-style')) return;
  const style = document.createElement('style');
  style.id = 'board-game-style';
  style.textContent = `
    .arena-rank-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 16px;}
    .arena-rank-tabs div{border:1px solid rgba(201,168,76,.32);border-radius:14px;background:rgba(201,168,76,.08);padding:10px 8px;text-align:center;}
    .arena-rank-tabs strong{display:block;color:#e8c97a;font-size:14px;font-weight:900;}
    .arena-rank-tabs span{display:block;color:rgba(255,248,236,.72);font-size:10px;margin-top:2px;font-weight:800;}
    .rank-medal{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ffdf7a,#c9a84c);color:#111827;font-weight:900;margin-right:6px;}
    .court-board-row:nth-child(1){border-color:rgba(255,223,122,.8)!important;box-shadow:0 8px 26px rgba(201,168,76,.12);}
    .court-board-row:nth-child(1)::after{content:'HOT';position:absolute;right:12px;top:12px;color:#111827;background:#ffdf7a;border-radius:999px;padding:3px 8px;font-size:9px;font-weight:900;}
    #board-list .card{position:relative;}
    .board-record-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
    .board-record-meta-row{justify-content:flex-start;}
    .board-judge-chip,.board-grievance-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;border:1px solid rgba(201,168,76,.32);background:rgba(201,168,76,.1);font-size:11px;color:var(--cream-dim);font-weight:800;}
    .board-grievance-chip strong{color:var(--gold-light);}
    .board-grievance-meter{display:inline-flex;gap:2px;margin-left:3px;}
    .board-grievance-meter i{display:block;width:3px;height:10px;border-radius:999px;background:rgba(255,255,255,.16);}
    .board-grievance-meter i.active{background:#d96b5d;}
    @media(max-width:520px){
      .board-record-meta{align-items:flex-start;}
      .board-judge-chip,.board-grievance-chip{font-size:10px;padding:5px 8px;}
    }
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
        <div class="court-seal" style="width:52px;height:52px;font-size:24px;" aria-hidden="true">🏟️</div>
        <div>
          <div class="court-kicker">SOSOKING ARENA</div>
          <div class="court-title" style="font-size:20px;">생활법정 아레나</div>
        </div>
      </div>
      <div class="arena-rank-tabs">
        <div><strong>최신</strong><span>방금 선고</span></div>
        <div><strong>판사성향</strong><span>캐릭터 판결</span></div>
        <div><strong>억울지수</strong><span>고정 기록</span></div>
      </div>`);
  }

  const pick = document.getElementById('today-pick')?.firstElementChild;
  if (pick && !pick.classList.contains('court-document')) {
    pick.classList.add('court-document');
    pick.insertAdjacentHTML('afterbegin', '<div class="court-stamp" style="margin-bottom:8px;">주목 기록</div>');
  }

  document.querySelectorAll('#board-list .card').forEach((card, index) => {
    if (card.classList.contains('court-board-row')) return;
    card.classList.add('court-board-row');
    card.style.borderLeft = '3px solid rgba(201,168,76,.5)';
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1);
    card.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:7px;"><span class="rank-medal">${medal}</span> ARENA RECORD</div>`);
  });
}

export async function renderBoard(container) {
  await renderBaseBoard(container);
  decorateBoard(container);
}
