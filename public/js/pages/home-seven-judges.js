import { renderHome as renderBaseHome } from './home-no-search.js?v=20260730-search-scope-1';

function keepSevenJudgeCards(container) {
  const lineup = container.querySelector('.judge-lineup');
  if (!lineup) return;

  lineup.querySelectorAll('.judge-card').forEach(card => {
    const name = card.querySelector('.judge-card-name')?.textContent?.trim() || '';
    const icon = card.querySelector('.judge-card-icon')?.textContent?.trim() || '';
    if (name === '운명에 맡기기' || icon === '🎲') card.remove();
  });

  const section = lineup.closest('.container');
  if (!section) return;
  const heading = Array.from(section.children).find(element => element.textContent?.includes('7명의 AI 판사'));
  if (heading) heading.textContent = '7명의 AI 판사';
  const subtitle = section.querySelector('.section-sub');
  if (subtitle) subtitle.textContent = '사건을 접수하면 7명 중 한 명이 자동으로 배정됩니다.';
}

function applyCurrentServiceCopy(container) {
  const heroSub = container.querySelector('.hero-sub');
  if (heroSub) {
    heroSub.innerHTML = '내 억울함은 AI 판사에게 맡기고,<br><strong>공개 판결은 투표와 토론으로 함께 즐겨보세요.</strong><br><span style="font-size:11px;opacity:0.58;">사건을 접수하거나 다른 사람의 생활판결에 참여할 수 있습니다.</span>';
  }

  const serviceNotice = Array.from(container.querySelectorAll('.disclaimer'))
    .find(element => element.textContent?.includes('실제 판례 맞히기'));
  if (serviceNotice) {
    serviceNotice.innerHTML = '<strong>⚠️ 오락 서비스 안내</strong><br>소소킹 판결소는 AI 생활판결과 공개 판결의 투표·토론을 즐기는 오락형 생활법정입니다. 서비스 결과에는 법적 효력이 없습니다.';
  }
}

export async function renderHome(container) {
  await renderBaseHome(container);
  keepSevenJudgeCards(container);
  applyCurrentServiceCopy(container);
}
