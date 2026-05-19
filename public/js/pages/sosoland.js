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
    title: '소소마피아',
    desc: '복잡한 직업 없이 가볍게 즐기는 모바일 마피아 게임',
    status: '준비중',
    tag: '실시간',
    enabled: false,
  },
  {
    key: 'marble',
    icon: '🎲',
    title: '소소마블',
    desc: '과금 없이 운과 선택으로만 즐기는 공정한 보드게임',
    status: '기획중',
    tag: '보드게임',
    enabled: false,
  },
];

export function renderSosoland() {
  setMeta('게임 · 소소랜드');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="sosoland-page">
      <section class="sosoland-hero">
        <div class="sosoland-hero__eyebrow">🎮 게임</div>
        <h1>소소랜드</h1>
        <p>피드는 멀티게시판 커뮤니티, 게임은 소소랜드로 분리해서 운영합니다.</p>
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

      <section class="sosoland-note">
        <b>운영 방향</b>
        <span>초기에는 카카오톡 초대 링크로 방에 들어오는 구조로 시작하고, 인원이 모이면 실시간 방/관전/랭킹을 붙입니다.</span>
      </section>

      <div class="sosoland-actions">
        <button class="btn btn--primary" id="btn-sosoland-feed">피드로 가기</button>
        <button class="btn btn--ghost" id="btn-sosoland-write">글쓰기</button>
      </div>
    </div>`;

  el.querySelectorAll('[data-game-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.gamePath));
  });
  document.getElementById('btn-sosoland-write')?.addEventListener('click', () => navigate('/write'));
  document.getElementById('btn-sosoland-feed')?.addEventListener('click', () => navigate('/feed'));
}
