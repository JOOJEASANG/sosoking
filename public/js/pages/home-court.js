import { renderHome as renderBaseHome } from './home.js?v=20260630-3';

function replaceHeroLogo(container) {
  const hero = container.querySelector('.hero-section');
  const image = hero?.querySelector('img[alt*="소소킹"]');
  if (!hero || !image) return;

  if (!document.getElementById('sosoking-logo-motion')) {
    const style = document.createElement('style');
    style.id = 'sosoking-logo-motion';
    style.textContent = `
      @keyframes sosokingLogoFloat {
        0%,100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      .sosoking-hero-logo {
        width: 112px !important;
        height: 112px !important;
        display: block;
        margin: 0 auto 16px !important;
        animation: sosokingLogoFloat 3.2s ease-in-out infinite !important;
        filter: none !important;
        image-rendering: auto;
      }
      @media (prefers-reduced-motion: reduce) {
        .sosoking-hero-logo { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  image.src = '/logo.svg?v=20260727-1';
  image.alt = '왕관과 판결봉이 있는 소소킹 판결소 로고';
  image.classList.add('sosoking-hero-logo');
  image.setAttribute('width', '112');
  image.setAttribute('height', '112');
  image.decoding = 'async';
}

function addCourtEntrance(container) {
  const hero = container.querySelector('.hero-section');
  if (!hero || document.getElementById('court-entrance')) return;
  hero.insertAdjacentHTML('afterend', `
    <div class="container" id="court-entrance" style="margin-top:22px;">
      <div class="court-shell" style="padding:20px;">
        <div style="display:flex;gap:16px;align-items:center;">
          <div class="court-seal">⚖️</div>
          <div style="flex:1;min-width:0;">
            <div class="court-kicker">SOSOKING ELECTRONIC COURT</div>
            <div class="court-title">생활분쟁 전자법정 개정 중</div>
            <div class="court-desc">라면, 충전기, 읽씹, 마지막 만두까지 제3생활부가 과하게 엄숙하게 심리합니다.</div>
          </div>
        </div>
        <div class="court-ledger">
          <div><strong>제3생활부</strong><span>사소함 전담</span></div>
          <div><strong>404호</strong><span>생활법정</span></div>
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
      <div class="court-title" style="font-size:19px;">접수 → 기록검토 → 변론 → 선고</div>
      <div class="court-desc">화면은 진지하게, 사건은 사소하게. 이것이 소소킹 판결소의 재판 원칙입니다.</div>
    </div>`);
}

export async function renderHome(container) {
  await renderBaseHome(container);
  replaceHeroLogo(container);
  addCourtEntrance(container);
  addProcedureSeal(container);
}
