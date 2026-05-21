const STYLE_ID = 'game-guide-toggle-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .game-guide-card.is-collapsible {
      padding: 0 !important;
      overflow: hidden;
    }

    .game-guide-toggle-head {
      width: 100%;
      border: 0;
      background: transparent;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font: inherit;
      text-align: left;
      cursor: pointer;
      color: var(--color-text-primary);
    }

    .game-guide-toggle-head .game-detail-card__head {
      flex: 1;
      min-width: 0;
      margin-bottom: 0 !important;
      pointer-events: none;
    }

    .game-guide-toggle-icon {
      flex: 0 0 auto;
      width: 31px;
      height: 31px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border-light);
      color: var(--color-text-secondary);
      font-size: 14px;
      font-weight: 950;
      transition: transform .18s ease, background .18s ease;
    }

    .game-guide-card.is-collapsed .game-guide-toggle-icon {
      transform: rotate(180deg);
    }

    .game-guide-toggle-body {
      padding: 0 16px 16px;
      display: block;
    }

    .game-guide-card.is-collapsed .game-guide-toggle-body {
      display: none;
    }

    .game-guide-card.is-collapsed {
      box-shadow: var(--shadow-sm);
    }

    .game-guide-card.is-collapsed .game-guide-toggle-head {
      padding-bottom: 16px;
    }

    @media (max-width: 767px) {
      .game-guide-toggle-head {
        padding: 14px;
      }
      .game-guide-toggle-body {
        padding: 0 14px 14px;
      }
    }
  `;
  document.head.appendChild(style);
}

function enhanceGuideCard(card) {
  if (!card || card.dataset.guideToggleReady === '1') return;
  const head = card.querySelector(':scope > .game-detail-card__head');
  const list = card.querySelector(':scope > .game-guide-list');
  if (!head || !list) return;

  card.dataset.guideToggleReady = '1';
  card.classList.add('is-collapsible');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-guide-toggle-head';
  button.setAttribute('aria-expanded', 'true');
  button.setAttribute('aria-label', '게임 설명 접기 또는 펼치기');

  const icon = document.createElement('span');
  icon.className = 'game-guide-toggle-icon';
  icon.textContent = '⌃';

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

function run() {
  injectStyle();
  document.querySelectorAll('.game-guide-card').forEach(enhanceGuideCard);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 80);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(run, 300);
