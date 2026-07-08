import { renderResult as renderBaseResult } from './result.js?v=20260708-result1';

function grievance(container) {
  const text = container.textContent || '';
  const m = text.match(/억울지수\s*(\d+)/);
  return Number(m?.[1] || 5);
}
function gradeByLv(lv) {
  if (lv >= 10) return ['SS', '전설의 억울함'];
  if (lv >= 8) return ['S', '제404호 긴급사건'];
  if (lv >= 6) return ['A', '황당재판 주요 사건'];
  if (lv >= 4) return ['B', '방청석 소환 가능'];
  return ['C', '사소하지만 기록됨'];
}
function badgesBy(container, lv) {
  const text = container.textContent || '';
  const badges = [];
  badges.push(['📜', '황당판결 발급']);
  if (lv >= 8) badges.push(['🔥', '과몰입 인정']);
  if (text.includes('이미지 감정')) badges.push(['🖼️', '이미지 증거']);
  if (text.includes('드립형')) badges.push(['🎭', '법정 드립']);
  if (text.includes('엄벌주의형')) badges.push(['👨‍⚖️', '엄숙 재판']);
  if (text.includes('항소심')) badges.push(['🏛️', '항소 경험']);
  if (text.includes('배심원')) badges.push(['🧑‍⚖️', '배심원 공개']);
  return badges.slice(0, 5);
}
function ensureResultGameStyle() {
  if (document.getElementById('result-game-style')) return;
  const style = document.createElement('style');
  style.id = 'result-game-style';
  style.textContent = `
    .reward-card{padding:18px;margin-bottom:14px;border-radius:20px;border:1px solid rgba(201,168,76,.45);background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(231,76,60,.08),rgba(255,255,255,.035));box-shadow:0 12px 34px rgba(0,0,0,.24);}
    .reward-grade{width:70px;height:70px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-family:var(--font-serif);font-size:32px;font-weight:900;color:#111827;background:linear-gradient(135deg,#ffdf7a,#c9a84c);box-shadow:0 10px 26px rgba(201,168,76,.28);}
    .reward-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(201,168,76,.36);background:rgba(255,255,255,.07);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;color:#fff8ec;}
    .invite-defense{padding:16px;margin-bottom:14px;border-radius:18px;border:1px dashed rgba(201,168,76,.48);background:rgba(201,168,76,.07);}
    .invite-defense-title{font-weight:900;color:#e8c97a;margin-bottom:6px;}
    .invite-defense-desc{font-size:12px;color:rgba(255,248,236,.78);line-height:1.7;margin-bottom:12px;}
    [data-theme="light"] .reward-badge,:root:not([data-theme="dark"]) .reward-badge{color:#fff8ec;background:rgba(13,17,23,.82);}
  `;
  document.head.appendChild(style);
}
function addReward(container) {
  if (document.getElementById('game-reward-card')) return;
  const lv = grievance(container);
  const [grade, label] = gradeByLv(lv);
  const badges = badgesBy(container, lv);
  const target = container.querySelector('.container > .card');
  if (!target) return;
  target.insertAdjacentHTML('afterend', `
    <div id="game-reward-card" class="reward-card">
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
        <div class="reward-grade">${grade}</div>
        <div style="flex:1;min-width:0;">
          <div class="court-kicker">JUDGEMENT REWARD</div>
          <div class="court-title" style="font-size:20px;">${label}</div>
          <div class="court-desc">아무것도 아닌 일이 황당재판 기록으로 등록되었습니다.</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${badges.map(([i, t]) => `<span class="reward-badge">${i} ${t}</span>`).join('')}</div>
    </div>`);
}
function addInviteDefense(container) {
  if (document.getElementById('invite-defense-card')) return;
  const actions = container.querySelector('.result-actions');
  if (!actions) return;
  actions.insertAdjacentHTML('beforebegin', `
    <div id="invite-defense-card" class="invite-defense">
      <div class="invite-defense-title">⚔️ 친구 변호 초대 준비중</div>
      <div class="invite-defense-desc">친구를 원고 측/피고 측 변호인으로 초대해서 서로 변론하는 기능을 붙일 수 있습니다. 지금은 황당판결 링크를 복사해 공유할 수 있습니다.</div>
      <button class="btn btn-secondary" id="copy-defense-link">친구에게 사건 링크 복사</button>
    </div>`);
  document.getElementById('copy-defense-link')?.addEventListener('click', async () => {
    const url = location.href;
    try { await navigator.clipboard?.writeText(url); alert('사건 링크를 복사했습니다.'); }
    catch { prompt('아래 링크를 복사하세요.', url); }
  });
}
function decorateResult(container) {
  ensureResultGameStyle();
  const titleCard = container.querySelector('.container > .card');
  if (titleCard && !document.getElementById('court-result-header')) {
    titleCard.classList.add('court-shell');
    titleCard.insertAdjacentHTML('afterbegin', `
      <div id="court-result-header" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
        <span class="court-stamp">선고</span>
        <span class="court-kicker">FINAL STAGE CLEAR</span>
      </div>
      <div class="court-bench"></div>`);
  }
  addReward(container);
  const verdictCard = container.querySelector('.verdict-card');
  if (verdictCard && !document.getElementById('court-verdict-label')) {
    verdictCard.classList.add('court-document');
    verdictCard.insertAdjacentHTML('afterbegin', `
      <div id="court-verdict-label" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
        <div><div class="court-kicker">JUDGEMENT DOCUMENT</div><div class="court-title" style="font-size:19px;">황당재판 판결문</div></div>
        <div class="court-seal" style="width:48px;height:48px;font-size:22px;">⚖️</div>
      </div>`);
  }
  const reactionBox = Array.from(container.querySelectorAll('.card')).find(el => el.textContent.includes('배심원 투표'));
  if (reactionBox && !reactionBox.classList.contains('court-jury-box')) {
    reactionBox.classList.add('court-document', 'court-jury-box');
    reactionBox.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:5px;">CITIZEN JURY VERDICT</div>`);
    reactionBox.querySelectorAll('.reaction-btn').forEach(btn => { if (btn.style.border.includes('201,168,76')) btn.dataset.picked = 'true'; });
  }
  const commentsBox = Array.from(container.querySelectorAll('.card')).find(el => el.textContent.includes('방청석 한마디'));
  if (commentsBox && !commentsBox.classList.contains('court-gallery-box')) {
    commentsBox.classList.add('court-document', 'court-gallery-box');
    commentsBox.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:5px;">PUBLIC GALLERY</div>`);
  }
  const steps = container.querySelectorAll('.step-card');
  steps.forEach((step, idx) => {
    if (step.classList.contains('court-step-decorated')) return;
    step.classList.add('court-step-decorated');
    step.style.borderLeft = '3px solid rgba(201,168,76,.55)';
    step.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:6px;">STAGE ${String(idx + 1).padStart(2, '0')}</div>`);
  });
  addInviteDefense(container);
}

export async function renderResult(container, caseId) {
  await renderBaseResult(container, caseId);
  decorateResult(container);
}
