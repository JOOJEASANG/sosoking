import { setMeta } from '../../utils/seo.js';

const SYMBOLS = ['🐰','🦊','🐻','🐼','🐸','🐵','🦁','🐯','🐨','🐧','🐳','🦄','🍒','🍋','🍉','🍇','🥝','🌽','🍕','🍩','🍭','⚽','🎲','🎧','🚀','💎','🔥','⭐','🌙','☂️','🧩','🎯','🪐','🔔','🛸','🧃'];
const AI_NAMES = ['AI 번개', 'AI 눈썰미', 'AI 스파크', 'AI 흔들기'];
const ROUND_LIMIT = 5;
const ROUND_SECONDS = 14;

let state = null;
let timerId = null;
let aiTimerId = null;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sample(list, count) {
  return shuffle(list).slice(0, count);
}

function clearTimers() {
  if (timerId) clearInterval(timerId);
  if (aiTimerId) clearTimeout(aiTimerId);
  timerId = null;
  aiTimerId = null;
}

function createRound(round) {
  const common = sample(SYMBOLS, 1)[0];
  const rest = SYMBOLS.filter(symbol => symbol !== common);
  const centerExtra = sample(rest, 7);
  const playerExtra = sample(rest.filter(symbol => !centerExtra.includes(symbol)), 7);
  const decoyPool = [...centerExtra, ...playerExtra];
  return {
    round,
    common,
    center: shuffle([common, ...centerExtra]),
    player: shuffle([common, ...playerExtra]),
    aiName: sample(AI_NAMES, 1)[0],
    aiPick: sample(decoyPool, 1)[0],
    selected: null,
    winner: null,
    timeLeft: ROUND_SECONDS,
    mistakes: 0,
    message: '중앙판과 내 판에 동시에 있는 심볼을 찾아 터치하세요.',
  };
}

function initState() {
  state = {
    phase: 'intro',
    score: 0,
    aiScore: 0,
    round: 1,
    history: [],
    current: createRound(1),
  };
}

function pageEl() {
  return document.getElementById('page-content');
}

function renderTopBar() {
  return `
    <header class="symbol-spy__topbar">
      <button class="symbol-spy__ghost" type="button" data-action="back">← 게임 목록</button>
      <div class="symbol-spy__brand"><span>⚡</span><b>심볼스파이</b><small>소소킹 오리지널</small></div>
      <div class="symbol-spy__score"><span>나 ${state.score}</span><span>AI ${state.aiScore}</span></div>
    </header>`;
}

function renderIntro() {
  const el = pageEl();
  if (!el) return;
  clearTimers();
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--intro">
      ${renderTopBar()}
      <div class="symbol-spy__hero">
        <div class="symbol-spy__glow symbol-spy__glow--a"></div>
        <div class="symbol-spy__glow symbol-spy__glow--b"></div>
        <div class="symbol-spy__kicker">빠른 눈썰미 + 스파이 심리전</div>
        <h1>같은 심볼을 찾고<br>AI 스파이보다 먼저 눌러라</h1>
        <p>중앙판과 내 판에 딱 하나 겹치는 심볼이 있습니다. 먼저 맞히면 점수 획득, 틀리면 AI에게 역전 기회가 갑니다.</p>
        <div class="symbol-spy__rules">
          <span>👆 큰 터치 버튼</span>
          <span>⏱ ${ROUND_SECONDS}초 라운드</span>
          <span>🏁 ${ROUND_LIMIT}라운드 승부</span>
          <span>🤖 AI 경쟁자</span>
        </div>
        <button class="symbol-spy__start" type="button" data-action="start">1차 플레이 시작</button>
      </div>
      <div class="symbol-spy__notice">
        <b>저작권 회피 설계</b>
        <span>상업 보드게임의 이름, 카드 디자인, 심볼 세트, 구성품 형태를 쓰지 않고 소소킹 전용 번개판 UI와 AI 스파이 규칙으로 구성했습니다.</span>
      </div>
    </section>`;
  bindCommonActions();
  el.querySelector('[data-action="start"]')?.addEventListener('click', startGame);
}

function renderBoard(title, symbols, type) {
  return `
    <article class="symbol-board symbol-board--${type}">
      <div class="symbol-board__title">${esc(title)}</div>
      <div class="symbol-board__grid">
        ${symbols.map(symbol => `
          <button class="symbol-tile" type="button" data-symbol="${esc(symbol)}" ${type === 'center' ? 'disabled' : ''}>
            <span>${symbol}</span>
          </button>`).join('')}
      </div>
    </article>`;
}

function renderPlaying() {
  const el = pageEl();
  if (!el || !state?.current) return;
  const round = state.current;
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--play">
      ${renderTopBar()}
      <div class="symbol-spy__playhead">
        <div><b>ROUND ${round.round}/${ROUND_LIMIT}</b><span>${esc(round.message)}</span></div>
        <div class="symbol-spy__timer" data-timer>${round.timeLeft}</div>
      </div>
      <div class="symbol-spy__arena">
        ${renderBoard('중앙 번개판', round.center, 'center')}
        <div class="symbol-spy__versus">
          <span>겹치는 심볼 1개</span>
          <b>VS</b>
          <small>${esc(round.aiName)}도 노리는 중</small>
        </div>
        ${renderBoard('내 탐색판', round.player, 'player')}
      </div>
      <div class="symbol-spy__hintline">
        <span>오답 ${round.mistakes}/3</span>
        <span>정답 보너스: 남은 시간 × 5점</span>
      </div>
    </section>`;
  bindCommonActions();
  el.querySelectorAll('.symbol-board--player .symbol-tile').forEach(btn => {
    btn.addEventListener('click', () => selectSymbol(btn.dataset.symbol));
  });
}

