import { initAuth, trackEvent, trackUser, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderHome } from './pages/home.js';
import { renderAiHunt } from './pages/ai-hunt.js';
import { renderAiHuntPlay } from './pages/ai-hunt-play.js';
import { renderAiHuntResult } from './pages/ai-hunt-result.js';
import { renderPolicy } from './pages/policy-ai-hunt.js';
import { renderGuide } from './pages/guide.js';
import { renderFeedback } from './pages/feedback.js';
import { renderAuth } from './pages/auth.js';
import { renderFooter } from './components/footer.js';
import { initTheme } from './components/theme.js';
import { renderNav } from './components/nav.js';

const LEGACY_ROUTES = [
  '#/town', '#/case-quest', '#/topics', '#/submit-topic', '#/court', '#/my-history'
];

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
  } else if (hash === '#/hunt') {
    pageName = 'ai_hunt_start';
    renderAiHunt(content);
  } else if (hash === '#/hunt/play') {
    pageName = 'ai_hunt_play';
    renderAiHuntPlay(content);
  } else if (hash === '#/hunt/result') {
    pageName = 'ai_hunt_result';
    renderAiHuntResult(content);
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
  } else if (LEGACY_ROUTES.includes(hash) || hash.startsWith('#/topic/') || hash.startsWith('#/debate/') || hash.startsWith('#/join/') || hash.startsWith('#/join-team/')) {
    pageName = 'legacy_redirect';
    location.hash = '#/hunt';
    return;
  } else {
    renderHome(content);
  }

  trackEvent('page_view', { page_name: pageName, page_path: hash });
  renderNav();
}

window.addEventListener('hashchange', route);

window._pwaPromptEvent = null;
if (typeof window._pwaInstall !== 'function') {
  window._pwaInstall = async () => {
    const promptEvent = window._pwaPromptEvent;
    if (!promptEvent) {
      alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.');
      return;
    }
    promptEvent.prompt();
    try { await promptEvent.userChoice; } catch {}
    window._pwaPromptEvent = null;
    document.dispatchEvent(new Event('pwa-installed'));
  };
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._pwaPromptEvent = e;
  document.dispatchEvent(new Event('pwa-installable'));
});
window.addEventListener('appinstalled', () => {
  window._pwaPromptEvent = null;
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
