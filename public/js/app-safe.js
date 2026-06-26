import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast, toast } from './components/toast.js';
import { appState } from './state.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { appState };

const KAKAO_STATE_KEY = 'kakao_oauth_state';
const KAKAO_RETURN_KEY = 'kakao_return_to';
const KAKAO_PAGE_KEY = 'kakao_page';

function pageContent() { return document.getElementById('page-content'); }
function esc(value) { return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])); }
function safeReturnPath(value) {
  const path = String(value || '').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  if (path === '/login' || path === '/signup') return '/';
  return path;
}

function clearKakaoSession() {
  sessionStorage.removeItem(KAKAO_STATE_KEY);
  sessionStorage.removeItem(KAKAO_RETURN_KEY);
  sessionStorage.removeItem(KAKAO_PAGE_KEY);
}

function clearOAuthQuery() {
  const cleanPath = `${window.location.pathname || '/'}${window.location.hash || ''}`;
  history.replaceState(null, '', cleanPath || '/');
}

function showPageError(title, error) {
  const element = pageContent();
  if (!element) return;
  console.error('[page error]', title, error);
  element.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">' + esc(title) + '</div><div class="empty-state__desc">잠시 후 다시 시도해주세요. 문제가 계속되면 페이지를 새로고침해주세요.</div><button class="btn btn--primary" id="page-error-retry">다시 시도</button></div>';
  element.querySelector('#page-error-retry')?.addEventListener('click', () => window.location.reload());
}

async function renderPage(renderer, title) {
  try { await renderer(); }
  catch (error) { console.error('[renderPage failed]', title, error); showPageError(title + ' 화면을 불러오지 못했습니다', error); }
}

function redirectTo(path) { return async () => navigate(path); }
async function renderAdminSafe() { const module = await import('./pages/admin-safe.js'); return module.renderAdmin(); }
async function renderAccountSafe() { const module = await import('./pages/account.js'); return module.renderAccount(); }
async function renderGuideSafe() { const module = await import('./pages/guide.js'); return module.renderGuide(); }
async function renderPlaygroundSafe(mode = 'judge') { const module = await import('./pages/playground.js'); return module.renderPlayground(mode); }

async function registerRoutes() {
  registerRoute('/', async () => renderPage((await import('./pages/home.js')).renderHome, '홈'));
  registerRoute('/playground', async () => renderPage(() => renderPlaygroundSafe('judge'), 'AI 놀이터'));
  registerRoute('/playground/:mode', async ({ mode }) => renderPage(() => renderPlaygroundSafe(mode), 'AI 놀이터'));
  registerRoute('/today', async () => renderPage((await import('./pages/battle.js')).renderBattle, '오늘의 콘텐츠'));
  registerRoute('/materials', async () => renderPage((await import('./pages/history.js')).renderHistory, '자료실'));
  registerRoute('/material/:id', async ({ id }) => renderPage(() => import('./pages/history.js').then(module => module.renderMaterialDetail(id)), '자료상세'));
  registerRoute('/debates', async () => renderPage((await import('./pages/ranking.js')).renderRanking, '토론실'));
  registerRoute('/debate/:id', async ({ id }) => renderPage(() => import('./pages/ranking.js').then(module => module.renderDebateDetail(id)), '토론상세'));
  registerRoute('/account', async () => renderPage(renderAccountSafe, '내 정보'));
  registerRoute('/admin', async () => renderPage(renderAdminSafe, '관리자'));
  registerRoute('/login', async () => renderPage((await import('./pages/login.js')).renderLogin, '로그인'));
  registerRoute('/signup', async () => renderPage((await import('./pages/signup.js')).renderSignup, '회원가입'));
  registerRoute('/guide', async () => renderPage(renderGuideSafe, '이용안내'));
  registerRoute('/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/legal/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/legal/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));

  registerRoute('/battle', redirectTo('/today'));
  registerRoute('/history', redirectTo('/materials'));
  registerRoute('/ranking', redirectTo('/debates'));
  registerRoute('/hall', redirectTo('/playground'));
  registerRoute('/feed', redirectTo('/debates'));
  registerRoute('/write', redirectTo('/debates'));
  registerRoute('/playground/lounge', redirectTo('/debates'));
  registerRoute('/detail/:id', async ({ id }) => navigate(`/material/${id}`));
  ['/republic', '/election', '/parties', '/congress', '/constitutional-court', '/king-history', '/points-shop', '/news', '/scraps'].forEach(path => registerRoute(path, redirectTo('/materials')));
}

async function isStrictAdmin(user) {
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult?.(false);
    if (token?.claims?.admin || token?.claims?.owner) return true;
  } catch {}
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch { return false; }
}

