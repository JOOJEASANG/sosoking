function currentTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function applyTheme(theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-choice').forEach(btn => {
    const active = btn.dataset.theme === theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  window.dispatchEvent(new CustomEvent('sosoking-theme-change'));
}

function ensureStyle() {
  if (document.getElementById('theme-preference-style')) return;
  const style = document.createElement('style');
  style.id = 'theme-preference-style';
  style.textContent = `
    .theme-preference-card{padding:16px;margin-top:14px;background:linear-gradient(135deg,rgba(201,168,76,.07),rgba(255,255,255,.025));border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 2px 14px rgba(0,0,0,.18);}
    .theme-preference-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
    .theme-preference-title{font-size:13px;font-weight:900;color:var(--gold);}
    .theme-preference-desc{font-size:11px;color:var(--cream-dim);line-height:1.55;margin-top:2px;}
    .theme-choice-wrap{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(255,255,255,.06);border:1px solid rgba(201,168,76,.28);padding:5px;border-radius:16px;}
    .theme-choice{height:42px;border:1px solid rgba(201,168,76,.22);border-radius:12px;background:rgba(255,255,255,.055);color:#f5f0e8;font-family:var(--font-sans);font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .18s ease;}
    .theme-choice.active{background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#111827!important;box-shadow:0 6px 18px rgba(201,168,76,.23);border-color:rgba(232,201,122,.62);}
    .theme-choice:not(.active):hover{background:rgba(255,255,255,.10);color:#ffdf7a;}
    [data-theme="light"] .theme-preference-card{background:#fffaf1;border-color:rgba(112,78,24,.28);}
    [data-theme="light"] .theme-preference-desc{color:#66503a;}
    [data-theme="light"] .theme-choice-wrap{background:rgba(0,0,0,.035);border-color:rgba(112,78,24,.22);}
    [data-theme="light"] .theme-choice{background:#fffdf8;color:#2f2417;border-color:rgba(112,78,24,.28);}
    [data-theme="light"] .theme-choice.active{color:#111827!important;background:linear-gradient(135deg,#e6bf4d,#b77d08);}
  `;
  document.head.appendChild(style);
}

export function renderThemePreference() {
  ensureStyle();
  document.getElementById('theme-preference-card')?.remove();
  const host = document.querySelector('#auth-box')?.parentElement;
  if (!host) return;
  const selected = currentTheme();
  const card = document.createElement('div');
  card.id = 'theme-preference-card';
  card.className = 'theme-preference-card';
  card.innerHTML = `
    <div class="theme-preference-head">
      <div>
        <div class="theme-preference-title">화면 설정</div>
        <div class="theme-preference-desc">사이트 분위기에 맞게 보기 모드를 선택하세요.</div>
      </div>
    </div>
    <div class="theme-choice-wrap">
      <button type="button" class="theme-choice ${selected === 'dark' ? 'active' : ''}" data-theme="dark" aria-pressed="${selected === 'dark'}"><span>🌙</span><span>다크</span></button>
      <button type="button" class="theme-choice ${selected === 'light' ? 'active' : ''}" data-theme="light" aria-pressed="${selected === 'light'}"><span>☀️</span><span>라이트</span></button>
    </div>`;
  host.appendChild(card);
  card.querySelectorAll('.theme-choice').forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));
}
