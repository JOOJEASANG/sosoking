import { appState } from './state.js';
import { navigate } from './router.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function openInstallPrompt() {
  const prompt = appState.installPrompt;
  if (!prompt) return;
  prompt.prompt();
  prompt.userChoice.then(({ outcome }) => {
    if (outcome === 'accepted') {
      appState.installPrompt = null;
      removeInstallButtons();
    }
  }).catch(() => {});
}

function removeInstallButtons() {
  document.querySelectorAll('[data-pwa-install-shortcut]').forEach(el => el.remove());
}

function ensureHeaderInstallButton() {
  if (!appState.installPrompt || isStandalone()) {
    removeInstallButtons();
    return;
  }

  const actions = document.querySelector('.site-header__actions');
  if (!actions || actions.querySelector('[data-pwa-install-shortcut]')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'site-header__icon-btn pwa-install-shortcut';
  btn.dataset.pwaInstallShortcut = 'header';
  btn.title = '앱 설치';
  btn.setAttribute('aria-label', '앱 설치');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
    </svg>`;
  btn.addEventListener('click', openInstallPrompt);
  actions.insertBefore(btn, actions.firstChild);
}

function ensureAdminWriteShortcut() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  if (!nav || nav.querySelector('[data-admin-write-shortcut]')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-menu-item admin-menu-item--write-shortcut';
  btn.dataset.adminWriteShortcut = 'true';
  btn.innerHTML = `
    <span class="admin-menu-item__icon">➕</span>
    <span class="admin-menu-item__label">글쓰기</span>`;
  btn.addEventListener('click', () => navigate('/write'));
  nav.appendChild(btn);
}

function installEnhancements() {
  ensureHeaderInstallButton();
  ensureAdminWriteShortcut();
}

window.addEventListener('beforeinstallprompt', () => setTimeout(installEnhancements, 0));
window.addEventListener('appinstalled', removeInstallButtons);
window.addEventListener('hashchange', () => setTimeout(installEnhancements, 60));
window.addEventListener('themechange', () => setTimeout(installEnhancements, 60));

new MutationObserver(() => installEnhancements()).observe(document.documentElement, { childList: true, subtree: true });

setTimeout(installEnhancements, 0);
