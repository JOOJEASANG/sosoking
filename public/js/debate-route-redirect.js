// debate-route-redirect.js — 토론실을 AI 놀이터와 분리합니다.
function redirectLegacyDebateRoute() {
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  if (path === '/playground/lounge' || path === '/feed' || path === '/write') {
    window.location.hash = '#/debates';
  }
}

redirectLegacyDebateRoute();
window.addEventListener('hashchange', redirectLegacyDebateRoute);
