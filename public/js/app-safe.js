import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast } from './components/toast.js';
import { appState } from './state.js';
import { GAME_ROUTE_PREFIXES } from './games/registry.js';
import { collection, query, where, getDocs, getDoc, doc, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { appState };

const OWNER_EMAILS = new Set();

const OPTIONAL_MODULES = [
  './secure-interactions-actions.js',
  './acrostic-enhancer.js',
  './representative-games-enhancer.js',
  './account-secure-actions.js',
  './admin-session-guard.js',
  './admin-password-actions.js',
  './admin-post-list-normalizer.js',
  './nickname-icon-actions.js',
  './social-play-enhancer.js',
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

function currentRoutePath() {
  return window.location.hash.slice(1).split('?')[0] || '/';
}

function isGameOnlyRoute(path = currentRoutePath()) {
  return GAME_ROUTE_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function isGameOnlyShellActive() {
  return !!document.querySelector('.game-only-shell');
}

function ensureGameOnlyStyles() {
  if (document.querySelector('link[href="/css/game-only-shell.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/game-only-shell.css';
  document.head.appendChild(link);
}

function showPageError(title, error) {
  const el = pageContent();
  if (!el) return;
  const msg = error && (error.stack || error.message) ? String(error.stack || error.message) : String(error || '알 수 없는 오류');
  el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">' + esc(title) + '</div><div style="margin-top:10px;font-size:12px;white-space:pre-wrap;text-align:left;max-width:720px;overflow:auto">' + esc(msg) + '</div></div>';
}

function fallbackHome() {
  const el = pageContent();
  if (!el) return;
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">🏠</div>
      <div class="empty-state__title">소소킹</div>
      <div class="empty-state__desc">피드와 게임을 불러오는 중입니다.</div>
    </div>`;
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

async function registerRoutes() {
  registerRoute('/', async () => renderPage((await import('./pages/home.js')).renderHome, '홈'));
  registerRoute('/feed', async () => renderPage((await import('./pages/feed.js')).renderFeed, '피드'));
  registerRoute('/sosoland', async () => renderPage((await import('./pages/sosoland.js')).renderSosoland, '소소랜드'));
  registerRoute('/hall', async () => renderPage((await import('./pages/hall.js')).renderHall, '통계'));
  registerRoute('/account', async () => renderPage(renderAccountSafe, '내 정보'));
  registerRoute('/scraps', async () => renderPage((await import('./pages/scraps.js')).renderScraps, '스크랩'));
  registerRoute('/admin', async () => renderPage(renderAdminSafe, '관리자'));
  registerRoute('/write', async () => renderPage(renderWriteSafe, '글쓰기'));
  registerRoute('/detail/:id', async ({ id }) => renderPage(() => renderDetailSafe(id), '상세'));
  registerRoute('/login', async () => renderPage((await import('./pages/login.js')).renderLogin, '로그인'));
  registerRoute('/guide', async () => renderPage((await import('./pages/guide.js')).renderGuide, '이용안내'));
  registerRoute('/terms', async () => renderPage((await import('./pages/terms.js')).renderTerms, '이용약관'));
  registerRoute('/privacy', async () => renderPage((await import('./pages/privacy.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/legal/terms', async () => renderPage((await import('./pages/terms.js')).renderTerms, '이용약관'));
  registerRoute('/legal/privacy', async () => renderPage((await import('./pages/privacy.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/game/liar', async () => renderPage((await import('./pages/liar-game.js')).renderLiarGame, 'AI 라이어 찾기'));
  registerRoute('/game/liar/:id', async ({ id }) => renderPage(() => import('./pages/liar-game.js').then(m => m.renderLiarGame({ id })), 'AI 라이어 찾기'));
  registerRoute('/game/mafia', async () => renderPage((await import('./pages/mafia-game.js')).renderMafiaGame, 'AI 마피아'));
  registerRoute('/game/mafia/:id', async ({ id }) => renderPage(() => import('./pages/mafia-game.js').then(m => m.renderMafiaGame({ id })), 'AI 마피아'));
  registerRoute('/game/touch-king', async () => renderPage((await import('./pages/touch-king-game.js')).renderTouchKingGame, '터치왕게임'));
  registerRoute('/game/touch-king/:id', async ({ id }) => renderPage(() => import('./pages/touch-king-game.js').then(m => m.renderTouchKingGame({ id })), '터치왕게임'));
  registerRoute('/game/symbol-spy', async () => renderPage(() => import('./pages/touch-king-game.js').then(m => m.redirectOldSymbolSpy()), '터치왕게임'));
  registerRoute('/game/symbol-spy/:id', async ({ id }) => renderPage(() => import('./pages/touch-king-game.js').then(m => m.redirectOldSymbolSpy({ id })), '터치왕게임'));
  registerRoute('/game/soso-spy', async () => renderPage((await import('./pages/soso-spy-game.js')).renderSosoSpyGame, '소소스파이'));
  registerRoute('/game/soso-spy/:id', async ({ id }) => renderPage(() => import('./pages/soso-spy-game.js').then(m => m.renderSosoSpyGame({ id })), '소소스파이'));
  registerRoute('/game/soso-code', async () => renderPage((await import('./pages/soso-code-game.js')).renderSosoCodeGame, '소소코드'));
  registerRoute('/game/soso-code/:id', async ({ id }) => renderPage(() => import('./pages/soso-code-game.js').then(m => m.renderSosoCodeGame({ id })), '소소코드'));
  registerRoute('/game/ai-court', async () => renderPage((await import('./pages/ai-court-game.js')).renderAiCourtGame, 'AI 재판소'));
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

function renderFrame() {
  const path = currentRoutePath();
  const app = document.getElementById('app');
  if (!app) return;

  if (isGameOnlyRoute(path)) {
    ensureGameOnlyStyles();
    app.innerHTML = `
      <div class="game-only-shell">
        <main id="page-content" class="game-only-shell__content"></main>
      </div>`;
    return;
  }

  app.innerHTML = `
    <div class="app-shell">
      <aside id="site-sidebar" class="site-sidebar"></aside>
      <div class="app-main site-main">
        <header id="site-header" class="site-header"></header>
        <main id="page-content" class="page-container"></main>
        <footer id="site-footer" class="site-footer"></footer>
        <nav id="bottom-nav" class="bottom-nav"></nav>
      </div>
    </div>`;
  renderSidebar();
  renderHeader();
  renderBottomNav();
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