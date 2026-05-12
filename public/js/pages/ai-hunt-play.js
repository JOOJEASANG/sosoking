import { getGame, getCurrentCase, getTimeLeft, formatTime, getAvailableClues, investigateLocation, interrogate, submitContradiction, attemptArrest } from '../game/ai-hunt-engine.js';
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

let interval = null;
let selectedStatement = 0;
let selectedEvidence = '';
let arrestEvidence = new Set();

export function renderAiHuntPlay(container) {
  injectHuntPlayStyle();
  const game = getGame();
  if (!game) { location.hash = '#/hunt'; return; }
  const c = getCurrentCase(game);
  container.innerHTML = `
    <main class="hunt-play-page">
      <header class="hunt-play-header">
        <button onclick="location.hash='#/hunt'">‹</button>
        <div><span>AI FUGITIVE CASE</span><strong>${esc(c.title)}</strong></div>
        <b id="hunt-timer">${formatTime(getTimeLeft(game))}</b>
      </header>
      <section class="hunt-briefing">
        <div class="suspect-core">
          <div class="suspect-face">🤖</div>
          <div><small>AI 용의자 첫 진술</small><p>“${esc(c.suspectClaim)}”</p></div>
        </div>
        <div class="escape-plan"><b>숨겨진 도주 시나리오</b><span>${esc(c.escapePlan || 'AI는 이미 빠져나갈 계획을 세웠습니다. 출입기록, 시간대, 진술의 빈틈을 압박하세요.')}</span></div>
      </section>
      <section class="hunt-meters">
        ${meter('수사망 압박도','pressure', game.pressure)}
        ${meter('AI 회피력','escape', game.escape)}
        ${meter('단서 확보','clues', Math.round((game.cluesFound.length / c.locations.length) * 100))}
        ${meter('모순 발견','contradictions', Math.round((game.contradictionsSolved.length / c.contradictions.length) * 100))}
      </section>
      <section class="hunt-board">
        <div class="hunt-panel">
          <div class="panel-title">현장 조사</div>
          <div class="clue-grid" id="clue-grid">
            ${getAvailableClues(game).map(loc => `<button class="clue-node ${loc.found ? 'found' : ''} ${loc.locked ? 'locked' : ''}" data-loc="${escAttr(loc.id)}" ${loc.locked ? 'disabled' : ''}><span>${loc.icon}</span><b>${esc(loc.name)}</b><small>${loc.locked ? '수사 진척 필요' : loc.found ? '확보 완료' : '조사하기'}</small></button>`).join('')}
          </div>
        </div>
        <div class="hunt-panel">
          <div class="panel-title">AI 심문</div>
          <div id="suspect-log" class="suspect-log"><p>AI가 침착하게 수사망을 빠져나갈 틈을 보고 있습니다.</p></div>
          <div class="interrogate-grid">
            ${c.statements.map((s, i) => `<button data-question="${i}">${i+1}. ${esc(s)}</button>`).join('')}
          </div>
        </div>
        <div class="hunt-panel wide">
          <div class="panel-title">모순 제기</div>
          <div class="contradiction-layout">
            <div><label>AI 진술 선택</label>${c.contradictions.map((x, i) => `<button class="statement-choice ${i===0?'active':''}" data-statement="${i}">“${esc(x.statementKey)}...”</button>`).join('')}</div>
            <div><label>제출할 단서 선택</label><div id="evidence-select">${c.locations.map(loc => `<button class="evidence-choice ${game.cluesFound.includes(loc.id)?'':'disabled'}" data-evidence="${escAttr(loc.id)}" ${game.cluesFound.includes(loc.id)?'':'disabled'}>${loc.icon} ${esc(loc.name)}</button>`).join('')}</div></div>
          </div>
          <button id="submit-contradiction" class="objection-btn">⚡ 모순 제기</button>
        </div>
        <div class="hunt-panel wide arrest-panel">
          <div class="panel-title">최종 검거</div>
          <p>AI의 도주 계획을 깨뜨릴 결정적 단서 2개를 선택하세요.</p>
          <div class="arrest-evidence-grid">${c.locations.map(loc => `<button class="arrest-evidence ${game.cluesFound.includes(loc.id)?'':'disabled'}" data-arrest-evidence="${escAttr(loc.id)}" ${game.cluesFound.includes(loc.id)?'':'disabled'}>${loc.icon}<b>${esc(loc.name)}</b></button>`).join('')}</div>
          <button id="attempt-arrest" class="arrest-btn">🚨 검거 시도</button>
        </div>
      </section>
    </main>`;
  bind(container);
  startTimer();
}

