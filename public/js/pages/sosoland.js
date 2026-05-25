import { setMeta } from '../utils/seo.js';
import { navigate } from '../router.js';
import { appState } from '../state.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
}
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

const GAMES = [
  {
    key: 'liar',
    icon: '🕵️',
    title: '라이어게임',
    desc: 'AI가 라이어로 잠입! 채팅으로 제시어를 설명하며 숨은 AI를 찾아내세요.',
    status: '방 만들기',
    tag: '🤖 AI',
    path: '/game/liar',
    enabled: true,
    guide: {
      subtitle: 'AI가 라이어로 위장 — 채팅으로 찾아내는 심리 추리 게임',
      goal: '시민은 제시어를 자연스럽게 설명하고, AI 라이어는 제시어 없이 끝까지 속입니다. 투표로 AI를 지목하면 승리!',
      flow: '방 만들기 → 초대 링크 공유 → 참가자 입장 → 제시어 확인 → 채팅 설명/질문 → AI 라이어 추리 및 투표 순서로 진행합니다.',
      tip: '너무 직접적인 설명은 AI에게 힌트가 됩니다. AI 난이도 어려움은 인터넷 슬랭까지 구사하니 주의하세요!',
    },
  },
  {
    key: 'mafia',
    icon: '🌙',
    title: '마피아게임',
    desc: 'AI가 마피아로 잠입! 채팅 토론과 투표로 숨은 AI를 처형하세요.',
    status: '방 만들기',
    tag: '🤖 AI',
    path: '/game/mafia',
    enabled: true,
    guide: {
      subtitle: 'AI가 마피아로 위장 — 토론과 투표로 찾아내는 추리 게임',
      goal: '시민팀은 AI 마피아를 모두 처형하면 승리. 마피아 수가 시민 수 이상이 되면 마피아 승리입니다.',
      flow: '방 만들기 → 초대 링크 공유 → 참가자 입장 → 방장 게임 시작 → 역할 배정 → 채팅 토론 → 투표 집계 순서로 진행합니다.',
      tip: 'AI는 채팅에도 직접 참여합니다. 말투와 투표 패턴을 잘 관찰하세요. 5명 이상이면 경찰·의사 특수 역할도 추가됩니다!',
    },
  },
];

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
        <div class="game-info-row"><b>목표</b><span>${esc(game.guide.goal)}</span></div>
        <div class="game-info-row"><b>진행</b><span>${esc(game.guide.flow)}</span></div>
        <div class="game-info-row"><b>팁</b><span>${esc(game.guide.tip)}</span></div>
      </div>
      <div class="game-info-layer__foot">
        <button class="btn btn--primary" type="button" data-game-info-start>이 게임 시작하기</button>
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
    <div class="arcade-lobby">
      <section class="arcade-hero">
        <div class="arcade-hero__orb arcade-hero__orb--1"></div>
        <div class="arcade-hero__orb arcade-hero__orb--2"></div>
        <div class="arcade-hero__orb arcade-hero__orb--3"></div>
        <div class="arcade-hero__content">
          <div class="arcade-badge">🎮 GAME ZONE</div>
          <h1 class="arcade-hero__title">소소킹 게임</h1>
          <p class="arcade-hero__desc">AI와 친구가 한 방에서 즐기는 채팅 추리게임<br><span class="arcade-hero__sub">모바일 전체화면 · PC 게임레이어 · 게스트 참가 가능</span></p>
        </div>
      </section>

      <div class="arcade-game-grid">
        ${GAMES.map(game => `
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
                <span>👥 4~8명</span>
                <span>💬 채팅</span>
                <span>🤖 AI 난이도</span>
              </div>
            </div>
            <div class="arcade-card__footer">
              <button class="arcade-card__guide" type="button" data-game-info="${game.key}">📖 방법 보기</button>
              <button class="arcade-card__play" type="button" data-game-start="${game.key}">▶ 방 만들기</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  el.querySelectorAll('[data-game-info]').forEach(btn => {
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const game = GAMES.find(item => item.key === btn.dataset.gameInfo);
      if (game) openGameInfoLayer(game);
    });
  });

  el.querySelectorAll('[data-game-start]').forEach(btn => {
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const game = GAMES.find(item => item.key === btn.dataset.gameStart);
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