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

export { appState };

export async function initApp() {
  document.getElementById('app').innerHTML = `
    <header class="site-header" id="site-header"></header>
    <main id="page-content" class="page-container"></main>
    <nav class="bottom-nav" id="bottom-nav"></nav>
    <div class="toast-container" id="toast-container"></div>
  `;

  renderHeader();
  renderBottomNav();
  initToast();

  onAuthStateChanged(auth, (user) => {
    appState.user    = user;
    appState.loading = false;
    renderHeader();
    renderBottomNav();
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

  initRouter();
}

window.navigate = navigate;
initApp();
