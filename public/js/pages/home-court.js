import { renderHome as renderBaseHome } from './home.js?v=20260710-v2judgment1';

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
            <div class="court-title">소소한 사건 접수 중</div>
            <div class="court-desc">일상 속 사소한 사건과 황당한 사례를 AI 재판부가 과하게 엄숙하게 심리합니다.</div>
          </div>
        </div>
        <div class="court-ledger">
          <div><strong>AI 재판부</strong><span>소소사건 전담</span></div>
          <div><strong>V2</strong><span>단일 판결 기록</span></div>
          <div><strong>0%</strong><span>법적 효력</span></div>
        </div>
      </div>
    </div>`);
}

function addProcedureSeal(container) {
  const target = Array.from(container.querySelectorAll('.container')).find(element => element.textContent.includes('재판 진행 순서'));
  if (!target || document.getElementById('court-procedure-note')) return;
  target.insertAdjacentHTML('afterbegin', `
    <div id="court-procedure-note" class="court-shell" style="padding:16px;margin-bottom:18px;">
      <div class="court-kicker">COURT PROTOCOL</div>
      <div class="court-title" style="font-size:19px;">접수 → 수사 → 변론 → 선고</div>
      <div class="court-desc">화면은 진지하게, 사건은 사소하게. 생성된 판단과 주문은 하나의 판결 기록으로 보관합니다.</div>
    </div>`);
}

export async function renderHome(container) {
  await renderBaseHome(container);
  addCourtEntrance(container);
  addProcedureSeal(container);
}
