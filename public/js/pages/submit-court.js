import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260702-16';

function lvLabel(v) {
  const n = Number(v || 5);
  if (n <= 2) return '먼지급 해프닝';
  if (n <= 4) return '카톡방 안건';
  if (n <= 6) return '속보 편성 가능';
  if (n <= 8) return '위원회 긴급소집';
  return '전국민 상황실급';
}
function judgeStat(name) {
  const map = {
    '엄벌주의형': ['엄중함 ★★★★★', '과장력 ★★★★★', '자비 ★☆☆☆☆'],
    '감성형': ['공감력 ★★★★★', '눈물샘 ★★★★☆', '단호함 ★★☆☆☆'],
    '현실주의형': ['팩트력 ★★★★★', '체념력 ★★★★☆', '드립력 ★★☆☆☆'],
    '과몰입형': ['확대해석 ★★★★★', '속보력 ★★★★★', '진정성 ★★☆☆☆'],
    '피곤형': ['귀찮음 ★★★★★', '문서력 ★★★★☆', '퇴근욕 ★★★★★'],
    '논리집착형': ['수치화 ★★★★★', '논리력 ★★★★★', '융통성 ★☆☆☆☆'],
    '드립형': ['속보톤 ★★★★☆', '드립력 ★★★★★', '정색력 ★★★★★'],
  };
  return map[name] || ['랜덤성 ★★★★★', '예측불가 ★★★★★', '긴급성 ★★★★☆'];
}
function ensureGameStyle() {
  if (document.getElementById('submit-game-style')) return;
  const style = document.createElement('style');
  style.id = 'submit-game-style';
  style.textContent = `
    .game-lv-card{padding:16px;margin-bottom:18px;border-radius:18px;border:1px solid var(--border);background:linear-gradient(135deg,rgba(231,76,60,.11),var(--gold-dim),var(--surface-2,rgba(255,255,255,.035)));}
    .game-lv-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
    .game-lv-title{font-size:12px;font-weight:900;color:var(--gold);letter-spacing:.12em;}
    .game-lv-num{font-family:var(--font-serif);font-size:24px;font-weight:900;color:var(--text-strong,var(--cream));}
    .game-lv-bar{height:12px;border-radius:99px;background:var(--surface-2,rgba(255,255,255,.10));overflow:hidden;border:1px solid var(--border);}
    .game-lv-fill{height:100%;width:50%;border-radius:99px;background:linear-gradient(90deg,var(--gold),#ff7166,var(--red));box-shadow:0 0 18px rgba(231,76,60,.28);transition:width .18s ease;}
    .game-lv-caption{font-size:12px;color:var(--text-muted,var(--cream-dim));margin-top:8px;font-weight:800;}
    .judge-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;}
    .judge-option{position:relative;min-height:118px!important;padding:13px 10px!important;border-radius:18px!important;border:1px solid var(--border)!important;background:var(--surface-1,var(--navy-card))!important;display:flex!important;flex-direction:column;align-items:flex-start!important;text-align:left!important;overflow:hidden;color:var(--text-strong,var(--cream))!important;}
    .judge-option::after{content:'위원 카드';position:absolute;right:9px;top:8px;font-size:9px;color:var(--text-soft,var(--cream-dim));font-weight:900;letter-spacing:.08em;}
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
        <div><strong>한 줄 제보</strong><span>짧을수록 유리</span></div>
        <div><strong>긴급속보</strong><span>과장 보도</span></div>
        <div><strong>웃김점수</strong><span>소소킹 랭킹</span></div>
      </div>`);
  }
  const rangeGroup = document.getElementById('grievance')?.closest('.form-group');
  if (rangeGroup && !document.getElementById('game-lv-card')) {
    rangeGroup.insertAdjacentHTML('afterbegin', `
      <div id="game-lv-card" class="game-lv-card">
        <div class="game-lv-head"><div class="game-lv-title">사소함 레벨</div><div class="game-lv-num">Lv.<span id="game-lv-num">5</span></div></div>
        <div class="game-lv-bar"><div class="game-lv-fill" id="game-lv-fill"></div></div>
        <div class="game-lv-caption" id="game-lv-caption">속보 편성 가능</div>
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
        <div class="court-kicker">BREAKING + FUN SCORE</div>
        <div class="court-title" style="font-size:19px;">소소한 한 줄이 속보와 랭킹 후보가 됩니다</div>
        <div class="court-timeline">
          <div class="court-step"><div class="court-step-num">1</div><div><div class="court-step-title">한 줄 소소사건 포착</div><div class="court-step-text">모기, 엘리베이터, 라면, 만두 같은 사안을 짧게 던집니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">2</div><div><div class="court-step-title">긴급속보 편성</div><div class="court-step-text">별일 아닌 일이 갑자기 국가적 사안처럼 보도됩니다.</div></div></div>
          <div class="court-step"><div class="court-step-num">3</div><div><div class="court-step-title">웃김점수 경쟁</div><div class="court-step-text">유저들이 1~10점으로 평가하고 소소킹 후보를 정합니다.</div></div></div>
        </div>
      </div>`);
  }
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
}
