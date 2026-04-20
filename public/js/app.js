import { initAuth } from './firebase.js';
import { renderHome } from './pages/home.js';
import { renderSubmit } from './pages/submit.js';
import { renderTrial } from './pages/trial.js';
import { renderResult } from './pages/result.js';
import { renderPolicy } from './pages/policy.js';
import { renderMyCases } from './pages/my-cases.js';
import { renderGuide } from './pages/guide.js';
import { renderFooter } from './components/footer.js';
import { initTheme, renderThemeToggle } from './components/theme.js';
import { renderNav } from './components/nav.js';

function route() {
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
  } else {
    renderHome(content);
  }

  renderNav();
}

window.addEventListener('hashchange', route);

(async () => {
  initTheme();
  await initAuth();
  renderFooter();
  renderThemeToggle();
  route();
})();
