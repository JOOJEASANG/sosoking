import { setMeta } from '../utils/seo.js';
import { navigate } from '../router.js';

const GAMES = [
  {
    key: 'liar',
    icon: '🕵️',
    title: '라이어게임',
    desc: '제시어를 모르는 라이어를 찾아내는 대화형 추리 게임',
    status: '준비중',
    tag: '추천',
  },
  {
    key: 'mafia-lite',
    icon: '🌙',
    title: '소소마피아',
    desc: '복잡한 직업 없이 가볍게 즐기는 모바일 마피아 게임',
    status: '준비중',
    tag: '실시간',
  },
  {
    key: 'marble',
    icon: '🎲',
    title: '소소마블',
    desc: '과금 없이 운과 선택으로만 즐기는 공정한 보드게임',
    status: '기획중',
    tag: '보드게임',
  },
];

export function renderSosoland() {
  setMeta('소소랜드 · 공정하게 즐기는 게임');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="sosoland-page">
      <section class="sosoland-hero">
        <div class="sosoland-hero__eyebrow">🎮 소소랜드</div>
        <h1>과금 없이 정정당당하게 즐기는 게임 공간</h1>
        <p>커뮤니티 글놀이는 만능 놀이글로, 실시간 게임은 소소랜드로 분리해서 더 깔끔하게 운영합니다.</p>
      </section>

      <section class="sosoland-grid">
        ${GAMES.map(game => `
          <article class="sosoland-card" data-game="${game.key}">
            <div class="sosoland-card__top">
              <div class="sosoland-card__icon">${game.icon}</div>
              <span class="sosoland-card__tag">${game.tag}</span>
            </div>
            <h2>${game.title}</h2>
            <p>${game.desc}</p>
            <button class="btn btn--ghost btn--sm" type="button" disabled>${game.status}</button>
          </article>
        `).join('')}
      </section>

      <section class="sosoland-note">
        <b>운영 방향</b>
        <span>초기에는 카카오톡 초대 링크로 방에 들어오는 구조가 가장 현실적입니다. 인원이 모이면 실시간 방/초대/관전 기능을 붙이면 됩니다.</span>
      </section>

      <div class="sosoland-actions">
        <button class="btn btn--primary" id="btn-sosoland-write">놀이글 쓰기</button>
        <button class="btn btn--ghost" id="btn-sosoland-feed">탐색으로 가기</button>
      </div>
    </div>`;

  document.getElementById('btn-sosoland-write')?.addEventListener('click', () => navigate('/write'));
  document.getElementById('btn-sosoland-feed')?.addEventListener('click', () => navigate('/feed'));
}
