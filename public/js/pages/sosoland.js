import { setMeta } from '../utils/seo.js';
import { navigate } from '../router.js';
import { VISIBLE_GAMES } from '../games/registry.js';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function isMobileGameMode() {
  return window.matchMedia('(max-width: 767px)').matches || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);
}

function closeGameLayer() {
  document.getElementById('desktop-game-layer')?.remove();
  document.body.classList.remove('desktop-game-layer-open');
  window.removeEventListener('keydown', onLayerKeydown);
}

function closeGameInfoLayer() {
  document.getElementById('game-info-layer')?.remove();
  document.body.classList.remove('desktop-game-layer-open');
  window.removeEventListener('keydown', onInfoKeydown);
}

function onLayerKeydown(event) {
  if (event.key === 'Escape') closeGameLayer();
}

function onInfoKeydown(event) {
  if (event.key === 'Escape') closeGameInfoLayer();
}

function openGameInfoLayer(game) {
  closeGameInfoLayer();
  const layer = document.createElement('div');
  layer.id = 'game-info-layer';
  layer.className = `game-info-layer game-info-layer--${game.key}`;
  layer.innerHTML = `
    <div class="game-info-layer__backdrop" data-game-info-close></div>
    <section class="game-info-layer__panel" role="dialog" aria-modal="true" aria-label="${esc(game.title)} 설명">
      <header class="game-info-layer__head">
        <div class="game-info-layer__title"><span>${game.icon}</span><div><b>${esc(game.title)}</b><small>${esc(game.guide.subtitle)}</small></div></div>
        <button class="game-info-layer__close" type="button" data-game-info-close aria-label="닫기">×</button>
      </header>
      <div class="game-info-layer__body">
        <div class="game-info-row"><b>한 줄 재미</b><span>${esc(game.hook || game.desc)}</span></div>
        <div class="game-info-row"><b>목표</b><span>${esc(game.guide.goal)}</span></div>
        <div class="game-info-row"><b>진행</b><span>${esc(game.guide.flow)}</span></div>
        <div class="game-info-row"><b>팁</b><span>${esc(game.guide.tip)}</span></div>
        <div class="game-info-row"><b>오리지널화</b><span>${esc(game.originalNote || '소소킹 전용 이름, 설정, 화면, 규칙으로 운영합니다.')}</span></div>
      </div>
      <div class="game-info-layer__foot">
        <button class="btn btn--primary" type="button" data-game-info-start>${game.status === '프로토타입' ? '기획 화면 보기' : '이 게임 시작하기'}</button>
      </div>
    </section>`;

  document.body.appendChild(layer);
  document.body.classList.add('desktop-game-layer-open');
  layer.querySelectorAll('[data-game-info-close]').forEach(btn => btn.addEventListener('click', closeGameInfoLayer));
  layer.querySelector('[data-game-info-start]')?.addEventListener('click', () => {
    closeGameInfoLayer();
    openGameLayer(game);
  });
  window.addEventListener('keydown', onInfoKeydown);
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
    <section class="desktop-game-layer__panel" role="dialog" aria-modal="true" aria-label="${esc(game.title)}">
      <header class="desktop-game-layer__head">
        <div class="desktop-game-layer__title"><span>${game.icon}</span><b>${esc(game.title)}</b><small>${esc(game.status || '게임')}</small></div>
        <div class="desktop-game-layer__actions">
          <button class="desktop-game-layer__mini" type="button" data-game-open-full>새 화면</button>
          <button class="desktop-game-layer__close" type="button" data-game-layer-close aria-label="닫기">×</button>
        </div>
      </header>
      <iframe class="desktop-game-layer__frame" src="${location.origin}/#${game.path}" title="${esc(game.title)}" allow="clipboard-write"></iframe>
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
  const games = VISIBLE_GAMES;

  el.innerHTML = `
    <div class="arcade-lobby">
      <section class="arcade-hero">
        <div class="arcade-hero__orb arcade-hero__orb--1"></div>
        <div class="arcade-hero__orb arcade-hero__orb--2"></div>
        <div class="arcade-hero__orb arcade-hero__orb--3"></div>
        <div class="arcade-hero__content">
          <div class="arcade-badge">🎮 ORIGINAL AI GAME ZONE</div>
          <h1 class="arcade-hero__title">소소킹 창작게임 ${games.length}종</h1>
          <p class="arcade-hero__desc">AI와 친구가 한 방에서 즐기는 추리·순발력·토론형 오리지널 게임<br><span class="arcade-hero__sub">저작권 리스크를 낮춘 자체 이름 · 자체 설정 · 자체 룰 확장 구조</span></p>
        </div>
      </section>

      <div class="arcade-game-grid">
        ${games.map(game => `
          <div class="arcade-card arcade-card--${game.key}" data-game-key="${game.key}">
            <div class="arcade-card__shine"></div>
            <div class="arcade-card__body">
              <div class="arcade-card__top">
                <span class="arcade-card__icon">${game.icon}</span>
                <span class="arcade-card__ai">${game.tag}</span>
              </div>
              <h2 class="arcade-card__title">${esc(game.title)}</h2>
              <p class="arcade-card__desc">${esc(game.desc)}</p>
              <div class="arcade-card__meta">
                <span>👥 ${esc(game.players || '2~8명')}</span>
                <span>🎲 ${esc(game.pace || '파티게임')}</span>
                <span>${esc(game.status || '방 만들기')}</span>
              </div>
            </div>
            <div class="arcade-card__footer">
              <button class="arcade-card__guide" type="button" data-game-info="${game.key}">📖 방법 보기</button>
              <button class="arcade-card__play" type="button" data-game-start="${game.key}">▶ ${game.status === '프로토타입' ? '기획 보기' : '방 만들기'}</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  el.querySelectorAll('[data-game-info]').forEach(btn => {
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const game = games.find(item => item.key === btn.dataset.gameInfo);
      if (game) openGameInfoLayer(game);
    });
  });

  el.querySelectorAll('[data-game-start]').forEach(btn => {
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const game = games.find(item => item.key === btn.dataset.gameStart);
      if (game) openGameLayer(game);
    });
  });

  return {
    destroy() {
      closeGameLayer();
      closeGameInfoLayer();
    },
  };
}
