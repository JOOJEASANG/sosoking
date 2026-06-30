import { initAuth } from './firebase.js?v=20260630-3';
import { renderHome } from './pages/home.js?v=20260630-3';
import { renderSubmit } from './pages/submit.js?v=20260630-8';
import { renderTrial } from './pages/trial.js?v=20260630-3';
import { renderResult } from './pages/result.js?v=20260630-7';
import { renderPolicy } from './pages/policy.js?v=20260630-3';
import { renderMyCases } from './pages/my-cases.js?v=20260630-9';
import { renderGuide } from './pages/guide.js?v=20260630-3';
import { renderAuth } from './pages/auth.js?v=20260630-7';
import { renderBoard } from './pages/board.js?v=20260630-6';
import { renderFooter } from './components/footer.js?v=20260630-3';
import { initTheme, renderThemeToggle } from './components/theme.js?v=20260630-10';
import { renderNav } from './components/nav.js?v=20260630-8';

function route() {
  if (window._pageCleanup) { window._pageCleanup(); window._pageCleanup = null; }

  const hash = location.hash || '#/';
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
  } else if (hash === '#/board') {
    renderBoard(content);
  } else {
    renderHome(content);
  }

  renderNav();
  renderThemeToggle();
}

window.addEventListener('hashchange', route);

(async () => {
  initTheme();
  await initAuth();
  renderFooter();
  route();
})();
