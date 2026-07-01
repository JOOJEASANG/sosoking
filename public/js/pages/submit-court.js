import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260630-8';

function decorateSubmit(container) {
  const form = container.querySelector('#submit-form');
  const topCard = container.querySelector('.container > .card');
  if (topCard && !document.getElementById('court-submit-docket')) {
    topCard.classList.add('court-shell');
    topCard.insertAdjacentHTML('beforeend', `
      <div id="court-submit-docket" class="court-ledger">
        <div><strong>전자접수</strong><span>원고 신청</span></div>
        <div><strong>제3생활부</strong><span>자동 배당</span></div>
        <div><strong>비공개</strong><span>접수 기본값</span></div>
      </div>`);
  }
  if (form && !document.getElementById('court-submit-flow')) {
    form.insertAdjacentHTML('afterbegin', `
      <div id="court-submit-flow" class="court-document" style="padding:16px;margin-bottom:18px;">
        <div class="court-kicker">E-FILING CHECKLIST</div>
        <div class="court-title" style="font-size:19px;">소장 제출 전 절차 확인</div>
        <div class="court-timeline">
          <div class="court-step"><div class="court-step-num">1</div><div><div class="court-step-title">사건명 특정</div><div class="court-step-text">라면, 충전기, 읽씹 등 생활분쟁의 핵심을 적습니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">2</div><div><div class="court-step-title">청구원인 작성</div><div class="court-step-text">누가 무엇을 해서 왜 억울한지 진술합니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">3</div><div><div class="court-step-title">재판부 배당</div><div class="court-step-text">선택한 판사 또는 랜덤 판사가 엄숙하게 심리합니다.</div></div></div>
        </div>
      </div>`);
  }
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
}
