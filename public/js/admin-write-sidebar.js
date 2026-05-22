function addDesktopWriteShortcut() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  if (!nav) return;
  nav.querySelectorAll('[data-admin-home-shortcut], .admin-menu-item--home-shortcut').forEach(el => el.remove());
  nav.querySelectorAll('[data-admin-write-shortcut], .admin-menu-item--write-shortcut').forEach(el => el.remove());

  const aiBtn = nav.querySelector('[data-admin-tab="ai"], [data-tab="ai"]');
  if (!aiBtn) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-menu-item admin-menu-item--write-shortcut';
  btn.dataset.adminWriteShortcut = 'true';
  btn.innerHTML = '<span class="admin-menu-item__icon">✍️</span><span class="admin-menu-item__label">글쓰기</span>';
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    window.location.hash = '#/write?type=multi';
  });

  aiBtn.insertAdjacentElement('afterend', btn);
}

function run() {
  setTimeout(addDesktopWriteShortcut, 80);
}

window.addEventListener('hashchange', run);
window.addEventListener('sosoking:extensions-ready', run);
new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
run();
