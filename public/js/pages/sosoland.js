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
    path: '/game/test/liar',
    realPath: '/game/liar',
    enabled: true,
    guide: {
      subtitle: '대화 속 어색함을 찾아내는 심리 추리 게임',
      goal: '일반 참가자는 라이어를 찾아내고, 라이어는 정체를 들키지 않은 채 제시어를 맞히거나 끝까지 버팁니다.',
      flow: '방 만들기 → 초대 링크 공유 → 참가자 입장 → 제시어 확인 → 돌아가며 설명/질문 → 투표로 라이어 지목 순서로 진행합니다.',
      tip: '너무 직접적인 설명은 라이어에게 힌트가 되고, 너무 애매한 설명은 의심을 받을 수 있습니다.',
    },
  },
  {
    key: 'mafia',
    icon: '🌙',
    title: '마피아게임',
    desc: '정체를 숨기고 대화로 범인을 찾아내는 추리 게임',
    status: '방 만들기',
    tag: '오픈',
    path: '/game/test/mafia',
    realPath: '/game/mafia',
    enabled: true,
    guide: {
      subtitle: '정체를 숨긴 사람을 토론과 투표로 찾아내는 게임',
      goal: '시민은 마피아를 모두 찾아내면 승리하고, 마피아는 시민 수와 같거나 많아질 때까지 살아남으면 승리합니다.',
      flow: '방 만들기 → 초대 링크 공유 → 참가자 입장 → 방장 게임 시작 → 역할 배정 → 토론 → 투표 집계 순서로 진행합니다.',
      tip: '마피아는 자연스럽게 시민처럼 행동하고, 시민은 말투·투표 패턴·방어 반응을 보고 의심 대상을 좁혀야 합니다.',
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
        <button class="btn btn--primary" type="button" data-game-info-start>가상 방 테스트하기</button>
        <button class="btn btn--ghost" type="button" data-game-real-start>실제 방 만들기 화면</button>
      </div>
    </section>`;

  document.body.appendChild(layer);
  document.body.classList.add('desktop-game-layer-open');
  layer.querySelectorAll('[data-game-info-close]').forEach(btn => btn.addEventListener('click', closeGameInfoLayer));
  layer.querySelector('[data-game-info-start]')?.addEventListener('click', () => {
    closeGameInfoLayer();
    openGameLayer(game);
  });
  layer.querySelector('[data-game-real-start]')?.addEventListener('click', () => {
    closeGameInfoLayer();
    navigate(game.realPath || game.path);
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
        <div class="desktop-game-layer__title"><span>${game.icon}</span><b>${game.title}</b><small>가상 테스트 게임창</small></div>
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
      <section class="sosoland-hero sosoland-hero--arcade sosoland-hero--simple">
        <div class="sosoland-hero__glow sosoland-hero__glow--one"></div>
        <div class="sosoland-hero__glow sosoland-hero__glow--two"></div>
        <div class="sosoland-hero__content">
          <div class="sosoland-hero__eyebrow">GAME PLAYGROUND</div>
          <h1>친구와 바로 즐기는<br>추리 게임 모음</h1>
          <p>현재 방 만들기는 실제 데이터 저장 없이 확인하는 가상 테스트 페이지로 연결됩니다.</p>
        </div>
      </section>

      <section class="sosoland-grid sosoland-grid--two sosoland-grid--compact">
        ${GAMES.map(game => `
          <article class="sosoland-card sosoland-card--${game.key}" data-game-key="${game.key}">
            <div class="sosoland-card__headline">
              <div class="sosoland-card__icon">${game.icon}</div>
              <div class="sosoland-card__title-stack">
                <h2>${game.title}</h2>
                <p>${game.desc}</p>
              </div>
            </div>
            <div class="sosoland-card__actions">
              <span class="sosoland-card__status">${game.tag}</span>
              <button class="sosoland-card__info" type="button" data-game-info="${game.key}" aria-label="${game.title} 설명 보기">설명</button>
              <button class="btn btn--primary btn--sm sosoland-card__start" type="button" data-game-start="${game.key}">${game.status}</button>
            </div>
          </article>
        `).join('')}
      </section>
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
}
