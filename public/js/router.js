/* router.js — 해시 기반 SPA 라우터 */

const routes = {};
let currentPage = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentPath() {
  const hash = window.location.hash.slice(1) || '/';
  return hash.split('?')[0];
}

export function getQueryParams() {
  const hash = window.location.hash.slice(1) || '/';
  const idx = hash.indexOf('?');
  if (idx < 0) return {};
  const qs = hash.slice(idx + 1);
  return Object.fromEntries(new URLSearchParams(qs));
}

async function handleRoute() {
  const path = getCurrentPath();

  if (currentPage?.destroy) currentPage.destroy();

  const exact   = routes[path];
  const dynamic = findDynamicRoute(path);
  const handler = exact || dynamic?.handler;

  if (!handler) {
    routes['/'] ? routes['/']({}) : renderNotFound();
    return;
  }

  const params = dynamic?.params || {};
  currentPage = await handler(params) || null;
}

function findDynamicRoute(path) {
  for (const pattern of Object.keys(routes)) {
    if (!pattern.includes(':')) continue;
    const regex = new RegExp('^' + pattern.replace(/:([^/]+)/g, '(?<$1>[^/]+)') + '$');
    const m = path.match(regex);
    if (m) return { handler: routes[pattern], params: m.groups || {} };
  }
  return null;
}

function renderNotFound() {
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = `
    <div class="empty-state" style="padding: 80px 24px;">
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">페이지를 찾을 수 없어요</div>
      <div class="empty-state__desc">주소가 잘못됐거나 삭제된 페이지예요</div>
      <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/')">홈으로</button>
    </div>`;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
