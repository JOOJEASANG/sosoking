(function initializeThemeBeforePaint() {
  var saved = 'system';
  try {
    var candidate = localStorage.getItem('theme');
    if (candidate === 'light' || candidate === 'dark' || candidate === 'system') saved = candidate;
  } catch (error) {
    saved = 'system';
  }

  var isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  var resolved = saved === 'light' || saved === 'dark' ? saved : (isLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-choice', saved);
  document.documentElement.style.colorScheme = resolved;
})();
