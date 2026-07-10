import { db } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderTrial as renderBaseTrial } from './trial.js?v=20260710-v2judgment1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const THEATER_STAGES = [
  ['📂','사건 접수'],
  ['🚓','초동 수사'],
  ['🔍','증거 감식'],
  ['⚔️','원고 주장'],
  ['🛡️','피고 반박'],
  ['🏛️','재판 심리'],
  ['🔨','판결 선고'],
];

function ensureTrialGameStyle() {
  if (document.getElementById('trial-game-style')) return;
  const style = document.createElement('style');
  style.id = 'trial-game-style';
  style.textContent = `
    #docket-card{border-radius:20px!important;background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 13%,var(--navy-card)),var(--navy-card))!important;}
    #docket-timeline>div{min-width:120px!important;border-radius:16px!important;position:relative;overflow:hidden;}
    #docket-timeline>div::after{content:'STAGE';position:absolute;right:7px;top:6px;font-size:8px;color:var(--cream-dim);font-weight:900;letter-spacing:.08em;opacity:.5;}
    .step-card{border-radius:18px!important;}
    .stage-clear{display:inline-flex;align-items:center;gap:5px;border:1px solid color-mix(in srgb,var(--green) 42%,transparent);background:color-mix(in srgb,var(--green) 12%,transparent);color:var(--green);border-radius:999px;padding:5px 9px;font-size:10px;font-weight:900;margin-bottom:8px;}
    .trial-boss-card{padding:16px;margin-bottom:14px;border-radius:18px;border:1px solid color-mix(in srgb,var(--red) 34%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--red) 10%,var(--navy-card)),color-mix(in srgb,var(--gold) 7%,var(--navy-card)));}
  `;
  document.head.appendChild(style);
}

function normalizeWording(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    node.nodeValue = node.nodeValue
      .replaceAll('생활형 처분', '황당 처분')
      .replaceAll('생활형', '황당')
      .replaceAll('검사의 주장', '원고측 주장')
      .replaceAll('변호인의 주장', '피고측 반박');
  });
}

function theaterMarkup() {
  return `<section id="trial-theater" class="court-shell trial-theater">
    <div class="trial-theater-head">
      <div><div class="court-kicker">LIVE COURT PROCEDURE</div><div class="trial-theater-title">사건이 실제 재판처럼 단계별로 진행됩니다</div></div>
      <div class="trial-theater-status" id="trial-theater-status">접수 기록 편철 중</div>
    </div>
    <div class="trial-theater-track">
      ${THEATER_STAGES.map(([icon,label], index) => `<div class="trial-theater-stage${index === 0 ? ' is-active' : ''}" data-theater-stage="${index}"><strong>${icon}</strong><span>${label}</span></div>`).join('')}
    </div>
  </section>`;
}

function setTheaterStage(index) {
  const safeIndex = Math.max(0, Math.min(THEATER_STAGES.length - 1, index));
  document.querySelectorAll('[data-theater-stage]').forEach((element, stageIndex) => {
    element.classList.toggle('is-done', stageIndex < safeIndex);
    element.classList.toggle('is-active', stageIndex === safeIndex);
  });
  const status = document.getElementById('trial-theater-status');
  if (status) status.textContent = `${THEATER_STAGES[safeIndex][1]} 진행 중`;
}

function renderMiniClaims(judgment = {}) {
  if (!judgment.plaintiffClaim || !judgment.defendantClaim || document.getElementById('trial-mini-claims')) return;
  const theater = document.getElementById('trial-theater');
  if (!theater) return;
  theater.insertAdjacentHTML('afterend', `<section id="trial-mini-claims" class="trial-mini-claims">
    <div class="trial-mini-claim plaintiff"><b>⚔️ 원고측 1분 주장</b><p>${escapeHtml(judgment.plaintiffClaim)}</p></div>
    <div class="trial-mini-vs">VS</div>
    <div class="trial-mini-claim defendant"><b>🛡️ 피고측 1분 반박</b><p>${escapeHtml(judgment.defendantClaim)}</p></div>
  </section>`);
}

function decorateTrial(container) {
  ensureTrialGameStyle();
  normalizeWording(container);
  const docket = document.getElementById('docket-card');
  if (docket && !document.getElementById('trial-theater')) docket.insertAdjacentHTML('afterend', theaterMarkup());
  if (docket && !document.getElementById('trial-game-brief')) {
    const theater = document.getElementById('trial-theater');
    theater?.insertAdjacentHTML('afterend', `
      <div id="trial-game-brief" class="trial-boss-card">
        <div class="court-kicker">FULL COURT DRAMA MODE</div>
        <div class="court-title" style="font-size:18px;">수사 → 양측 주장 → 법정공방 → 판결</div>
        <div class="court-desc">AI 수사관이 사건을 복원하고 원고측과 피고측의 핵심 논리를 만든 뒤, 검사·변호인·재판부가 같은 사실을 서로 다르게 해석합니다.</div>
      </div>`);
  }
  document.querySelectorAll('.step-card').forEach((card, index) => {
    if (card.querySelector('.stage-clear')) return;
    card.insertAdjacentHTML('afterbegin', `<div class="stage-clear">✅ 기록 ${index + 1} 편철 완료</div>`);
  });
}

export async function renderTrial(container, caseId) {
  await renderBaseTrial(container, caseId);
  decorateTrial(container);

  let visualStage = 0;
  const stageTimer = setInterval(() => {
    if (!document.body.contains(container)) return clearInterval(stageTimer);
    if (visualStage < THEATER_STAGES.length - 2) visualStage += 1;
    setTheaterStage(visualStage);
    decorateTrial(container);
  }, 1450);

  const unsubscribeResult = onSnapshot(doc(db, 'results', caseId), snapshot => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() || {};
    const judgment = data.judgment && typeof data.judgment === 'object' ? data.judgment : {};
    renderMiniClaims(judgment);
    if (judgment.opinion || judgment.orders?.length) {
      visualStage = THEATER_STAGES.length - 1;
      setTheaterStage(visualStage);
      const status = document.getElementById('trial-theater-status');
      if (status) status.textContent = '판결 기록 완성';
    }
  }, () => {});

  const decorationTimer = setInterval(() => {
    if (!document.body.contains(container)) return clearInterval(decorationTimer);
    decorateTrial(container);
  }, 500);

  const oldCleanup = window._pageCleanup;
  window._pageCleanup = () => {
    clearInterval(stageTimer);
    clearInterval(decorationTimer);
    unsubscribeResult();
    oldCleanup?.();
  };
}
