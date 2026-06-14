// republic-game-flow.js
// 소소공화국 게임 흐름 UI 보강 모듈

import { navigate } from './router.js';

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function ensureGameFlowStyle() {
  if (document.getElementById('republic-game-flow-style')) return;
  const style = document.createElement('style');
  style.id = 'republic-game-flow-style';
  style.textContent = `
    @media(max-width:640px){
      .daily-routine-grid,.checks-balance-steps,.rep-power-ladder-grid{grid-template-columns:repeat(2,1fr)!important}
      #checks-balance-panel,#daily-routine-panel{border-radius:18px!important;padding:14px!important}
    }
    @media(max-width:420px){
      .daily-routine-grid,.checks-balance-steps,.rep-power-ladder-grid{grid-template-columns:1fr!important}
      #checks-balance-panel button,#daily-routine-panel button{width:100%;justify-content:center}
    }
  `;
  document.head.appendChild(style);
}

function addHomeRepublicEntry() {
  if (currentPath() !== '/') return;
  if (document.getElementById('home-republic-entry')) return;
  const root = document.querySelector('.home-dash--v2');
  if (!root) return;
  const anchor = root.querySelector('.home-id-card') || root.querySelector('.home-guest-hero') || root.firstElementChild;
  if (!anchor) return;

  if (!document.getElementById('home-republic-entry-style')) {
    const style = document.createElement('style');
    style.id = 'home-republic-entry-style';
    style.textContent = `
      .home-republic-entry{margin:0 0 14px;padding:14px 15px;border-radius:20px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(51,65,85,.92));color:#fff;border:0;box-shadow:0 12px 28px rgba(15,23,42,.16);cursor:pointer;text-align:left;width:100%;font-family:inherit;display:block}
      .home-republic-entry__top{display:flex;justify-content:space-between;gap:10px;align-items:center}
      .home-republic-entry__eyebrow{font-size:10px;font-weight:1000;letter-spacing:.08em;color:rgba(255,255,255,.58);margin-bottom:3px}
      .home-republic-entry__title{font-size:18px;font-weight:1000;color:#fff}
      .home-republic-entry__desc{font-size:12px;line-height:1.45;color:rgba(255,255,255,.72);margin-top:5px}
      .home-republic-entry__cta{flex:0 0 auto;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);padding:8px 10px;font-size:12px;font-weight:900;color:#fff}
      .home-republic-entry__steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}
      .home-republic-entry__step{border-radius:12px;background:rgba(255,255,255,.09);padding:8px 7px;font-size:11px;font-weight:900;color:#fff;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media(max-width:480px){.home-republic-entry__steps{grid-template-columns:repeat(2,1fr)}.home-republic-entry__cta{display:none}}
    `;
    document.head.appendChild(style);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'home-republic-entry';
  btn.className = 'home-republic-entry';
  btn.innerHTML = `
    <div class="home-republic-entry__top">
      <div>
        <div class="home-republic-entry__eyebrow">SOSO REPUBLIC</div>
        <div class="home-republic-entry__title">👑 정치 인생 진행도</div>
        <div class="home-republic-entry__desc">정당에 입당하고 정치력을 쌓아 당대표, 대통령, 국회·헌재까지 도전하세요.</div>
      </div>
      <span class="home-republic-entry__cta">공화국 보기 →</span>
    </div>
    <div class="home-republic-entry__steps">
      <span class="home-republic-entry__step">1 입당</span>
      <span class="home-republic-entry__step">2 당대표</span>
      <span class="home-republic-entry__step">3 대통령</span>
      <span class="home-republic-entry__step">4 국회·헌재</span>
    </div>`;
  btn.addEventListener('click', () => navigate('/republic'));
  anchor.insertAdjacentElement('afterend', btn);
}

function pledgeSuggestions(partyName) {
  if (partyName.includes('청년') || partyName.includes('혁명')) {
    return [
      '청년 월세·교통·알바권리 3대 생존 패키지 추진',
      '기득권 특혜를 줄이고 청년 정치력 보너스를 확대하겠습니다',
      '모든 시민이 하루 한 번 정책 제안권을 갖는 직접정치제 도입',
    ];
  }
  if (partyName.includes('중도') || partyName.includes('민주')) {
    return [
      '데이터 공개와 민생 우선 예산으로 실용 공화국을 만들겠습니다',
      '갈등 법안은 시민투표와 국회 조정을 거쳐 합리적으로 처리',
      '정당 간 협치 보너스를 도입해 싸움보다 결과로 평가받겠습니다',
    ];
  }
  return [
    '흔들림 없는 질서와 민생 안정 패키지를 최우선 추진하겠습니다',
    '검증된 행정과 책임정치로 공화국 안정도를 높이겠습니다',
    '무리한 공약보다 매일 체감되는 생활 안정 정책을 실행하겠습니다',
  ];
}

function addPledgeRecommendButton() {
  if (currentPath() !== '/election') return;
  if (document.getElementById('elec-pledge-recommend')) return;
  const input = document.getElementById('elec-pledge-input');
  const actions = document.querySelector('.elec-pledge-actions');
  const section = document.querySelector('.elec-pledge-section');
  if (!input || !actions || !section) return;

  const partyName = section.querySelector('.elec-pledge-section__title')?.textContent || document.body.innerText || '';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'elec-pledge-recommend';
  btn.className = 'btn btn--ghost btn--sm';
  btn.textContent = '✨ 공약 추천';
  btn.addEventListener('click', () => {
    const list = pledgeSuggestions(partyName);
    const next = list[Math.floor(Math.random() * list.length)].slice(0, 80);
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  actions.insertBefore(btn, actions.querySelector('#elec-pledge-submit'));
}

function addBattleImpactNotice() {
  if (currentPath() !== '/battle') return;
  if (document.getElementById('battle-impact-notice')) return;
  const gameBar = document.querySelector('.battle-game-bar');
  const topicCard = document.querySelector('.battle-topic-card');
  const anchor = gameBar || topicCard;
  if (!anchor) return;

  const titleText = document.querySelector('.battle-vote-section__title')?.textContent || '';
  const isEnded = titleText.includes('논쟁 승리');
  const notice = document.createElement('div');
  notice.id = 'battle-impact-notice';
  notice.style.cssText = 'margin:10px 0 12px;padding:13px 14px;border-radius:18px;background:linear-gradient(135deg,rgba(255,107,74,.12),rgba(15,23,42,.04));border:1px solid rgba(255,107,74,.22);font-size:13px;line-height:1.55;color:var(--color-text-secondary)';
  notice.innerHTML = `
    <div style="font-weight:1000;color:var(--color-text-primary);margin-bottom:4px">${isEnded ? '🏆 오늘의 정국 영향 확정' : '⚡ 오늘 배틀은 정국에 영향을 줍니다'}</div>
    <div>${isEnded ? '승리 정당은 오늘 여론을 장악한 것으로 기록됩니다. 공화국 현황과 대선 판세를 이어서 확인하세요.' : '배틀 투표는 단순 인기투표가 아니라 정당전·대선 분위기를 만드는 데일리 정치 행동입니다.'}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button type="button" data-battle-impact-path="/republic" style="border:0;border-radius:999px;padding:8px 10px;background:var(--color-primary);color:#fff;font-weight:900;font-family:inherit;cursor:pointer">공화국 현황</button>
      <button type="button" data-battle-impact-path="/election" style="border:1px solid rgba(100,116,139,.25);border-radius:999px;padding:8px 10px;background:rgba(255,255,255,.65);color:var(--color-text-primary);font-weight:900;font-family:inherit;cursor:pointer">대선 판세</button>
      <button type="button" data-battle-impact-path="/parties" style="border:1px solid rgba(100,116,139,.25);border-radius:999px;padding:8px 10px;background:rgba(255,255,255,.65);color:var(--color-text-primary);font-weight:900;font-family:inherit;cursor:pointer">정당전</button>
    </div>`;
  notice.querySelectorAll('[data-battle-impact-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.battleImpactPath));
  });
  anchor.insertAdjacentElement('afterend', notice);
}

function battleCommentSuggestions(topic) {
  const base = [
    '이 사안은 명분보다 실제 시민에게 돌아갈 효과를 먼저 따져봐야 합니다.',
    '좋은 방향이지만 재원과 실행 순서가 빠지면 공약이 아니라 구호에 그칠 수 있습니다.',
    '저는 이 정책이 공정성과 실효성 둘 다 챙길 수 있는지 지켜봐야 한다고 봅니다.',
    '정당의 입장보다 지금 공화국에 필요한 우선순위가 무엇인지가 핵심입니다.',
    '찬반보다 중요한 건 실행했을 때 누가 이익을 보고 누가 부담을 지는지입니다.',
  ];
  if ((topic || '').includes('청년')) base.unshift('청년 문제는 단기 지원과 장기 기회 확대를 같이 봐야 합니다.');
  if ((topic || '').includes('세금') || (topic || '').includes('예산')) base.unshift('예산 정책은 인기보다 지속 가능성이 먼저 검증돼야 합니다.');
  if ((topic || '').includes('탄핵') || (topic || '').includes('대통령')) base.unshift('권력 견제는 필요하지만 정국 혼란 비용도 함께 계산해야 합니다.');
  return base;
}

function addBattleCommentSuggestButton() {
  if (currentPath() !== '/battle') return;
  if (document.getElementById('battle-comment-suggest')) return;
  const input = document.getElementById('discuss-input');
  const submit = document.getElementById('btn-discuss-submit');
  const form = document.querySelector('.battle-discuss__form');
  if (!input || !submit || !form) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'battle-comment-suggest';
  btn.className = 'btn btn--ghost btn--sm';
  btn.style.cssText = 'margin-top:8px;width:100%';
  btn.textContent = '✨ 토론 멘트 추천';
  btn.addEventListener('click', () => {
    const topic = document.querySelector('.battle-topic-card__title')?.textContent || '';
    const list = battleCommentSuggestions(topic);
    const next = list[Math.floor(Math.random() * list.length)].slice(0, 300);
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  form.insertBefore(btn, submit);
}

function addChecksBalancePanel() {
  const path = currentPath();
  if (path !== '/congress' && path !== '/constitutional-court') return;
  if (document.getElementById('checks-balance-panel')) return;
  const page = document.getElementById('page-content');
  if (!page) return;
  const anchor = page.querySelector('section, .card, .page-section, .congress-page, .court-page') || page.firstElementChild;
  if (!anchor) return;

  const isCourt = path === '/constitutional-court';
  const panel = document.createElement('div');
  panel.id = 'checks-balance-panel';
  panel.style.cssText = 'margin:0 0 14px;padding:16px;border-radius:22px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(67,56,202,.88));color:#fff;box-shadow:0 14px 32px rgba(15,23,42,.18);font-size:13px;line-height:1.55';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;font-weight:1000;letter-spacing:.08em;color:rgba(255,255,255,.6)">CHECKS & BALANCE</div>
        <div style="font-size:21px;font-weight:1000;margin-top:3px">${isCourt ? '⚖️ 탄핵심판 최종 단계' : '🏛️ 권력 견제 국면'}</div>
        <div style="color:rgba(255,255,255,.72);margin-top:4px">${isCourt ? '국회 탄핵소추가 넘어오면 헌법재판소가 최종 판단하고, 인용 시 조기 대선 국면으로 전환됩니다.' : '국회는 법안 표결과 탄핵소추로 대통령 권력을 견제합니다. 정국이 흔들리면 헌재와 조기대선까지 이어집니다.'}</div>
      </div>
      <button type="button" data-checks-path="/election" style="border:0;border-radius:999px;padding:9px 12px;background:var(--color-primary);color:#fff;font-weight:1000;font-family:inherit;cursor:pointer">대선 판세 →</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:14px" class="checks-balance-steps">
      <div style="border-radius:13px;background:rgba(255,255,255,.1);padding:10px;text-align:center"><b>1</b><br>지지율 하락</div>
      <div style="border-radius:13px;background:${isCourt ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.2)'};padding:10px;text-align:center"><b>2</b><br>국회 소추</div>
      <div style="border-radius:13px;background:${isCourt ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.1)'};padding:10px;text-align:center"><b>3</b><br>헌재 심판</div>
      <div style="border-radius:13px;background:rgba(255,255,255,.1);padding:10px;text-align:center"><b>4</b><br>조기 대선</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button type="button" data-checks-path="/congress" style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 10px;background:rgba(255,255,255,.1);color:#fff;font-weight:900;font-family:inherit;cursor:pointer">소소국회</button>
      <button type="button" data-checks-path="/constitutional-court" style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 10px;background:rgba(255,255,255,.1);color:#fff;font-weight:900;font-family:inherit;cursor:pointer">헌법재판소</button>
      <button type="button" data-checks-path="/republic" style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 10px;background:rgba(255,255,255,.1);color:#fff;font-weight:900;font-family:inherit;cursor:pointer">공화국 현황</button>
    </div>`;
  panel.querySelectorAll('[data-checks-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.checksPath));
  });
  anchor.insertAdjacentElement('beforebegin', panel);
}

function addDailyRoutinePanel() {
  if (currentPath() !== '/republic') return;
  if (document.getElementById('daily-routine-panel')) return;
  const content = document.querySelector('.rep-content') || document.getElementById('page-content');
  if (!content) return;
  const firstSection = content.querySelector('.rep-section');
  if (!firstSection) return;

  const panel = document.createElement('div');
  panel.id = 'daily-routine-panel';
  panel.className = 'rep-section';
  panel.style.cssText = 'background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,250,252,.94));border:1px solid rgba(100,116,139,.18);box-shadow:0 12px 28px rgba(15,23,42,.07)';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px">
      <div>
        <div style="font-size:12px;font-weight:1000;letter-spacing:.06em;color:var(--color-primary)">DAILY ROUTINE</div>
        <div style="font-size:20px;font-weight:1000;color:var(--color-text-primary);margin-top:3px">📋 오늘 정치 루틴</div>
        <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.5;margin-top:4px">처음 온 유저도 아래 순서대로만 누르면 정치력이 쌓이고 대선까지 이어집니다.</div>
      </div>
      <button type="button" data-routine-path="/battle" style="border:0;border-radius:999px;padding:9px 12px;background:var(--color-primary);color:#fff;font-weight:1000;font-family:inherit;cursor:pointer">오늘 배틀 시작</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px" class="daily-routine-grid">
      <button type="button" data-routine-path="/battle" style="text-align:left;border:1px solid rgba(100,116,139,.18);border-radius:16px;background:#fff;padding:12px;font-family:inherit;cursor:pointer"><b>1. 정치배틀</b><br><small>투표하고 +5P</small></button>
      <button type="button" data-routine-path="/parties" style="text-align:left;border:1px solid rgba(100,116,139,.18);border-radius:16px;background:#fff;padding:12px;font-family:inherit;cursor:pointer"><b>2. 정당전</b><br><small>내 당 세력 키우기</small></button>
      <button type="button" data-routine-path="/election" style="text-align:left;border:1px solid rgba(100,116,139,.18);border-radius:16px;background:#fff;padding:12px;font-family:inherit;cursor:pointer"><b>3. 대선</b><br><small>당대표·대통령 도전</small></button>
      <button type="button" data-routine-path="/congress" style="text-align:left;border:1px solid rgba(100,116,139,.18);border-radius:16px;background:#fff;padding:12px;font-family:inherit;cursor:pointer"><b>4. 국회</b><br><small>법안·탄핵 정국</small></button>
    </div>`;
  panel.querySelectorAll('[data-routine-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.routinePath));
  });
  firstSection.insertAdjacentElement('afterend', panel);
}

export function runRepublicGameFlow() {
  ensureGameFlowStyle();
  addHomeRepublicEntry();
  addPledgeRecommendButton();
  addBattleImpactNotice();
  addBattleCommentSuggestButton();
  addChecksBalancePanel();
  addDailyRoutinePanel();
}

let flowTimer = null;
function scheduleGameFlow() {
  clearTimeout(flowTimer);
  flowTimer = setTimeout(runRepublicGameFlow, 120);
}

window.addEventListener('hashchange', scheduleGameFlow);
window.addEventListener('popstate', scheduleGameFlow);
window.addEventListener('sosoking:extensions-ready', scheduleGameFlow);
new MutationObserver(scheduleGameFlow).observe(document.body, { childList: true, subtree: true });
scheduleGameFlow();
