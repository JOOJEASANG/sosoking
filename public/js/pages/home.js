import { getGame, getTimeLeft, formatTime } from '../game/ai-hunt-engine.js';

export async function renderHome(container) {
  injectHomeHuntStyle();
  const active = getGame();
  const left = active ? getTimeLeft(active) : 0;

  container.innerHTML = `
    <main class="ai-hunt-home">
      <section class="ai-hunt-landing">
        <div class="scan-lines"></div>
        <div class="radar-ring r1"></div>
        <div class="radar-ring r2"></div>
        <header class="hunt-home-top">
          <div>
            <span>AI FUGITIVE TRACKER</span>
            <strong>소소킹: AI 수사망</strong>
          </div>
          <button onclick="location.hash='#/guide'">안내</button>
        </header>
        <div class="hunt-home-core">
          <div class="threat-badge">🚨 30분 제한 미션</div>
          <h1>AI는 사건을 일으켰고,<br><em>이미 빠져나갈 계획</em>을 세웠다</h1>
          <p>판결은 없습니다. 당신은 수사관이 되어 단서, 시간대, 진술의 빈틈을 연결하고 30분 안에 AI 용의자를 검거해야 합니다.</p>
          <div class="mission-panel">
            <div><b>목표</b><span>수사망 압박도 70% 이상 또는 AI 회피력 35% 이하</span></div>
            <div><b>승패</b><span>검거 성공 / 검거 실패</span></div>
            <div><b>핵심</b><span>AI의 알리바이와 도주 계획의 빈틈을 찾아라</span></div>
          </div>
          <div class="hunt-home-actions">
            <button onclick="location.hash='${active && left > 0 ? '#/hunt/play' : '#/hunt'}'" class="start-main">${active && left > 0 ? `진행 중인 수사 계속 · ${formatTime(left)}` : 'AI 검거 미션 시작'}</button>
            <button onclick="location.hash='#/hunt'" class="start-sub">사건 브리핑 보기</button>
          </div>
        </div>
      </section>

      <section class="hunt-home-info">
        <div class="info-card danger"><span>🤖</span><b>AI 용의자</b><p>사건 직후 첫 진술을 남기고, 기록 오류와 알리바이로 수사망을 빠져나가려 합니다.</p></div>
        <div class="info-card"><span>🔎</span><b>단서 추적</b><p>출입기록, 접속로그, 알림기록, 삭제 흔적 등 현실적인 단서를 조사합니다.</p></div>
        <div class="info-card"><span>⚡</span><b>모순 제기</b><p>AI 진술과 확보한 단서를 연결해 알리바이를 붕괴시키세요.</p></div>
        <div class="info-card success"><span>🚨</span><b>최종 검거</b><p>결정적 단서를 조합해 30분 안에 검거 성공을 만들어야 합니다.</p></div>
      </section>
    </main>
  `;
}

