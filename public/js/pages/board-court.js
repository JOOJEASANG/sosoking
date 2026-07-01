import { renderBoard as renderBaseBoard } from './board.js?v=20260630-6';

function decorateBoard(container) {
  const intro = container.querySelector('.container > div');
  if (intro && !document.getElementById('court-board-intro')) {
    intro.classList.add('court-shell');
    intro.id = 'court-board-intro';
    intro.style.padding = '20px';
    intro.insertAdjacentHTML('afterbegin', `
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:10px;">
        <div class="court-seal" style="width:52px;height:52px;font-size:24px;">👥</div>
        <div>
          <div class="court-kicker">PUBLIC GALLERY COURT</div>
          <div class="court-title" style="font-size:20px;">국민참여 생활재판</div>
        </div>
      </div>`);
  }
  const pick = document.getElementById('today-pick')?.firstElementChild;
  if (pick && !pick.classList.contains('court-document')) {
    pick.classList.add('court-document');
    pick.insertAdjacentHTML('afterbegin', `<div class="court-stamp" style="margin-bottom:8px;">명판결</div>`);
  }
  document.querySelectorAll('#board-list .card').forEach((card, idx) => {
    if (card.classList.contains('court-board-row')) return;
    card.classList.add('court-board-row');
    card.style.borderLeft = '3px solid rgba(201,168,76,.5)';
    card.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:5px;">PUBLIC RECORD ${String(idx + 1).padStart(2, '0')}</div>`);
  });
}

export async function renderBoard(container) {
  await renderBaseBoard(container);
  decorateBoard(container);
  setTimeout(() => decorateBoard(container), 250);
}
