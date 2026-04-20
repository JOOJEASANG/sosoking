const THEMES = ['system', 'dark', 'light'];
const ICONS = { system: '🌓', dark: '🌙', light: '☀️' };
const LABELS = { system: '시스템', dark: '다크', light: '라이트' };

export function initTheme() {
  applyTheme(localStorage.getItem('theme') || 'system');
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if ((localStorage.getItem('theme') || 'system') === 'system') applyTheme('system');
  });
}

export function renderThemeToggle() {
  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.setAttribute('aria-label', '테마 변경');
  updateBtn(btn, localStorage.getItem('theme') || 'system');

  btn.addEventListener('click', () => {
    const cur = localStorage.getItem('theme') || 'system';
    const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    localStorage.setItem('theme', next);
    applyTheme(next);
    updateBtn(btn, next);
  });

  document.body.appendChild(btn);
}

function updateBtn(btn, theme) {
  btn.textContent = ICONS[theme];
  btn.title = `테마: ${LABELS[theme]}`;
}

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