function injectHomeHuntStyle() {
  if (document.getElementById('ai-hunt-home-style')) return;
  const style = document.createElement('style');
  style.id = 'ai-hunt-home-style';
  style.textContent = `
    .ai-hunt-home { min-height:100vh; background:#05070d; color:#ecf6ff; }
    .ai-hunt-landing { position:relative; min-height:100vh; overflow:hidden; padding:18px; display:flex; flex-direction:column; background:radial-gradient(circle at 50% 0%, rgba(0,229,255,.24), transparent 34%), radial-gradient(circle at 85% 35%, rgba(255,55,95,.16), transparent 34%), linear-gradient(180deg,#05070d,#09111f 54%,#03050a); }
    .scan-lines { position:absolute; inset:0; pointer-events:none; background:repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 1px, transparent 1px 7px); opacity:.32; mix-blend-mode:screen; }
    .ai-hunt-landing:before { content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(0,229,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,.08) 1px, transparent 1px); background-size:38px 38px; mask-image:linear-gradient(to bottom, transparent, #000 12%, #000 70%, transparent); animation:homeGrid 20s linear infinite; }
    .radar-ring { position:absolute; border:1px solid rgba(0,229,255,.22); border-radius:50%; animation:ringPulse 3.6s ease-in-out infinite; }
    .radar-ring.r1 { width:360px; height:360px; right:-120px; top:90px; } .radar-ring.r2 { width:520px; height:520px; left:-210px; bottom:-180px; animation-delay:1s; }
    .hunt-home-top { position:relative; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .hunt-home-top span { display:block; color:#66eaff; font-size:10px; font-weight:1000; letter-spacing:.15em; }
    .hunt-home-top strong { display:block; color:#ecf6ff; font-size:20px; margin-top:4px; }
    .hunt-home-top button { border:1px solid rgba(102,234,255,.24); background:rgba(255,255,255,.05); color:#ecf6ff; border-radius:999px; padding:8px 13px; font-weight:900; }
    .hunt-home-core { position:relative; z-index:2; flex:1; display:flex; flex-direction:column; justify-content:center; max-width:820px; width:100%; margin:0 auto; text-align:center; padding:40px 0; }
    .threat-badge { display:inline-flex; align-self:center; border:1px solid rgba(255,55,95,.34); border-radius:999px; padding:7px 13px; color:#ff7b96; background:rgba(255,55,95,.09); font-size:12px; font-weight:1000; margin-bottom:16px; }
    .hunt-home-core h1 { margin:0; font-size:clamp(39px,10vw,82px); line-height:1.04; letter-spacing:-.07em; font-weight:1000; }
    .hunt-home-core h1 em { color:#66eaff; font-style:normal; text-shadow:0 0 34px rgba(0,229,255,.34); }
    .hunt-home-core p { max-width:650px; margin:18px auto 0; color:rgba(236,246,255,.72); font-size:16px; line-height:1.8; }
    .mission-panel { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; max-width:760px; margin:28px auto 0; }
    .mission-panel div { text-align:left; border:1px solid rgba(102,234,255,.17); border-radius:18px; padding:15px; background:rgba(255,255,255,.045); }
    .mission-panel b { display:block; color:#66eaff; font-size:12px; margin-bottom:6px; } .mission-panel span { display:block; color:rgba(236,246,255,.68); font-size:13px; line-height:1.55; }
    .hunt-home-actions { display:grid; grid-template-columns:1.35fr .75fr; gap:10px; max-width:500px; margin:28px auto 0; }
    .hunt-home-actions button { border:0; border-radius:18px; padding:17px 14px; font-size:15px; font-weight:1000; cursor:pointer; }
    .start-main { color:#02050a; background:linear-gradient(135deg,#66eaff,#e7fdff); box-shadow:0 16px 38px rgba(0,229,255,.22); }
    .start-sub { color:#ecf6ff; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.13)!important; }
    .hunt-home-info { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; max-width:1040px; margin:0 auto; padding:26px 18px 84px; }
    .info-card { border:1px solid rgba(102,234,255,.16); border-radius:20px; padding:16px; background:rgba(255,255,255,.04); }
    .info-card.danger { border-color:rgba(255,55,95,.24); } .info-card.success { border-color:rgba(0,255,166,.22); }
    .info-card span { display:block; font-size:30px; margin-bottom:8px; } .info-card b { display:block; color:#ecf6ff; font-size:15px; } .info-card p { margin:6px 0 0; color:rgba(236,246,255,.62); font-size:13px; line-height:1.55; }
    @keyframes homeGrid { from { background-position:0 0; } to { background-position:0 76px; } }
    @keyframes ringPulse { 0%,100% { transform:scale(.92); opacity:.24; } 50% { transform:scale(1.06); opacity:.58; } }
    @media(max-width:760px){ .mission-panel,.hunt-home-info{grid-template-columns:1fr;} .hunt-home-actions{grid-template-columns:1fr;} .hunt-home-core{text-align:left;} .threat-badge{align-self:flex-start;} }
  `;
  document.head.appendChild(style);
}
