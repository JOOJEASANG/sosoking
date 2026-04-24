export function initTheme() {
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('theme', 'dark');
}

export function renderThemeToggle() {
  // 다크모드 전용 — 토글 없음
}
