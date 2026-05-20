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

function isMobileGameMode() {
  return window.matchMedia('(max-width: 767px)').matches || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);
}

function closeGameLayer() {
  document.getElementById('desktop-game-layer')?.remove();
  document.body.classList.remove('desktop-game-layer-open');
  window.removeEventListener('keydown', onLayerKeydown);
}

function onLayerKeydown(event) {
  if (event.key === 'Escape') closeGameLayer();
}

function openGameLayer(game) {
  if (isMobileGameMode()) {
    navigate(game.path);
    return;
  }

  closeGameLayer();
  const layer = document.createElement('div');
  layer.id = 'desktop-game-layer';
  layer.className = `desktop-game-layer desktop-game-layer--${game.key}`;
  layer.innerHTML = `
    <div class="desktop-game-layer__backdrop" data-game-layer-close></div>
    <section class="desktop-game-layer__panel" role="dialog" aria-modal="true" aria-label="${game.title}">
      <header class="desktop-game-layer__head">
        <div class="desktop-game-layer__title"><span>${game.icon}</span><b>${game.title}</b><small>PC 레이어 게임창</small></div>
        <div class="desktop-game-layer__actions">
          <button class="desktop-game-layer__mini" type="button" data-game-open-full>새 화면</button>
          <button class="desktop-game-layer__close" type="button" data-game-layer-close aria-label="닫기">×</button>
        </div>
      </header>
      <iframe class="desktop-game-layer__frame" src="${location.origin}/#${game.path}" title="${game.title}" allow="clipboard-write"></iframe>
    </section>`;

  document.body.appendChild(layer);
  document.body.classList.add('desktop-game-layer-open');
  layer.querySelectorAll('[data-game-layer-close]').forEach(btn => btn.addEventListener('click', closeGameLayer));
  layer.querySelector('[data-game-open-full]')?.addEventListener('click', () => {
    closeGameLayer();
    navigate(game.path);
  });
  window.addEventListener('keydown', onLayerKeydown);
}

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
          <p>모바일은 앱 게임처럼 전체 화면으로, PC는 소소킹 안의 게임 레이어창으로 바로 즐길 수 있습니다.</p>
          <div class="sosoland-hero__chips">
            <span>🕵️ 라이어게임</span>
            <span>🌙 마피아게임</span>
            <span>📱 모바일 앱 모드</span>
            <span>🖥️ PC 레이어창</span>
          </div>
        </div>
        <div class="sosoland-hero__console" aria-hidden="true">
          <span>▲</span><span>●</span><span>◆</span><span>✦</span>
        </div>
      </section>

      <section class="sosoland-grid sosoland-grid--two">
        ${GAMES.map(game => `
          <article class="sosoland-card sosoland-card--${game.key}" data-game-key="${game.key}" data-game-path="${game.path}">
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
      const game = GAMES.find(item => item.key === card.dataset.gameKey) || GAMES.find(item => item.path === card.dataset.gamePath);
      if (game) openGameLayer(game);
      else navigate(card.dataset.gamePath);
    });
  });
}
