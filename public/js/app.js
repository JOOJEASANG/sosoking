import { initAuth } from './firebase.js?v=20260729-auth-session-1';
import { renderHome } from './pages/home-court.js?v=20260729-logo-feed-1';
import { renderSubmit } from './pages/submit-guard.js?v=20260728-audit-1';
import { renderTrial } from './pages/trial-game.js?v=20260728-audit-1';
import { renderResult } from './pages/result-court.js?v=20260728-audit-1';
import { renderPolicy } from './pages/policy.js?v=20260630-3';
import { renderMyCases } from './pages/my-cases-game.js?v=20260630-22';
import { renderGuide } from './pages/guide.js?v=20260728-audit-1';
import { renderAuth } from './pages/auth2.js?v=20260729-auth-session-1';
import { renderBoard } from './pages/board-court.js?v=20260729-logo-feed-1';
import { renderFooter } from './components/footer.js?v=20260728-logo-cleanup-1';
import { initTheme, renderThemeToggle } from './components/theme.js?v=20260729-theme-global-2';
import { initCourtDesign } from './components/court-design.js?v=20260729-light-cards-1';
import { initNavAuthSync, renderNav } from './components/nav.js?v=20260729-auth-session-1';

let routeSequence = 0;

function normalizedRoute() {
  const hash = location.hash || '';
  if (hash === '#/' || hash === '' || hash === '#') {
    const path = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/') return '#/';
    if (path === '/board') return '#/board';
    if (path === '/submit') return '#/submit';
    if (path === '/guide') return '#/guide';
    if (path === '/auth') return '#/auth';
    if (path === '/my-cases') return '#/my-cases';
    if (path.startsWith('/result/')) return `#/result/${encodeURIComponent(decodeURIComponent(path.replace('/result/', '')))}`;
    if (path.startsWith('/trial/')) return `#/trial/${encodeURIComponent(decodeURIComponent(path.replace('/trial/', '')))}`;
  }
  return hash || '#/';
}

function renderRouteError(content) {
  content.innerHTML = `
    <div class="page-header"><span class="logo">⚠️ 화면 오류</span></div>
    <div class="container" style="padding-top:56px;padding-bottom:90px;text-align:center;">
      <div class="card" style="padding:24px;">
        <div style="font-size:40px;margin-bottom:10px;" aria-hidden="true">🛠️</div>
        <div style="font-family:var(--font-serif);font-size:19px;font-weight:900;color:var(--gold);margin-bottom:8px;">화면을 불러오지 못했습니다</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;margin-bottom:18px;">네트워크 상태를 확인한 뒤 다시 시도해주세요.</div>
        <button type="button" class="btn btn-primary" onclick="location.reload()">새로고침</button>
        <a href="#/" class="btn btn-ghost" style="margin-top:10px;">홈으로 이동</a>
      </div>
    </div>`;
}

async function route() {
  const sequence = ++routeSequence;
  if (window._pageCleanup) {
    try { window._pageCleanup(); }
    catch (err) { console.warn('page cleanup failed:', err); }
    window._pageCleanup = null;
  }

  const hash = normalizedRoute();
  const content = document.getElementById('page-content');
  if (!content) return;
  window.scrollTo(0, 0);

  try {
    let renderTask;
    if (hash === '#/' || hash === '' || hash === '#') renderTask = renderHome(content);
    else if (hash === '#/submit') renderTask = renderSubmit(content);
    else if (hash.startsWith('#/trial/')) renderTask = renderTrial(content, decodeURIComponent(hash.replace('#/trial/', '')));
    else if (hash.startsWith('#/result/')) renderTask = renderResult(content, decodeURIComponent(hash.replace('#/result/', '')));
    else if (hash.startsWith('#/policy/')) renderTask = renderPolicy(content, hash.replace('#/policy/', ''));
    else if (hash === '#/my-cases') renderTask = renderMyCases(content);
    else if (hash === '#/guide') renderTask = renderGuide(content);
    else if (hash === '#/auth') renderTask = renderAuth(content);
    else if (hash === '#/board') renderTask = renderBoard(content);
    else renderTask = renderHome(content);

    renderNav();
    await renderTask;
    renderThemeToggle();
  } catch (err) {
    console.error('route render failed:', { hash, err });
    if (sequence === routeSequence) {
      renderRouteError(content);
      renderNav();
      renderThemeToggle();
    }
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);

(async () => {
  initTheme();
  initCourtDesign();
  try { await initAuth(); }
  catch (err) { console.error('initial authentication failed:', err); }
  initNavAuthSync();
  renderFooter();
  await route();
})();
