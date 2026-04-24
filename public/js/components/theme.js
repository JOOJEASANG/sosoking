const THEMES = ['light', 'dark'];
const ICONS = { dark: '🌙', light: '☀️' };
const LABELS = { dark: '다크', light: '라이트' };

export function initTheme() {
  applyTheme(localStorage.getItem('theme') || 'light');
}

export function renderThemeToggle() {
  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.setAttribute('aria-label', '테마 변경');
  updateBtn(btn, localStorage.getItem('theme') || 'light');

  btn.addEventListener('click', () => {
    const cur = localStorage.getItem('theme') || 'light';
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