function bind(container){
  container.querySelectorAll('[data-loc]').forEach(btn=>btn.addEventListener('click',()=>{ const r=investigateLocation(btn.dataset.loc); if(r) toast(r.location.name, r.line); renderAiHuntPlay(container); }));
  container.querySelectorAll('[data-question]').forEach(btn=>btn.addEventListener('click',async()=>{
    const questionIndex = Number(btn.dataset.question);
    const log=document.getElementById('suspect-log');
    const local = interrogate(questionIndex);
    if(!local)return;
    refreshMeters(local.game);
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'AI 답변 생성 중...';
    if(log) log.innerHTML = `<p><b>AI 용의자:</b> 수사망을 계산하며 답변을 고르고 있습니다...</p>`;
    try {
      const latestGame = getGame();
      const currentCase = getCurrentCase(latestGame);
      const fn = httpsCallable(functions, 'interrogateAiHuntSuspect');
      const res = await fn({
        caseId: latestGame.remoteCaseId || latestGame.caseId,
        question: currentCase.statements[questionIndex] || oldText,
        pressure: latestGame.pressure,
        escape: latestGame.escape
      });
      const line = res.data?.line || local.line;
      if(log) log.innerHTML = `<p><b>AI 용의자:</b> “${esc(line)}”</p>`;
    } catch {
      if(log) log.innerHTML = `<p><b>${esc(local.speaker)}:</b> “${esc(local.line)}”</p><small class="fallback-note">AI 실시간 답변 연결 전이라 기본 방어 진술을 표시했습니다.</small>`;
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }));
  container.querySelectorAll('[data-statement]').forEach(btn=>btn.addEventListener('click',()=>{ selectedStatement=Number(btn.dataset.statement); container.querySelectorAll('.statement-choice').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); }));
  container.querySelectorAll('[data-evidence]').forEach(btn=>btn.addEventListener('click',()=>{ selectedEvidence=btn.dataset.evidence; container.querySelectorAll('.evidence-choice').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); }));
  document.getElementById('submit-contradiction')?.addEventListener('click',()=>{ if(!selectedEvidence) return toast('단서 선택 필요','확보한 단서 중 하나를 선택하세요.'); const r=submitContradiction(selectedStatement, selectedEvidence); if(!r)return; toast(r.success?'모순 발견':'AI가 빠져나감', r.result); setTimeout(()=>renderAiHuntPlay(container), 650); });
  container.querySelectorAll('[data-arrest-evidence]').forEach(btn=>btn.addEventListener('click',()=>{ const id=btn.dataset.arrestEvidence; if(arrestEvidence.has(id)){ arrestEvidence.delete(id); btn.classList.remove('active'); } else { arrestEvidence.add(id); btn.classList.add('active'); } }));
  document.getElementById('attempt-arrest')?.addEventListener('click',()=>{ const r=attemptArrest([...arrestEvidence]); if(!r)return; location.hash='#/hunt/result'; });
}

function startTimer(){ clearInterval(interval); interval=setInterval(()=>{ const el=document.getElementById('hunt-timer'); if(!el){clearInterval(interval);return;} const left=getTimeLeft(); el.textContent=formatTime(left); if(left<=0){ attemptArrest([]); location.hash='#/hunt/result'; } },1000); window._pageCleanup=()=>clearInterval(interval); }
function refreshMeters(game){ document.querySelector('[data-meter="pressure"] i')?.style.setProperty('width', `${game.pressure}%`); document.querySelector('[data-meter="pressure"] b').textContent=game.pressure; document.querySelector('[data-meter="escape"] i')?.style.setProperty('width', `${game.escape}%`); document.querySelector('[data-meter="escape"] b').textContent=game.escape; }
function meter(label,key,value){ return `<div class="hunt-meter" data-meter="${key}"><span>${label}</span><div><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div><b>${value}</b></div>`; }
function toast(title,msg){ const box=document.getElementById('toast-container'); if(!box) return; const el=document.createElement('div'); el.className='toast show'; el.innerHTML=`<strong>${esc(title)}</strong><br>${esc(msg)}`; box.appendChild(el); setTimeout(()=>el.remove(),2600); }
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');} function escAttr(s){return esc(s);}

