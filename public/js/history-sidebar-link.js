// history-sidebar-link.js
// PC 사이드바에 역사자료 바로가기를 보강합니다.

function currentPath() {
  return window.location.hash.slice(1).split('?')[0] || '/';
}

function injectHistorySidebarLink() {
  const nav = document.querySelector('#site-sidebar .sidebar__nav');
  if (!nav || nav.querySelector('[data-nav="/history"]')) return;
  const feed = nav.querySelector('[data-nav="/feed"]');
  const link = document.createElement('a');
  link.href = '#/history';
  link.className = 'sidebar__nav-item';
  link.dataset.nav = '/history';
  link.setAttribute('aria-current', currentPath() === '/history' ? 'page' : 'false');
  if (currentPath() === '/history') link.classList.add('active');
  link.innerHTML = '<span style="width:22px;text-align:center;font-size:17px;line-height:1">📚</span><span>역사자료</span>';
  link.addEventListener('click', event => {
    event.preventDefault();
    window.location.hash = '/history';
  });
  if (feed) feed.insertAdjacentElement('afterend', link);
  else nav.prepend(link);
}

function syncActive() {
  const path = currentPath();
  document.querySelectorAll('#site-sidebar [data-nav]').forEach(link => {
    const active = link.dataset.nav === path;
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    injectHistorySidebarLink();
    syncActive();
  }, 80);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
