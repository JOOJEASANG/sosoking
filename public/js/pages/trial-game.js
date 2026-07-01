import { renderTrial as renderBaseTrial } from './trial.js?v=20260702-11';

function ensureTrialGameStyle() {
  if (document.getElementById('trial-game-style')) return;
  const style = document.createElement('style');
  style.id = 'trial-game-style';
  style.textContent = `
    #docket-card{border-radius:20px!important;background:linear-gradient(135deg,rgba(231,76,60,.14),rgba(201,168,76,.13),rgba(255,255,255,.04))!important;}
    #docket-timeline>div{min-width:120px!important;border-radius:16px!important;position:relative;overflow:hidden;}
    #docket-timeline>div::after{content:'LIVE';position:absolute;right:7px;top:6px;font-size:8px;color:rgba(255,248,236,.32);font-weight:900;letter-spacing:.08em;}
    .step-card{border-radius:18px!important;}
    .stage-clear{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(231,76,60,.38);background:rgba(231,76,60,.12);color:#ffb3ac;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:900;margin-bottom:8px;}
    .trial-boss-card{padding:16px;margin-bottom:14px;border-radius:18px;border:1px solid rgba(231,76,60,.35);background:linear-gradient(135deg,rgba(231,76,60,.13),rgba(201,168,76,.08));}
  `;
  document.head.appendChild(style);
}
function decorateTrial(container) {
  ensureTrialGameStyle();
  const docket = document.getElementById('docket-card');
  if (docket && !document.getElementById('trial-game-brief')) {
    docket.insertAdjacentHTML('afterend', `
      <div id="trial-game-brief" class="trial-boss-card">
        <div class="court-kicker">LIVE MODE</div>
        <div class="court-title" style="font-size:18px;">속보 → 브리핑 → 쟁점 → 위원회 결정 → 소소 처분</div>
        <div class="court-desc">한 줄 다툼이 긴급속보로 터지고, 소소분쟁위원회가 괜히 엄중하게 결정합니다.</div>
      </div>`);
  }
  document.querySelectorAll('.step-card').forEach((card, idx) => {
    if (card.querySelector('.stage-clear')) return;
    card.insertAdjacentHTML('afterbegin', `<div class="stage-clear">🚨 LIVE ${idx + 1}</div>`);
  });
}

export async function renderTrial(container, caseId) {
  await renderBaseTrial(container, caseId);
  decorateTrial(container);
  const timer = setInterval(() => {
    if (!document.body.contains(container)) return clearInterval(timer);
    decorateTrial(container);
  }, 400);
  const oldCleanup = window._pageCleanup;
  window._pageCleanup = () => { clearInterval(timer); oldCleanup?.(); };
}
