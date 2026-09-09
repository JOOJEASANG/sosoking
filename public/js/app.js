import { initAuth, auth } from './firebase.js?v=20260729-auth-session-1';
import { signOut, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { startIdleSessionTimeout } from './session-timeout.js?v=20260831-idle-timeout-1';
import { initAdminLoginRedirect, redirectAdminAccountRoute } from './admin-access.js?v=20260730-admin-redirect-1';
import { renderHome } from './pages/home.js?v=20260908-home-tw-1';
import { renderSubmit } from './pages/submit.js?v=20260906-list-fix-1';
import { renderTrial } from './pages/trial.js?v=20260906-trial-flow-2';
import { renderResult } from './pages/result-comments.js?v=20260906-result-clean-1';
import { renderDebate } from './pages/debate.js?v=20260907-debate-2';
import { renderClinic } from './pages/clinic.js?v=20260907-clinic-2';
import { renderTranslate } from './pages/translate.js?v=20260909-translate-1';
import { renderDiscussion } from './pages/discussion.js?v=20260830-final-blind-1';
import { renderPolicy } from './pages/policy.js?v=20260830-final-audit-1';
import { renderMyCases } from './pages/my-cases-game.js?v=20260810-mycase-light-1';
import { renderGuide } from './pages/guide.js?v=20260830-final-audit-1';
import { renderAuth } from './pages/auth2.js?v=20260829-avatar-1';
import { renderHall } from './pages/hall.js?v=20260830-final-blind-1';
import { renderJury } from './pages/jury.js?v=20260901-daily-vote-feedback-1';
import { renderFooter } from './components/footer.js?v=20260729-brand-policy-1';
import { initTheme, renderThemeToggle } from './components/theme.js?v=20260729-theme-global-2';
import { initCourtDesign } from './components/court-design.js?v=20260729-light-home-1';
import { initNavAuthSync, renderNav } from './components/nav.js?v=20260829-arena-1';
import { normalizePageHeaderIcons } from './components/header-icons.js?v=20260829-arena-1';
import { showToast } from './components/toast.js?v=20260630-3';

let routeSequence = 0;
let routeQueued = false;

let _cardObserver = null;
function initCardObserver() {
  if (_cardObserver) _cardObserver.disconnect();
  _cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.transitionDelay = `${i * 55}ms`;
      el.classList.add('anim-card-in');
      _cardObserver.unobserve(el);
    });
  }, { threshold: 0.08 });
}

function observeCards(container) {
  if (!_cardObserver) initCardObserver();
  container.querySelectorAll('.card:not(.anim-card-in)').forEach(el => {
    el.classList.add('anim-card');
    _cardObserver.observe(el);
  });
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
    if (path === '/jury') return '#/jury';
    if (path === '/submit') return '#/submit';
    if (path === '/guide') return '#/guide';
    if (path === '/auth') return '#/auth';
    if (path === '/my-cases') return '#/my-cases';
    if (path === '/debate') return '#/debate';
    if (path.startsWith('/debate/')) {
      const debateId = decodeRouteValue(path.replace('/debate/', ''));
      return debateId ? `#/debate/${encodeURIComponent(debateId)}` : '#/debate';
    }
    if (path === '/clinic') return '#/clinic';
    if (path === '/translate') return '#/translate';
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
    catch (error) { console.warn('page cleanup failed:', error); }
    window._pageCleanup = null;
  }

  const hash = normalizedRoute();
  if (hash === '#/auth' && await redirectAdminAccountRoute()) return;

  // 나가는 페이지 fade-out
  const outgoing = document.getElementById('page-content');
  if (outgoing && outgoing.firstChild) {
    outgoing.style.opacity = '0';
    outgoing.style.transform = 'translateY(-6px)';
    await new Promise(r => setTimeout(r, 190));
    if (sequence !== routeSequence) return;
  }

  const content = freshContentHost();
  if (!content) return;
  // 들어오는 페이지 초기 상태 (숨김)
  content.style.opacity = '0';
  content.style.transform = 'translateY(10px)';
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
      renderTask = caseId ? renderDiscussion(content, caseId) : renderHall(content);
    } else if (hash.startsWith('#/debate/')) {
      const debateId = decodeRouteValue(hash.replace('#/debate/', ''));
      renderTask = renderDebate(content, debateId);
    } else if (hash === '#/debate') renderTask = renderDebate(content);
    else if (hash === '#/clinic') renderTask = renderClinic(content);
    else if (hash === '#/translate') renderTask = renderTranslate(content);
    else if (hash.startsWith('#/policy/')) renderTask = renderPolicy(content, hash.replace('#/policy/', ''));
    else if (hash === '#/my-cases') renderTask = renderMyCases(content);
    else if (hash === '#/guide') renderTask = renderGuide(content);
    else if (hash === '#/auth') renderTask = renderAuth(content);
    else if (hash === '#/board') renderTask = renderHall(content);
    else if (hash === '#/jury') renderTask = renderJury(content);
    else renderTask = renderHome(content);

    renderNav(hash);
    await renderTask;
    if (sequence !== routeSequence || !content.isConnected) return;
    normalizePageHeaderIcons(content, hash);
    renderThemeToggle();
    // 들어오는 페이지 fade-in + 카드 입장
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        content.style.opacity = '';
        content.style.transform = '';
        observeCards(content);
      });
    });
  } catch (error) {
    console.error('route render failed:', { hash, error });
    if (sequence === routeSequence && content.isConnected) {
      renderRouteError(content);
      renderNav(hash);
      normalizePageHeaderIcons(content, hash);
      renderThemeToggle();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          content.style.opacity = '';
          content.style.transform = '';
        });
      });
    }
  }
}

function scheduleRoute() {
  if (routeQueued) return;
  routeQueued = true;
  queueMicrotask(() => {
    routeQueued = false;
    void route();
  });
}

async function autoLogoutInactiveUser() {
  await signOut(auth);
  await signInAnonymously(auth).catch(error => {
    console.warn('anonymous session restore after idle logout failed:', error?.code || error);
  });
  showToast('30분 동안 활동이 없어 자동 로그아웃되었습니다.', 'info');
  if (location.hash === '#/auth') scheduleRoute();
  else location.hash = '#/auth';
}

window.addEventListener('hashchange', scheduleRoute);
window.addEventListener('popstate', scheduleRoute);

(async () => {
  initTheme();
  initCourtDesign();
  try { await initAuth(); }
  catch (error) { console.error('initial authentication failed:', error); }
  startIdleSessionTimeout({ auth, onTimeout: autoLogoutInactiveUser });
  initAdminLoginRedirect();
  initNavAuthSync();
  renderFooter();
  await route();
})();