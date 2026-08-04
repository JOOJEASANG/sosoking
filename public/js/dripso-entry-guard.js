const DRIPSO_PATH = '/dripso/#/';
const BUTTON_ID = 'dripso-quick-button';
const PANEL_ID = 'dripso-quick-panel';

function isHomeRoute() {
  const hash = location.hash || '';
  const path = location.pathname.replace(/\/$/, '') || '/';
  return path === '/' && (hash === '' || hash === '#' || hash === '#/');
}

function removeLegacyEntries() {
  const nav = document.getElementById('bottom-nav');
  nav?.querySelector('a[href="/dripso/"], a[href="/dripso/#/"]')?.remove();
  nav?.classList.remove('has-dripso-entry');
  document.getElementById('dripso-home-entry')?.remove();
  document.querySelectorAll('.dripso-home-entry').forEach(node => node.remove());
}

function closePanel({ restoreFocus = false } = {}) {
  const button = document.getElementById(BUTTON_ID);
  const panel = document.getElementById(PANEL_ID);
  if (!button || !panel) return;
  panel.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  if (restoreFocus) button.focus({ preventScroll: true });
}

function togglePanel() {
  const button = document.getElementById(BUTTON_ID);
  const panel = document.getElementById(PANEL_ID);
  if (!button || !panel) return;
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  button.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) panel.querySelector('a')?.focus({ preventScroll: true });
}

function buildQuickButton() {
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'dripso-quick-button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', PANEL_ID);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', '드립소 안내 열기');

  const mark = document.createElement('span');
  mark.className = 'dripso-quick-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = 'ㅋ';

  const label = document.createElement('span');
  label.className = 'dripso-quick-label';
  label.textContent = '드립소';

  button.append(mark, label);
  return button;
}

function buildQuickPanel() {
  const panel = document.createElement('aside');
  panel.id = PANEL_ID;
  panel.className = 'dripso-quick-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'dripso-quick-title');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'dripso-quick-close';
  close.dataset.dripsoQuickClose = 'true';
  close.setAttribute('aria-label', '드립소 안내 닫기');
  close.textContent = '×';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'dripso-quick-eyebrow';
  eyebrow.textContent = '10초 웃음 배틀';

  const title = document.createElement('strong');
  title.id = 'dripso-quick-title';
  title.textContent = '드립소에서 한 판 붙어보세요';

  const description = document.createElement('p');
  description.textContent = '7가지 짧은 드립으로 출전하고, 익명 1대1 투표와 파이널4 결승으로 챔피언을 정합니다.';

  const link = document.createElement('a');
  link.className = 'dripso-quick-link';
  link.href = DRIPSO_PATH;
  link.setAttribute('aria-label', '드립소로 이동');
  link.textContent = 'ㅋ 드립소 바로가기';

  panel.append(close, eyebrow, title, description, link);
  return panel;
}

function ensureQuickEntry() {
  removeLegacyEntries();

  if (!isHomeRoute()) {
    document.getElementById(BUTTON_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();
    return;
  }

  let button = document.getElementById(BUTTON_ID);
  let panel = document.getElementById(PANEL_ID);
  if (!button) button = buildQuickButton();
  if (!panel) panel = buildQuickPanel();

  const themeToggle = document.getElementById('theme-toggle');
  if (button.parentElement !== document.body) document.body.append(button);
  if (themeToggle && button.nextElementSibling !== themeToggle) {
    document.body.insertBefore(button, themeToggle);
  }
  if (panel.parentElement !== document.body) document.body.append(panel);
}

let scheduled = false;
function scheduleEnsure() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    ensureQuickEntry();
  });
}

document.addEventListener('click', event => {
  const button = event.target.closest(`#${BUTTON_ID}`);
  if (button) {
    event.preventDefault();
    togglePanel();
    return;
  }

  const close = event.target.closest('[data-dripso-quick-close]');
  if (close) {
    event.preventDefault();
    closePanel({ restoreFocus: true });
    return;
  }

  const panel = document.getElementById(PANEL_ID);
  if (panel && !panel.hidden && !event.target.closest(`#${PANEL_ID}`)) closePanel();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closePanel({ restoreFocus: true });
});

const observer = new MutationObserver(scheduleEnsure);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  closePanel();
  scheduleEnsure();
});
window.addEventListener('pageshow', scheduleEnsure);
window.addEventListener('sosoking:themechange', scheduleEnsure);
ensureQuickEntry();
