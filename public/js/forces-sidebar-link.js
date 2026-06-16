// forces-sidebar-link.js — PC 사이드바에 외부세력 링크 추가
import { navigate } from './router.js';

const LINK_PATH = '/forces';

function currentPath() {
  return window.location.hash.slice(1).split('?')[0] || '/';
}

function syncActive() {
  const path = currentPath();
  document.querySelectorAll('[data-nav="/forces"]').forEach(link => {
    const active = path === LINK_PATH;
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function injectForcesLink() {
  const nav = document.querySelector('#site-sidebar .sidebar__nav');
  if (!nav || nav.querySelector('[data-nav="/forces"]')) return;
  const republic = nav.querySelector('[data-nav="/republic"]');
  const link = document.createElement('a');
  link.href = '#/forces';
  link.className = 'sidebar__nav-item';
  link.dataset.nav = '/forces';
  link.innerHTML = '<span>⚡ 외부세력</span>';
  link.addEventListener('click', e => {
    e.preventDefault();
    navigate('/forces');
  });
  if (republic?.nextSibling) nav.insertBefore(link, republic.nextSibling);
  else nav.appendChild(link);
  syncActive();
}

injectForcesLink();
window.addEventListener('hashchange', syncActive);
new MutationObserver(injectForcesLink).observe(document.body, { childList: true, subtree: true });
