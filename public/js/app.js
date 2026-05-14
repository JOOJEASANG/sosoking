import { initAuth, trackEvent, trackUser, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderSosoHome } from './pages/soso-home.js';
import { renderSosoFeed } from './pages/soso-feed-v2.js';
import { renderPredictGuide } from './pages/predict-guide.js';
import { renderPredictPolicy } from './pages/predict-policy.js';
import { renderFeedback } from './pages/feedback.js';
import { renderAuth } from './pages/auth.js';
import { renderAccount } from './pages/account.js';
import { renderFooter } from './components/footer.js';
import { initTheme } from './components/theme.js';
import { renderNav } from './components/nav.js';

const LEGACY_PREFIXES = ['#/hunt', '#/topic/', '#/debate/', '#/join/', '#/join-team/'];
const LEGACY_ROUTES = ['#/town', '#/case-quest', '#/topics', '#/submit-topic', '#/court', '#/my-history'];
const SOSO_FEED_REDIRECT_PREFIXES = ['#/predict', '#/ranking', '#/history'];

function shouldRedirectToFeed(hash) {
  return SOSO_FEED_REDIRECT_PREFIXES.some(route => hash === route || hash.startsWith(`${route}/`));
}

function redirectToFeed() {
  history.replaceState(null, '', `${location.pathname}${location.search}#/feed`);
  route();
}

function loadPolishStyle() {
  [
    ['sosoking-polish-style','/css/predict-polish.css'],
    ['sosoking-detail-polish-style','/css/predict-detail-polish.css'],
    ['sosoking-layout-comfort-style','/css/layout-comfort.css'],
    ['sosoking-feed-style','/css/soso-feed.css'],
    ['sosoking-design-refresh-style','/css/sosoking-design-refresh.css'],
    ['sosoking-polish-v2-style','/css/sosoking-polish-v2.css'],
    ['sosoking-doc-footer-style','/css/sosoking-doc-footer.css']
  ].forEach(([id, href]) => {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  });
}

function route() {
  if (window._pageCleanup) { window._pageCleanup(); window._pageCleanup = null; }
  const hash = location.hash || '#/';
  const content = document.getElementById('page-content');
  if (!content) return;
  if (shouldRedirectToFeed(hash)) { redirectToFeed(); return; }
  window.scrollTo(0, 0);
  content.classList.remove('page-entering'); void content.offsetWidth; content.classList.add('page-entering');
  let pageName = 'home';
  if (hash === '#/' || hash === '' || hash === '#') renderSosoHome(content);
  else if (hash === '#/feed' || hash === '#/feed/top' || hash === '#/feed/new' || hash.startsWith('#/feed/')) { pageName = hash.startsWith('#/feed/') && !['#/feed/top','#/feed/new'].includes(hash) ? 'soso_feed_detail' : 'soso_feed'; renderSosoFeed(content); }
  else if (hash === '#/account') { pageName = 'account'; renderAccount(content); }
  else if (hash.startsWith('#/policy/')) { pageName = 'policy_' + hash.replace('#/policy/', ''); renderPredictPolicy(content, hash.replace('#/policy/', '')); }
  else if (hash === '#/guide') { pageName = 'guide'; renderPredictGuide(content); }
  else if (hash === '#/feedback') { pageName = 'feedback'; renderFeedback(content); }
  else if (hash === '#/login') { pageName = 'login'; renderAuth(content); }
  else if (LEGACY_ROUTES.includes(hash) || LEGACY_PREFIXES.some(prefix => hash.startsWith(prefix))) { pageName = 'legacy_redirect'; location.hash = '#/'; return; }
  else renderSosoHome(content);
  trackEvent('page_view', { page_name: pageName, page_path: hash });
  renderNav();
}

window.addEventListener('hashchange', route);
window._pwaPromptEvent = null;
if (typeof window._pwaInstall !== 'function') {
  window._pwaInstall = async () => {
    const promptEvent = window._pwaPromptEvent;
    if (!promptEvent) { alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.'); return; }
    promptEvent.prompt();
    try { await promptEvent.userChoice; } catch {}
    window._pwaPromptEvent = null;
    document.dispatchEvent(new Event('pwa-installed'));
  };
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._pwaPromptEvent = e; document.dispatchEvent(new Event('pwa-installable')); });
window.addEventListener('appinstalled', () => { window._pwaPromptEvent = null; document.dispatchEvent(new Event('pwa-installed')); });

async function injectSeoMeta() {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    if (!snap.exists()) return;
    const seo = snap.data().seoVerification || {};
    if (seo.google) { const m = document.createElement('meta'); m.name = 'google-site-verification'; m.content = seo.google; document.head.appendChild(m); }
    if (seo.naver) { const m = document.createElement('meta'); m.name = 'naver-site-verification'; m.content = seo.naver; document.head.appendChild(m); }
  } catch {}
}
(async () => { initTheme(); loadPolishStyle(); injectSeoMeta(); const user = await initAuth(); if (user?.uid) trackUser(user.uid); renderFooter(); route(); })();
