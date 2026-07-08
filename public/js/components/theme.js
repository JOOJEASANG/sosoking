function systemPrefersLight() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

function storedTheme() {
  return localStorage.getItem('theme') || 'system';
}

function resolvedTheme() {
  const theme = storedTheme();
  if (theme === 'light' || theme === 'dark') return theme;
  return systemPrefersLight() ? 'light' : 'dark';
}

function ensureThemeToggleStyle() {
  if (document.getElementById('theme-toggle-style')) return;
  const style = document.createElement('style');
  style.id = 'theme-toggle-style';
  style.textContent = `
    .page-header .logo{flex:1;min-width:0;padding-right:46px;}
    .theme-toggle{margin-left:auto;flex-shrink:0;width:38px;height:38px;min-width:38px;padding:0;border-radius:50%;border:1.5px solid rgba(232,201,122,.46);background:rgba(13,17,23,.88);color:#fff8ec;font-size:19px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s ease,background .15s ease,border-color .15s ease,box-shadow .15s ease;box-shadow:0 7px 18px rgba(0,0,0,.20);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
    .theme-toggle:active{transform:scale(.94);}
    .theme-toggle:hover{border-color:#e8c97a;background:rgba(201,168,76,.18);box-shadow:0 9px 22px rgba(0,0,0,.24);}
    .theme-toggle-icon{display:block;font-size:19px;line-height:1;transform:translateY(-1px);}
    .theme-toggle-text{display:none!important;}
    .theme-toggle-floating{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:14px;z-index:1200;}
    .page-header .theme-toggle{position:absolute;right:14px;top:50%;transform:translateY(-50%);z-index:1200;}
    .page-header .theme-toggle:active{transform:translateY(-50%) scale(.94);}
    [data-theme="light"] .theme-toggle,:root:not([data-theme="dark"]) .theme-toggle{background:rgba(255,250,241,.96);color:#2f2417;border-color:rgba(112,78,24,.42);box-shadow:0 7px 18px rgba(70,46,16,.13);}
    [data-theme="light"] .theme-toggle:hover,:root:not([data-theme="dark"]) .theme-toggle:hover{background:#fff3cf;border-color:rgba(112,78,24,.62);box-shadow:0 9px 22px rgba(70,46,16,.15);}
    @media(max-width:360px){.page-header .logo{padding-right:42px}.theme-toggle{width:36px;height:36px;min-width:36px}.theme-toggle-icon{font-size:18px}}
  `;
  document.head.appendChild(style);
}

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  updateThemeToggleLabel();
}

function updateThemeToggleLabel() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const mode = resolvedTheme();
  const next = mode === 'light' ? 'dark' : 'light';
  btn.setAttribute('aria-label', next === 'light' ? '라이트 모드로 변경' : '다크 모드로 변경');
  btn.title = next === 'light' ? '라이트 모드' : '다크 모드';
  btn.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${mode === 'light' ? '🌙' : '☀️'}</span><span class="theme-toggle-text">${mode === 'light' ? '다크' : '라이트'}</span>`;
}

export function initTheme() {
  ensureThemeToggleStyle();
  applyTheme(storedTheme());
  window.addEventListener('sosoking-theme-change', () => updateThemeToggleLabel());
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (storedTheme() === 'system') applyTheme('system');
    });
  }
}

export function renderThemeToggle() {
  ensureThemeToggleStyle();
  document.getElementById('theme-toggle')?.remove();

  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.type = 'button';
  btn.className = 'theme-toggle';
  btn.addEventListener('click', () => {
    const next = resolvedTheme() === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent('sosoking-theme-change'));
  });

  const header = document.querySelector('.page-header');
  if (header) {
    header.appendChild(btn);
  } else {
    btn.classList.add('theme-toggle-floating');
    document.body.appendChild(btn);
  }
  updateThemeToggleLabel();
}
