import { auth, waitForAuthReady } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { loadAdminDashboard, adminPageHtml, bindAdminActions } from './admin-ui.js';

const ADMIN_EMAILS = new Set(['joojeasang@gmail.com']);
let user = null;
let adminAllowed = false;
let cache = null;
let loading = false;
let renderToken = 0;

function isAdminRoute() { return (location.hash || '').split('?')[0] === '#/admin'; }
async function resolveAdminAccess(current) {
  if (!current) return false;
  try {
    const tokenResult = await current.getIdTokenResult();
    const claimAdmin = tokenResult.claims?.admin === true;
    const verifiedEmailAdmin = current.emailVerified === true
      && current.email
      && ADMIN_EMAILS.has(current.email.toLowerCase());
    return claimAdmin || verifiedEmailAdmin;
  } catch {
    return false;
  }
}
function toast(message, error = false) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const item = document.createElement('div');
  item.className = `toast${error ? ' error' : ''}`;
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3500);
}
function errorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('permission-denied')) return '관리자 권한이 필요합니다.';
  if (code.includes('not-found')) return '신고 또는 사건을 찾을 수 없습니다.';
  return error?.message || '관리자 작업 중 오류가 발생했습니다.';
}
function injectNav() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;
  let link = nav.querySelector('[data-admin-nav]');
  if (!adminAllowed) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('a');
    link.className = 'nav-link';
    link.dataset.adminNav = 'true';
    link.href = '#/admin';
    link.textContent = '관리자';
    nav.querySelector('.user-chip')?.before(link);
  }
  link.classList.toggle('active', isAdminRoute());
}
function deniedPage() {
  return `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="receipt-check">!</div><h2>관리자 전용 화면입니다</h2><p>신고 검토와 콘텐츠 운영 권한이 있는 계정만 접근할 수 있습니다.</p><a class="button" href="#/">홈으로</a></div></div></section>`;
}
function loadingPage() {
  return `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="court-orbit compact"><span>⚖</span></div><h2>운영 현황을 불러오는 중입니다</h2><p>신고와 판결 상태를 확인하고 있습니다.</p></div></div></section>`;
}
async function refresh() {
  if (!adminAllowed || loading) return;
  loading = true;
  const token = ++renderToken;
  const page = document.querySelector('.page');
  if (page && isAdminRoute()) page.innerHTML = loadingPage();
  try { cache = await loadAdminDashboard(); }
  catch (error) { cache = { __error: errorMessage(error) }; }
  finally { loading = false; if (token === renderToken && isAdminRoute()) renderAdmin(); }
}
function renderAdmin() {
  if (!isAdminRoute()) return;
  const page = document.querySelector('.page');
  if (!page) return;
  injectNav();
  if (!adminAllowed) { page.innerHTML = deniedPage(); return; }
  if (cache === null) { refresh(); return; }
  if (cache.__error) {
    page.innerHTML = `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="receipt-check">!</div><h2>운영 현황을 불러오지 못했습니다</h2><p>${cache.__error}</p><button class="button button-primary" id="retry-admin" type="button">다시 불러오기</button></div></div></section>`;
    document.getElementById('retry-admin')?.addEventListener('click', () => { cache = null; refresh(); });
    return;
  }
  page.innerHTML = adminPageHtml(cache);
  bindAdminActions({
    onRefresh: async () => { cache = null; await refresh(); },
    showToast: message => toast(message),
    showError: error => toast(errorMessage(error), true),
  });
}
function scheduleRender() { setTimeout(() => { injectNav(); renderAdmin(); }, 0); }

window.addEventListener('hashchange', scheduleRender);
new MutationObserver(() => injectNav()).observe(document.getElementById('app'), { childList: true, subtree: true });
await waitForAuthReady();
onAuthStateChanged(auth, async current => {
  user = current;
  adminAllowed = await resolveAdminAccess(current);
  cache = null;
  scheduleRender();
});
scheduleRender();
