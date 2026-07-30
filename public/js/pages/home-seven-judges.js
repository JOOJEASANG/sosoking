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

export async function renderHome(container) {
  await renderBaseHome(container);
  keepSevenJudgeCards(container);
}
