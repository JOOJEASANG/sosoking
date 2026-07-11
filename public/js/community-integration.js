import { auth, waitForAuthReady } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  loadPublicCases,
  boardPageHtml,
  loadCommunity,
  communityPanelHtml,
  bindCommunityActions,
} from './community-ui.js';

let user = null;
let boardCache = null;
let boardLoading = false;
const communityCache = new Map();
const communityLoading = new Set();

function routeInfo() {
  const path = (location.hash || '#/').split('?')[0].replace(/^#/, '') || '/';
  const segments = path.split('/').filter(Boolean);
  return { path, segments };
}

function toast(message, error = false) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const item = document.createElement('div');
  item.className = `toast${error ? ' error' : ''}`;
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function injectBoardNav() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;
  let link = nav.querySelector('[data-board-nav]');
  if (!link) {
    link = document.createElement('a');
    link.className = 'nav-link';
    link.dataset.boardNav = 'true';
    link.href = '#/board';
    link.textContent = '공개 재판';
    const submit = [...nav.querySelectorAll('a')].find(item => item.getAttribute('href') === '#/submit');
    if (submit) submit.before(link);
    else nav.prepend(link);
  }
  link.classList.toggle('active', routeInfo().path === '/board');
}

function loadingPage(title = '공개 판결을 불러오는 중입니다') {
  return `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="court-orbit compact"><span>⚖</span></div><h2>${title}</h2><p>배심원단 기록을 정리하고 있습니다.</p></div></div></section>`;
}

async function refreshBoard() {
  if (boardLoading) return;
  boardLoading = true;
  const page = document.querySelector('.page');
  if (page && routeInfo().path === '/board') page.innerHTML = loadingPage();
  try {
    boardCache = await loadPublicCases();
  } catch (error) {
    boardCache = { error: error?.message || '공개 사건을 불러오지 못했습니다.' };
  } finally {
    boardLoading = false;
    if (routeInfo().path === '/board') renderBoard();
  }
}

function renderBoard() {
  if (routeInfo().path !== '/board') return;
  injectBoardNav();
  const page = document.querySelector('.page');
  if (!page) return;
  if (boardCache === null) {
    refreshBoard();
    return;
  }
  if (boardCache.error) {
    page.innerHTML = `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="receipt-check">!</div><h2>공개 재판을 불러오지 못했습니다</h2><p>${boardCache.error}</p><button class="button button-primary" id="retry-board" type="button">다시 불러오기</button></div></div></section>`;
    document.getElementById('retry-board')?.addEventListener('click', () => {
      boardCache = null;
      refreshBoard();
    });
    return;
  }
  page.innerHTML = boardPageHtml(boardCache);
}

async function refreshCommunity(caseId, force = false) {
  if (!force && communityCache.has(caseId)) return renderCommunity(caseId);
  if (communityLoading.has(caseId)) return;
  communityLoading.add(caseId);
  try {
    const data = await loadCommunity(caseId, user?.uid || null);
    communityCache.set(caseId, data || false);
  } catch (error) {
    communityCache.set(caseId, { error: error?.message || '배심원 의견을 불러오지 못했습니다.' });
  } finally {
    communityLoading.delete(caseId);
    const route = routeInfo();
    if (route.segments[0] === 'result' && route.segments[1] === caseId) renderCommunity(caseId, true);
  }
}

function renderCommunity(caseId, replace = false) {
  const route = routeInfo();
  if (route.segments[0] !== 'result' || route.segments[1] !== caseId) return;
  const shell = document.querySelector('.result-shell');
  if (!shell) return;
  const existingPanel = shell.querySelector('[data-community-case]');
  const existingError = shell.querySelector('.community-error');
  if ((existingPanel || existingError) && !replace) return;
  existingPanel?.remove();
  existingError?.remove();

  if (!communityCache.has(caseId)) {
    refreshCommunity(caseId);
    return;
  }
  const data = communityCache.get(caseId);
  if (data === false) return;
  if (data?.error) {
    shell.insertAdjacentHTML('beforeend', `<section class="card community-error"><strong>배심원 의견을 불러오지 못했습니다</strong><p>${data.error}</p><button class="button" id="retry-community" type="button">다시 시도</button></section>`);
    document.getElementById('retry-community')?.addEventListener('click', () => {
      communityCache.delete(caseId);
      refreshCommunity(caseId, true);
    });
    return;
  }

  const legalNotice = shell.querySelector('.legal-notice');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = communityPanelHtml(caseId, data, user).trim();
  const panel = wrapper.firstElementChild;
  if (legalNotice) legalNotice.before(panel);
  else shell.appendChild(panel);
  bindCommunityActions({
    caseId,
    user,
    refresh: async () => {
      communityCache.delete(caseId);
      boardCache = null;
      await refreshCommunity(caseId, true);
    },
    notify: (message, isError = false) => toast(message, isError),
  });
}

function renderForRoute() {
  injectBoardNav();
  const route = routeInfo();
  if (route.path === '/board') {
    renderBoard();
    return;
  }
  if (route.segments[0] === 'result' && route.segments[1]) renderCommunity(route.segments[1]);
}

window.addEventListener('hashchange', () => setTimeout(renderForRoute, 0));
const observer = new MutationObserver(() => {
  injectBoardNav();
  const route = routeInfo();
  if (route.path === '/board' && !document.querySelector('.board-page')) renderBoard();
  if (route.segments[0] === 'result' && route.segments[1] && document.querySelector('.result-shell')) renderCommunity(route.segments[1]);
});
observer.observe(document.getElementById('app'), { childList: true, subtree: true });

await waitForAuthReady();
onAuthStateChanged(auth, current => {
  user = current;
  communityCache.clear();
  document.querySelector('[data-community-case]')?.remove();
  document.querySelector('.community-error')?.remove();
  setTimeout(renderForRoute, 0);
});
setTimeout(renderForRoute, 0);
