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
    .theme-preference-head{display:flex;align-items:center;justify-content:center;text-align:center;margin-bottom:12px;}
    .theme-preference-title{font-size:13px;font-weight:900;color:var(--gold);}
    .theme-preference-desc{font-size:11px;color:var(--cream-dim);line-height:1.55;margin-top:2px;}
    .theme-choice-wrap{display:flex;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,.045);border:1px solid rgba(201,168,76,.22);padding:10px;border-radius:999px;width:max-content;max-width:100%;margin:0 auto;}
    .theme-choice{width:48px;height:48px;border:1.5px solid rgba(201,168,76,.28);border-radius:50%;background:rgba(255,255,255,.055);color:#f5f0e8;font-size:23px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .18s ease;box-shadow:0 6px 16px rgba(0,0,0,.16);}
    .theme-choice span{display:block;line-height:1;}
    .theme-choice.active{background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#111827!important;box-shadow:0 8px 20px rgba(201,168,76,.25);border-color:rgba(232,201,122,.68);transform:scale(1.04);}
    .theme-choice:not(.active):hover{background:rgba(255,255,255,.10);border-color:rgba(232,201,122,.48);}
    [data-theme="light"] .theme-preference-card{background:#fffaf1;border-color:rgba(112,78,24,.28);}
    [data-theme="light"] .theme-preference-desc{color:#66503a;}
    [data-theme="light"] .theme-choice-wrap{background:rgba(0,0,0,.035);border-color:rgba(112,78,24,.22);}
    [data-theme="light"] .theme-choice{background:#fffdf8;color:#2f2417;border-color:rgba(112,78,24,.30);box-shadow:0 6px 16px rgba(70,46,16,.10);}
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
        <div class="theme-preference-desc">해·달 아이콘으로 보기 모드를 바꿉니다.</div>
      </div>
    </div>
    <div class="theme-choice-wrap">
      <button type="button" class="theme-choice ${selected === 'dark' ? 'active' : ''}" data-theme="dark" aria-label="다크 모드" aria-pressed="${selected === 'dark'}"><span aria-hidden="true">🌙</span></button>
      <button type="button" class="theme-choice ${selected === 'light' ? 'active' : ''}" data-theme="light" aria-label="라이트 모드" aria-pressed="${selected === 'light'}"><span aria-hidden="true">☀️</span></button>
    </div>`;
  host.appendChild(card);
  card.querySelectorAll('.theme-choice').forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));
}
