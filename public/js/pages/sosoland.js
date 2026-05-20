import { setMeta } from '../utils/seo.js';
import { navigate } from '../router.js';

const GAMES = [
  {
    key: 'liar',
    icon: '🕵️',
    title: '라이어게임',
    desc: '제시어를 모르는 라이어를 찾아내는 대화형 추리 게임',
    status: '방 만들기',
    tag: '1차 오픈',
    path: '/game/liar',
    enabled: true,
  },
  {
    key: 'mafia-lite',
    icon: '🌙',
    title: '마피아',
    desc: '복잡한 직업 없이 가볍게 즐기는 모바일 마피아 게임',
    status: '준비중',
    tag: '실시간',
    enabled: false,
  },
  {
    key: 'marble',
    icon: '🎲',
    title: '마블',
    desc: '과금 없이 운과 선택으로만 즐기는 공정한 보드게임',
    status: '기획중',
    tag: '보드게임',
    enabled: false,
  },
];

export function renderSosoland() {
  setMeta('게임');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="sosoland-page">
      <section class="sosoland-hero sosoland-hero--gamebox">
        <div class="sosoland-hero__eyebrow">GAME</div>
        <h1>가볍게 즐기는<br>게임공간</h1>
        <p>복잡한 과금유도 없이 운과 선택으로 즐기는 게임을 하나씩 추가하고 있습니다.</p>
        <div class="sosoland-hero__chips">
          <span>🕵️ 라이어게임 오픈</span>
          <span>🌙 마피아 준비중</span>
          <span>🎲 마블 기획중</span>
        </div>
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
            <button class="btn ${game.enabled ? 'btn--primary' : 'btn--ghost'} btn--sm" type="button" ${game.enabled ? `data-game-path="${game.path}"` : 'disabled'}>${game.status}</button>
          </article>
        `).join('')}
      </section>
    </div>`;

  el.querySelectorAll('[data-game-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.gamePath));
  });
}
