import { renderHome as renderBaseHome } from './home-no-search.js?v=20260730-search-scope-1';

const JUDGES = [
  { name: '꼰대형', icon: '🧓', desc: '사건 끝에 꼭 인생훈계' },
  { name: '냉혈형', icon: '🧊', desc: '서운함도 수치로 정산' },
  { name: '회피형', icon: '🏃', desc: '판결 피하다 더 이상한 처분' },
  { name: '추궁형', icon: '🔎', desc: '말 한마디를 끝까지 추궁' },
  { name: '오버형', icon: '🚨', desc: '소소한 사건도 국가비상급' },
  { name: '드립형', icon: '🎭', desc: '정색하고 사건 맞춤 드립' },
  { name: '빙의형', icon: '🌀', desc: '사건 세계관에 완전 빙의' }
];

const JUDGE_ICON = Object.fromEntries(JUDGES.map(judge => [judge.name, judge.icon]));

function syncSevenJudgeCards(container) {
  const lineup = container.querySelector('.judge-lineup');
  if (!lineup) return;

  lineup.querySelectorAll('.judge-card').forEach(card => {
    const name = card.querySelector('.judge-card-name')?.textContent?.trim() || '';
    const icon = card.querySelector('.judge-card-icon')?.textContent?.trim() || '';
    if (name === '운명에 맡기기' || icon === '🎲') card.remove();
  });

  const cards = [...lineup.querySelectorAll('.judge-card')];
  cards.slice(0, JUDGES.length).forEach((card, index) => {
    const judge = JUDGES[index];
    const icon = card.querySelector('.judge-card-icon');
    const name = card.querySelector('.judge-card-name');
    const desc = card.querySelector('.judge-card-desc');
    if (icon) icon.textContent = judge.icon;
    if (name) name.textContent = judge.name;
    if (desc) desc.textContent = judge.desc;
    card.setAttribute('aria-label', `${judge.name} 판사 · ${judge.desc}`);
  });

  // 구형 카드가 더 남아도 메인에는 현재 판사 7명만 노출한다.
  cards.slice(JUDGES.length).forEach(card => card.remove());

  const section = lineup.closest('.container');
  if (!section) return;
  const heading = Array.from(section.children).find(element => element.textContent?.includes('7명의 AI 판사'));
  if (heading) heading.textContent = '7명의 AI 판사';
  const subtitle = section.querySelector('.section-sub');
  if (subtitle) subtitle.textContent = '사건을 접수하면 성격부터 판결 방식까지 다른 7명 중 한 명이 자동 배정됩니다.';
}

function syncJudgeIcons(container) {
  const popularJudge = container.querySelector('#stat-judge');
  if (popularJudge) {
    const judgeType = JUDGES.find(judge => popularJudge.textContent?.includes(judge.name))?.name;
    if (judgeType) popularJudge.textContent = `${JUDGE_ICON[judgeType]} ${judgeType.replace('형', '')}`;
  }

  container.querySelectorAll('.case-meta span').forEach(meta => {
    const judge = JUDGES.find(item => meta.textContent?.includes(item.name));
    if (!judge) return;
    meta.textContent = `${judge.icon} ${judge.name} 판사`;
  });
}

function applyCurrentServiceCopy(container) {
  const heroSub = container.querySelector('.hero-sub');
  if (heroSub) {
    heroSub.innerHTML = '내 억울함은 AI 판사에게 맡기고,<br><strong>꼰대부터 냉혈·회피·추궁·오버·드립·빙의까지, 누가 걸릴지 모르는 생활재판을 받아보세요.</strong><br><span style="font-size:11px;opacity:0.58;">같은 사건도 담당 판사의 성격에 따라 전혀 다른 방식으로 흘러갑니다.</span>';
  }

  const feedSection = container.querySelector('#feed-container')?.closest('.container');
  if (feedSection) {
    const kicker = feedSection.children[0];
    const heading = feedSection.children[1];
    if (kicker) kicker.textContent = '🔥 사용자가 공개한 AI 생활판결';
    if (heading) heading.textContent = '최근 공개 AI 판결 5건';
  }

  const serviceNotice = Array.from(container.querySelectorAll('.disclaimer'))
    .find(element => element.textContent?.includes('오락 서비스 안내'));
  if (serviceNotice) {
    serviceNotice.innerHTML = '<strong>⚠️ 오락 서비스 안내</strong><br>소소킹 판결소는 사용자가 접수한 사소한 생활분쟁을 7명의 개성 강한 AI 판사가 과하게 진지하게 심리하는 오락형 생활법정입니다. 실제 사례·판례 서비스가 아니며 결과에는 법적 효력이 없습니다.';
  }
}

export async function renderHome(container) {
  await renderBaseHome(container);
  syncSevenJudgeCards(container);
  syncJudgeIcons(container);
  applyCurrentServiceCopy(container);
}
