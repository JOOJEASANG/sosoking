import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast } from './components/toast.js';
import { appState } from './state.js';
import './secure-feed-actions.js';
import './secure-interactions-actions.js';
import './acrostic-enhancer.js';
import './initial-game-enhancer.js';
import './representative-games-enhancer.js';
import './write-normalizer.js';
import './relay-name-patch.js';
import './account-secure-actions.js';
import './admin-session-guard.js';
import './admin-password-actions.js';
import './admin-ai-mission-actions.js';
import './admin-ai-ops-actions.js';
import './social-play-enhancer.js';
import './site-copy-normalizer.js';
import {
  collection, query, where, getDocs, getDoc, doc, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { renderHome }    from './pages/home.js';
import { renderFeed }    from './pages/feed.js';
import { renderWrite }   from './pages/write.js';
import { renderDetail }  from './pages/detail.js';
import { renderAccount } from './pages/account.js';
import { renderLogin }   from './pages/login.js';
import { renderGuide }   from './pages/guide.js';
import { renderAdmin }   from './pages/admin.js';
import { renderTerms }   from './pages/terms.js';
import { renderPrivacy } from './pages/privacy.js';
import { renderScraps }  from './pages/scraps.js';
import { renderHall }    from './pages/hall.js';

export { appState };

export function isAdmin() {
  return !!appState.isAdmin;
}

async function loadUserMeta(uid) {
  try {
    const [notifSnap, userSnap, adminSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'notifications'),
        where('userId', '==', uid),
        where('read', '==', false),
        limit(100),
      )),
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'admins', uid)),
    ]);
    appState.unreadNotifications = notifSnap.size;
    const data = userSnap.exists() ? userSnap.data() : {};
    appState.streak    = data.streak    || 0;
    appState.userTitle = data.title     || '';
    appState.isAdmin   = adminSnap.exists();
    const currentUser  = auth.currentUser;
    appState.nickname  = data.nickname  || currentUser?.displayName || currentUser?.email?.split('@')[0] || '익명';
  } catch { /* non-critical */ }
}

export async function initApp() {
  document.getElementById('app').innerHTML = `
    <div class="app-shell">
      <aside class="site-sidebar" id="site-sidebar"></aside>
      <div class="site-main">
        <header class="site-header" id="site-header"></header>
        <main id="page-content" class="page-container"></main>
        <footer class="site-footer" id="site-footer">
          <div class="site-footer__body" id="footer-body" hidden>
            <div class="site-footer__inner">
              <div class="site-footer__brand-block">
                <a href="#/" class="site-footer__brand">
                  <img src="/logo.svg" alt="" width="26" height="26">
                  <span>소소킹</span>
                </a>
                <div class="site-footer__tagline">7가지 대표 놀이 · 참여형 커뮤니티<br>가볍게 즐기는 소소한 킹갓 놀이터</div>
              </div>
              <div>
                <div class="site-footer__col-title">바로가기</div>
                <div class="site-footer__links">
                  <a href="#/feed">탐색하기</a>
                  <a href="#/hall">명예의 전당</a>
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
      </div>
    </div>
    <nav class="bottom-nav" id="bottom-nav"></nav>
    <div class="toast-container" id="toast-container"></div>
  `;

  renderSidebar();
  renderHeader();
  renderBottomNav();
  initToast();

  window.addEventListener('themechange', () => {
    renderSidebar();
    renderHeader();
  });

  document.getElementById('btn-footer-toggle')?.addEventListener('click', function () {
    const body = document.getElementById('footer-body');
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    this.classList.toggle('open', !expanded);
    if (expanded) {
      body.hidden = true;
    } else {
      body.hidden = false;
    }
  });

  onAuthStateChanged(auth, async (user) => {
    const previousUser = appState.user;
    const wasLoading   = appState.loading;
    appState.user    = user;
    appState.loading = false;
    appState.isAdmin = false;
    if (user) {
      await loadUserMeta(user.uid);
    } else {
      appState.unreadNotifications = 0;
      appState.streak    = 0;
      appState.userTitle = '';
      appState.nickname  = '';
    }
    renderSidebar();
    renderHeader();
    renderBottomNav();

    const path = window.location.hash.slice(1).split('?')[0] || '/';
    const justLoggedIn = !!user && previousUser?.uid !== user.uid;
    if (justLoggedIn) {
      if (appState.isAdmin && path !== '/admin') navigate('/admin');
      else if (path === '/login') navigate('/');
    } else if (wasLoading) {
      // 새로고침 시 인증 완료 후 현재 페이지 재렌더
      window.dispatchEvent(new Event('hashchange'));
    }
  });

  registerRoute('/',           () => renderHome());
  registerRoute('/feed',       () => renderFeed());
  registerRoute('/write',      () => renderWrite());
  registerRoute('/detail/:id', ({ id }) => renderDetail(id));
  registerRoute('/account',    () => renderAccount());
  registerRoute('/scraps',     () => renderScraps());
  registerRoute('/login',      () => renderLogin());
  registerRoute('/guide',      () => renderGuide());
  registerRoute('/admin',      () => renderAdmin());
  registerRoute('/terms',      () => renderTerms());
  registerRoute('/privacy',    () => renderPrivacy());
  registerRoute('/hall',       () => renderHall());

  initRouter();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appState.installPrompt = e;
    renderSidebar();
    renderHeader();
  });
  window.addEventListener('appinstalled', () => {
    appState.installPrompt = null;
    renderSidebar();
    renderHeader();
  });
}

window.navigate = navigate;
initApp();