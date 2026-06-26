import { renderHeader } from './components/header.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebar } from './components/sidebar.js';

function repairShellIds() {
  const shell = document.querySelector('.app-shell');
  if (!shell || document.querySelector('.game-only-shell')) return;

  const main = document.querySelector('.app-main');
  if (main) main.classList.add('site-main');

  const sidebar = document.getElementById('sidebar-root') || document.getElementById('site-sidebar');
  if (sidebar) {
    sidebar.id = 'site-sidebar';
    sidebar.classList.add('site-sidebar');
  }

  const header = document.getElementById('header-root') || document.getElementById('site-header');
  if (header) {
    header.id = 'site-header';
    header.classList.add('site-header');
  }

  const content = document.getElementById('page-content');
  if (content) content.classList.add('page-container');

  const bottom = document.getElementById('bottom-nav-root') || document.getElementById('bottom-nav');
  if (bottom) {
    bottom.id = 'bottom-nav';
    bottom.classList.add('bottom-nav');
  }
}

function rerenderLayoutParts() {
  repairShellIds();
  renderSidebar();
  renderHeader();
  renderBottomNav();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(rerenderLayoutParts, 40);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('themechange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
