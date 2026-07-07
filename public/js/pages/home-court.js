import { renderHome as renderBaseHome } from './home.js?v=20260707-2';

function addCourtEntrance(container) {
  const hero = container.querySelector('.hero-section');
  if (!hero || document.getElementById('court-entrance')) return;
  hero.insertAdjacentHTML('afterend', `
    <div class="container" id="court-entrance" style="margin-top:22px;">
      <div class="court-shell" style="padding:20px;">
        <div style="display:flex;gap:16px;align-items:center;">
          <div class="court-seal">⚖️</div>
          <div style="flex:1;min-width:0;">
            <div class="court-kicker">SOSOKING ABSURD COURT</div>
            <div class="court-title">황당재판소 개정 중</div>
            <div class="court-desc">라면, 충전기, 읽씹, 마지막 만두까지 제3황당재판부가 과하게 엄숙하게 심리합니다.</div>
          </div>
        </div>
        <div class="court-ledger">
          <div><strong>제3황당재판부</strong><span>사소함 전담</span></div>
          <div><strong>404호</strong><span>황당법정</span></div>
          <div><strong>0%</strong><span>법적 효력</span></div>
        </div>
      </div>
    </div>`);
}

function addProcedureSeal(container) {
  const target = Array.from(container.querySelectorAll('.container')).find(el => el.textContent.includes('재판 진행 순서'));
  if (!target || document.getElementById('court-procedure-note')) return;
  target.insertAdjacentHTML('afterbegin', `
    <div id="court-procedure-note" class="court-shell" style="padding:16px;margin-bottom:18px;">
      <div class="court-kicker">COURT PROTOCOL</div>
      <div class="court-title" style="font-size:19px;">접수 → 황당성 검토 → 변론 → 선고</div>
      <div class="court-desc">화면은 진지하게, 사건은 사소하게. 이것이 소소킹 황당재판소의 재판 원칙입니다.</div>
    </div>`);
}

export async function renderHome(container) {
  await renderBaseHome(container);
  addCourtEntrance(container);
  addProcedureSeal(container);
}