async function fetchUserProfile(user) {
  if (!user) {
    appState.nickname = '';
    appState.partyId = '';
    appState.points = 0;
    appState.isAdmin = false;
    return;
  }
  try {
    let snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists() && !user.isAnonymous) {
      try {
        const { ensureUserProvisioned } = await import('./services/user-service.js');
        await ensureUserProvisioned(user);
        snap = await getDoc(doc(db, 'users', user.uid));
      } catch (provisionError) { console.warn('[fetchUserProfile] provision failed', provisionError); }
    }
    if (snap.exists()) {
      const data = snap.data();
      appState.nickname = data.nickname || user.displayName || user.email?.split('@')[0] || '';
      appState.nicknameIcon = data.nicknameIcon || null;
      appState.points = Number(data.points || data.totalPoints || 0);
      appState.partyId = data.partyId || '';
    } else {
      appState.nickname = user.displayName || user.email?.split('@')[0] || '';
      appState.partyId = '';
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
    toggle.textContent = expanded ? '더보기' : '접기';
  });
}

function renderFrame() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `<div class="app-shell"><aside id="site-sidebar" class="site-sidebar"></aside><div class="app-main site-main"><header id="site-header" class="site-header"></header><main id="page-content" class="page-container"></main><footer class="site-footer" id="site-footer"><div class="site-footer__body" id="footer-body" hidden><div class="site-footer__inner"><div class="site-footer__brand-block"><a href="#/" class="site-footer__brand"><img src="/logo.svg" alt="" width="26" height="26"><span>소소킹</span></a><div class="site-footer__tagline">생활 고민을 AI 캐릭터와<br>판결하고 만들고 토론합니다</div></div><div><div class="site-footer__col-title">AI 놀이터</div><div class="site-footer__links"><a href="#/playground/judge">판결소</a><a href="#/playground/create">창작소</a><a href="#/playground/consult">상담소</a></div></div><div><div class="site-footer__col-title">콘텐츠</div><div class="site-footer__links"><a href="#/today">오늘의 콘텐츠</a><a href="#/materials">자료실</a><a href="#/debates">토론실</a></div></div><div><div class="site-footer__col-title">정보</div><div class="site-footer__links"><a href="#/guide">이용안내</a><a href="#/terms">이용약관</a><a href="#/privacy">개인정보처리방침</a></div></div></div></div><div class="site-footer__copy-bar"><div class="site-footer__copy">© ${new Date().getFullYear()} 소소킹</div><button class="site-footer__toggle" id="btn-footer-toggle" aria-expanded="false">더보기</button></div></footer><nav id="bottom-nav" class="bottom-nav"></nav></div></div>`;
  renderHeader();
  renderSidebar();
  renderBottomNav();
  bindFooterToggle();
}

async function handleKakaoCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const oauthError = params.get('error');
  if (!code && !oauthError) return null;

  const expectedState = sessionStorage.getItem(KAKAO_STATE_KEY);
  const returnTo = safeReturnPath(sessionStorage.getItem(KAKAO_RETURN_KEY));

  if (oauthError) {
    clearKakaoSession();
    clearOAuthQuery();
    toast.error('카카오 로그인이 취소됐거나 처리되지 않았습니다.');
    return null;
  }

  if (!expectedState || !state || state !== expectedState) {
    clearKakaoSession();
    clearOAuthQuery();
    console.warn('[kakao callback] OAuth state mismatch');
    toast.error('카카오 로그인 요청을 확인할 수 없습니다. 다시 시도해주세요.');
    return null;
  }

  try {
    const { data } = await import('./firebase.js').then(({ functions }) => import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js').then(({ httpsCallable }) => httpsCallable(functions, 'kakaoLogin')({
      code,
      redirectUri: window.location.origin + '/',
    })));
    if (!data.customToken) throw new Error('토큰 발급 실패');
    const { signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    await signInWithCustomToken(auth, data.customToken);
    clearKakaoSession();
    clearOAuthQuery();
    return returnTo;
  } catch (error) {
    clearKakaoSession();
    clearOAuthQuery();
    console.error('[kakao callback]', error);
    toast.error('카카오 로그인 처리에 실패했습니다.');
    return null;
  }
}

async function initApp() {
  initToast();
  renderFrame();
  const kakaoReturnTo = await handleKakaoCallback();
  await registerRoutes();
  initRouter();
  if (kakaoReturnTo) navigate(kakaoReturnTo);
  onAuthStateChanged(auth, async user => {
    appState.user = user;
    await fetchUserProfile(user);
    renderHeader();
    renderSidebar();
    renderBottomNav();
  });
}

initApp().catch(error => { console.error('[app init failed]', error); showPageError('앱 초기화 실패', error); });
