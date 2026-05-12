import { startNewHunt } from '../game/ai-hunt-engine.js';

export function renderAiHunt(container) {
  injectAiHuntStyle();
  container.innerHTML = `
    <main class="hunt-page hunt-start-page">
      <section class="hunt-hero">
        <div class="hunt-grid-bg"></div>
        <div class="hunt-status-bar">
          <span>AI FUGITIVE PROTOCOL</span>
          <b>30:00 MISSION</b>
        </div>
        <div class="hunt-hero-content">
          <div class="hunt-mark">🧠</div>
          <p class="hunt-kicker">SOSOKING · AI HUNT</p>
          <h1>AI는 이미<br><span>빠져나갈 계획</span>을 세웠다</h1>
          <p class="hunt-lead">당신은 30분 안에 단서와 진술의 빈틈을 연결해 AI 용의자의 도주 계획을 깨야 합니다.</p>
          <div class="hunt-command-card">
            <div><strong>미션 목표</strong><span>AI 회피력을 낮추고 수사망 압박도를 높여 최종 검거에 성공하세요.</span></div>
            <div><strong>결과</strong><span>판결은 없습니다. 오직 검거 성공 또는 검거 실패뿐입니다.</span></div>
          </div>
          <div class="hunt-actions">
            <button id="start-hunt-btn" class="hunt-primary">🚨 30분 수사 시작</button>
            <button onclick="location.hash='#/'" class="hunt-secondary">메인으로</button>
          </div>
        </div>
      </section>
    </main>
  `;

  document.getElementById('start-hunt-btn')?.addEventListener('click', () => {
    startNewHunt();
    location.hash = '#/hunt/play';
  });
}

function injectAiHuntStyle() {
  if (document.getElementById('ai-hunt-style')) return;
  const style = document.createElement('style');
  style.id = 'ai-hunt-style';
  style.textContent = `
    .hunt-page { min-height:100vh; background:#05070d; color:#ecf6ff; font-family:var(--font-sans); }
    .hunt-hero { position:relative; min-height:100vh; overflow:hidden; padding:24px; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 0%, rgba(0,229,255,.22), transparent 38%), radial-gradient(circle at 10% 80%, rgba(255,45,85,.16), transparent 36%), linear-gradient(180deg,#05070d,#09111f 52%,#03050a); }
    .hunt-grid-bg { position:absolute; inset:0; background-image:linear-gradient(rgba(0,229,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,.08) 1px, transparent 1px); background-size:36px 36px; mask-image:linear-gradient(to bottom, transparent, #000 18%, #000 70%, transparent); opacity:.45; animation:huntGrid 18s linear infinite; }
    .hunt-status-bar { position:absolute; left:18px; right:18px; top:16px; z-index:2; display:flex; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid rgba(0,229,255,.25); border-radius:14px; background:rgba(4,9,18,.72); backdrop-filter:blur(12px); }
    .hunt-status-bar span { color:#66eaff; font-size:10px; font-weight:900; letter-spacing:.14em; } .hunt-status-bar b { color:#ff375f; font-size:11px; letter-spacing:.08em; }
    .hunt-hero-content { position:relative; z-index:2; width:100%; max-width:720px; text-align:center; padding-top:24px; }
    .hunt-mark { width:82px; height:82px; margin:0 auto 14px; display:flex; align-items:center; justify-content:center; border-radius:26px; font-size:44px; background:linear-gradient(135deg, rgba(0,229,255,.18), rgba(255,45,85,.12)); border:1px solid rgba(102,234,255,.34); box-shadow:0 0 42px rgba(0,229,255,.18); }
    .hunt-kicker { color:#66eaff; font-size:11px; font-weight:900; letter-spacing:.18em; margin:0 0 10px; }
    .hunt-hero h1 { margin:0; font-size:clamp(38px,11vw,76px); line-height:1.04; letter-spacing:-.06em; font-weight:1000; }
    .hunt-hero h1 span { color:#ff375f; text-shadow:0 0 28px rgba(255,55,95,.32); }
    .hunt-lead { max-width:560px; margin:16px auto 0; color:rgba(236,246,255,.72); font-size:16px; line-height:1.75; }
    .hunt-command-card { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:26px auto 0; max-width:620px; }
    .hunt-command-card > div { text-align:left; border:1px solid rgba(102,234,255,.18); border-radius:18px; padding:15px; background:rgba(255,255,255,.045); }
    .hunt-command-card strong { display:block; color:#66eaff; font-size:12px; margin-bottom:6px; } .hunt-command-card span { display:block; color:rgba(236,246,255,.68); font-size:13px; line-height:1.55; }
    .hunt-actions { display:grid; grid-template-columns:1.4fr .8fr; gap:10px; max-width:440px; margin:24px auto 0; }
    .hunt-primary, .hunt-secondary { border:0; border-radius:18px; padding:16px 14px; font-weight:1000; cursor:pointer; }
    .hunt-primary { color:#02050a; background:linear-gradient(135deg,#66eaff,#d7fbff); box-shadow:0 14px 34px rgba(0,229,255,.22); }
    .hunt-secondary { color:#ecf6ff; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); }
    @keyframes huntGrid { from { background-position:0 0; } to { background-position:0 72px; } }
    @media(max-width:560px){ .hunt-hero{padding:18px;} .hunt-command-card{grid-template-columns:1fr;} .hunt-actions{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(style);
}
