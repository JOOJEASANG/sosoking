import { auth, db } from './firebase.js';
import { appState } from './state.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

async function renderPoints() {
  if (!auth.currentUser || !isAccountPage()) return;
  const page = document.querySelector('.account-profile-card .account-stats');
  if (!page || page.dataset.pointsReady === '1') return;
  page.dataset.pointsReady = '1';
  const snap = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null);
  const data = snap?.exists?.() ? snap.data() : {};
  const points = Number(data.points || data.totalPoints || 0);
  page.insertAdjacentHTML('beforeend', `
    <div class="account-stat account-stat--points">
      <div class="account-stat__num">${formatPoint(points)}</div>
      <div class="account-stat__label">포인트</div>
    </div>`);
}

function runAccountUi() {
  ensureAccountInstallButton();
  renderPoints();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runAccountUi, 180);
}

window.addEventListener('beforeinstallprompt', schedule);
window.addEventListener('appinstalled', () => {
  removeAccountInstallButtons();
  schedule();
});
window.addEventListener('hashchange', schedule);
window.addEventListener('themechange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(runAccountUi, 500);
