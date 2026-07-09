import { initAuth } from './firebase.js?v=20260708-1';
import './components/seed-case-prefill.js?v=20260707-2';
import { initSessionTimeout } from './components/session-timeout.js?v=20260707-1';
import { renderHome } from './pages/home-court.js?v=20260708-homecase2';
import { renderSubmit } from './pages/submit-guard.js?v=20260709-privacy1';
import { renderTrial } from './pages/trial-game.js?v=20260708-serious1';
import { renderResult } from './pages/result-court.js?v=20260709-storage1';
import { renderPolicy } from './pages/policy.js?v=20260708-policy1';
import { renderMyCases } from './pages/my-cases-game.js?v=20260708-delete2';
import { renderGuide } from './pages/guide.js?v=20260708-policy1';
import { renderAuth } from './pages/auth.js?v=20260708-4';
import { renderAbsurdCases } from './pages/absurd-cases.js?v=20260707-4';
import { renderBoard } from './pages/board-court.js?v=20260709-board1';
import { renderFooter } from './components/footer.js?v=20260707-3';
import { initTheme, renderThemeToggle } from './components/theme.js?v=20260708-4';
import { initCourtDesign } from './components/court-design.js?v=20260707-1';
import { renderNav } from './components/nav.js?v=20260707-4';
import { applyEmojiCompat, startEmojiCompatObserver } from './components/emoji-compat.js?v=20260708-3';

function normalizedRoute() {
  const hash = location.hash || '';
  if (hash === '#/' || hash === '' || hash === '#') {
    const path = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/') return '#/';
    if (path === '/absurd-cases') return '#/absurd-cases';
    if (path === '/board') return '#/board';
    if (path === '/submit') return '#/submit';
    if (path === '/guide') return '#/guide';
    if (path === '/auth') return '#/auth';
    if (path === '/my-cases') return '#/my-cases';
    if (path.startsWith('/result/')) return `#/result/${encodeURIComponent(decodeURIComponent(path.replace('/result/', '')))}`;
    if (path.startsWith('/trial/')) return `#/trial/${encodeURIComponent(decodeURIComponent(path.replace('/trial/', '')))}`;
  }
  return hash || '#/';
}

function showThemeToggleSoon() {
  renderThemeToggle();
  setTimeout(renderThemeToggle, 120);
  setTimeout(renderThemeToggle, 900);
}

function applyEmojiCompatSoon() {
  const content = document.getElementById('page-content');
  applyEmojiCompat(content || document.body);
  startEmojiCompatObserver(content || document.body);
  setTimeout(() => applyEmojiCompat(content || document.body), 120);
  setTimeout(() => applyEmojiCompat(content || document.body), 900);
}

function route() {
  if (window._pageCleanup) { window._pageCleanup(); window._pageCleanup = null; }

  const hash = normalizedRoute();
  const content = document.getElementById('page-content');
  if (!content) return;
  window.scrollTo(0, 0);

  if (hash === '#/' || hash === '' || hash === '#') {
    renderHome(content);
  } else if (hash === '#/submit') {
    renderSubmit(content);
  } else if (hash.startsWith('#/trial/')) {
    renderTrial(content, decodeURIComponent(hash.replace('#/trial/', '')));
  } else if (hash.startsWith('#/result/')) {
    renderResult(content, decodeURIComponent(hash.replace('#/result/', '')));
  } else if (hash.startsWith('#/policy/')) {
    renderPolicy(content, hash.replace('#/policy/', ''));
  } else if (hash === '#/my-cases') {
    renderMyCases(content);
  } else if (hash === '#/guide') {
    renderGuide(content);
  } else if (hash === '#/auth') {
    renderAuth(content);
  } else if (hash === '#/absurd-cases') {
    renderAbsurdCases(content);
  } else if (hash === '#/board') {
    renderBoard(content);
  } else {
    renderHome(content);
  }

  renderNav();
  showThemeToggleSoon();
  applyEmojiCompatSoon();
}

window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);

(async () => {
  initTheme();
  initCourtDesign();
  await initAuth();
  initSessionTimeout();
  renderFooter();
  route();
})();
