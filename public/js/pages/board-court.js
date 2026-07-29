import { renderBoard as renderBaseBoard } from './board.js?v=20260729-dark-record-participation-1';

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
    [data-theme='dark'] .court-board-page{
      color-scheme:dark;
      background:radial-gradient(circle at 50% -5%,rgba(209,173,80,.08),transparent 30%),#0b0f16;
      color:#fff9ef;
    }
    [data-theme='dark'] .court-board-page .card,
    [data-theme='dark'] .court-board-page .court-shell{
      background:linear-gradient(145deg,#1a2130,#10151f)!important;
      color:#fff9ef!important;
      border-color:rgba(209,173,80,.31)!important;
      box-shadow:0 10px 28px rgba(0,0,0,.31),inset 0 1px 0 rgba(255,255,255,.045)!important;
    }
    [data-theme='dark'] .court-board-page .board-judge-chip,
    [data-theme='dark'] .court-board-page .board-grievance-chip,
    [data-theme='dark'] .court-board-page .arena-rank-tabs div{
      background:rgba(255,255,255,.045)!important;
      border-color:rgba(209,173,80,.27)!important;
      color:rgba(255,249,239,.78)!important;
    }
    [data-theme='dark'] .court-board-page .arena-rank-tabs strong{color:#f0cf78!important;}
    [data-theme='dark'] .court-board-page .arena-rank-tabs span{color:rgba(255,249,239,.68)!important;}
    [data-theme='light'] .court-board-page .card{
      background:linear-gradient(145deg,#fffdf9,#f9efdf)!important;
      color:#20170d!important;
      border-color:rgba(121,83,11,.25)!important;
      box-shadow:0 8px 20px rgba(77,52,12,.08),inset 0 1px 0 rgba(255,255,255,.95)!important;
    }
    [data-theme='light'] .court-board-page .board-judge-chip,
    [data-theme='light'] .court-board-page .board-grievance-chip{
      color:rgba(32,23,13,.72)!important;
      background:rgba(121,83,11,.07)!important;
      border-color:rgba(121,83,11,.22)!important;
    }
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
