import { setMeta } from '../utils/seo.js';
import { findGameByKey } from './registry.js';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

const ROADMAP = {
  'symbol-spy': [
    '1차: 개인판/중앙판 심볼 터치 화면 구현',
    '2차: 정답 속도 기록, 오답 페널티, 라운드 점수 계산',
    '3차: 선택 패턴 공개 후 스파이 투표 단계 추가',
    '확장: 카드 회전, 가림막, AI 스파이 난이도, 심볼 테마팩',
  ],
  'soso-code': [
    '1차: 비밀 코드 배정, 질문 카드, 추측 입력 화면 구현',
    '2차: 정답/오답 판정과 공개 정보 보드 추가',
    '3차: AI 해커 힌트와 가짜 힌트 시스템 추가',
    '확장: 고수 모드, 랭킹전, 코드 스킨, 2:2 팀전',
  ],
  'ai-court': [
    '1차: 사건 카드, 증거 카드, 최종 판결 화면 구현',
    '2차: 토론 타이머, 반박 버튼, 증거 연결 UI 추가',
    '3차: AI 증언 요청과 모순 탐지 점수 추가',
    '확장: 사건 에피소드팩, 배심원 모드, 반전 증거, 시즌 랭킹',
  ],
};

const MECHANICS = {
  'symbol-spy': ['순발력', '공통점 탐색', '선택 패턴 추리', '스파이 투표', 'AI 방해'],
  'soso-code': ['숫자/기호 추론', '위험한 추측', '정보 공개', '질문 카드', 'AI 가짜 힌트'],
  'ai-court': ['증거 조합', '토론', 'AI 증언', '모순 찾기', '최종 판결'],
};

export function renderPrototypeGame(key) {
  const game = findGameByKey(key);
  setMeta(game?.title || '창작게임');
  const el = document.getElementById('page-content');
  if (!el || !game) return;

  const mechanics = MECHANICS[key] || [];
  const roadmap = ROADMAP[key] || [];

  el.innerHTML = `
    <section class="prototype-game prototype-game--${esc(game.key)}">
      <div class="prototype-game__hero">
        <div class="prototype-game__badge">${esc(game.tag)} · ${esc(game.status)}</div>
        <div class="prototype-game__icon">${game.icon}</div>
        <h1>${esc(game.title)}</h1>
        <p>${esc(game.desc)}</p>
        <div class="prototype-game__meta">
          <span>👥 ${esc(game.players)}</span>
          <span>🎲 ${esc(game.pace)}</span>
          <span>🧠 소소킹 오리지널</span>
        </div>
      </div>

      <div class="prototype-game__grid">
        <article class="prototype-card prototype-card--wide">
          <h2>이 게임의 한 줄 재미</h2>
          <p>${esc(game.hook)}</p>
        </article>
        <article class="prototype-card">
          <h2>목표</h2>
          <p>${esc(game.guide.goal)}</p>
        </article>
        <article class="prototype-card">
          <h2>진행 방식</h2>
          <p>${esc(game.guide.flow)}</p>
        </article>
        <article class="prototype-card">
          <h2>저작권 회피 방향</h2>
          <p>${esc(game.originalNote)}</p>
        </article>
        <article class="prototype-card">
          <h2>핵심 재미요소</h2>
          <div class="prototype-tags">
            ${mechanics.map(item => `<span>${esc(item)}</span>`).join('')}
          </div>
        </article>
        <article class="prototype-card prototype-card--wide">
          <h2>단계별 개발 로드맵</h2>
          <ol class="prototype-roadmap">
            ${roadmap.map(item => `<li>${esc(item)}</li>`).join('')}
          </ol>
        </article>
      </div>

      <div class="prototype-game__footer">
        <button type="button" class="btn btn--secondary" onclick="location.hash='/sosoland'">게임 목록으로</button>
        <button type="button" class="btn btn--primary" disabled>방 만들기 기능 준비 중</button>
      </div>
    </section>`;
}
