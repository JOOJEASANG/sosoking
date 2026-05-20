import { setMeta } from '../utils/seo.js';
import { navigate } from '../router.js';

const GAMES = [
  {
    key: 'liar',
    icon: '🕵️',
    title: '라이어게임',
    desc: '제시어를 모르는 라이어를 찾아내는 대화형 추리 게임',
    status: '방 만들기',
    tag: '오픈',
    path: '/game/liar',
    enabled: true,
  },
  {
    key: 'mafia',
    icon: '🌙',
    title: '마피아게임',
    desc: '정체를 숨기고 대화로 범인을 찾아내는 추리 게임',
    status: '방 만들기',
    tag: '오픈',
    path: '/game/mafia',
    enabled: true,
  },
];

export function renderSosoland() {
  setMeta('게임');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="sosoland-page">
      <section class="sosoland-hero sosoland-hero--arcade">
        <div class="sosoland-hero__glow sosoland-hero__glow--one"></div>
        <div class="sosoland-hero__glow sosoland-hero__glow--two"></div>
        <div class="sosoland-hero__content">
          <div class="sosoland-hero__eyebrow">GAME PLAYGROUND</div>
          <h1>친구와 바로 즐기는<br>추리 게임 모음</h1>
          <p>회원가입 없이 닉네임만 입력하고 초대 링크로 함께 즐길 수 있는 게임공간입니다.</p>
          <div class="sosoland-hero__chips">
            <span>🕵️ 라이어게임</span>
            <span>🌙 마피아게임</span>
          </div>
        </div>
        <div class="sosoland-hero__console" aria-hidden="true">
          <span>▲</span><span>●</span><span>◆</span><span>✦</span>
        </div>
      </section>

      <section class="sosoland-grid sosoland-grid--two">
        ${GAMES.map(game => `
          <article class="sosoland-card sosoland-card--${game.key}" data-game-path="${game.path}">
            <div class="sosoland-card__top">
              <div class="sosoland-card__icon">${game.icon}</div>
              <span class="sosoland-card__tag">${game.tag}</span>
            </div>
            <h2>${game.title}</h2>
            <p>${game.desc}</p>
            <button class="btn btn--primary btn--sm" type="button">${game.status}</button>
          </article>
        `).join('')}
      </section>
    </div>`;

  el.querySelectorAll('[data-game-path]').forEach(card => {
    card.addEventListener('click', event => {
      event.preventDefault();
      navigate(card.dataset.gamePath);
    });
  });
}
