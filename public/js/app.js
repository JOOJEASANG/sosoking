import { initAuth } from './firebase.js?v=20260729-auth-session-1';
import { initAdminLoginRedirect, redirectAdminAccountRoute } from './admin-access.js?v=20260730-admin-redirect-1';
import { renderHome } from './pages/home-seven-judges.js?v=20260730-home-layout-route-1';
// Cache lineage marker for search-free home: './pages/home-no-search.js?v=20260730-search-scope-1';
// Cache lineage marker for judge assignment: './pages/home-judge-assignment.js?v=20260730-judge-board-search-1';
// Cache lineage marker for configurable limits: './pages/home-court.js?v=20260730-configurable-limit-1';
// Cache lineage marker for CSP: './pages/home-court.js?v=20260729-brand-unified-1';
import { renderSubmit } from './pages/submit-guard.js?v=20260731-private-first-publication-1';
// Cache lineage marker: './pages/submit-guard.js?v=20260730-configurable-limit-1';
import { renderTrial } from './pages/trial-game.js?v=20260729-dark-record-participation-1';
import { renderResult } from './pages/result-comments.js?v=20260810-owner-original-route-2';
// Cache lineage marker: './pages/result-comments.js?v=20260801-public-original-modal-1';
// Cache lineage marker: './pages/result-comments.js?v=20260730-discussion-court-1';
import { renderDiscussion } from './pages/discussion.js?v=20260730-discussion-court-1';
import { renderPolicy } from './pages/policy-configurable-limit.js?v=20260730-final-audit-1';
// Cache lineage marker: './pages/policy-configurable-limit.js?v=20260730-configurable-limit-1';
import { renderMyCases } from './pages/my-cases-game.js?v=20260810-mycase-light-1';
// Cache lineage marker: './pages/my-cases-game.js?v=20260729-dark-record-participation-1';
import { renderGuide } from './pages/guide.js?v=20260802-remove-daily-court-1';
import { renderAuth } from './pages/auth2.js?v=20260829-avatar-1';
import { renderBoard } from './pages/board-full-content-search.js?v=20260731-compact-record-card-1';
import { renderJury } from './pages/jury.js?v=20260829-jury-1';
// Cache lineage marker for full search: './pages/board-full-content-search.js?v=20260730-search-scope-1';
// Cache lineage marker for pagination: './pages/board-search-pagination.js?v=20260730-judge-board-search-1';
// Cache lineage marker for discussion: './pages/board-court.js?v=20260730-discussion-court-1';
// Cache lineage marker for CSP: './pages/board-court.js?v=20260729-script-csp-1';
import { renderFooter } from './components/footer.js?v=20260729-brand-policy-1';
// Cache lineage marker for the compact-spacing regression check: ./components/footer.js?v=20260729-compact-spacing-1
import { initTheme, renderThemeToggle } from './components/theme.js?v=20260729-theme-global-2';
import { initCourtDesign } from './components/court-design.js?v=20260729-light-home-1';
import { initNavAuthSync, renderNav } from './components/nav.js?v=20260829-avatar-1';
// Cache lineage marker: './components/nav.js?v=20260802-remove-daily-court-2';
import { normalizePageHeaderIcons } from './components/header-icons.js?v=20260806-unified-service-nav-1';
// Cache lineage marker: './components/header-icons.js?v=20260730-header-icon-single-1';

let routeSequence = 0;
let routeQueued = false;

function removeRetiredDailyCourtUi() {
  document.querySelectorAll(
    'a[href*="daily-court"], [data-nav-key="daily-court"], [data-daily-court]'
  ).forEach(element => element.remove());
}

function startRetiredUiGuard() {
  removeRetiredDailyCourtUi();
  const observer = new MutationObserver(removeRetiredDailyCourtUi);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function decodeRouteValue(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return '';
  }
}

function normalizedRoute() {
  const hash = location.hash || '';
  if (hash === '' || hash === '#') {
    const path = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/') return '#/';
    if (path === '/board') return '#/board';
    if (path === '/submit') return '#/submit';
    if (path === '/guide') return '#/guide';
    if (path === '/auth') return '#/auth';
    if (path === '/my-cases') return '#/my-cases';
    if (path.startsWith('/result/')) {
      const caseId = decodeRouteValue(path.replace('/result/', ''));
      return caseId ? `#/result/${encodeURIComponent(caseId)}` : '#/';
    }
    if (path.startsWith('/discussion/')) {
      const caseId = decodeRouteValue(path.replace('/discussion/', ''));
      return caseId ? `#/discussion/${encodeURIComponent(caseId)}` : '#/';
    }
    if (path.startsWith('/verdict/')) {
      const caseId = decodeRouteValue(path.replace('/verdict/', ''));
      return caseId ? `#/verdict/${encodeURIComponent(caseId)}` : '#/';
    }
    if (path.startsWith('/trial/')) {
      const caseId = decodeRouteValue(path.replace('/trial/', ''));
      return caseId ? `#/trial/${encodeURIComponent(caseId)}` : '#/';
    }
  }
  return hash || '#/';
}

