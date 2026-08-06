import { initTheme, renderThemeToggle } from '/js/components/theme.js?v=20260729-theme-global-2';

function syncBrowserThemeColor() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const color = theme === 'light' ? '#f8f5fb' : '#17121f';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

initTheme();
renderThemeToggle();
syncBrowserThemeColor();

window.addEventListener('sosoking:themechange', syncBrowserThemeColor);
