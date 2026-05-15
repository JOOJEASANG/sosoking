import { auth, onAuthStateChanged } from './firebase.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { initToast } from './components/toast.js';
import { appState } from './state.js';

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

export { appState };

// 관리자 이메일 목록 — Firebase Console에서 확인한 이메일 추가
export const ADMIN_EMAILS = [];

export function isAdmin(user) {
  if (!user) return false;
  if (!ADMIN_EMAILS.length) return true; // 미설정 시 모든 로그인 유저 접근 허용
  return ADMIN_EMAILS.includes(user.email);
}

export async function initApp() {
  document.getElementById('app').innerHTML = `
    <header class="site-header" id="site-header"></header>
    <main id="page-content" class="page-container"></main>
    <nav class="bottom-nav" id="bottom-nav"></nav>
    <div class="toast-container" id="toast-container"></div>
    <footer class="site-footer" id="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__brand">소소킹 🎉</div>
        <div class="site-footer__links">
          <a href="#/guide">이용안내</a>
          <a href="#/terms">이용약관</a>
          <a href="#/privacy">개인정보처리방침</a>
        </div>
        <div class="site-footer__copy">© 2025 소소킹. All rights reserved.</div>
      </div>
    </footer>
  `;

  renderHeader();
  renderBottomNav();
  initToast();

  onAuthStateChanged(auth, (user) => {
    const wasLoading = appState.loading;
    appState.user    = user;
    appState.loading = false;
    appState.isAdmin = isAdmin(user);
    renderHeader();
    renderBottomNav();
    // 첫 로딩 후 관리자라면 /admin으로 이동 (로그인 페이지에서 온 경우만)
    const path = window.location.hash.slice(1).split('?')[0] || '/';
    if (!wasLoading && user && appState.isAdmin && path === '/login') {
      navigate('/admin');
    }
  });

  registerRoute('/',           () => renderHome());
  registerRoute('/feed',       () => renderFeed());
  registerRoute('/write',      () => renderWrite());
  registerRoute('/detail/:id', ({ id }) => renderDetail(id));
  registerRoute('/mission',    () => renderMission());
  registerRoute('/account',    () => renderAccount());
  registerRoute('/login',      () => renderLogin());
  registerRoute('/guide',      () => renderGuide());
  registerRoute('/admin',      () => renderAdmin());
  registerRoute('/terms',      () => renderTerms());
  registerRoute('/privacy',    () => renderPrivacy());

  initRouter();
}

window.navigate = navigate;
initApp();
