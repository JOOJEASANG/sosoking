const DRIPSO_PATH = '/dripso/';
const BUTTON_ID = 'dripso-quick-launch';
const PANEL_ID = 'dripso-quick-panel';

function isHomeRoute() {
  const hash = location.hash || '';
  const path = location.pathname.replace(/\/$/, '') || '/';
  return path === '/' && (hash === '' || hash === '#' || hash === '#/');
}

function setExpanded(button, panel, expanded) {
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  panel.hidden = !expanded;
}

function removeQuickLaunch() {
  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(PANEL_ID)?.remove();
}

function createPanel() {
  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.className = 'dripso-quick-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'dripso-quick-panel-title');

  const heading = document.createElement('div');
  heading.className = 'dripso-quick-panel-heading';

  const titleWrap = document.createElement('div');
  const eyebrow = document.createElement('span');
  eyebrow.textContent = 'DRIP BATTLE';
  const title = document.createElement('strong');
  title.id = 'dripso-quick-panel-title';
  title.textContent = '드립소에서 한 판 붙어보세요';
  titleWrap.append(eyebrow, title);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'dripso-quick-panel-close';
  close.setAttribute('aria-label', '드립소 안내 닫기');
  close.textContent = '×';
  heading.append(titleWrap, close);

  const description = document.createElement('p');
  description.textContent = '빈칸채우기·이름붙이기·받아치기 등 7가지 짧은 드립으로 출전하고, 익명 투표와 파이널4로 챔피언을 정합니다.';

  const link = document.createElement('a');
  link.className = 'dripso-quick-panel-link';
  link.href = DRIPSO_PATH;
  link.textContent = 'ㅋ 드립소 바로가기';
  link.setAttribute('aria-label', '드립소로 이동');

  panel.append(heading, description, link);
  close.addEventListener('click', () => {
    const button = document.getElementById(BUTTON_ID);
    if (button) setExpanded(button, panel, false);
    button?.focus();
  });
  return panel;
}

function ensureQuickLaunch() {
  document.getElementById('dripso-home-entry')?.remove();
  document.getElementById('bottom-nav')?.querySelector('a[href="/dripso/"]')?.remove();

  if (!isHomeRoute()) {
    removeQuickLaunch();
    return;
  }

  let button = document.getElementById(BUTTON_ID);
  let panel = document.getElementById(PANEL_ID);
  if (!button) {
    button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'dripso-quick-launch';
    button.setAttribute('aria-controls', PANEL_ID);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '드립소 안내 열기');

    const mark = document.createElement('span');
    mark.className = 'dripso-quick-launch-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = 'ㅋ';
    const label = document.createElement('span');
    label.textContent = '드립소';
    button.append(mark, label);
    document.body.append(button);
  }

  if (!panel) {
    panel = createPanel();
    document.body.append(panel);
  }

  if (!button.dataset.bound) {
    button.dataset.bound = 'true';
    button.addEventListener('click', event => {
      event.stopPropagation();
      setExpanded(button, panel, panel.hidden);
    });
  }
}

let scheduled = false;
function scheduleEnsure() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    ensureQuickLaunch();
  });
}

document.addEventListener('click', event => {
  const button = document.getElementById(BUTTON_ID);
  const panel = document.getElementById(PANEL_ID);
  if (!button || !panel || panel.hidden) return;
  if (button.contains(event.target) || panel.contains(event.target)) return;
  setExpanded(button, panel, false);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const button = document.getElementById(BUTTON_ID);
  const panel = document.getElementById(PANEL_ID);
  if (!button || !panel || panel.hidden) return;
  setExpanded(button, panel, false);
  button.focus();
});

new MutationObserver(scheduleEnsure).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleEnsure);
window.addEventListener('pageshow', scheduleEnsure);
ensureQuickLaunch();
