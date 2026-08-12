const STORAGE_KEY = 'theme';

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function storedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

function resolvedTheme(choice = storedTheme()) {
  return choice === 'light' || choice === 'dark' ? choice : systemTheme();
}

function saveTheme(choice) {
  try { localStorage.setItem(STORAGE_KEY, choice); } catch {}
}

function updateMetaTheme(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f5f2ec' : '#0b101a';
}

function updateButton(button) {
  if (!button) return;
  const current = resolvedTheme();
  const next = current === 'light' ? 'dark' : 'light';
  button.textContent = current === 'light' ? '🌙' : '☀️';
  button.setAttribute('aria-label', next === 'light' ? '라이트 모드로 변경' : '다크 모드로 변경');
  button.title = next === 'light' ? '라이트 모드' : '다크 모드';
}

function applyTheme(choice = storedTheme()) {
  const normalized = choice === 'light' || choice === 'dark' ? choice : 'system';
  const resolved = resolvedTheme(normalized);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeChoice = normalized;
  document.documentElement.style.colorScheme = resolved;
  updateMetaTheme(resolved);
  updateButton(document.querySelector('.game-theme-toggle'));
}

function mountToggle() {
  if (document.querySelector('.game-theme-toggle')) return;
  const header = document.querySelector('.game-header, .topbar');
  if (!header) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-theme-toggle';
  header.classList.add('has-theme-toggle');
  button.addEventListener('click', () => {
    const next = resolvedTheme() === 'light' ? 'dark' : 'light';
    saveTheme(next);
    applyTheme(next);
  });
  header.appendChild(button);
  updateButton(button);
}

function removeCourtBottomNav() {
  document.getElementById('bottom-nav')?.remove();
}

function normalizeGameAudienceCopy() {
  document.querySelectorAll('.kicker').forEach(node => {
    if (node.textContent?.trim() === 'SOSOKING FAMILY GAME') node.textContent = 'SOSOKING PARTY GAME';
  });
  document.querySelectorAll('input[placeholder]').forEach(input => {
    if (input.placeholder === '예: 아빠') input.placeholder = '예: 초성왕';
    if (input.placeholder === '예: 엄마') input.placeholder = '예: 폭탄맨';
  });
}

function normalizeGameSurface() {
  removeCourtBottomNav();
  normalizeGameAudienceCopy();
}

applyTheme();
mountToggle();
normalizeGameSurface();

const gameSurfaceObserver = new MutationObserver(normalizeGameSurface);
gameSurfaceObserver.observe(document.body, { childList: true, subtree: true });

window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (storedTheme() === 'system') applyTheme('system');
});
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) applyTheme();
});
window.addEventListener('pagehide', () => gameSurfaceObserver.disconnect(), { once: true });
