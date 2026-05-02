import { initAuth, trackEvent, trackUser, auth, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderHome } from './pages/home.js';
import { renderTopics } from './pages/topics.js';
import { renderTopicDetail } from './pages/topic-detail.js';
import { renderDebate } from './pages/debate.js';
import { renderSubmitTopic } from './pages/submit-topic.js';
import { renderCourt } from './pages/court.js';
import { renderMyHistory } from './pages/my-history.js';
import { renderPolicy } from './pages/policy.js';
import { renderGuide } from './pages/guide.js';
import { renderFeedback } from './pages/feedback.js';
import { renderAuth } from './pages/auth.js';
import { renderJoinTeam } from './pages/join-team.js';
import { renderFooter } from './components/footer.js';
import { initTheme } from './components/theme.js';
import { renderNav } from './components/nav.js';

function route() {
  if (window._pageCleanup) { window._pageCleanup(); window._pageCleanup = null; }

  const hash = location.hash || '#/';
  const content = document.getElementById('page-content');
  if (!content) return;
  window.scrollTo(0, 0);

  content.classList.remove('page-entering');
  void content.offsetWidth;
  content.classList.add('page-entering');

  let pageName = 'home';
  if (hash === '#/' || hash === '' || hash === '#') {
    renderHome(content);
  } else if (hash === '#/topics') {
    pageName = 'topics';
    renderTopics(content);
  } else if (hash.startsWith('#/topic/')) {
    pageName = 'topic_detail';
    renderTopicDetail(content, decodeURIComponent(hash.replace('#/topic/', '')));
  } else if (hash.startsWith('#/debate/')) {
    pageName = 'debate';
    renderDebate(content, decodeURIComponent(hash.replace('#/debate/', '')));
  } else if (hash.startsWith('#/join-team/')) {
    pageName = 'join_team';
    const parts = hash.replace('#/join-team/', '').split('/');
    renderJoinTeam(content, decodeURIComponent(parts[0]), parts[1] || 'plaintiff');
  } else if (hash.startsWith('#/join/')) {
    pageName = 'debate_join';
    renderDebate(content, null, decodeURIComponent(hash.replace('#/join/', '')));
  } else if (hash === '#/court') {
    pageName = 'court';
    renderCourt(content);
  } else if (hash === '#/submit-topic') {
    pageName = 'submit_topic';
    renderSubmitTopic(content);
  } else if (hash === '#/my-history') {
    pageName = 'my_history';
    renderMyHistory(content);
  } else if (hash.startsWith('#/policy/')) {
    pageName = 'policy_' + hash.replace('#/policy/', '');
    renderPolicy(content, hash.replace('#/policy/', ''));
  } else if (hash === '#/guide') {
    pageName = 'guide';
    renderGuide(content);
  } else if (hash === '#/feedback') {
    pageName = 'feedback';
    renderFeedback(content);
  } else if (hash === '#/login') {
    pageName = 'login';
    renderAuth(content);
  } else {
    renderHome(content);
  }

  trackEvent('page_view', { page_name: pageName, page_path: hash });
  renderNav();
}

window.addEventListener('hashchange', route);

// PWA 설치 프롬프트 캡처
window._pwaInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._pwaInstall = e;
  document.dispatchEvent(new Event('pwa-installable'));
});
window.addEventListener('appinstalled', () => {
  window._pwaInstall = null;
  document.dispatchEvent(new Event('pwa-installed'));
});

async function injectSeoMeta() {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    if (!snap.exists()) return;
    const seo = snap.data().seoVerification || {};
    if (seo.google) {
      const m = document.createElement('meta');
      m.name = 'google-site-verification';
      m.content = seo.google;
      document.head.appendChild(m);
    }
    if (seo.naver) {
      const m = document.createElement('meta');
      m.name = 'naver-site-verification';
      m.content = seo.naver;
      document.head.appendChild(m);
    }
  } catch {}
}

(async () => {
  initTheme();
  injectSeoMeta();
  const user = await initAuth();
  if (user?.uid) trackUser(user.uid);
  renderFooter();
  route();
})();
