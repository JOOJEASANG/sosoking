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
    heroSub.innerHTML = '내 억울함은 AI 판사에게 맡기고,<br><strong>사소한 생활분쟁을 과하게 진지한 판결문으로 받아보세요.</strong><br><span style="font-size:11px;opacity:0.58;">사용자가 접수한 내용으로 만드는 오락용 AI 생활법정입니다.</span>';
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
    serviceNotice.innerHTML = '<strong>⚠️ 오락 서비스 안내</strong><br>소소킹 판결소는 사용자가 접수한 사소한 생활분쟁을 AI 판결문으로 만드는 오락형 생활법정입니다. 실제 사례·판례 서비스가 아니며 결과에는 법적 효력이 없습니다.';
  }
}

export async function renderHome(container) {
  await renderBaseHome(container);
  keepSevenJudgeCards(container);
  applyCurrentServiceCopy(container);
}
