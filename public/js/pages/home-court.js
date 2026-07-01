import { renderHome as renderBaseHome } from './home.js?v=20260630-3';

function polishHomeCopy(container) {
  const logo = container.querySelector('.hero-section img');
  if (logo) logo.src = '/app-icon.svg?v=20260702-6';
  const replacements = [
    ['사소함 전문 생활법정', '사소함 전문 소소법정'],
    ['생활법정 심의중', '소소법정 심의중'],
    ['생활법정 라인업', '소소법정 라인업'],
    ['최근 생활형 처분', '최근 소소한 처분'],
    ['생활법정에 접수하고', '소소법정에 접수하고'],
    ['생활사 대하드라마', '소소사건사 대하드라마']
  ];
  container.querySelectorAll('div, span, p, h1, h2, strong, a').forEach(el => {
    if (el.children.length) return;
    let text = el.textContent;
    replacements.forEach(([from, to]) => { text = text.replace(from, to); });
    if (text !== el.textContent) el.textContent = text;
  });
  ['.hero-tw', '.cta-section p'].forEach(sel => {
    const el = container.querySelector(sel);
    if (!el) return;
    let html = el.innerHTML;
    replacements.forEach(([from, to]) => { html = html.replace(from, to); });
    el.innerHTML = html;
  });
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
            <div class="court-title">사소한 사건 전자법정 개정 중</div>
            <div class="court-desc">라면, 충전기, 읽씹, 마지막 만두까지 제3소소부가 과하게 엄숙하게 심리합니다.</div>
          </div>
        </div>
        <div class="court-ledger">
          <div><strong>제3소소부</strong><span>사소함 전담</span></div>
          <div><strong>404호</strong><span>소소법정</span></div>
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
      <div class="court-title" style="font-size:19px;">접수 → 조사 → 공방 → 선고</div>
      <div class="court-desc">화면은 진지하게, 사건은 사소하게. 이것이 소소킹 판결소의 재판 원칙입니다.</div>
    </div>`);
}

export async function renderHome(container) {
  await renderBaseHome(container);
  polishHomeCopy(container);
  addCourtEntrance(container);
  addProcedureSeal(container);
}