function renderResult() {
  const el = pageEl();
  if (!el || !state?.current) return;
  clearTimers();
  const round = state.current;
  const isFinal = round.round >= ROUND_LIMIT;
  const userWonRound = round.winner === 'user';
  const aiWonRound = round.winner === 'ai';
  const timedOut = round.winner === 'timeout';
  const resultTitle = isFinal
    ? (state.score > state.aiScore ? '최종 승리!' : state.score === state.aiScore ? '무승부!' : 'AI에게 패배!')
    : (userWonRound ? '정답! 먼저 찾아냈습니다' : aiWonRound ? `${round.aiName}가 먼저 찾았습니다` : timedOut ? '시간 종료' : '라운드 종료');
  const resultDesc = userWonRound
    ? `공통 심볼 ${round.common}을 정확히 눌렀습니다.`
    : `정답은 ${round.common} 입니다. AI는 ${round.aiPick}을 노렸습니다.`;

  el.innerHTML = `
    <section class="symbol-spy symbol-spy--result">
      ${renderTopBar()}
      <div class="symbol-result">
        <div class="symbol-result__badge">ROUND ${round.round}</div>
        <h1>${esc(resultTitle)}</h1>
        <p>${esc(resultDesc)}</p>
        <div class="symbol-result__answer"><span>정답 심볼</span><b>${round.common}</b></div>
        <div class="symbol-result__stats">
          <div><b>${state.score}</b><span>내 점수</span></div>
          <div><b>${state.aiScore}</b><span>AI 점수</span></div>
          <div><b>${round.mistakes}</b><span>이번 라운드 오답</span></div>
        </div>
        <div class="symbol-result__actions">
          <button class="symbol-spy__ghost" type="button" data-action="restart">처음부터</button>
          <button class="symbol-spy__start" type="button" data-action="next">${isFinal ? '한 번 더 하기' : '다음 라운드'}</button>
        </div>
      </div>
    </section>`;
  bindCommonActions();
  el.querySelector('[data-action="restart"]')?.addEventListener('click', () => {
    initState();
    renderIntro();
  });
  el.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    if (isFinal) {
      initState();
      startGame();
      return;
    }
    state.round += 1;
    state.current = createRound(state.round);
    state.phase = 'playing';
    renderPlaying();
    startRoundTimers();
  });
}

function bindCommonActions() {
  pageEl()?.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    clearTimers();
    location.hash = '/sosoland';
  });
}

function startGame() {
  clearTimers();
  state = {
    phase: 'playing',
    score: 0,
    aiScore: 0,
    round: 1,
    history: [],
    current: createRound(1),
  };
  renderPlaying();
  startRoundTimers();
}

function startRoundTimers() {
  clearTimers();
  timerId = setInterval(() => {
    if (!state?.current || state.phase !== 'playing') return;
    state.current.timeLeft -= 1;
    const timer = pageEl()?.querySelector('[data-timer]');
    if (timer) timer.textContent = String(Math.max(0, state.current.timeLeft));
    if (state.current.timeLeft <= 0) finishRound('timeout');
  }, 1000);

  const aiDelay = Math.floor(3800 + Math.random() * 5200);
  aiTimerId = setTimeout(() => {
    if (!state?.current || state.phase !== 'playing') return;
    const aiGetsIt = Math.random() > 0.34;
    if (aiGetsIt) finishRound('ai');
  }, aiDelay);
}

function selectSymbol(symbol) {
  if (!state?.current || state.phase !== 'playing') return;
  const round = state.current;
  round.selected = symbol;
  if (symbol === round.common) {
    const bonus = Math.max(0, round.timeLeft) * 5;
    state.score += 120 + bonus;
    finishRound('user');
    return;
  }

  round.mistakes += 1;
  state.score = Math.max(0, state.score - 15);
  round.message = `오답입니다. ${3 - round.mistakes}번 더 틀리면 AI에게 점수가 넘어갑니다.`;
  const btn = pageEl()?.querySelector(`[data-symbol="${CSS.escape(symbol)}"]`);
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-wrong');
  }
  const hint = pageEl()?.querySelector('.symbol-spy__playhead span');
  if (hint) hint.textContent = round.message;
  const wrong = pageEl()?.querySelector('.symbol-spy__hintline span');
  if (wrong) wrong.textContent = `오답 ${round.mistakes}/3`;
  if (round.mistakes >= 3) finishRound('ai');
}

function finishRound(winner) {
  if (!state?.current || state.phase !== 'playing') return;
  clearTimers();
  state.phase = 'result';
  state.current.winner = winner;
  if (winner === 'ai' || winner === 'timeout') state.aiScore += winner === 'ai' ? 100 : 60;
  state.history.push({
    round: state.current.round,
    winner,
    answer: state.current.common,
    mistakes: state.current.mistakes,
  });
  renderResult();
}

export function renderSymbolSpyGame() {
  setMeta('심볼스파이');
  clearTimers();
  initState();
  renderIntro();
  return { destroy: clearTimers };
}
