
function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

function injectGameGuideStyle() {
  injectStyle('game-guide-toggle-style', `
    .game-guide-card.is-collapsible { padding: 0 !important; overflow: hidden; }
    .game-guide-toggle-head {
      width: 100%; border: 0; background: transparent; padding: 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      font: inherit; text-align: left; cursor: pointer; color: var(--color-text-primary);
    }
    .game-guide-toggle-head .game-detail-card__head { flex: 1; min-width: 0; margin-bottom: 0 !important; pointer-events: none; }
    .game-guide-toggle-icon {
      flex: 0 0 auto; width: 31px; height: 31px; display: grid; place-items: center;
      border-radius: 999px; background: var(--color-surface-2); border: 1px solid var(--color-border-light);
      color: var(--color-text-secondary); font-size: 14px; font-weight: 950; transition: transform .18s ease, background .18s ease;
    }
    .game-guide-card.is-collapsed .game-guide-toggle-icon { transform: rotate(180deg); }
    .game-guide-toggle-body { padding: 0 16px 16px; display: block; }
    .game-guide-card.is-collapsed .game-guide-toggle-body { display: none; }
    .game-guide-card.is-collapsed { box-shadow: var(--shadow-sm); }
    .game-guide-card.is-collapsed .game-guide-toggle-head { padding-bottom: 16px; }
    @media (max-width: 767px) {
      .game-guide-toggle-head { padding: 14px; }
      .game-guide-toggle-body { padding: 0 14px 14px; }
    }
  `);
}

function injectModeratorStyle() {
  injectStyle('game-moderator-style', `
    .game-chat-item.is-system { align-self: center !important; max-width: 96% !important; width: 100% !important; justify-content: center !important; }
    .game-chat-item.is-system i { background: linear-gradient(135deg, #6366f1, #ff6b4a) !important; color: #fff !important; }
    .game-chat-item.is-system > div { flex: 1 !important; min-width: 0 !important; }
    .game-chat-item.is-system p {
      background: linear-gradient(135deg, rgba(99,102,241,.12), rgba(255,107,74,.10)) !important;
      border-color: rgba(99,102,241,.24) !important; color: var(--color-text-primary) !important;
      font-weight: 850 !important; box-shadow: 0 8px 20px rgba(99,102,241,.06) !important;
    }
    .game-chat-item.is-system .game-chat-item__meta b { color: var(--color-primary) !important; }
    .game-chat-item.is-system .game-chat-item__meta span { background: rgba(99,102,241,.12) !important; color: #6366f1 !important; }
    [data-theme="dark"] .game-chat-item.is-system p {
      background: linear-gradient(135deg, rgba(99,102,241,.22), rgba(255,107,74,.16)) !important;
      border-color: rgba(255,255,255,.18) !important;
    }
    [data-theme="dark"] .game-chat-item.is-system .game-chat-item__meta span { background: rgba(255,255,255,.13) !important; color: #f8faff !important; }
  `);
}

function injectEndButtonStyle() {
  injectStyle('game-end-button-style', `
    .game-end-btn { border-color: rgba(239,68,68,.24) !important; color: #dc2626 !important; background: rgba(239,68,68,.08) !important; }
    .game-end-btn:hover { background: rgba(239,68,68,.14) !important; }
    [data-theme="dark"] .game-end-btn {
      color: #fecaca !important; background: rgba(239,68,68,.18) !important; border-color: rgba(248,113,113,.28) !important;
    }
  `);
}

function enhanceGuideCard(card) {
  if (!card || card.dataset.guideToggleReady === '1') return;
  const head = card.querySelector(':scope > .game-detail-card__head');
  const list = card.querySelector(':scope > .game-guide-list');
  if (!head || !list) return;

  card.dataset.guideToggleReady = '1';
  card.classList.add('is-collapsible', 'is-collapsed');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-guide-toggle-head';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', '게임 설명 접기 또는 펼치기');

  const icon = document.createElement('span');
  icon.className = 'game-guide-toggle-icon';
  icon.textContent = '⌄';

  const body = document.createElement('div');
  body.className = 'game-guide-toggle-body';

  card.insertBefore(button, head);
  button.appendChild(head);
  button.appendChild(icon);
  body.appendChild(list);
  card.appendChild(body);

  button.addEventListener('click', () => {
    const collapsed = card.classList.toggle('is-collapsed');
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    icon.textContent = collapsed ? '⌄' : '⌃';
  });
}

function runGameUi() {
  injectGameGuideStyle();
  injectModeratorStyle();
  injectEndButtonStyle();
  document.querySelectorAll('.game-guide-card').forEach(enhanceGuideCard);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runGameUi, 100);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('themechange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(runGameUi, 300);
