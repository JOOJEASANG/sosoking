import { initAuth, trackEvent, trackUser, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderSosoHome } from './pages/soso-home.js';
import { renderSosoFeed } from './pages/soso-feed-v2.js';
import { renderMission } from './pages/mission.js';
import { renderGuide } from './pages/guide.js';
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
let authReady = false;

function shouldRedirectToFeed(hash) { return SOSO_FEED_REDIRECT_PREFIXES.some(route => hash === route || hash.startsWith(`${route}/`)); }
function redirectToFeed() { history.replaceState(null, '', `${location.pathname}${location.search}#/feed`); route(); }

function loadSosoStyles() {
  [
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

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    registration.update?.();
  } catch (error) {
    console.warn('서비스워커 등록 실패:', error);
  }
}

function updatePwaInstallButton() {
  let button = document.getElementById('soso-pwa-install-fab');
  if (!button) {
    button = document.createElement('button');
    button.id = 'soso-pwa-install-fab';
    button.type = 'button';
    button.innerHTML = '📲 앱 설치';
    button.addEventListener('click', () => {
      if (typeof window._pwaInstall === 'function') window._pwaInstall();
      else alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.');
    });
    document.body.appendChild(button);
  }
  const installed = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone;
  button.classList.toggle('show', Boolean(window._pwaPromptEvent && !installed));
}

function route() {
  if (window._pageCleanup) { window._pageCleanup(); window._pageCleanup = null; }
  const hash = location.hash || '#/';
  const content = document.getElementById('page-content');
  if (!content) return;
  if (hash === '#/games') { location.hash = '#/mission'; return; }
  if (shouldRedirectToFeed(hash)) { redirectToFeed(); return; }
  window.scrollTo(0, 0);
  content.classList.remove('page-entering');
  void content.offsetWidth;
  content.classList.add('page-entering');
  let pageName = 'home';
  try {
    if (hash === '#/' || hash === '' || hash === '#') renderSosoHome(content);
    else if (hash === '#/mission') { pageName = 'mission'; renderMission(content); }
    else if (hash === '#/feed' || hash === '#/feed/top' || hash === '#/feed/new' || hash.startsWith('#/feed/')) { pageName = hash.startsWith('#/feed/') && !['#/feed/top','#/feed/new'].includes(hash) ? 'soso_feed_detail' : 'soso_feed'; renderSosoFeed(content); }
    else if (hash === '#/account') { pageName = 'account'; renderAccount(content); }
    else if (hash.startsWith('#/policy/')) { pageName = 'policy_' + hash.replace('#/policy/', ''); renderPredictPolicy(content, hash.replace('#/policy/', '')); }
    else if (hash === '#/guide') { pageName = 'guide'; renderGuide(content); }
    else if (hash === '#/feedback') { pageName = 'feedback'; renderFeedback(content); }
    else if (hash === '#/login') { pageName = 'login'; renderAuth(content); }
    else if (LEGACY_ROUTES.includes(hash) || LEGACY_PREFIXES.some(prefix => hash.startsWith(prefix))) { pageName = 'legacy_redirect'; location.hash = '#/'; return; }
    else renderSosoHome(content);
    trackEvent('page_view', { page_name: pageName, page_path: hash });
    renderNav();
    updatePwaInstallButton();
  } catch (error) {
    console.error('화면 렌더링 실패:', error);
    renderFallback(content, error);
    updatePwaInstallButton();
  }
}

function renderFallback(content, error) {
  content.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;font-family:'Noto Sans KR',system-ui,sans-serif;background:#f5f7fb;color:#121724;">
      <section style="max-width:420px;width:100%;padding:26px;border-radius:28px;background:#fff;box-shadow:0 18px 60px rgba(55,90,170,.14);text-align:center;">
        <img src="/logo.svg" alt="소소킹" style="width:72px;height:72px;border-radius:22px;margin-bottom:14px;">
        <h1 style="margin:0 0 8px;font-size:24px;letter-spacing:-.04em;">소소킹을 불러오지 못했습니다</h1>
        <p style="margin:0 0 16px;color:#697386;line-height:1.65;font-size:14px;">새로고침 후에도 계속 보이면 잠시 후 다시 접속해주세요.</p>
        <a href="#/" onclick="location.reload()" style="display:inline-flex;justify-content:center;border-radius:16px;padding:12px 18px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;text-decoration:none;font-weight:900;">다시 불러오기</a>
        <small style="display:block;margin-top:12px;color:#9aa4b5;word-break:break-all;">${String(error?.message || '').slice(0, 120)}</small>
      </section>
    </main>`;
}

window.addEventListener('hashchange', route);
window.addEventListener('error', event => { const content = document.getElementById('page-content'); if (content && !content.innerHTML.trim()) renderFallback(content, event.error || event.message); });
window.addEventListener('unhandledrejection', event => { const content = document.getElementById('page-content'); if (content && !content.innerHTML.trim()) renderFallback(content, event.reason || event); });

window._pwaPromptEvent = null;
if (typeof window._pwaInstall !== 'function') {
  window._pwaInstall = async () => {
    const promptEvent = window._pwaPromptEvent;
    if (!promptEvent) { alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.'); return; }
    promptEvent.prompt();
    try { await promptEvent.userChoice; } catch {}
    window._pwaPromptEvent = null;
    updatePwaInstallButton();
    document.dispatchEvent(new Event('pwa-installed'));
  };
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._pwaPromptEvent = e; updatePwaInstallButton(); document.dispatchEvent(new Event('pwa-installable')); });
window.addEventListener('appinstalled', () => { window._pwaPromptEvent = null; updatePwaInstallButton(); document.dispatchEvent(new Event('pwa-installed')); });
document.addEventListener('visibilitychange', updatePwaInstallButton);

async function injectSeoMeta() {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    if (!snap.exists()) return;
    const seo = snap.data().seoVerification || {};
    if (seo.google) { const meta = document.createElement('meta'); meta.name = 'google-site-verification'; meta.content = seo.google; document.head.appendChild(meta); }
    if (seo.naver) { const meta = document.createElement('meta'); meta.name = 'naver-site-verification'; meta.content = seo.naver; document.head.appendChild(meta); }
  } catch {}
}

function boot() {
  try { initTheme(); } catch (error) { console.warn('테마 초기화 실패:', error); }
  try { loadSosoStyles(); } catch (error) { console.warn('스타일 로드 실패:', error); }
  registerServiceWorker();
  try { renderFooter(); } catch (error) { console.warn('푸터 렌더링 실패:', error); }
  updatePwaInstallButton();
  route();
  injectSeoMeta();
  initAuth().then(user => {
    authReady = true;
    if (user?.uid) trackUser(user.uid);
    renderNav();
    updatePwaInstallButton();
  }).catch(error => {
    authReady = true;
    console.warn('인증 초기화 실패:', error);
    renderNav();
    updatePwaInstallButton();
  });
}

boot();