function freshContentHost() {
  const current = document.getElementById('page-content');
  if (!current) return null;
  const next = current.cloneNode(false);
  current.replaceWith(next);
  return next;
}

function renderRouteError(content) {
  content.innerHTML = `
    <div class="page-header"><span class="logo">⚠️ 화면 오류</span></div>
    <div class="container" style="padding-top:56px;padding-bottom:90px;text-align:center;">
      <div class="card" style="padding:24px;">
        <div style="font-size:40px;margin-bottom:10px;" aria-hidden="true">🛠️</div>
        <div style="font-family:var(--font-serif);font-size:19px;font-weight:900;color:var(--gold);margin-bottom:8px;">화면을 불러오지 못했습니다</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;margin-bottom:18px;">네트워크 상태를 확인한 뒤 다시 시도해주세요.</div>
        <button type="button" class="btn btn-primary" id="route-reload-btn">새로고침</button>
        <a href="#/" class="btn btn-ghost" style="margin-top:10px;">홈으로 이동</a>
      </div>
    </div>`;
  content.querySelector('#route-reload-btn')?.addEventListener('click', () => location.reload());
}

async function route() {
  const sequence = ++routeSequence;
  if (window._pageCleanup) {
    try { window._pageCleanup(); }
    catch (err) { console.warn('page cleanup failed:', err); }
    window._pageCleanup = null;
  }

  const hash = normalizedRoute();
  if (hash === '#/auth' && await redirectAdminAccountRoute()) return;

  const content = freshContentHost();
  if (!content) return;
  window.scrollTo(0, 0);

  try {
    let renderTask;
    if (hash === '#/' || hash === '' || hash === '#') renderTask = renderHome(content);
    else if (hash === '#/submit') renderTask = renderSubmit(content);
    else if (hash.startsWith('#/trial/')) {
      const caseId = decodeRouteValue(hash.replace('#/trial/', ''));
      renderTask = caseId ? renderTrial(content, caseId) : renderHome(content);
    } else if (hash.startsWith('#/verdict/')) {
      const caseId = decodeRouteValue(hash.replace('#/verdict/', ''));
      renderTask = caseId ? renderResult(content, caseId) : renderHome(content);
    } else if (hash.startsWith('#/result/')) {
      const caseId = decodeRouteValue(hash.replace('#/result/', ''));
      renderTask = caseId ? renderResult(content, caseId) : renderHome(content);
    } else if (hash.startsWith('#/discussion/')) {
      const caseId = decodeRouteValue(hash.replace('#/discussion/', ''));
      renderTask = caseId ? renderDiscussion(content, caseId) : renderBoard(content);
    } else if (hash.startsWith('#/policy/')) renderTask = renderPolicy(content, hash.replace('#/policy/', ''));
    else if (hash === '#/my-cases') renderTask = renderMyCases(content);
    else if (hash === '#/guide') renderTask = renderGuide(content);
    else if (hash === '#/auth') renderTask = renderAuth(content);
    else if (hash === '#/board') renderTask = renderBoard(content);
    else if (hash === '#/jury') renderTask = renderJury(content);
    else renderTask = renderHome(content);

    renderNav(hash);
    removeRetiredDailyCourtUi();
    await renderTask;
    if (sequence !== routeSequence || !content.isConnected) return;
    removeRetiredDailyCourtUi();
    normalizePageHeaderIcons(content, hash);
    renderThemeToggle();
  } catch (err) {
    console.error('route render failed:', { hash, err });
    if (sequence === routeSequence && content.isConnected) {
      renderRouteError(content);
      renderNav(hash);
      removeRetiredDailyCourtUi();
      normalizePageHeaderIcons(content, hash);
      renderThemeToggle();
    }
  }
}

function scheduleRoute() {
  if (routeQueued) return;
  routeQueued = true;
  queueMicrotask(() => {
    routeQueued = false;
    route();
  });
}

window.addEventListener('hashchange', scheduleRoute);
window.addEventListener('popstate', scheduleRoute);

(async () => {
  startRetiredUiGuard();
  initTheme();
  initCourtDesign();
  try { await initAuth(); }
  catch (err) { console.error('initial authentication failed:', err); }
  initAdminLoginRedirect();
  initNavAuthSync();
  renderFooter();
  await route();
})();
