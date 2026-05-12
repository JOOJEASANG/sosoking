import { getResult, startNewHunt, formatTime } from '../game/ai-hunt-engine.js';

export function renderAiHuntResult(container) {
  const result = getResult();
  if (!result) { location.hash = '#/hunt'; return; }
  injectResultStyle();
  container.innerHTML = `
    <main class="hunt-result-page ${result.success ? 'success' : 'fail'}">
      <section class="result-card">
        <div class="result-stamp">${result.success ? '🚨' : '💨'}</div>
        <p class="result-kicker">AI HUNT RESULT</p>
        <h1>${result.success ? '검거 성공' : '검거 실패'}</h1>
        <h2>${esc(result.caseTitle)}</h2>
        <p class="result-line">${esc(result.line)}</p>
        <div class="result-stats">
          <div><span>수사망 압박도</span><b>${result.pressure}%</b></div>
          <div><span>AI 회피력</span><b>${result.escape}%</b></div>
          <div><span>확보 단서</span><b>${result.clues}</b></div>
          <div><span>모순 발견</span><b>${result.contradictions}</b></div>
          <div><span>실수</span><b>${result.wrongMoves}</b></div>
          <div><span>소요 시간</span><b>${formatTime(result.elapsedMs)}</b></div>
        </div>
        <div class="rank-box"><span>수사 등급</span><strong>${esc(result.rank)}</strong></div>
        <div class="result-actions">
          <button id="retry-hunt">새 사건 수사</button>
          <button onclick="location.hash='#/'">메인으로</button>
        </div>
      </section>
    </main>
  `;
  document.getElementById('retry-hunt')?.addEventListener('click', () => {
    startNewHunt();
    location.hash = '#/hunt/play';
  });
}

function injectResultStyle() {
  if (document.getElementById('hunt-result-style')) return;
  const style = document.createElement('style');
  style.id = 'hunt-result-style';
  style.textContent = `
    .hunt-result-page { min-height:100vh; padding:22px; display:flex; align-items:center; justify-content:center; background:#05070d; color:#ecf6ff; }
    .hunt-result-page.success { background:radial-gradient(circle at 50% 0%,rgba(0,229,255,.24),transparent 42%),linear-gradient(180deg,#05070d,#061522); }
    .hunt-result-page.fail { background:radial-gradient(circle at 50% 0%,rgba(255,55,95,.24),transparent 42%),linear-gradient(180deg,#05070d,#180910); }
    .result-card { width:100%; max-width:660px; border:1px solid rgba(102,234,255,.22); border-radius:28px; padding:26px; text-align:center; background:rgba(255,255,255,.045); box-shadow:0 24px 70px rgba(0,0,0,.36); }
    .fail .result-card { border-color:rgba(255,55,95,.28); }
    .result-stamp { width:84px; height:84px; margin:0 auto 12px; border-radius:28px; display:flex; align-items:center; justify-content:center; font-size:42px; background:rgba(0,229,255,.12); border:1px solid rgba(102,234,255,.24); }
    .fail .result-stamp { background:rgba(255,55,95,.12); border-color:rgba(255,55,95,.24); }
    .result-kicker { color:#66eaff; font-size:10px; font-weight:1000; letter-spacing:.18em; margin:0 0 8px; }
    .fail .result-kicker { color:#ff7b96; }
    .result-card h1 { margin:0; font-size:clamp(42px,12vw,76px); letter-spacing:-.06em; line-height:1; }
    .result-card h2 { margin:12px 0 0; color:rgba(236,246,255,.78); font-size:18px; }
    .result-line { max-width:520px; margin:16px auto 0; color:rgba(236,246,255,.72); line-height:1.7; }
    .result-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:22px; }
    .result-stats div { border:1px solid rgba(102,234,255,.14); border-radius:15px; padding:11px; background:rgba(255,255,255,.04); }
    .result-stats span { display:block; color:rgba(236,246,255,.56); font-size:10px; font-weight:900; }
    .result-stats b { display:block; margin-top:4px; color:#66eaff; font-size:18px; }
    .rank-box { margin-top:14px; border-radius:18px; padding:15px; background:linear-gradient(135deg,rgba(102,234,255,.14),rgba(255,55,95,.08)); }
    .rank-box span { display:block; font-size:11px; color:rgba(236,246,255,.62); font-weight:900; } .rank-box strong { display:block; margin-top:3px; color:#ecf6ff; font-size:24px; }
    .result-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px; }
    .result-actions button { border:0; border-radius:16px; padding:15px; font-weight:1000; cursor:pointer; }
    .result-actions button:first-child { background:linear-gradient(135deg,#66eaff,#d7fbff); color:#02050a; }
    .result-actions button:last-child { background:rgba(255,255,255,.07); color:#ecf6ff; border:1px solid rgba(255,255,255,.12); }
    @media(max-width:560px){ .result-card{padding:20px;} .result-stats{grid-template-columns:1fr 1fr;} .result-actions{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(style);
}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}
