import { functions, auth } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundLabel(remaining) {
  if (remaining === 2) return '결승';
  if (remaining === 4) return '4강';
  if (remaining === 8) return '8강';
  if (remaining === 16) return '16강';
  return `${remaining}강`;
}

function itemCard(item) {
  const imgHtml = item.imageUrl
    ? `<img class="t-play-card__img" src="${esc(item.imageUrl)}" alt="${esc(item.name)}" loading="lazy">`
    : `<div class="t-play-card__no-img">⚔️</div>`;
  return `
    <button class="t-play-card" type="button" data-pick="${item._battleIdx}">
      ${imgHtml}
      <span class="t-play-card__name">${esc(item.name)}</span>
    </button>`;
}

function renderBattleHtml(left, right, matchNum, totalMatches, roundSize) {
  return `
    <div class="t-play-wrap">
      <div class="t-play-header">
        <div class="t-play-round-label">${roundLabel(roundSize)}</div>
        <div class="t-play-progress">경기 ${matchNum} / ${totalMatches}</div>
      </div>
      <div class="t-play-battle">
        ${itemCard({ ...left, _battleIdx: 0 })}
        <div class="t-play-vs">VS</div>
        ${itemCard({ ...right, _battleIdx: 1 })}
      </div>
    </div>`;
}

function renderResultHtml(winner, totalPlays) {
  const imgHtml = winner.imageUrl
    ? `<img class="t-play-result__img" src="${esc(winner.imageUrl)}" alt="${esc(winner.name)}">`
    : '';
  return `
    <div class="t-play-result">
      <div class="t-play-result__crown">🏆</div>
      <div class="t-play-result__label">최종 우승!</div>
      ${imgHtml}
      <div class="t-play-result__winner">${esc(winner.name)}</div>
      <div class="t-play-result__btns">
        <button class="btn btn--ghost btn--sm" type="button" data-t-restart>다시 하기</button>
      </div>
    </div>`;
}

function startGame(wrap, postId, items) {
  let currentRound = shuffle(items);
  let matchIdx = 0;
  let roundWinners = [];

  function renderMatch() {
    const left = currentRound[matchIdx * 2];
    const right = currentRound[matchIdx * 2 + 1];
    const totalMatches = Math.floor(currentRound.length / 2);
    wrap.innerHTML = renderBattleHtml(left, right, matchIdx + 1, totalMatches, currentRound.length);

    wrap.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pickedIdx = parseInt(btn.dataset.pick);
        const winner = pickedIdx === 0 ? left : right;
        roundWinners.push(winner);
        matchIdx++;

        if (matchIdx * 2 >= currentRound.length) {
          if (roundWinners.length === 1) {
            finishGame(roundWinners[0]);
          } else {
            currentRound = roundWinners;
            matchIdx = 0;
            roundWinners = [];
            renderMatch();
          }
        } else {
          renderMatch();
        }
      });
    });
  }

  async function finishGame(winner) {
    wrap.innerHTML = renderResultHtml(winner);
    wrap.querySelector('[data-t-restart]')?.addEventListener('click', () => startGame(wrap, postId, items));

    if (auth.currentUser) {
      try {
        const fn = httpsCallable(functions, 'recordTournamentResult');
        await fn({ postId, winnerIdx: winner.origIdx });
      } catch (e) {
        console.warn('[tournament] 결과 저장 실패', e.message);
      }
    }
  }

  renderMatch();
}

function initTournamentModule(moduleEl) {
  const postId = moduleEl.dataset.postId || '';
  if (!postId) return;

  const dataEl = document.getElementById(`t-data-${postId}`);
  if (!dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch {
    return;
  }

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length < 2) return;

  const startBtn = moduleEl.querySelector(`[data-t-start="${postId}"]`);
  if (!startBtn) return;

  const wrap = document.getElementById(`t-game-wrap-${postId}`);
  if (!wrap) return;

  startBtn.addEventListener('click', () => startGame(wrap, postId, items));
}

function run() {
  document.querySelectorAll('[data-multi-module="tournament"]').forEach(moduleEl => {
    if (moduleEl.dataset.tInit === '1') return;
    moduleEl.dataset.tInit = '1';
    initTournamentModule(moduleEl);
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 300);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:detail-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 600);
