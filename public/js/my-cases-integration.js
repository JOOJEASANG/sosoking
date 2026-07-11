import { auth, waitForAuthReady } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { loadMyCases, myCasesPageHtml, bindMyCasesActions } from './my-cases-ui.js';

let user = null;
let cache = null;
let loading = false;
let renderToken = 0;

function isMyCasesRoute() { return (location.hash || '').split('?')[0] === '#/my-cases'; }
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
  if (code.includes('permission-denied')) return '본인 사건만 관리할 수 있습니다.';
  if (code.includes('not-found')) return '사건을 찾을 수 없습니다.';
  return error?.message || '사건 관리 중 오류가 발생했습니다.';
}
function injectNav() {
  const nav = document.querySelector('.main-nav');
  if (!nav || !user) return;
  let link = nav.querySelector('[data-my-cases-nav]');
  if (!link) {
    link = document.createElement('a');
    link.className = 'nav-link';
    link.dataset.myCasesNav = 'true';
    link.href = '#/my-cases';
    link.textContent = '내 사건';
    nav.querySelector('.user-chip')?.before(link);
  }
  link.classList.toggle('active', isMyCasesRoute());
}
function loginRequired() {
  return `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="receipt-check">!</div><h2>로그인 후 내 사건을 관리할 수 있습니다</h2><p>접수한 사건과 판결을 본인 계정에서 안전하게 관리합니다.</p><a class="button button-primary" href="#/login?next=${encodeURIComponent('/my-cases')}">로그인하고 계속하기</a></div></div></section>`;
}
function loadingPage() {
  return `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="court-orbit compact"><span>⚖</span></div><h2>내 사건을 불러오는 중입니다</h2><p>최근 사건부터 정리하고 있습니다.</p></div></div></section>`;
}
async function refresh() {
  if (!user || loading) return;
  loading = true;
  const token = ++renderToken;
  const page = document.querySelector('.page');
  if (page && isMyCasesRoute()) page.innerHTML = loadingPage();
  try { cache = await loadMyCases(user.uid); }
  catch (error) { cache = { error: errorMessage(error) }; }
  finally { loading = false; if (token === renderToken && isMyCasesRoute()) renderMyCases(); }
}
function renderMyCases() {
  if (!isMyCasesRoute()) return;
  const page = document.querySelector('.page');
  if (!page) return;
  injectNav();
  if (!user) { page.innerHTML = loginRequired(); return; }
  if (cache === null) { refresh(); return; }
  if (cache.error) {
    page.innerHTML = `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="receipt-check">!</div><h2>사건 목록을 불러오지 못했습니다</h2><p>${cache.error}</p><button class="button button-primary" id="retry-my-cases" type="button">다시 불러오기</button></div></div></section>`;
    document.getElementById('retry-my-cases')?.addEventListener('click', () => { cache = null; refresh(); });
    return;
  }
  page.innerHTML = myCasesPageHtml(cache);
  bindMyCasesActions({ onRefresh: async () => { cache = null; await refresh(); }, showToast: message => toast(message), showError: error => toast(errorMessage(error), true) });
}
function scheduleRender() { setTimeout(() => { injectNav(); renderMyCases(); }, 0); }

window.addEventListener('hashchange', scheduleRender);
const observer = new MutationObserver(() => injectNav());
observer.observe(document.getElementById('app'), { childList: true, subtree: true });

await waitForAuthReady();
onAuthStateChanged(auth, current => { user = current; cache = null; scheduleRender(); });
scheduleRender();
