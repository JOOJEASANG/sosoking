import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260702-2';

function lvLabel(v) {
  const n = Number(v || 5);
  if (n <= 2) return '살짝 서운';
  if (n <= 4) return '마음에 걸림';
  if (n <= 6) return '주변에 말하고 싶음';
  if (n <= 8) return '생활법정 개정 필요';
  return '국민참여재판 요청';
}
function judgeStat(name) {
  const map = {
    '엄벌주의형': ['엄격함 ★★★★★', '공감력 ★★☆☆☆', '드립력 ★☆☆☆'],
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
    .game-lv-card{padding:16px;margin-bottom:18px;border-radius:18px;border:1px solid var(--border);background:linear-gradient(135deg,var(--gold-dim),var(--surface-2,rgba(255,255,255,.035)));}
    .game-lv-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
    .game-lv-title{font-size:12px;font-weight:900;color:var(--gold);letter-spacing:.12em;}
    .game-lv-num{font-family:var(--font-serif);font-size:24px;font-weight:900;color:var(--text-strong,var(--cream));}
    .game-lv-bar{height:12px;border-radius:99px;background:var(--surface-2,rgba(255,255,255,.10));overflow:hidden;border:1px solid var(--border);}
    .game-lv-fill{height:100%;width:50%;border-radius:99px;background:linear-gradient(90deg,var(--gold),var(--gold-light),var(--red));box-shadow:0 0 18px rgba(201,168,76,.35);transition:width .18s ease;}
    .game-lv-caption{font-size:12px;color:var(--text-muted,var(--cream-dim));margin-top:8px;font-weight:800;}
    .judge-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;}
    .judge-option{position:relative;min-height:118px!important;padding:13px 10px!important;border-radius:18px!important;border:1px solid var(--border)!important;background:var(--surface-1,var(--navy-card))!important;display:flex!important;flex-direction:column;align-items:flex-start!important;text-align:left!important;overflow:hidden;color:var(--text-strong,var(--cream))!important;}
    .judge-option::after{content:'판사 카드';position:absolute;right:9px;top:8px;font-size:9px;color:var(--text-soft,var(--cream-dim));font-weight:900;letter-spacing:.08em;}
    .judge-option.active{border-color:var(--gold)!important;box-shadow:0 0 0 2px var(--gold-dim),0 12px 26px rgba(0,0,0,.16)!important;background:linear-gradient(145deg,var(--gold-dim),var(--surface-2,rgba(255,255,255,.04)))!important;}
    .judge-option span{font-size:28px!important;margin-bottom:7px;}
    .judge-option-name{font-size:14px!important;font-weight:900!important;color:var(--text-strong,var(--cream))!important;}
    .judge-option-desc{font-size:11px!important;line-height:1.45!important;color:var(--text-muted,var(--cream-dim))!important;margin-top:4px;}
    .judge-stat{font-size:10px;color:var(--text-soft,var(--cream-dim));line-height:1.35;margin-top:7px;font-weight:800;}
    @media(max-width:380px){.judge-grid{grid-template-columns:1fr!important}.judge-option{min-height:104px!important}}
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
        <div><strong>퀘스트 접수</strong><span>생활분쟁 시작</span></div>
        <div><strong>제3생활부</strong><span>자동 배당</span></div>
        <div><strong>보상 대기</strong><span>판결문·배지</span></div>
      </div>`);
  }
  const rangeGroup = document.getElementById('grievance')?.closest('.form-group');
  if (rangeGroup && !document.getElementById('game-lv-card')) {
    rangeGroup.insertAdjacentHTML('afterbegin', `
      <div id="game-lv-card" class="game-lv-card">
        <div class="game-lv-head"><div class="game-lv-title">억울함 레벨</div><div class="game-lv-num">Lv.<span id="game-lv-num">5</span></div></div>
        <div class="game-lv-bar"><div class="game-lv-fill" id="game-lv-fill"></div></div>
        <div class="game-lv-caption" id="game-lv-caption">주변에 말하고 싶음</div>
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
        <div class="court-title" style="font-size:19px;">아무것도 아닌 일을 중대 사건으로 격상합니다</div>
        <div class="court-timeline">
          <div class="court-step"><div class="court-step-num">1</div><div><div class="court-step-title">사소한 사건 포착</div><div class="court-step-text">라면, 충전기, 읽씹 같은 생활분쟁을 대사건처럼 접수합니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">2</div><div><div class="court-step-title">억울함 레벨 산정</div><div class="court-step-text">Lv이 높을수록 판사가 더 엄숙하게 과몰입합니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">3</div><div><div class="court-step-title">판사 캐릭터 배정</div><div class="court-step-text">선택한 판사 카드의 성향에 따라 판결 톤이 달라집니다.</div></div></div>
        </div>
      </div>`);
  }
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
}
