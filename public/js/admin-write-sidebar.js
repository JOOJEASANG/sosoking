function goWrite() {
  window.location.hash = '#/write?type=multi';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function addDesktopWriteShortcut() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  if (!nav) return;

  // 예전 홈 버튼만 제거하고, PC 글쓰기 버튼은 다른 정리 모듈이 지우지 못하는 별도 속성으로 유지합니다.
  nav.querySelectorAll('[data-admin-home-shortcut], .admin-menu-item--home-shortcut').forEach(el => el.remove());

  const existing = nav.querySelector('[data-admin-pc-write-shortcut]');
  if (existing) return;

  const aiBtn = nav.querySelector('[data-admin-tab="ai"], [data-tab="ai"]');
  if (!aiBtn) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-menu-item admin-menu-item--pc-write';
  btn.dataset.adminPcWriteShortcut = 'true';
  btn.innerHTML = '<span class="admin-menu-item__icon">✍️</span><span class="admin-menu-item__label">글쓰기</span>';
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    goWrite();
  });

  aiBtn.insertAdjacentElement('afterend', btn);
}

function bindMobileProfileWrite() {
  const btn = document.getElementById('admin-profile-write-btn');
  if (!btn || btn.dataset.writeBound === '1') return;
  btn.dataset.writeBound = '1';
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    goWrite();
  });
}

function run() {
  setTimeout(() => {
    addDesktopWriteShortcut();
    bindMobileProfileWrite();
  }, 80);
}

window.addEventListener('hashchange', run);
window.addEventListener('sosoking:extensions-ready', run);
new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
run();
