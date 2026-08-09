const JUDGE_UI_VERSION = '20260810-judge-final-1';
const HOME_HERO_HTML = '내 억울함은 AI 판사에게 맡기고,<br><strong>꼰대·냉혈·회피·추궁·오버·드립·빙의, 누가 맡느냐에 따라 같은 사건도 완전히 다르게 판결됩니다.</strong><br><span style="font-size:11px;opacity:0.58;">사건접수부터 수사·양측 변론·판결까지 담당 판사의 성격이 이어지는 오락용 AI 생활법정입니다.</span>';
const HOME_NOTICE_HTML = '<strong>⚠️ 오락 서비스 안내</strong><br>소소킹 판결소는 사소한 생활분쟁을 7명의 개성 강한 AI 판사가 사건접수·수사보고·원고측 변론·피고측 변론·판결의 다섯 단계로 과하게 진지하게 심리하는 오락 서비스입니다. 실제 법률 판단이 아니며 결과에는 법적 효력이 없습니다.';
const JUDGES = [
  { name: '꼰대형', icon: '🧓', desc: '기본·예의·사람 사는 도리로 끝까지 훈계하는 재판부' },
  { name: '냉혈형', icon: '🧊', desc: '감정보다 시간·수량·결과를 차갑게 계산하는 재판부' },
  { name: '회피형', icon: '🏃', desc: '개입을 피하려다 결국 이상한 최소처분을 내리는 재판부' },
  { name: '추궁형', icon: '🔎', desc: '단어 하나와 앞뒤 모순을 끝까지 놓지 않는 재판부' },
  { name: '오버형', icon: '🚨', desc: '사소한 생활분쟁을 국가비상급으로 확대하는 재판부' },
  { name: '드립형', icon: '🎭', desc: '사건 고유 소재에서만 강한 드립과 콜백을 뽑는 재판부' },
  { name: '빙의형', icon: '🌀', desc: '게임·회사·음식 등 사건 세계의 실제 문법에 몰입하는 재판부' }
];

const JUDGE_BY_NAME = new Map(JUDGES.map(judge => [judge.name, judge]));
const LEGACY_JUDGE_NAMES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형'];

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function syncHomeJudgeLineup(root) {
  const lineup = root.querySelector('.judge-lineup');
  if (!lineup) return;

  [...lineup.querySelectorAll('.judge-card')].forEach(card => {
    const name = card.querySelector('.judge-card-name')?.textContent?.trim() || '';
    const icon = card.querySelector('.judge-card-icon')?.textContent?.trim() || '';
    if (name === '운명에 맡기기' || icon === '🎲') card.remove();
  });

  const cards = [...lineup.querySelectorAll('.judge-card')];
  if (cards.length !== JUDGES.length) {
    lineup.replaceChildren(...JUDGES.map(judge => {
      const link = document.createElement('a');
      link.href = '#/submit';
      link.className = 'judge-card';
      link.style.textDecoration = 'none';
      link.style.color = 'inherit';
      link.setAttribute('aria-label', `${judge.name} 판사 · ${judge.desc}`);

      const icon = document.createElement('div');
      icon.className = 'judge-card-icon';
      icon.textContent = judge.icon;
      const name = document.createElement('div');
      name.className = 'judge-card-name';
      name.textContent = judge.name;
      const desc = document.createElement('div');
      desc.className = 'judge-card-desc';
      desc.textContent = judge.desc;
      link.append(icon, name, desc);
      return link;
    }));
  } else {
    [...lineup.querySelectorAll('.judge-card')].forEach((card, index) => {
      const judge = JUDGES[index];
      setText(card.querySelector('.judge-card-icon'), judge.icon);
      setText(card.querySelector('.judge-card-name'), judge.name);
      setText(card.querySelector('.judge-card-desc'), judge.desc);
      card.setAttribute('aria-label', `${judge.name} 판사 · ${judge.desc}`);
    });
  }

  const section = lineup.closest('.container');
  const heading = section && [...section.children].find(element => element.textContent?.includes('7명의 AI 판사'));
  setText(heading, '7명의 AI 판사');
  setText(section?.querySelector('.section-sub'), '사건을 접수하면 성격부터 수사·변론·판결 방식까지 다른 7명 중 한 명이 자동 배정됩니다.');
}

function syncHomeCopy(root) {
  const heroSub = root.querySelector('.hero-sub');
  if (heroSub && heroSub.innerHTML !== HOME_HERO_HTML) heroSub.innerHTML = HOME_HERO_HTML;
  if (heroSub) heroSub.dataset.judgeFinalVersion = JUDGE_UI_VERSION;

  setText(
    root.querySelector('#court-entrance .court-desc'),
    '사건을 접수하면 7명의 개성 강한 AI 판사 중 한 명이 자동 배정되어 다섯 단계 전체를 자기 방식으로 심리합니다.'
  );

  const notice = [...root.querySelectorAll('.disclaimer')]
    .find(element => element.textContent?.includes('오락 서비스 안내'));
  if (notice && notice.innerHTML !== HOME_NOTICE_HTML) notice.innerHTML = HOME_NOTICE_HTML;
  if (notice) notice.dataset.judgeFinalVersion = JUDGE_UI_VERSION;
}

function syncJudgeMetadata(root) {
  const popularJudge = root.querySelector('#stat-judge');
  if (popularJudge) {
    const current = popularJudge.textContent || '';
    const judge = JUDGES.find(item => current.includes(item.name) || current.includes(item.name.replace('형', '')));
    if (judge) setText(popularJudge, `${judge.icon} ${judge.name.replace('형', '')}`);
  }

  root.querySelectorAll('.case-meta span').forEach(meta => {
    const judge = JUDGES.find(item => meta.textContent?.includes(item.name));
    if (judge) setText(meta, `${judge.icon} ${judge.name} 판사`);
  });

  root.querySelectorAll('.judge-name').forEach(nameElement => {
    const raw = (nameElement.textContent || '').replace(/\s*판사\s*$/, '').trim();
    const judge = JUDGE_BY_NAME.get(raw);
    if (!judge) return;
    const summary = nameElement.closest('.judge-summary');
    setText(summary?.querySelector('.judge-character'), judge.icon);
    setText(summary?.querySelector('.judge-desc'), judge.desc);
  });
}

function syncGuide(root) {
  const card = [...root.querySelectorAll('.card')]
    .find(element => element.textContent?.includes('AI 판사 자동 배정'));
  if (!card) return;

  const textBlocks = [...card.querySelectorAll('div')].filter(element => !element.children.length);
  const description = textBlocks.find(element => LEGACY_JUDGE_NAMES.some(name => element.textContent?.includes(name)))
    || textBlocks.find(element => element.textContent?.includes('중 한 명이 사건마다 자동 배정'));
  if (description) {
    setText(description, '꼰대형·냉혈형·회피형·추궁형·오버형·드립형·빙의형 중 한 명이 사건마다 자동 배정됩니다. 같은 사건도 담당 판사에 따라 다섯 단계의 관찰 방식과 웃음 포인트가 달라집니다.');
  }
}

function applyFinalJudgeUi() {
  const root = document.getElementById('page-content');
  if (!root) return;
  syncHomeJudgeLineup(root);
  syncHomeCopy(root);
  syncJudgeMetadata(root);
  syncGuide(root);
  window.__SOSOKING_JUDGE_UI_VERSION__ = JUDGE_UI_VERSION;
}

let queued = false;
function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applyFinalJudgeUi();
  });
}

const observeTarget = document.getElementById('page-content') || document.body;
new MutationObserver(queueApply).observe(observeTarget, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', queueApply);
queueApply();
