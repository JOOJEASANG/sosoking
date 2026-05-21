import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast } from './components/toast.js';
import { appState } from './state.js';
import { collection, query, where, getDocs, getDoc, doc, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { appState };

const OPTIONAL_MODULES = [
  './secure-interactions-actions.js',
  './acrostic-enhancer.js',
  './representative-games-enhancer.js',
  './account-secure-actions.js',
  './admin-session-guard.js',
  './admin-password-actions.js',
  './admin-ai-mission-actions.js',
  './admin-ai-ops-actions.js',
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
  return path === '/game/liar' || path.startsWith('/game/liar/') || path === '/game/mafia' || path.startsWith('/game/mafia/') || path === '/game/test/liar' || path === '/game/test/mafia';
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
  el.innerHTML = '<section class="card"><div class="card__body--lg"><h1 style="font-size:28px;margin:0 0 10px">소소킹</h1><p style="color:var(--color-text-secondary);line-height:1.7">피드와 게임을 즐기는 참여형 커뮤니티입니다.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px"><button class="btn btn--primary" data-go="/feed">피드 보기</button><button class="btn btn--ghost" data-go="/sosoland">게임 보기</button></div></div></section>';
  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
}

async function renderPage(path, exportName, args) {
  try {
    const mod = await import(path);
    const fn = mod[exportName];
    if (typeof fn !== 'function') throw new Error(exportName + ' export를 찾을 수 없습니다: ' + path);
    return fn(...args);
  } catch (error) {
    console.error('[app-safe] page failed', path, error);
    showPageError('페이지를 불러오지 못했어요', error);
  }
}

export function isAdmin() {
  return !!appState.isAdmin;
}

async function loadUserMeta(uid) {
  try {
    const notifQuery = query(collection(db, 'notifications'), where('userId', '==', uid), where('read', '==', false), limit(100));
    const [notifSnap, userSnap, adminSnap] = await Promise.all([
      getDocs(notifQuery),
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'admins', uid))
    ]);
    appState.unreadNotifications = notifSnap.size;
    const data = userSnap.exists() ? userSnap.data() : {};
    appState.streak = data.streak || 0;
    appState.userTitle = data.title || '';
    appState.isAdmin = adminSnap.exists();
    const currentUser = auth.currentUser;
    appState.nickname = data.nickname || currentUser?.displayName || currentUser?.email?.split('@')[0] || '익명';
    appState.nicknameIcon = data.nicknameIcon || null;
  } catch (error) {
    console.warn('[app-safe] user meta failed', error);
  }
}

function renderSiteShell() {
  document.body.classList.remove('game-only-mode');
  document.getElementById('app').innerHTML = '<div class="app-shell"><aside class="site-sidebar" id="site-sidebar"></aside><div class="site-main"><header class="site-header" id="site-header"></header><main id="page-content" class="page-container"></main><footer class="site-footer" id="site-footer"><div class="site-footer__copy-bar"><div class="site-footer__copy">© ' + new Date().getFullYear() + ' 소소킹. All rights reserved.</div></div></footer></div></div><nav class="bottom-nav" id="bottom-nav"></nav><div class="toast-container" id="toast-container"></div>';
}

function renderGameOnlyShell() {
  document.body.classList.add('game-only-mode');
  document.getElementById('app').innerHTML = '<div class="game-only-shell"><main id="page-content" class="game-only-content"></main><div class="toast-container" id="toast-container"></div></div>';
}

function renderChrome() {
  if (isGameOnlyShellActive()) return;
  renderSidebar();
  renderHeader();
  renderBottomNav();
}

function syncShellWithRoute() {
  const shouldUseGameShell = isGameOnlyRoute();
  if (shouldUseGameShell && !isGameOnlyShellActive()) {
    renderGameOnlyShell();
    initToast();
    return;
  }
  if (!shouldUseGameShell && isGameOnlyShellActive()) {
    renderSiteShell();
    renderChrome();
    initToast();
  }
}

export async function initApp() {
  ensureGameOnlyStyles();
  if (isGameOnlyRoute()) renderGameOnlyShell();
  else {
    renderSiteShell();
    renderChrome();
  }
  initToast();

  window.addEventListener('themechange', () => {
    if (!isGameOnlyShellActive()) {
      renderSidebar();
      renderHeader();
    }
  });

  onAuthStateChanged(auth, async user => {
    const previousUser = appState.user;
    const wasLoading = appState.loading;
    appState.user = user;
    appState.loading = false;
    appState.isAdmin = false;
    if (user) await loadUserMeta(user.uid);
    else {
      appState.unreadNotifications = 0;
      appState.streak = 0;
      appState.userTitle = '';
      appState.nickname = '';
      appState.nicknameIcon = null;
    }
    renderChrome();
    const currentPath = window.location.hash.slice(1).split('?')[0] || '/';
    const justLoggedIn = !!user && previousUser?.uid !== user.uid;
    if (justLoggedIn) {
      if (appState.isAdmin && currentPath !== '/admin' && !isGameOnlyRoute(currentPath)) navigate('/admin');
      else if (currentPath === '/login') navigate('/');
    } else if (wasLoading) {
      window.dispatchEvent(new Event('hashchange'));
    }
  });

  registerRoute('/', () => renderPage('./pages/home.js', 'renderHome', []).catch(() => fallbackHome()));
  registerRoute('/feed', () => renderPage('./pages/feed.js', 'renderFeed', []));
  registerRoute('/write', () => renderPage('./pages/write.js', 'renderWrite', []));
  registerRoute('/sosoland', () => renderPage('./pages/sosoland.js', 'renderSosoland', []));
  registerRoute('/game/test/:kind', ({ kind }) => renderPage('./pages/game-test-room.js', 'renderGameTestRoom', [{ kind }]));
  registerRoute('/game/liar', () => renderPage('./pages/liar-game.js', 'renderLiarGame', []));
  registerRoute('/game/liar/:id', ({ id }) => renderPage('./pages/liar-game.js', 'renderLiarGame', [{ id }]));
  registerRoute('/game/mafia', () => renderPage('./pages/mafia-game.js', 'renderMafiaGame', []));
  registerRoute('/game/mafia/:id', ({ id }) => renderPage('./pages/mafia-game.js', 'renderMafiaGame', [{ id }]));
  registerRoute('/detail/:id', ({ id }) => renderPage('./pages/detail-safe.js', 'renderDetail', [id]));
  registerRoute('/account', () => renderPage('./pages/account.js', 'renderAccount', []));
  registerRoute('/scraps', () => renderPage('./pages/scraps.js', 'renderScraps', []));
  registerRoute('/login', () => renderPage('./pages/login.js', 'renderLogin', []));
  registerRoute('/guide', () => renderPage('./pages/guide.js', 'renderGuide', []));
  registerRoute('/admin', () => renderPage('./pages/admin-safe.js', 'renderAdmin', []));
  registerRoute('/terms', () => renderPage('./pages/terms.js', 'renderTerms', []));
  registerRoute('/privacy', () => renderPage('./pages/privacy.js', 'renderPrivacy', []));
  registerRoute('/hall', () => renderPage('./pages/hall.js', 'renderHall', []));

  window.addEventListener('hashchange', syncShellWithRoute);
  initRouter();
  loadOptionalModules();

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    appState.installPrompt = event;
    renderChrome();
  });
  window.addEventListener('appinstalled', () => {
    appState.installPrompt = null;
    renderChrome();
  });
}

window.navigate = navigate;
initApp();
