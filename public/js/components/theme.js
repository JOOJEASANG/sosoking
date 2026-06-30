export function initTheme() {
  const theme = localStorage.getItem('theme') || 'system';
  applyTheme(theme);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if ((localStorage.getItem('theme') || 'system') === 'system') applyTheme('system');
  });
}

export function renderThemeToggle() {
  document.getElementById('theme-toggle')?.remove();
}

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
