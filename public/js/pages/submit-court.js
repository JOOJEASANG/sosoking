import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260708-submit1';

function lvLabel(v) {
  const n = Number(v || 5);
  if (n <= 2) return '그냥 웃김';
  if (n <= 4) return '마음에 걸림';
  if (n <= 6) return '방청석 소환 가능';
  if (n <= 8) return '황당재판 개정 필요';
  return '제404호 법정 긴급배당';
}
function judgeStat(name) {
  const map = {
    '엄벌주의형': ['엄격함 ★★★★★', '공감력 ★★☆☆☆', '드립력 ★☆☆☆☆'],
    '감성형': ['엄격함 ★★☆☆☆', '공감력 ★★★★★', '드립력 ★★☆☆☆'],
    '현실주의형': ['엄격함 ★★★☆☆', '공감력 ★★★☆☆', '팩트력 ★★★★★'],
    '과몰입형': ['엄격함 ★★★★☆', '몰입도 ★★★★★', '확대해석 ★★★★★'],
    '피곤형': ['엄격함 ★★☆☆☆', '귀찮음 ★★★★★', '양식미 ★★★★☆'],
    '논리집착형': ['엄격함 ★★★★☆', '논리력 ★★★★★', '소수점 ★★★★★'],
    '드립형': ['엄격함 ★★☆☆☆', '공감력 ★★★☆☆', '드립력 ★★★★★'],
  };
  return map[name] || ['랜덤성 ★★★★★', '예측불가 ★★★★★', '운명력 ★★★★★'];
}
function ensureGameStyle() {
  if (document.getElementById('submit-game-style')) return;
  const style = document.createElement('style');
  style.id = 'submit-game-style';
  style.textContent = `
    .grievance-unified{margin-bottom:20px!important;}
    .grievance-unified>.form-label,.grievance-unified>.slider-value{display:none!important;}
    .game-lv-card{padding:17px 16px 15px;margin-bottom:12px;border-radius:22px;border:1.25px solid rgba(201,168,76,.36);background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(255,255,255,.035));box-shadow:0 12px 26px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.05);}
    .game-lv-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
    .game-lv-title{font-size:12px;font-weight:900;color:#e8c97a;letter-spacing:.12em;}
    .game-lv-num{font-family:var(--font-serif);font-size:24px;font-weight:900;color:#fff8ec;}
    .game-lv-bar{height:12px;border-radius:99px;background:rgba(255,255,255,.10);overflow:hidden;border:1px solid rgba(201,168,76,.25);}
    .game-lv-fill{height:100%;width:50%;border-radius:99px;background:linear-gradient(90deg,#c9a84c,#ffdf7a,#e74c3c);box-shadow:0 0 18px rgba(201,168,76,.35);transition:width .18s ease;}
    .game-lv-caption{font-size:12px;color:rgba(255,248,236,.82);margin-top:8px;font-weight:800;}
    .grievance-unified .form-range{margin-top:8px;}
    .grievance-unified .slider-labels{font-size:12px;font-weight:800;color:rgba(255,248,236,.74)!important;}
    .judge-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;}
    .judge-option{position:relative;min-height:132px!important;padding:16px 14px!important;border-radius:22px!important;border:1.25px solid rgba(201,168,76,.24)!important;background:linear-gradient(145deg,rgba(31,39,63,.94),rgba(17,23,38,.98))!important;display:flex!important;flex-direction:column;align-items:flex-start!important;text-align:left!important;overflow:hidden;box-shadow:0 12px 26px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.05)!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease!important;}
    .judge-option:hover{transform:translateY(-2px);border-color:rgba(232,201,122,.48)!important;box-shadow:0 16px 30px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.06)!important;}
    .judge-option::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 14% 0%,rgba(232,201,122,.14),transparent 34%),linear-gradient(180deg,rgba(255,255,255,.045),transparent 50%);pointer-events:none;}
    .judge-option::after{content:'재판부 카드';position:absolute;right:12px;top:10px;font-size:9px;color:rgba(255,248,236,.38);font-weight:900;letter-spacing:.08em;}
    .judge-option.active{border-color:#e8c97a!important;box-shadow:0 0 0 2px rgba(201,168,76,.22),0 16px 32px rgba(0,0,0,.28)!important;background:linear-gradient(145deg,rgba(201,168,76,.24),rgba(31,39,63,.96))!important;}
    .judge-option-icon{position:relative;z-index:1;font-size:29px!important;line-height:1!important;margin-bottom:10px;display:inline-flex!important;width:34px;height:34px;align-items:center;justify-content:center;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif!important;}
    .judge-option-name{position:relative;z-index:1;font-size:15px!important;font-weight:900!important;color:#fff8ec!important;line-height:1.35!important;}
    .judge-option-desc{position:relative;z-index:1;font-size:12px!important;line-height:1.55!important;color:rgba(255,248,236,.76)!important;margin-top:5px!important;}
    .judge-stat{position:relative;z-index:1;font-size:10.5px;color:rgba(255,248,236,.66);line-height:1.45;margin-top:8px;font-weight:800;}
    html[data-theme="light"] .game-lv-card,:root[data-theme="light"] .game-lv-card{background:linear-gradient(135deg,#fffdf8,#f3dfba)!important;border-color:rgba(154,112,24,.28)!important;box-shadow:0 13px 28px rgba(70,46,16,.11),inset 0 1px 0 rgba(255,255,255,.95)!important;}
    html[data-theme="light"] .game-lv-title,:root[data-theme="light"] .game-lv-title{color:#9a7018!important;}
    html[data-theme="light"] .game-lv-num,:root[data-theme="light"] .game-lv-num{color:#7a4d00!important;text-shadow:0 1px 0 rgba(255,255,255,.85)!important;}
    html[data-theme="light"] .game-lv-bar,:root[data-theme="light"] .game-lv-bar{background:#efe1c6!important;border-color:rgba(154,112,24,.20)!important;}
    html[data-theme="light"] .game-lv-caption,:root[data-theme="light"] .game-lv-caption{color:#5d4630!important;}
    html[data-theme="light"] .grievance-unified .slider-labels,:root[data-theme="light"] .grievance-unified .slider-labels{color:#5d4630!important;}
    html[data-theme="light"] .judge-option,:root[data-theme="light"] .judge-option{background:linear-gradient(145deg,#fffdf8,#f3dfba)!important;border-color:rgba(154,112,24,.26)!important;box-shadow:0 12px 26px rgba(70,46,16,.11),inset 0 1px 0 rgba(255,255,255,.92)!important;}
    html[data-theme="light"] .judge-option::before,:root[data-theme="light"] .judge-option::before{background:radial-gradient(circle at 12% 0%,rgba(154,112,24,.14),transparent 34%),linear-gradient(180deg,rgba(255,255,255,.58),transparent 50%)!important;}
    html[data-theme="light"] .judge-option::after,:root[data-theme="light"] .judge-option::after{color:rgba(95,68,28,.42)!important;}
    html[data-theme="light"] .judge-option.active,:root[data-theme="light"] .judge-option.active{border-color:rgba(154,112,24,.55)!important;background:linear-gradient(145deg,#fff7df,#ecd29d)!important;box-shadow:0 0 0 2px rgba(154,112,24,.13),0 14px 28px rgba(70,46,16,.14)!important;}
    html[data-theme="light"] .judge-option-icon,:root[data-theme="light"] .judge-option-icon{filter:none!important;text-shadow:0 1px 0 rgba(255,255,255,.85)!important;}
    html[data-theme="light"] .judge-option-name,:root[data-theme="light"] .judge-option-name{color:#24190c!important;}
    html[data-theme="light"] .judge-option-desc,:root[data-theme="light"] .judge-option-desc{color:#5a4329!important;}
    html[data-theme="light"] .judge-stat,:root[data-theme="light"] .judge-stat{color:#6a5135!important;}
    @media(prefers-color-scheme:light){:root:not([data-theme="dark"]) .game-lv-card{background:linear-gradient(135deg,#fffdf8,#f3dfba)!important;border-color:rgba(154,112,24,.28)!important;box-shadow:0 13px 28px rgba(70,46,16,.11),inset 0 1px 0 rgba(255,255,255,.95)!important}:root:not([data-theme="dark"]) .game-lv-title{color:#9a7018!important}:root:not([data-theme="dark"]) .game-lv-num{color:#7a4d00!important}:root:not([data-theme="dark"]) .game-lv-caption,:root:not([data-theme="dark"]) .grievance-unified .slider-labels{color:#5d4630!important}:root:not([data-theme="dark"]) .judge-option{background:linear-gradient(145deg,#fffdf8,#f3dfba)!important;border-color:rgba(154,112,24,.26)!important;box-shadow:0 12px 26px rgba(70,46,16,.11),inset 0 1px 0 rgba(255,255,255,.92)!important}:root:not([data-theme="dark"]) .judge-option-name{color:#24190c!important}:root:not([data-theme="dark"]) .judge-option-desc{color:#5a4329!important}:root:not([data-theme="dark"]) .judge-stat{color:#6a5135!important}}
    @media(max-width:520px){.judge-grid{grid-template-columns:1fr!important}.judge-option{min-height:118px!important}.grievance-unified>.form-label,.grievance-unified>.slider-value{display:none!important}}
  `;
  document.head.appendChild(style);
}
function decorateSubmit(container) {
  ensureGameStyle();
  const form = container.querySelector('#submit-form');
  const topCard = container.querySelector('.container > .card');
  if (topCard && !document.getElementById('court-submit-docket')) {
    topCard.classList.add('court-shell');
    topCard.insertAdjacentHTML('beforeend', `
      <div id="court-submit-docket" class="court-ledger">
        <div><strong>황당접수</strong><span>사건 시작</span></div>
        <div><strong>제3황당재판부</strong><span>자동 배당</span></div>
        <div><strong>보상 대기</strong><span>판결문·배지</span></div>
      </div>`);
  }
  const rangeGroup = document.getElementById('grievance')?.closest('.form-group');
  if (rangeGroup && !document.getElementById('game-lv-card')) {
    rangeGroup.classList.add('grievance-unified');
    rangeGroup.insertAdjacentHTML('afterbegin', `
      <div id="game-lv-card" class="game-lv-card">
        <div class="game-lv-head"><div class="game-lv-title">억울함 레벨</div><div class="game-lv-num">Lv.<span id="game-lv-num">5</span></div></div>
        <div class="game-lv-bar"><div class="game-lv-fill" id="game-lv-fill"></div></div>
        <div class="game-lv-caption" id="game-lv-caption">방청석 소환 가능</div>
      </div>`);
    const input = document.getElementById('grievance');
    const sync = () => {
      const v = Number(input.value || 5);
      document.getElementById('game-lv-num').textContent = v;
      document.getElementById('game-lv-fill').style.width = `${v * 10}%`;
      document.getElementById('game-lv-caption').textContent = lvLabel(v);
    };
    input.addEventListener('input', sync);
    sync();
  } else if (rangeGroup) {
    rangeGroup.classList.add('grievance-unified');
  }
  document.querySelectorAll('.judge-option').forEach(opt => {
    if (opt.querySelector('.judge-stat')) return;
    const name = opt.dataset.judge || '랜덤';
    opt.insertAdjacentHTML('beforeend', `<div class="judge-stat">${judgeStat(name).map(s => `<div>${s}</div>`).join('')}</div>`);
  });
  if (form && !document.getElementById('court-submit-flow')) {
    form.insertAdjacentHTML('afterbegin', `
      <div id="court-submit-flow" class="court-document" style="padding:16px;margin-bottom:18px;">
        <div class="court-kicker">QUEST BRIEFING</div>
        <div class="court-title" style="font-size:19px;">아무것도 아닌 일을 황당사건으로 격상합니다</div>
        <div class="court-timeline">
          <div class="court-step"><div class="court-step-num">1</div><div><div class="court-step-title">사소한 사건 포착</div><div class="court-step-text">라면, 충전기, 읽씹 같은 일을 황당사건으로 접수합니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">2</div><div><div class="court-step-title">이미지 증거 첨부</div><div class="court-step-text">사진이 있으면 AI가 증거 아닌 증거로 함께 감정합니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">3</div><div><div class="court-step-title">재판부 카드 배정</div><div class="court-step-text">선택한 재판부의 성향에 따라 판결 톤이 달라집니다.</div></div></div>
        </div>
      </div>`);
  }
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
}
