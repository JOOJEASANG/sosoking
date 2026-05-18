import { appState } from './state.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isAccountPage() {
  return (window.location.hash.slice(1).split('?')[0] || '/') === '/account';
}

function removeAccountInstallButtons() {
  document.querySelectorAll('[data-account-install-button]').forEach(el => el.remove());
}

function openInstallPrompt() {
  const prompt = appState.installPrompt;
  if (!prompt) return;
  prompt.prompt();
  prompt.userChoice.then(({ outcome }) => {
    if (outcome === 'accepted') {
      appState.installPrompt = null;
      removeAccountInstallButtons();
    }
  }).catch(() => {});
}

function ensureAccountInstallButton() {
  if (!isAccountPage()) return;

  const logoutBtn = document.getElementById('btn-logout');
  if (!logoutBtn) return;

  const footer = logoutBtn.closest('.card__footer');
  if (!footer) return;

  footer.classList.add('account-action-footer');

  if (!appState.installPrompt || isStandalone()) {
    removeAccountInstallButtons();
    return;
  }

  if (footer.querySelector('[data-account-install-button]')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--primary btn--sm account-install-btn';
  btn.dataset.accountInstallButton = 'true';
  btn.innerHTML = '📲 앱 설치';
  btn.addEventListener('click', openInstallPrompt);

  logoutBtn.insertAdjacentElement('afterend', btn);
}

function install() {
  ensureAccountInstallButton();
}

window.addEventListener('beforeinstallprompt', () => setTimeout(install, 0));
window.addEventListener('appinstalled', removeAccountInstallButtons);
window.addEventListener('hashchange', () => setTimeout(install, 80));
window.addEventListener('themechange', () => setTimeout(install, 80));

new MutationObserver(() => install()).observe(document.documentElement, { childList: true, subtree: true });

setTimeout(install, 0);
