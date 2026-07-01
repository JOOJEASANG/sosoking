import { renderResult as renderBaseResult } from './result.js?v=20260630-7';

function decorateResult(container) {
  const titleCard = container.querySelector('.container > .card');
  if (titleCard && !document.getElementById('court-result-header')) {
    titleCard.classList.add('court-shell');
    titleCard.insertAdjacentHTML('afterbegin', `
      <div id="court-result-header" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
        <span class="court-stamp">선고</span>
        <span class="court-kicker">SOSOKING DISTRICT COURT</span>
      </div>
      <div class="court-bench"></div>`);
  }

  const verdictCard = container.querySelector('.verdict-card');
  if (verdictCard && !document.getElementById('court-verdict-label')) {
    verdictCard.classList.add('court-document');
    verdictCard.insertAdjacentHTML('afterbegin', `
      <div id="court-verdict-label" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
        <div>
          <div class="court-kicker">JUDGEMENT DOCUMENT</div>
          <div class="court-title" style="font-size:19px;">생활법정 판결문</div>
        </div>
        <div class="court-seal" style="width:48px;height:48px;font-size:22px;">⚖️</div>
      </div>`);
  }

  const reactionBox = Array.from(container.querySelectorAll('.card')).find(el => el.textContent.includes('배심원 투표'));
  if (reactionBox && !reactionBox.classList.contains('court-jury-box')) {
    reactionBox.classList.add('court-document', 'court-jury-box');
    reactionBox.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:5px;">CITIZEN JURY VERDICT</div>`);
    reactionBox.querySelectorAll('.reaction-btn').forEach(btn => {
      if (btn.style.border.includes('201,168,76')) btn.dataset.picked = 'true';
    });
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
    step.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:6px;">RECORD ${String(idx + 1).padStart(2, '0')}</div>`);
  });
}

export async function renderResult(container, caseId) {
  await renderBaseResult(container, caseId);
  decorateResult(container);
}
