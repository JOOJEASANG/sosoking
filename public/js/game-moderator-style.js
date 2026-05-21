const STYLE_ID = 'game-moderator-style';

function injectModeratorStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .game-chat-item.is-system {
      align-self: center !important;
      max-width: 96% !important;
      width: 100% !important;
      justify-content: center !important;
    }

    .game-chat-item.is-system i {
      background: linear-gradient(135deg, #6366f1, #ff6b4a) !important;
      color: #fff !important;
    }

    .game-chat-item.is-system > div {
      flex: 1 !important;
      min-width: 0 !important;
    }

    .game-chat-item.is-system p {
      background: linear-gradient(135deg, rgba(99,102,241,.12), rgba(255,107,74,.10)) !important;
      border-color: rgba(99,102,241,.24) !important;
      color: var(--color-text-primary) !important;
      font-weight: 850 !important;
      box-shadow: 0 8px 20px rgba(99,102,241,.06) !important;
    }

    .game-chat-item.is-system .game-chat-item__meta b {
      color: var(--color-primary) !important;
    }

    .game-chat-item.is-system .game-chat-item__meta span {
      background: rgba(99,102,241,.12) !important;
      color: #6366f1 !important;
    }

    [data-theme="dark"] .game-chat-item.is-system p {
      background: linear-gradient(135deg, rgba(99,102,241,.22), rgba(255,107,74,.16)) !important;
      border-color: rgba(255,255,255,.18) !important;
    }

    [data-theme="dark"] .game-chat-item.is-system .game-chat-item__meta span {
      background: rgba(255,255,255,.13) !important;
      color: #f8faff !important;
    }
  `;
  document.head.appendChild(style);
}

injectModeratorStyle();
window.addEventListener('hashchange', injectModeratorStyle);
window.addEventListener('sosoking:extensions-ready', injectModeratorStyle);
