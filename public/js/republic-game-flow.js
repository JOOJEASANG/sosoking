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
    .battle-score-card{margin-top:10px;border:1px solid rgba(255,107,74,.22);border-radius:16px;background:linear-gradient(135deg,rgba(255,107,74,.09),rgba(15,23,42,.035));padding:12px;font-size:12px;color:var(--color-text-secondary)}
    .battle-score-card__head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}
    .battle-score-card__title{font-weight:1000;color:var(--color-text-primary)}
    .battle-score-card__total{font-weight:1000;color:var(--color-primary);font-size:15px}
    .battle-score-card__grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:8px 0}
    .battle-score-card__metric{border-radius:12px;background:rgba(255,255,255,.7);border:1px solid rgba(100,116,139,.14);padding:8px 6px;text-align:center}
    .battle-score-card__metric b{display:block;color:var(--color-text-primary);font-size:13px;margin-bottom:2px}
    .battle-score-card__tip{line-height:1.45;color:var(--color-text-secondary)}
    @media(max-width:640px){
      .daily-routine-grid,.checks-balance-steps,.rep-power-ladder-grid{grid-template-columns:repeat(2,1fr)!important}
      #checks-balance-panel,#daily-routine-panel{border-radius:18px!important;padding:14px!important}
      .battle-score-card__grid{grid-template-columns:repeat(2,1fr)}
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

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countHits(text, words) {
  return words.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0);
}

function scoreBattleComment(text) {
  const t = String(text || '').trim();
  const len = t.length;
  const hasNumber = /\d|%|퍼센트|예산|세금|비용|재원|효과|지표/.test(t);
  const hasReason = /왜냐|때문|근거|따라서|그래서|우선|실행|결과|효과/.test(t);
  const hasBalance = /다만|하지만|반면|동시에|한편|위험|부작용|검토/.test(t);
  const hasPeople = /시민|청년|서민|유권자|국민|자영업|학생|노동|민생/.test(t);
  const attackWords = countHits(t, ['무능', '거짓', '특혜', '기득권', '포퓰리즘', '책임', '검증', '실패']);
  const riskWords = countHits(t, ['멍청', '꺼져', '닥쳐', '쓰레기', '무조건', '절대', '다 죽', '망해라']);

  const lengthScore = len < 10 ? 18 : len < 30 ? 48 : len < 80 ? 76 : 88;
  const persuasion = clampScore(lengthScore + (hasReason ? 12 : 0) + (hasPeople ? 8 : 0) - riskWords * 10);
  const reality = clampScore(42 + (hasNumber ? 20 : 0) + (hasReason ? 16 : 0) + (hasBalance ? 12 : 0) - (len < 20 ? 15 : 0));
  const defense = clampScore(40 + (hasBalance ? 20 : 0) + Math.min(20, attackWords * 7) + (hasReason ? 10 : 0));
  const popularity = clampScore(48 + (hasPeople ? 18 : 0) + (len >= 25 && len <= 120 ? 12 : 0) - riskWords * 12);
  const risk = clampScore(20 + riskWords * 24 + (len > 180 ? 12 : 0) + (!hasBalance && attackWords >= 2 ? 12 : 0));
  const total = clampScore((persuasion + reality + defense + popularity + (100 - risk)) / 5);

  let tip = '근거와 시민 영향이 보이면 토론 점수가 올라갑니다.';
  if (len < 20) tip = '한 문장 더 보태서 근거를 넣으면 설득력이 올라갑니다.';
  else if (!hasNumber) tip = '예산, 재원, 효과 같은 현실성 단어를 넣으면 더 강해집니다.';
  else if (!hasBalance) tip = '반론이나 부작용을 한 줄 넣으면 방어력이 좋아집니다.';
  else if (risk >= 55) tip = '표현이 강합니다. 공격은 좋지만 말실수 위험을 낮추는 게 좋습니다.';
  else if (total >= 80) tip = '캡처하고 싶을 정도로 좋은 토론 멘트입니다.';

  return { total, persuasion, reality, defense, popularity, risk, tip };
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

function addBattleDebateScoreButton() {
  if (currentPath() !== '/battle') return;
  if (document.getElementById('battle-debate-score-btn')) return;
  const input = document.getElementById('discuss-input');
  const submit = document.getElementById('btn-discuss-submit');
  const form = document.querySelector('.battle-discuss__form');
  if (!input || !submit || !form) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'battle-debate-score-btn';
  btn.className = 'btn btn--ghost btn--sm';
  btn.style.cssText = 'margin-top:8px;width:100%';
  btn.textContent = '🎯 토론력 평가';
  btn.addEventListener('click', () => {
    const text = input.value || '';
    const score = scoreBattleComment(text);
    let card = document.getElementById('battle-score-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'battle-score-card';
      card.className = 'battle-score-card';
      form.insertBefore(card, submit);
    }
    if (text.trim().length < 5) {
      card.innerHTML = `<div class="battle-score-card__head"><span class="battle-score-card__title">🎯 토론력 평가</span><span class="battle-score-card__total">대기</span></div><div class="battle-score-card__tip">먼저 토론 멘트를 5자 이상 입력해 주세요.</div>`;
      input.focus();
      return;
    }
    card.innerHTML = `
      <div class="battle-score-card__head"><span class="battle-score-card__title">🎯 토론력 평가</span><span class="battle-score-card__total">${score.total}점</span></div>
      <div class="battle-score-card__grid">
        <div class="battle-score-card__metric"><b>${score.persuasion}</b>설득력</div>
        <div class="battle-score-card__metric"><b>${score.reality}</b>현실성</div>
        <div class="battle-score-card__metric"><b>${score.defense}</b>방어력</div>
        <div class="battle-score-card__metric"><b>${score.popularity}</b>대중성</div>
        <div class="battle-score-card__metric"><b>${score.risk}%</b>말실수</div>
      </div>
      <div class="battle-score-card__tip">${score.tip}</div>`;
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
  addBattleDebateScoreButton();
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
