function addAdminHomeButton() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  if (!nav || nav.querySelector('[data-admin-home-shortcut]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-menu-item admin-menu-item--home-shortcut';
  btn.dataset.adminHomeShortcut = '1';
  btn.innerHTML = '<span class="admin-menu-item__icon">🏠</span><span class="admin-menu-item__label">홈</span>';
  btn.onclick = function () { window.location.hash = '#/'; };
  nav.insertBefore(btn, nav.firstElementChild);
}

function runSoon() {
  setTimeout(addAdminHomeButton, 80);
}

window.addEventListener('hashchange', runSoon);
window.addEventListener('sosoking:extensions-ready', runSoon);
new MutationObserver(runSoon).observe(document.documentElement, { childList: true, subtree: true });
runSoon();
