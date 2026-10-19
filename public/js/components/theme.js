function systemPrefersLight() {
  return Boolean(window.matchMedia?.('(prefers-color-scheme: light)').matches);
}

function readStoredTheme() {
  try {
    return localStorage.getItem('theme');
  } catch (error) {
    console.warn('theme preference read skipped:', error?.name || error);
    return null;
  }
}

function writeStoredTheme(value) {
  try {
    localStorage.setItem('theme', value);
    return true;
  } catch (error) {
    console.warn('theme preference save skipped:', error?.name || error);
    return false;
  }
}

function storedTheme() {
  const saved = readStoredTheme();
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function resolveTheme(choice = storedTheme()) {
  if (choice === 'light' || choice === 'dark') return choice;
  return systemPrefersLight() ? 'light' : 'dark';
}

function ensureThemeToggleStyle() {
  if (document.getElementById('theme-toggle-style')) return;
  const style = document.createElement('style');
  style.id = 'theme-toggle-style';
  style.textContent = `
    .theme-toggle{margin-left:auto;flex:0 0 38px;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border-radius:50%;border:1px solid var(--border);background:var(--surface-soft);color:var(--cream);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s ease,background .15s ease,border-color .15s ease,color .15s ease;box-shadow:0 5px 16px rgba(0,0,0,.16);}
    .theme-toggle:active{transform:scale(.96);}
    .theme-toggle:hover{border-color:var(--gold);background:var(--gold-dim);color:var(--gold);}
    .theme-toggle:focus-visible{outline:3px solid color-mix(in srgb,var(--gold) 70%,transparent);outline-offset:3px;}
    .theme-toggle-icon{font-size:18px;line-height:1;}
    #theme-toggle.theme-toggle-floating{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:14px;bottom:auto;width:38px;height:38px;z-index:500;box-shadow:var(--shadow);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
    @media (prefers-reduced-motion:reduce){.theme-toggle{transition:none!important;}.theme-toggle:hover,.theme-toggle:active{transform:none!important;}}
  `;
  document.head.appendChild(style);
}

function applyTheme(choice) {
  const normalized = choice === 'light' || choice === 'dark' ? choice : 'system';
  const resolved = resolveTheme(normalized);
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-choice', normalized);
  root.style.colorScheme = resolved;
  updateThemeToggleLabel();
  window.dispatchEvent(new CustomEvent('sosoking:themechange', { detail: { choice: normalized, resolved } }));
}

function updateThemeToggleLabel() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const mode = resolveTheme();
  const next = mode === 'light' ? 'dark' : 'light';
  btn.setAttribute('aria-label', next === 'light' ? '라이트 모드로 변경' : '다크 모드로 변경');
  btn.title = next === 'light' ? '라이트 모드' : '다크 모드';
  btn.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${mode === 'light' ? '🌙' : '☀️'}</span>`;
}

export function initTheme() {
  ensureThemeToggleStyle();
  applyTheme(storedTheme());
  if (window.matchMedia) {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const listener = () => { if (storedTheme() === 'system') applyTheme('system'); };
    query.addEventListener?.('change', listener);
  }
}

export function setThemePreference(choice) {
  const normalized = choice === 'light' || choice === 'dark' ? choice : 'system';
  writeStoredTheme(normalized);
  applyTheme(normalized);
}

export function renderThemeToggle() {
  ensureThemeToggleStyle();
  document.getElementById('theme-toggle')?.remove();
  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.type = 'button';
  btn.className = 'theme-toggle theme-toggle-floating';
  btn.addEventListener('click', () => {
    const next = resolveTheme() === 'light' ? 'dark' : 'light';
    setThemePreference(next);
  });
  document.body.appendChild(btn);
  updateThemeToggleLabel();
}
