import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast, toast } from './components/toast.js';
import { appState } from './state.js';
import { collection, query, where, getDocs, getDoc, doc, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { appState };

const OWNER_EMAILS = new Set();
const ADMIN_ALLOWED_PATHS = new Set(['/admin', '/account', '/terms', '/privacy', '/legal/terms', '/legal/privacy', '/guide', '/login', '/signup']);

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

function pageContent() { return document.getElementById('page-content'); }
function esc(value) { return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])); }

function showPageError(title, error) {
  const el = pageContent();
  if (!el) return;
  const msg = error && (error.stack || error.message) ? String(error.stack || error.message) : String(error || '알 수 없는 오류');
  el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">' + esc(title) + '</div><div style="margin-top:10px;font-size:12px;white-space:pre-wrap;text-align:left;max-width:720px;overflow:auto">' + esc(msg) + '</div></div>';
}

function currentPath() {
  const hash = window.location.hash.slice(1) || '/';
  return hash.split('?')[0] || '/';
}

function isAdminAllowedPath(path) {
  return ADMIN_ALLOWED_PATHS.has(path) || path.startsWith('/admin');
}

async function renderPage(renderer, title) {
  try {
    const path = currentPath();
    if (appState.isAdmin && !isAdminAllowedPath(path)) {
      toast.info?.('관리자 계정은 관리 페이지에서만 사용합니다.');
      navigate('/admin');
      return;
    }
    await renderer();
  } catch (error) {
    console.error('[renderPage failed]', title, error);
    showPageError(title + ' 화면을 불러오지 못했어요', error);
  }
}

async function renderAdminSafe() { const module = await import('./pages/admin-safe.js'); return module.renderAdmin(); }
async function renderAccountSafe() { const module = await import('./pages/account.js'); return module.renderAccount(); }
async function renderDetailSafe(id) { const module = await import('./pages/detail.js'); return module.renderDetail(id); }
async function renderGuideSafe() { const module = await import('./pages/guide.js'); return module.renderGuide(); }

async function registerRoutes() {
  registerRoute('/', async () => renderPage((await import('./pages/home.js')).renderHome, '홈'));
  registerRoute('/feed', async () => renderPage((await import('./pages/feed.js')).renderFeed, '피드'));
  registerRoute('/hall', async () => renderPage((await import('./pages/hall.js')).renderHall, '통계'));
  registerRoute('/account', async () => renderPage(renderAccountSafe, '내 정보'));
  registerRoute('/scraps', async () => renderPage((await import('./pages/scraps.js')).renderScraps, '스크랩'));
  registerRoute('/admin', async () => renderPage(renderAdminSafe, '관리자'));
  registerRoute('/detail/:id', async ({ id }) => renderPage(() => renderDetailSafe(id), '상세'));
  registerRoute('/login', async () => renderPage((await import('./pages/login.js')).renderLogin, '로그인'));
  registerRoute('/signup', async () => renderPage((await import('./pages/signup.js')).renderSignup, '회원가입'));
  registerRoute('/guide', async () => renderPage(renderGuideSafe, '이용안내'));
  registerRoute('/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/legal/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/legal/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/ai-king', async () => renderPage((await import('./pages/ai-king.js')).renderAiKing, 'AI킹'));
  registerRoute('/ai-judge', async () => renderPage((await import('./pages/ai-judge.js')).renderAiJudge, '미친판사'));
  registerRoute('/ai-translate', async () => renderPage((await import('./pages/ai-translate.js')).renderAiTranslate, '만국번역사'));
  registerRoute('/ai-match', async () => renderPage((await import('./pages/ai-match.js')).renderAiMatch, '궁합점쟁이'));
  registerRoute('/ai-naming', async () => renderPage((await import('./pages/ai-naming.js')).renderAiNaming, '작명의신'));
  registerRoute('/points-shop', async () => renderPage((await import('./pages/points-shop.js')).renderPointsShop, '포인트 상점'));
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
  } catch { return false; }
}

