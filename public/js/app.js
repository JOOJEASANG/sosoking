import { initAuth, trackEvent, trackUser, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderPredictHome } from './pages/predict-home.js';
import { renderPredictList, renderPredictDetail } from './pages/predict-board.js';
import { renderPredictRanking } from './pages/predict-ranking.js';
import { renderPredictHistory } from './pages/predict-history.js';
import { renderSosoFeed } from './pages/soso-feed.js';
import { renderPredictGuide } from './pages/predict-guide.js';
import { renderPredictPolicy } from './pages/predict-policy.js';
import { renderFeedback } from './pages/feedback.js';
import { renderAuth } from './pages/auth.js';
import { renderFooter } from './components/footer.js';
import { initTheme } from './components/theme.js';
import { renderNav } from './components/nav.js';

const LEGACY_PREFIXES = ['#/hunt', '#/topic/', '#/debate/', '#/join/', '#/join-team/'];
const LEGACY_ROUTES = ['#/town', '#/case-quest', '#/topics', '#/submit-topic', '#/court', '#/my-history'];

function loadPolishStyle() {
  [
    ['sosoking-polish-style','/css/predict-polish.css'],
    ['sosoking-detail-polish-style','/css/predict-detail-polish.css'],
    ['sosoking-layout-comfort-style','/css/layout-comfort.css']
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
  window.scrollTo(0, 0);
  content.classList.remove('page-entering'); void content.offsetWidth; content.classList.add('page-entering');
  let pageName = 'home';
  if (hash === '#/' || hash === '' || hash === '#') renderPredictHome(content);
  else if (hash === '#/predict') { pageName = 'predict_list'; renderPredictList(content); }
  else if (hash.startsWith('#/predict/')) { pageName = 'predict_detail'; renderPredictDetail(content, decodeURIComponent(hash.replace('#/predict/', ''))); }
  else if (hash === '#/feed' || hash === '#/feed/top' || hash === '#/feed/new') { pageName = 'soso_feed'; renderSosoFeed(content); }
  else if (hash === '#/ranking') { pageName = 'ranking'; renderPredictRanking(content); }
  else if (hash === '#/history') { pageName = 'history'; renderPredictHistory(content); }
  else if (hash.startsWith('#/policy/')) { pageName = 'policy_' + hash.replace('#/policy/', ''); renderPredictPolicy(content, hash.replace('#/policy/', '')); }
  else if (hash === '#/guide') { pageName = 'guide'; renderPredictGuide(content); }
  else if (hash === '#/feedback') { pageName = 'feedback'; renderFeedback(content); }
  else if (hash === '#/login') { pageName = 'login'; renderAuth(content); }
  else if (LEGACY_ROUTES.includes(hash) || LEGACY_PREFIXES.some(prefix => hash.startsWith(prefix))) { pageName = 'legacy_redirect'; location.hash = '#/'; return; }
  else renderPredictHome(content);
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
