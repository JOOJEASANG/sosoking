import { auth, db, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';
import { initToast } from './components/toast.js';
import { appState } from './state.js';
import './secure-feed-actions.js';
import './account-secure-actions.js';
import './admin-ai-mission-actions.js';
import './admin-ai-ops-actions.js';
import './social-play-enhancer.js';
import {
  collection, query, where, getDocs, getDoc, doc, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { renderHome }    from './pages/home.js';
import { renderFeed }    from './pages/feed.js';
import { renderWrite }   from './pages/write.js';
import { renderDetail }  from './pages/detail.js';
import { renderMission } from './pages/mission.js';
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
          <div class="site-footer__inner">
            <div class="site-footer__brand-block">
              <a href="#/" class="site-footer__brand">
                <img src="/logo.svg" alt="" width="26" height="26">
                <span>소소킹</span>
              </a>
              <div class="site-footer__tagline">골라봐, 웃겨봐, 도전봐<br>9가지 게임형 한국 커뮤니티</div>
            </div>
            <div>
              <div class="site-footer__col-title">바로가기</div>
              <div class="site-footer__links">
                <a href="#/feed">탐색하기</a>
                <a href="#/mission">오늘의 미션</a>
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
          <div class="site-footer__copy-bar">
            <div class="site-footer__copy">© ${new Date().getFullYear()} 소소킹. All rights reserved.</div>
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

  onAuthStateChanged(auth, async (user) => {
    const previousUser = appState.user;
    appState.user    = user;
    appState.loading = false;
    appState.isAdmin = false;
    if (user) {
      await loadUserMeta(user.uid);
    } else {
      appState.unreadNotifications = 0;
      appState.streak    = 0;
      appState.userTitle = '';
    }
    renderSidebar();
    renderHeader();
    renderBottomNav();

    const path = window.location.hash.slice(1).split('?')[0] || '/';
    const justLoggedIn = !!user && previousUser?.uid !== user.uid;
    if (justLoggedIn) {
      if (appState.isAdmin && path !== '/admin') navigate('/admin');
      else if (path === '/login') navigate('/');
    }
  });

  registerRoute('/',           () => renderHome());
  registerRoute('/feed',       () => renderFeed());
  registerRoute('/write',      () => renderWrite());
  registerRoute('/detail/:id', ({ id }) => renderDetail(id));
  registerRoute('/mission',    () => renderMission());
  registerRoute('/account',    () => renderAccount());
  registerRoute('/scraps',     () => renderScraps());
  registerRoute('/login',      () => renderLogin());
  registerRoute('/guide',      () => renderGuide());
  registerRoute('/admin',      () => renderAdmin());
  registerRoute('/terms',      () => renderTerms());
  registerRoute('/privacy',    () => renderPrivacy());
  registerRoute('/hall',       () => renderHall());

  initRouter();

  // PWA 설치 프롬프트 캡처
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