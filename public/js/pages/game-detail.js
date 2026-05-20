import { setMeta } from '../utils/seo.js';
import { navigate } from '../router.js';

const GAME_DETAIL = {
  mafia: {
    key: 'mafia',
    icon: '🌙',
    title: '마피아게임',
    eyebrow: 'NIGHT MISSION',
    desc: '밤에는 정체를 숨기고, 낮에는 대화로 의심을 좁혀가는 추리형 파티게임입니다.',
    status: '준비중',
    theme: 'mafia',
    chips: ['실시간 방', '역할 추리', '모바일 최적화'],
    points: ['복잡한 직업을 줄인 가벼운 진행', '친구 초대 링크 기반 참가', '모바일에서도 한눈에 보이는 역할 카드'],
  },
  marble: {
    key: 'marble',
    icon: '🎲',
    title: '마블게임',
    eyebrow: 'DICE BOARD',
    desc: '운과 선택으로만 승부하는 보드게임입니다. 과금 유리함 없이 공정한 재미를 목표로 합니다.',
    status: '기획중',
    theme: 'marble',
    chips: ['주사위', '보드게임', '공정한 승부'],
    points: ['과금 유도 없는 동일 조건 플레이', '짧은 판으로 가볍게 즐기는 구조', '친구와 같이 들어오는 방 기반 플레이'],
  },
};

export function renderGameDetail(params = {}) {
  const key = params.key || '';
  const game = GAME_DETAIL[key];
  const el = document.getElementById('page-content');
  if (!el) return;

  if (!game) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎮</div>
        <div class="empty-state__title">게임을 찾을 수 없어요</div>
        <button class="btn btn--primary" onclick="navigate('/sosoland')">게임 목록으로</button>
      </div>`;
    return;
  }

  setMeta(`게임 · ${game.title}`);
  el.innerHTML = `
    <div class="game-detail-page game-detail-page--${game.theme}">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="game-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">${game.icon}</div>
        <div class="game-detail-hero__eyebrow">${game.eyebrow}</div>
        <h1>${game.title}</h1>
        <p>${game.desc}</p>
        <div class="game-detail-hero__chips">
          ${game.chips.map(chip => `<span>${chip}</span>`).join('')}
        </div>
      </section>

      <section class="game-detail-card">
        <div class="game-detail-card__head">
          <div>
            <b>${game.title} 안내</b>
            <span>${game.status}</span>
          </div>
          <i>${game.icon}</i>
        </div>
        <div class="game-detail-list">
          ${game.points.map(point => `<div class="game-detail-list__item">${point}</div>`).join('')}
        </div>
        <button class="btn btn--ghost" type="button" disabled>${game.status}</button>
      </section>
    </div>`;

  document.getElementById('game-back')?.addEventListener('click', () => navigate('/sosoland'));
}
