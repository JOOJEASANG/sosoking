import { auth } from './firebase.js';
import { toast } from './components/toast.js';
import { endGameRoom } from './games/end.js';

function getGameTypeFromHash() {
  const match = (location.hash || '').match(/^#\/game\/(liar|mafia|wordtrap)\//);
  return match ? match[1] : '';
}

function getCurrentRoomFromPage() {
  const json = document.querySelector('[data-game-room-json]')?.textContent;
  if (json) {
    try { return JSON.parse(json); } catch {}
  }
  const type = getGameTypeFromHash();
  const id = (location.hash || '').split('/').pop();
  return type && id ? { id, game: type } : null;
}

function findHero() {
  return document.querySelector('.liar-hero--room, .game-detail-page .game-detail-hero');
}

function injectEndButton() {
  const type = getGameTypeFromHash();
  if (!type) return;
  const hero = findHero();
  if (!hero || hero.querySelector('[data-game-end-room]')) return;

  const actions = hero.querySelector('.game-room-actions') || (() => {
    const box = document.createElement('div');
    box.className = 'game-room-actions';
    hero.appendChild(box);
    return box;
  })();

  const room = window.__sosokingCurrentGameRoom || getCurrentRoomFromPage();
  if (!room || room.status === 'ended' || room.hostId !== auth.currentUser?.uid) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--ghost btn--sm game-end-btn';
  btn.dataset.gameEndRoom = '1';
  btn.textContent = '게임 종료';
  btn.addEventListener('click', async () => {
    if (!confirm('현재 게임을 종료할까요?')) return;
    try {
      btn.disabled = true;
      await endGameRoom(room);
      toast.success('게임을 종료했어요');
    } catch (error) {
      toast.warn(error.message || '게임 종료에 실패했어요');
      btn.disabled = false;
    }
  });
  actions.appendChild(btn);
}

function injectStyle() {
  if (document.getElementById('game-end-button-style')) return;
  const style = document.createElement('style');
  style.id = 'game-end-button-style';
  style.textContent = `
    .game-end-btn {
      border-color: rgba(239,68,68,.24) !important;
      color: #dc2626 !important;
      background: rgba(239,68,68,.08) !important;
    }
    .game-end-btn:hover {
      background: rgba(239,68,68,.14) !important;
    }
    [data-theme="dark"] .game-end-btn {
      color: #fecaca !important;
      background: rgba(239,68,68,.18) !important;
      border-color: rgba(248,113,113,.28) !important;
    }
  `;
  document.head.appendChild(style);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    injectStyle();
    injectEndButton();
  }, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
