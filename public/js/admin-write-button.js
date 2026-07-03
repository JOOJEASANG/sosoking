import { navigate } from './router.js';

function ensureAdminWriteButton() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  if (!nav || nav.querySelector('[data-admin-write-shortcut]')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-menu-item admin-menu-item--write-shortcut';
  btn.dataset.adminWriteShortcut = '1';
  btn.innerHTML = '<span class="admin-menu-item__icon">✍️</span><span class="admin-menu-item__label">글쓰기</span>';
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    navigate('/write');
  });

  const postsBtn = nav.querySelector('[data-admin-tab="posts"], [data-tab="posts"]');
  if (postsBtn) postsBtn.insertAdjacentElement('afterend', btn);
  else nav.appendChild(btn);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureAdminWriteButton, 80);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(ensureAdminWriteButton, 300);
