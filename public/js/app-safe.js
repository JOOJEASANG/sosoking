import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast } from './components/toast.js';
import { appState } from './state.js';
import { collection, query, where, getDocs, getDoc, doc, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { appState };

const OWNER_EMAILS = new Set();

const OPTIONAL_MODULES = [
  './secure-interactions-actions.js',
  './account-secure-actions.js',
  './admin-session-guard.js',
  './admin-password-actions.js',
  './admin-post-list-normalizer.js',
  './nickname-icon-actions.js',
  './site-copy-normalizer.js'
];

function loadOptionalModules() {
  OPTIONAL_MODULES.forEach(path => import(path).catch(error => console.warn('[app-safe] optional failed', path, error)));
}

function pageContent() {
  return document.getElementById('page-content');
}

function esc(value) {
  return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function showPageError(title, error) {
  const el = pageContent();
  if (!el) return;
  const msg = error && (error.stack || error.message) ? String(error.stack || error.message) : String(error || '알 수 없는 오류');
  el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">' + esc(title) + '</div><div style="margin-top:10px;font-size:12px;white-space:pre-wrap;text-align:left;max-width:720px;overflow:auto">' + esc(msg) + '</div></div>';
}

async function renderPage(renderer, title) {
  try {
    await renderer();
  } catch (error) {
    console.error('[renderPage failed]', title, error);
    showPageError(title + ' 화면을 불러오지 못했어요', error);
  }
}

async function renderAdminSafe() {
  const module = await import('./pages/admin-safe.js');
  return module.renderAdmin();
}

async function renderAccountSafe() {
  const module = await import('./pages/account.js');
  return module.renderAccount();
}

async function renderWriteSafe() {
  const module = await import('./pages/write.js');
  return module.renderWrite();
}

async function renderDetailSafe(id) {
  const module = await import('./pages/detail.js');
  return module.renderDetail(id);
}

async function renderGuideSafe() {
  const module = await import('./pages/guide.js');
  return module.renderGuide();
}

function renderRemovedGamePage() {
  navigate('/feed');
}

async function registerRoutes() {
  registerRoute('/', async () => renderPage((await import('./pages/home.js')).renderHome, '홈'));
  registerRoute('/feed', async () => renderPage((await import('./pages/feed.js')).renderFeed, '피드'));
  registerRoute('/hall', async () => renderPage((await import('./pages/hall.js')).renderHall, '통계'));
  registerRoute('/account', async () => renderPage(renderAccountSafe, '내 정보'));
  registerRoute('/scraps', async () => renderPage((await import('./pages/scraps.js')).renderScraps, '스크랩'));
  registerRoute('/admin', async () => renderPage(renderAdminSafe, '관리자'));
  registerRoute('/write', async () => renderPage(renderWriteSafe, '글쓰기'));
  registerRoute('/detail/:id', async ({ id }) => renderPage(() => renderDetailSafe(id), '상세'));
  registerRoute('/login', async () => renderPage((await import('./pages/login.js')).renderLogin, '로그인'));
  registerRoute('/guide', async () => renderPage(renderGuideSafe, '이용안내'));
  registerRoute('/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/legal/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/legal/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/sosoland', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/liar', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/liar/:id', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/mafia', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/mafia/:id', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/touch-king', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/touch-king/:id', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/symbol-spy', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/symbol-spy/:id', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/soso-defense', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/soso-code', async () => renderPage(renderRemovedGamePage, '게임'));
  registerRoute('/game/ai-court', async () => renderPage(renderRemovedGamePage, '게임'));
}

async function isStrictAdmin(user) {
  if (!user) return false;
  const email = String(user.email || '').toLowerCase();
  if (OWNER_EMAILS.has(email)) return true;
  try {
    const token = await user.getIdTokenResult?.(false);
    if (token?.claims?.admin || token?.claims?.owner) return true;
  } catch {}
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

async function fetchUserProfile(user) {
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      appState.nickname = data.nickname || user.displayName || user.email?.split('@')[0] || '';
      appState.nicknameIcon = data.nicknameIcon || null;
      appState.points = Number(data.points || data.totalPoints || 0);
    } else {
      appState.nickname = user.displayName || user.email?.split('@')[0] || '';
    }
    appState.isAdmin = await isStrictAdmin(user);
  } catch (error) {
    appState.isAdmin = await isStrictAdmin(user);
    console.warn('[fetchUserProfile]', error);
  }
}

function bindFooterToggle() {
  const toggle = document.getElementById('btn-footer-toggle');
  const body = document.getElementById('footer-body');
  if (!toggle || !body) return;
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.classList.toggle('open', !expanded);
    body.hidden = expanded;
    toggle.lastChild.textContent = expanded ? ' 더보기' : ' 접기';
  });
}

function renderFrame() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="app-shell">
      <aside id="site-sidebar" class="site-sidebar"></aside>
      <div class="app-main site-main">
        <header id="site-header" class="site-header"></header>
        <main id="page-content" class="page-container"></main>
        <footer class="site-footer" id="site-footer">
          <div class="site-footer__body" id="footer-body" hidden>
            <div class="site-footer__inner">
              <div class="site-footer__brand-block">
                <a href="#/" class="site-footer__brand">
                  <img src="/logo.svg" alt="" width="26" height="26">
                  <span>소소킹</span>
                </a>
                <div class="site-footer__tagline">소소하게 보고<br>짧게 참여하는 피드</div>
              </div>
              <div>
                <div class="site-footer__col-title">바로가기</div>
                <div class="site-footer__links">
                  <a href="#/feed">피드</a>
                  <a href="#/write?type=multi">글쓰기</a>
                  <a href="#/guide">이용안내</a>
                </div>
              </div>
              <div>
                <div class="site-footer__col-title">정보</div>
                <div class="site-footer__links">
                  <a href="#/terms">이용약관</a>
                  <a href="#/privacy">개인정보처리방침</a>
                </div>
              </div>
            </div>
          </div>
          <div class="site-footer__copy-bar">
            <div class="site-footer__copy">© ${new Date().getFullYear()} 소소킹. All rights reserved.</div>
            <button class="site-footer__toggle" id="btn-footer-toggle" aria-expanded="false" title="푸터 펼치기">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              더보기
            </button>
          </div>
        </footer>
        <nav id="bottom-nav" class="bottom-nav"></nav>
      </div>
    </div>`;
  renderSidebar();
  renderHeader();
  renderBottomNav();
  bindFooterToggle();
}

function rerenderCurrentRouteSoon() {
  setTimeout(() => {
    renderFrame();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, 0);
}

async function initApp() {
  initToast();
  await registerRoutes();
  initRouter();
  loadOptionalModules();

  onAuthStateChanged(auth, async user => {
    appState.user = user || null;
    appState.isAuthenticated = !!user;
    if (user) await fetchUserProfile(user);
    else {
      appState.nickname = '';
      appState.nicknameIcon = null;
      appState.points = 0;
      appState.isAdmin = false;
    }
    rerenderCurrentRouteSoon();
  });

  renderFrame();
}

initApp().catch(error => {
  console.error('[app init failed]', error);
  showPageError('앱 초기화 실패', error);
});
