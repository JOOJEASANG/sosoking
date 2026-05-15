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
import './feed/crazy-naming-patch.js';
import './account-delete-server-patch.js';
import './account-nickname-server-patch.js';
import './home-pc-mobile-final-patch.js';

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
    ['sosoking-doc-footer-style','/css/sosoking-doc-footer.css'],
    ['sosoking-v3-design-style','/css/sosoking-v3-design.css?v=20260515-7']
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

function injectDesktopHeaderStyle() {
  if (document.getElementById('sosoking-dashboard-header-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-dashboard-header-style';
  style.textContent = `
    @media(min-width:901px){body{padding-top:78px!important}.soso-dashboard-header{display:flex!important}}
    .soso-dashboard-header{display:none;position:fixed;left:0;right:0;top:0;height:78px;z-index:520;align-items:center;gap:26px;padding:10px 34px;border-bottom:1px solid rgba(79,124,255,.12);background:rgba(255,255,255,.91);box-shadow:0 10px 34px rgba(25,35,70,.09);backdrop-filter:blur(22px) saturate(1.25);-webkit-backdrop-filter:blur(22px) saturate(1.25)}
    .soso-top-brand{display:flex;align-items:center;gap:12px;min-width:230px;color:#10172f;text-decoration:none}.soso-top-brand img{width:55px;height:55px;border-radius:19px;background:#fff;box-shadow:0 12px 30px rgba(79,124,255,.18);transform:rotate(-6deg)}.soso-top-brand b{display:block;font-size:29px;line-height:1;font-weight:1000;letter-spacing:-.08em}.soso-top-brand span{display:block;margin-top:4px;color:#6b7280;font-size:11px;font-weight:1000;letter-spacing:-.04em}.soso-top-links{display:flex;align-items:center;gap:8px;justify-content:center;flex:1}.soso-top-links a{position:relative;padding:13px 16px;border-radius:16px;color:#171e3b;text-decoration:none;font-size:15px;font-weight:1000;letter-spacing:-.04em}.soso-top-links a:hover{background:rgba(79,124,255,.08)}.soso-top-links a.active{color:#6d38ff}.soso-top-links a.active:after{content:'';position:absolute;left:18px;right:18px;bottom:6px;height:3px;border-radius:999px;background:linear-gradient(90deg,#7c5cff,#ff5c8a)}.soso-top-tools{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:410px}.soso-top-search{display:flex;align-items:center;gap:8px;width:238px;height:46px;padding:0 12px;border:1px solid rgba(79,124,255,.14);border-radius:999px;background:#fff;box-shadow:0 8px 22px rgba(55,90,170,.06)}.soso-top-search input{width:100%;border:0;outline:0;background:transparent;color:#151a33;font-family:inherit;font-weight:800}.soso-top-search button{border:0;background:transparent;font-size:18px;cursor:pointer}.soso-top-install{height:46px;border:0;border-radius:999px;padding:0 18px;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff;font-weight:1000;font-family:inherit;box-shadow:0 14px 34px rgba(255,92,138,.24);cursor:pointer;white-space:nowrap}.soso-top-avatar{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#151a33;cursor:pointer}.soso-top-avatar i{font-style:normal;width:45px;height:45px;border-radius:999px;background:linear-gradient(135deg,#ffe85c,#ff9f43,#7c5cff);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 12px 28px rgba(55,90,170,.12)}.soso-top-avatar span{font-size:18px;color:#6d7588}
    @media(max-width:1160px){.soso-dashboard-header{gap:14px;padding-left:18px;padding-right:18px}.soso-top-brand{min-width:185px}.soso-top-brand b{font-size:24px}.soso-top-tools{min-width:320px}.soso-top-search{width:180px}.soso-top-links a{padding:12px 10px}}
    @media(max-width:900px){.soso-dashboard-header{display:none!important}body{padding-top:0!important}}
    [data-theme="dark"] .soso-dashboard-header{border-color:rgba(255,255,255,.10);background:rgba(10,15,26,.9);box-shadow:0 12px 40px rgba(0,0,0,.28)}[data-theme="dark"] .soso-top-brand,[data-theme="dark"] .soso-top-links a,[data-theme="dark"] .soso-top-avatar{color:#f5f7fb}[data-theme="dark"] .soso-top-search{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12)}[data-theme="dark"] .soso-top-search input{color:#fff}
  `;
  document.head.appendChild(style);
}

function renderDesktopHeader() {
  injectDesktopHeaderStyle();
  document.getElementById('soso-dashboard-header')?.remove();
  const hash = location.hash || '#/';
  const active = (path) => path === '#/' ? (hash === '#/' || hash === '#' || hash === '') : (hash === path || (path === '#/feed' && (hash === '#/feed/top' || (hash.startsWith('#/feed/') && hash !== '#/feed/new'))));
  const header = document.createElement('header');
  header.id = 'soso-dashboard-header';
  header.className = 'soso-dashboard-header';
  header.innerHTML = `
    <a class="soso-top-brand" href="#/"><img src="/logo.svg" alt="소소킹"><div><b>소소킹</b><span>즐거운 커뮤니티의 왕!</span></div></a>
    <nav class="soso-top-links">
      <a href="#/" class="${active('#/') ? 'active' : ''}">홈</a>
      <a href="#/feed" class="${active('#/feed') ? 'active' : ''}">피드</a>
      <a href="#/feed/new" class="${active('#/feed/new') ? 'active' : ''}">만들기</a>
      <a href="#/mission" class="${active('#/mission') ? 'active' : ''}">미션</a>
      <a href="#/account" class="${active('#/account') ? 'active' : ''}">내정보</a>
    </nav>
    <div class="soso-top-tools">
      <form class="soso-top-search" id="soso-top-search"><input id="soso-top-search-input" placeholder="검색어를 입력하세요"><button type="submit">⌕</button></form>
      <button class="soso-top-install" id="soso-top-install" type="button">📥 앱 설치하기</button>
      <button class="soso-top-avatar" type="button" onclick="location.hash='#/account'"><i>🧑</i><span>⌄</span></button>
    </div>`;
  document.body.appendChild(header);
  header.querySelector('#soso-top-install')?.addEventListener('click', () => { if (typeof window._pwaInstall === 'function') window._pwaInstall(); else alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.'); });
  header.querySelector('#soso-top-search')?.addEventListener('submit', event => { event.preventDefault(); const q = header.querySelector('#soso-top-search-input')?.value.trim() || ''; if (q) sessionStorage.setItem('sosoFeedSearch', q); location.hash = '#/feed'; });
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
    renderDesktopHeader();
    renderNav();
    updatePwaInstallButton();
  } catch (error) {
    console.error('화면 렌더링 실패:', error);
    renderFallback(content, error);
    renderDesktopHeader();
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
    renderDesktopHeader();
    renderNav();
    updatePwaInstallButton();
  }).catch(error => {
    authReady = true;
    console.warn('인증 초기화 실패:', error);
    renderDesktopHeader();
    renderNav();
    updatePwaInstallButton();
  });
}

boot();