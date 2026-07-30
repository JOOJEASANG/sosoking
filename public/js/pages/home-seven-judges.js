import { renderHome as renderBaseHome } from './home-no-search.js?v=20260730-search-scope-1';

const HOME_FEATURES = [
  ['#/submit', '🤖', 'AI 생활판결', '내 사건을 접수하고 판결받기'],
  ['#/daily-court', '⚖️', '오늘의 재판', '매일 실제 판례 3건에 도전'],
  ['#/board', '📜', '판결기록', '공개 판결과 토론 둘러보기'],
  ['#/my-cases', '🗂️', '내 사건', '내가 접수한 사건 다시 확인']
];

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

function createFeatureCard([href, iconText, titleText, descriptionText]) {
  const link = document.createElement('a');
  link.className = 'home-feature-card';
  link.href = href;

  const icon = document.createElement('span');
  icon.className = 'home-feature-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = iconText;

  const copy = document.createElement('span');
  const title = document.createElement('strong');
  const description = document.createElement('small');
  title.textContent = titleText;
  description.textContent = descriptionText;
  copy.append(title, description);
  link.append(icon, copy);
  return link;
}

function addFeatureGrid(container, hero) {
  if (container.querySelector('.home-feature-wrap')) return;
  const section = document.createElement('section');
  section.className = 'home-feature-wrap';
  section.setAttribute('aria-label', '주요 기능 바로가기');
  const grid = document.createElement('div');
  grid.className = 'home-feature-grid';
  HOME_FEATURES.forEach(feature => grid.appendChild(createFeatureCard(feature)));
  section.appendChild(grid);
  hero.insertAdjacentElement('afterend', section);
}

function findDirectChild(section, text) {
  return Array.from(section?.children || []).find(element => element.textContent?.includes(text));
}

function decorateSection(section, kind, titleText, kickerText = '') {
  if (!section) return;
  section.classList.add('home-section', `home-${kind}-section`);
  const title = findDirectChild(section, titleText);
  const kicker = title?.previousElementSibling;
  title?.classList.add('section-title');
  kicker?.classList.add('section-kicker');
  if (kicker && kickerText) kicker.textContent = kickerText;
}

function applyHomeRedesign(container) {
  const shell = container.firstElementChild;
  const hero = container.querySelector('.hero-section');
  if (!shell || !hero) return;

  shell.classList.add('home-redesign-shell');
  hero.setAttribute('aria-label', '소소킹 판결소 소개');

  const badge = hero.querySelector('.hero-badge');
  if (badge) badge.textContent = '⚖️ 소소한 일상을 판결하는 생활법정 놀이터';

  const subtitle = hero.querySelector('.hero-sub');
  if (subtitle) {
    subtitle.textContent = '내 억울함은 AI 판사에게 맡기고, 실제 판례는 직접 판결해보세요.';
  }

  addFeatureGrid(container, hero);

  const judgeSection = container.querySelector('.judge-lineup')?.closest('.container');
  const feedSection = container.querySelector('#feed-container')?.closest('.container');
  const procedureSection = Array.from(container.querySelectorAll('.container'))
    .find(element => element.textContent?.includes('재판 진행 순서'));

  decorateSection(judgeSection, 'judges', '7명의 AI 판사');
  decorateSection(feedSection, 'records', '최근 생활형 처분', '📜 지금 공개된 생활법정 기록');
  decorateSection(procedureSection, 'procedure', '재판 진행 순서');

  const feedTitle = findDirectChild(feedSection, '최근 생활형 처분');
  if (feedTitle) feedTitle.textContent = '최근 공개 판결';

  const procedureTitle = findDirectChild(procedureSection, '재판 진행 순서');
  if (procedureTitle) procedureTitle.textContent = '한눈에 보는 재판 진행 순서';
}

export async function renderHome(container) {
  await renderBaseHome(container);
  keepSevenJudgeCards(container);
  applyHomeRedesign(container);
}
