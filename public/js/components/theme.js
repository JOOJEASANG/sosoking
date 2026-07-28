function systemPrefersLight() {
  return Boolean(window.matchMedia?.('(prefers-color-scheme: light)').matches);
}

function storedTheme() {
  const saved = localStorage.getItem('theme');
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
    .page-header .logo{flex:1;min-width:0;}
    .theme-toggle{margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:68px;height:34px;padding:0 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface-soft);color:var(--cream);font-family:var(--font-sans);font-size:11px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s ease,background .15s ease,border-color .15s ease,color .15s ease;}
    .theme-toggle:active{transform:scale(.96);}
    .theme-toggle:hover{border-color:var(--gold);background:var(--gold-dim);color:var(--gold);}
    .theme-toggle-icon{font-size:14px;line-height:1;}
    .theme-toggle-text{line-height:1;}
    .theme-toggle-floating{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:14px;z-index:250;box-shadow:var(--shadow);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
    @media(max-width:360px){.theme-toggle{min-width:38px;width:38px;padding:0}.theme-toggle-text{display:none}}
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
  btn.innerHTML = `<span class="theme-toggle-icon">${mode === 'light' ? '🌙' : '☀️'}</span><span class="theme-toggle-text">${mode === 'light' ? '다크' : '라이트'}</span>`;
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
  localStorage.setItem('theme', normalized);
  applyTheme(normalized);
}

export function renderThemeToggle() {
  ensureThemeToggleStyle();
  document.getElementById('theme-toggle')?.remove();
  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.type = 'button';
  btn.className = 'theme-toggle';
  btn.addEventListener('click', () => {
    const next = resolveTheme() === 'light' ? 'dark' : 'light';
    setThemePreference(next);
  });
  const header = document.querySelector('.page-header');
  if (header) header.appendChild(btn);
  else {
    btn.classList.add('theme-toggle-floating');
    document.body.appendChild(btn);
  }
  updateThemeToggleLabel();
}
