import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast, toast } from './components/toast.js';
import { appState } from './state.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { appState };

const OWNER_EMAILS = new Set();
const ADMIN_ALLOWED_PATHS = new Set(['/admin', '/account', '/terms', '/privacy', '/legal/terms', '/legal/privacy', '/guide', '/login', '/signup']);

const OPTIONAL_MODULES = [
  './account-secure-actions.js',
  './nickname-icon-actions.js'
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

function showWelcomeModal(nickname) {
  if (document.getElementById('welcome-modal')) return;
  const el = document.createElement('div');
  el.id = 'welcome-modal';
  el.className = 'welcome-modal';
  el.innerHTML = `
    <div class="welcome-modal__card">
      <div class="welcome-modal__emoji">🏛️</div>
      <div class="welcome-modal__title">소소공화국 입장 완료</div>
      <div class="welcome-modal__nick">${esc(nickname || '시민')}님</div>
      <div class="welcome-modal__bonus"><span class="welcome-modal__bonus-label">입국 보너스</span><span class="welcome-modal__bonus-pts">+500P</span></div>
      <div class="welcome-modal__steps">
        <div class="welcome-modal__step"><span>1</span> 오늘게임에서 역사 사건 선택</div>
        <div class="welcome-modal__step"><span>2</span> 정당에 입당하고 정치력 쌓기</div>
        <div class="welcome-modal__step"><span>3</span> 대통령 선거에서 지지 선언</div>
      </div>
      <div class="welcome-modal__actions"><button class="btn btn--primary" id="wm-play">오늘게임 시작</button><button class="btn btn--ghost" id="wm-skip">닫기</button></div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('welcome-modal--visible'));
  el.querySelector('#wm-play')?.addEventListener('click', () => { el.remove(); navigate('/battle'); });
  el.querySelector('#wm-skip')?.addEventListener('click', () => el.remove());
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
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

function redirectTo(path) {
  return async () => navigate(path);
}

async function registerRoutes() {
  registerRoute('/', async () => renderPage((await import('./pages/home.js')).renderHome, '홈'));
  registerRoute('/battle', async () => renderPage((await import('./pages/battle.js')).renderBattle, '오늘게임'));
  registerRoute('/history', async () => renderPage((await import('./pages/history.js')).renderHistory, '역사자료'));
  registerRoute('/republic', async () => renderPage((await import('./pages/republic.js')).renderRepublic, '정당·대선'));
  registerRoute('/election', async () => renderPage((await import('./pages/election.js')).renderElection, '대통령 선거'));
  registerRoute('/ranking', async () => renderPage((await import('./pages/ranking.js')).renderRanking, '랭킹'));
  registerRoute('/account', async () => renderPage(renderAccountSafe, '내 정보'));
  registerRoute('/admin', async () => renderPage(renderAdminSafe, '관리자'));
  registerRoute('/detail/:id', async ({ id }) => renderPage(() => renderDetailSafe(id), '상세'));
  registerRoute('/login', async () => renderPage((await import('./pages/login.js')).renderLogin, '로그인'));
  registerRoute('/signup', async () => renderPage((await import('./pages/signup.js')).renderSignup, '회원가입'));
  registerRoute('/guide', async () => renderPage(renderGuideSafe, '이용안내'));
  registerRoute('/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));
  registerRoute('/legal/terms', async () => renderPage((await import('./pages/legal.js')).renderTerms, '이용약관'));
  registerRoute('/legal/privacy', async () => renderPage((await import('./pages/legal.js')).renderPrivacy, '개인정보처리방침'));

  // 간소화 후 보조 기능은 핵심 흐름으로 돌립니다.
  ['/feed', '/write', '/hall', '/scraps', '/points-shop', '/news', '/congress', '/constitutional-court', '/king-history', '/parties'].forEach(path => {
    registerRoute(path, path === '/news' ? redirectTo('/history') : redirectTo('/republic'));
  });
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
      } catch (provErr) { console.warn('[fetchUserProfile] provision failed', provErr); }
    }
    if (snap.exists()) {
      const data = snap.data();
      appState.nickname = data.nickname || user.displayName || user.email?.split('@')[0] || '';
      appState.nicknameIcon = data.nicknameIcon || null;
      appState.points = Number(data.points || data.totalPoints || 0);
      appState.partyId = data.partyId || '';
      if (!data.signupBonusClaimed) {
        import('./firebase.js').then(({ functions }) =>
          import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js').then(({ httpsCallable }) =>
            httpsCallable(functions, 'claimSignupBonus')().then(res => {
              if (res.data?.awarded) showWelcomeModal(appState.nickname);
            }).catch(() => {})
          )
        );
      }
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
  app.innerHTML = `
    <div class="app-shell">
      <aside id="site-sidebar" class="site-sidebar"></aside>
      <div class="app-main site-main">
        <header id="site-header" class="site-header"></header>
        <main id="page-content" class="page-container"></main>
        <footer class="site-footer" id="site-footer">
          <div class="site-footer__body" id="footer-body" hidden>
            <div class="site-footer__inner">
              <div class="site-footer__brand-block"><a href="#/" class="site-footer__brand"><img src="/logo.svg" alt="" width="26" height="26"><span>소소킹</span></a><div class="site-footer__tagline">오늘의 역사 사건을 선택하고<br>정당을 키우는 역사정치 게임</div></div>
              <div><div class="site-footer__col-title">핵심 메뉴</div><div class="site-footer__links"><a href="#/battle">⚔️ 오늘게임</a><a href="#/history">📚 역사자료</a><a href="#/republic">🏛️ 정당·대선</a><a href="#/election">👑 대통령 선거</a></div></div>
              <div><div class="site-footer__col-title">내 정보</div><div class="site-footer__links"><a href="#/account">내정보</a><a href="#/ranking">랭킹</a><a href="#/guide">이용안내</a></div></div>
              <div><div class="site-footer__col-title">정보</div><div class="site-footer__links"><a href="#/terms">이용약관</a><a href="#/privacy">개인정보처리방침</a></div></div>
            </div>
          </div>
          <div class="site-footer__copy-bar"><div class="site-footer__copy">© ${new Date().getFullYear()} 소소킹</div><button class="site-footer__toggle" id="btn-footer-toggle" aria-expanded="false" title="푸터 펼치기">더보기</button></div>
        </footer>
        <nav id="bottom-nav" class="bottom-nav"></nav>
      </div>
    </div>`;
  renderHeader();
  renderSidebar();
  renderBottomNav();
  bindFooterToggle();
}

async function handleKakaoCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || state !== 'kakao_login') return;
  try {
    const { data } = await import('./firebase.js').then(({ functions }) =>
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js').then(({ httpsCallable }) =>
        httpsCallable(functions, 'kakaoLogin')({ code, redirectUri: window.location.origin + '/' })
      )
    );
    if (!data.customToken) throw new Error('토큰 발급 실패');
    const { signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    await signInWithCustomToken(auth, data.customToken);
    history.replaceState(null, '', '/');
  } catch (error) {
    console.error('[kakao callback]', error);
    toast.error?.('카카오 로그인 처리에 실패했습니다.');
  }
}

async function initApp() {
  initToast();
  renderFrame();
  await handleKakaoCallback();
  await registerRoutes();
  initRouter();
  loadOptionalModules();

  onAuthStateChanged(auth, async user => {
    appState.user = user;
    await fetchUserProfile(user);
    renderHeader();
    renderSidebar();
    renderBottomNav();
  });
}

initApp().catch(error => {
  console.error('[app init failed]', error);
  showPageError('앱 초기화 실패', error);
});