function injectHuntPlayStyle(){ if(document.getElementById('hunt-play-style'))return; const style=document.createElement('style'); style.id='hunt-play-style'; style.textContent=`
.hunt-play-page{min-height:100vh;background:#05070d;color:#ecf6ff;padding-bottom:80px;background-image:radial-gradient(circle at 20% 0%,rgba(0,229,255,.16),transparent 34%),radial-gradient(circle at 90% 30%,rgba(255,55,95,.12),transparent 32%)}
.hunt-play-header{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:rgba(5,7,13,.88);backdrop-filter:blur(14px);border-bottom:1px solid rgba(102,234,255,.18)}.hunt-play-header button{border:0;background:transparent;color:#ecf6ff;font-size:28px}.hunt-play-header span{display:block;color:#66eaff;font-size:9px;font-weight:900;letter-spacing:.14em}.hunt-play-header strong{display:block;font-size:14px}.hunt-play-header>b{color:#ff375f;font-size:18px;font-weight:1000}
.hunt-briefing,.hunt-meters,.hunt-board{max-width:980px;margin:0 auto;padding:14px}.suspect-core{display:flex;gap:12px;align-items:center;border:1px solid rgba(102,234,255,.2);border-radius:20px;padding:14px;background:rgba(255,255,255,.04)}.suspect-face{width:58px;height:58px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:34px;background:linear-gradient(135deg,rgba(0,229,255,.18),rgba(255,55,95,.14))}.suspect-core small{color:#66eaff;font-weight:900}.suspect-core p{margin:4px 0 0;color:#ecf6ff;line-height:1.45}.escape-plan{margin-top:10px;border:1px solid rgba(255,55,95,.22);border-radius:18px;padding:12px;background:rgba(255,55,95,.06)}.escape-plan b{display:block;color:#ff5878;font-size:12px}.escape-plan span{display:block;margin-top:4px;color:rgba(236,246,255,.68);font-size:13px;line-height:1.55}
.hunt-meters{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.hunt-meter{border:1px solid rgba(102,234,255,.16);border-radius:14px;padding:10px;background:rgba(255,255,255,.035)}.hunt-meter span{display:block;color:rgba(236,246,255,.64);font-size:10px;font-weight:900;margin-bottom:7px}.hunt-meter div{height:8px;background:rgba(255,255,255,.09);border-radius:999px;overflow:hidden}.hunt-meter i{display:block;height:100%;background:linear-gradient(90deg,#66eaff,#ff375f);border-radius:inherit;transition:width .25s}.hunt-meter b{display:block;text-align:right;color:#66eaff;font-size:10px;margin-top:4px}
.hunt-board{display:grid;grid-template-columns:1fr 1fr;gap:12px}.hunt-panel{border:1px solid rgba(102,234,255,.18);border-radius:20px;padding:14px;background:rgba(255,255,255,.04)}.hunt-panel.wide{grid-column:1/-1}.panel-title{color:#66eaff;font-size:12px;font-weight:1000;letter-spacing:.08em;margin-bottom:10px}.clue-grid,.interrogate-grid,.arrest-evidence-grid{display:grid;gap:8px}.clue-node,.interrogate-grid button,.evidence-choice,.statement-choice,.arrest-evidence{border:1px solid rgba(102,234,255,.16);border-radius:14px;background:rgba(255,255,255,.045);color:#ecf6ff;padding:11px;text-align:left;cursor:pointer}.interrogate-grid button:disabled{opacity:.62;cursor:wait}.clue-node span{font-size:23px}.clue-node b,.arrest-evidence b{display:block;font-size:12px;margin-top:4px}.clue-node small{display:block;color:rgba(236,246,255,.55);font-size:10px;margin-top:3px}.clue-node.found{border-color:#66eaff;background:rgba(0,229,255,.09)}.locked,.disabled{opacity:.38!important;cursor:not-allowed!important}.suspect-log{min-height:72px;border-radius:14px;padding:12px;background:rgba(0,0,0,.22);color:rgba(236,246,255,.76);font-size:13px;line-height:1.55;margin-bottom:10px}.suspect-log .fallback-note{display:block;margin-top:6px;color:rgba(236,246,255,.44);font-size:11px}.contradiction-layout{display:grid;grid-template-columns:1fr 1fr;gap:10px}.contradiction-layout label{display:block;color:rgba(236,246,255,.6);font-size:10px;font-weight:900;margin-bottom:6px}.statement-choice,.evidence-choice{display:block;width:100%;margin-bottom:6px}.active{border-color:#ff375f!important;background:rgba(255,55,95,.12)!important}.objection-btn,.arrest-btn{width:100%;margin-top:10px;border:0;border-radius:16px;padding:15px;background:linear-gradient(135deg,#ff375f,#ff8a9f);color:#090b10;font-weight:1000;cursor:pointer}.arrest-panel p{color:rgba(236,246,255,.68);font-size:13px;line-height:1.55}.arrest-evidence{text-align:center}.arrest-evidence span{font-size:22px}
@media(max-width:720px){.hunt-meters{grid-template-columns:1fr 1fr}.hunt-board{grid-template-columns:1fr}.contradiction-layout{grid-template-columns:1fr}}`; document.head.appendChild(style); }
