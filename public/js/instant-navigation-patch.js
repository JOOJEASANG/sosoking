const NAV_BUSY_MS = 180;
let lastNavAt = 0;
let lastNavTarget = '';

function normalizeHash(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.startsWith('#/')) return value;
  if (value === '#') return '#/';
  return '';
}

function notifyRouteRequested() {
  document.dispatchEvent(new CustomEvent('soso-route-requested', { detail: { hash: location.hash || '#/' } }));
}

function navigate(hash, { replace = false } = {}) {
  const target = normalizeHash(hash);
  if (!target) return false;

  const now = Date.now();
  if (lastNavTarget === target && now - lastNavAt < NAV_BUSY_MS) return true;
  lastNavAt = now;
  lastNavTarget = target;

  if ((location.hash || '#/') === target) {
    notifyRouteRequested();
    return true;
  }

  if (replace) {
    history.replaceState(null, '', `${location.pathname}${location.search}${target}`);
    try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch { window.dispatchEvent(new Event('hashchange')); }
  } else {
    location.hash = target;
  }

  notifyRouteRequested();
  return true;
}

window.sosoNavigate = navigate;

document.addEventListener('click', event => {
  const avatar = event.target?.closest?.('.soso-dashboard-header .soso-top-avatar');
  if (avatar) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const user = window.firebaseAuthUser || null;
    navigate(user && !user.isAnonymous ? '#/account' : '#/login');
    return;
  }

  const link = event.target?.closest?.('a[href^="#/"]');
  if (!link) return;
  const target = normalizeHash(link.getAttribute('href'));
  if (!target || link.dataset.nativeNav === '1') return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  navigate(target);
}, true);

document.addEventListener('submit', event => {
  const form = event.target?.closest?.('.soso-top-search');
  if (!form) return;
  const input = form.querySelector('input');
  const q = input?.value?.trim() || '';
  if (q) sessionStorage.setItem('sosoFeedSearch', q);
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  navigate('#/feed');
}, true);

window.addEventListener('popstate', notifyRouteRequested);
