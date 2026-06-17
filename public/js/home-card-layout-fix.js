// home-card-layout-fix.js — 홈 카드 버튼/배치 보정
import { navigate } from './router.js';

function injectStyle() {
  if (document.getElementById('home-card-layout-fix-style')) return;
  const style = document.createElement('style');
  style.id = 'home-card-layout-fix-style';
  style.textContent = `
    .home-election-topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 7px;
    }
    .home-election-topline .home-core-card__title {
      margin-bottom: 0 !important;
    }
    .home-election-topline .btn {
      white-space: nowrap;
      min-height: 34px;
      padding: 7px 10px;
    }
  `;
  document.head.appendChild(style);
}

function removeTodayMainButton() {
  document.querySelectorAll('.home-core-card--main').forEach(card => {
    card.querySelectorAll('button[data-go="/battle"]').forEach(btn => btn.remove());
  });
}

function moveElectionButton() {
  document.querySelectorAll('.home-core-card').forEach(card => {
    const title = card.querySelector('.home-core-card__title');
    if (!title || !title.textContent.includes('대통령 선거')) return;
    if (card.querySelector('.home-election-topline')) return;
    const button = card.querySelector('button[data-go="/election"]');
    if (!button) return;
    const top = document.createElement('div');
    top.className = 'home-election-topline';
    title.parentNode.insertBefore(top, title);
    top.appendChild(title);
    top.appendChild(button);
    button.addEventListener('click', () => navigate('/election'));
  });
}

function run() {
  injectStyle();
  removeTodayMainButton();
  moveElectionButton();
}

run();
window.addEventListener('hashchange', () => setTimeout(run, 0));
window.addEventListener('sosoking:extensions-ready', run);
new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