async function fetchUserProfile(user) {
  if (!user) return;
  try {
    let snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists() && !user.isAnonymous) {
      try {
        const { ensureUserProvisioned } = await import('./services/user-service.js');
        await ensureUserProvisioned(user);
        snap = await getDoc(doc(db, 'users', user.uid));
      } catch (provErr) { console.warn('[fetchUserProfile] provision failed', provErr); }
    }
    if (snap.exists()) {
      const data = snap.data();
      appState.nickname = data.nickname || user.displayName || user.email?.split('@')[0] || '';
      appState.nicknameIcon = data.nicknameIcon || null;
      appState.points = Number(data.points || data.totalPoints || 0);
      if (!data.signupBonusClaimed) {
        import('./firebase.js').then(({ functions }) =>
          import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js').then(({ httpsCallable }) =>
            httpsCallable(functions, 'claimSignupBonus')().catch(() => {})
          )
        );
      }
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
              <div class="site-footer__brand-block"><a href="#/" class="site-footer__brand"><img src="/logo.svg" alt="" width="26" height="26"><span>소소킹</span></a><div class="site-footer__tagline">AI가 판결하고, 번역하고,<br>궁합 보고, 이름 짓는 놀이터</div></div>
              <div><div class="site-footer__col-title">AI킹</div><div class="site-footer__links"><a href="#/ai-judge">⚖️ 미친판사</a><a href="#/ai-translate">🌍 만국번역사</a><a href="#/ai-match">💘 궁합점쟁이</a><a href="#/ai-naming">🎭 작명의신</a></div></div>
              <div><div class="site-footer__col-title">바로가기</div><div class="site-footer__links"><a href="#/feed">피드</a><a href="#/hall">통계</a><a href="#/guide">이용안내</a></div></div>
              <div><div class="site-footer__col-title">정보</div><div class="site-footer__links"><a href="#/terms">이용약관</a><a href="#/privacy">개인정보처리방침</a></div></div>
            </div>
          </div>
          <div class="site-footer__copy-bar"><div class="site-footer__copy">© ${new Date().getFullYear()} 소소킹. All rights reserved.</div><button class="site-footer__toggle" id="btn-footer-toggle" aria-expanded="false" title="푸터 펼치기">더보기</button></div>
        </footer>
        <nav id="bottom-nav" class="bottom-nav"></nav>
      </div>
    </div>`;
  renderSidebar(); renderHeader(); renderBottomNav(); bindFooterToggle();
}

function rerenderCurrentRouteSoon() { setTimeout(() => { renderFrame(); window.dispatchEvent(new HashChangeEvent('hashchange')); }, 0); }

async function handleKakaoCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const oauthError = params.get('error');
  if (!code && !oauthError) return;
  window.history.replaceState({}, '', '/');
  if (oauthError) { setTimeout(() => toast.warn('카카오 로그인이 취소됐어요'), 800); return; }
  const returnTo = sessionStorage.getItem('kakao_return_to') || '/';
  sessionStorage.removeItem('kakao_return_to');
  const processingEl = document.getElementById('app');
  if (processingEl) processingEl.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif"><div style="text-align:center"><div class="spinner spinner--lg"></div><p>카카오 로그인 처리 중...</p></div></div>';
  try {
    const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js');
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { signInWithCustomToken, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const fns = getFunctions(getApp(), 'asia-northeast3');
    const { data } = await httpsCallable(fns, 'kakaoLogin')({ code, redirectUri: 'https://sosoking.co.kr/' });
    await signInWithCustomToken(auth, data.customToken);
    if (auth.currentUser && (data.displayName || data.photoURL)) {
      await updateProfile(auth.currentUser, { displayName: data.displayName || auth.currentUser.displayName || null, photoURL: data.photoURL || auth.currentUser.photoURL || null }).catch(() => {});
    }
    toast.success('카카오 로그인됐어요!');
    window.location.hash = '#' + (returnTo.startsWith('/') ? returnTo : '/' + returnTo);
  } catch (e) {
    console.error('[kakao callback]', e);
    const label = e?.code ? `${e?.message || String(e)} (${e.code})` : (e?.message || String(e));
    const backPage = sessionStorage.getItem('kakao_page') || 'login';
    sessionStorage.removeItem('kakao_page');
    setTimeout(() => { toast.error('카카오 로그인 실패: ' + label); window.location.hash = '#/' + backPage; }, 300);
  }
}

async function initApp() {
  initToast();
  await handleKakaoCallback();
  await registerRoutes();
  initRouter();
  loadOptionalModules();
  onAuthStateChanged(auth, async user => {
    appState.user = user || null;
    appState.isAuthenticated = !!user;
    if (user) await fetchUserProfile(user);
    else { appState.nickname = ''; appState.nicknameIcon = null; appState.points = 0; appState.isAdmin = false; }
    if (appState.isAdmin && !isAdminAllowedPath(currentPath())) navigate('/admin');
    rerenderCurrentRouteSoon();
  });
  renderFrame();
}

initApp().catch(error => { console.error('[app init failed]', error); showPageError('앱 초기화 실패', error); });
