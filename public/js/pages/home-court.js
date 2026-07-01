import { renderHome as renderBaseHome } from './home.js?v=20260702-20';

function addBreakingTicker(container) {
  const hero = container.querySelector('.hero-section');
  if (!hero || document.getElementById('breaking-committee-ticker')) return;
  hero.insertAdjacentHTML('afterend', `
    <div class="container" id="breaking-committee-ticker" style="margin-top:22px;">
      <div class="court-shell" style="padding:18px;">
        <div style="display:flex;gap:14px;align-items:center;">
          <div class="court-seal">📡</div>
          <div style="flex:1;min-width:0;">
            <div class="court-kicker">SOSOKING BREAKING DESK</div>
            <div class="court-title">한 줄 소소사건 긴급 편성중</div>
            <div class="court-desc">사소할수록 더 크게 보도하고, 웃길수록 더 높은 점수로 올라갑니다.</div>
          </div>
        </div>
        <div class="court-ledger">
          <div><strong>속보</strong><span>과장 보도</span></div>
          <div><strong>점수</strong><span>1~10 웃김</span></div>
          <div><strong>킹</strong><span>랭킹 후보</span></div>
        </div>
      </div>
    </div>`);
}

export async function renderHome(container) {
  await renderBaseHome(container);
  addBreakingTicker(container);
}
