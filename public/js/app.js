import { initAuth } from './firebase.js';
import { renderHome } from './pages/home.js';
import { renderTopics } from './pages/topics.js';
import { renderTopicDetail } from './pages/topic-detail.js';
import { renderDebate } from './pages/debate.js';
import { renderSubmitTopic } from './pages/submit-topic.js';
import { renderMyHistory } from './pages/my-history.js';
import { renderPolicy } from './pages/policy.js';
import { renderGuide } from './pages/guide.js';
import { renderFeedback } from './pages/feedback.js';
import { renderFooter } from './components/footer.js';
import { initTheme, renderThemeToggle } from './components/theme.js';
import { renderNav } from './components/nav.js';

function route() {
  if (window._pageCleanup) { window._pageCleanup(); window._pageCleanup = null; }

  const hash = location.hash || '#/';
  const content = document.getElementById('page-content');
  if (!content) return;
  window.scrollTo(0, 0);

  if (hash === '#/' || hash === '' || hash === '#') {
    renderHome(content);
  } else if (hash === '#/topics') {
    renderTopics(content);
  } else if (hash.startsWith('#/topic/')) {
    renderTopicDetail(content, decodeURIComponent(hash.replace('#/topic/', '')));
  } else if (hash.startsWith('#/debate/')) {
    renderDebate(content, decodeURIComponent(hash.replace('#/debate/', '')));
  } else if (hash.startsWith('#/join/')) {
    renderDebate(content, null, decodeURIComponent(hash.replace('#/join/', '')));
  } else if (hash === '#/submit-topic') {
    renderSubmitTopic(content);
  } else if (hash === '#/my-history') {
    renderMyHistory(content);
  } else if (hash.startsWith('#/policy/')) {
    renderPolicy(content, hash.replace('#/policy/', ''));
  } else if (hash === '#/guide') {
    renderGuide(content);
  } else if (hash === '#/feedback') {
    renderFeedback(content);
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
