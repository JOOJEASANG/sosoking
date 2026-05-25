import { setMeta } from '../../utils/seo.js';

const SYMBOLS = ['🐰','🦊','🐻','🐼','🐸','🐵','🦁','🐯','🐨','🐧','🐳','🦄','🍒','🍋','🍉','🍇','🥝','🌽','🍕','🍩','🍭','⚽','🎲','🎧','🚀','💎','🔥','⭐','🌙','☂️','🧩','🎯','🪐','🔔','🛸','🧃','🍔','🍟','🌈','🎮','🎁','🦖','🐙','🍀','🍎','🥨','🏀','🎸'];
const BOARD_SIZE = 12;
const ROUND_LIMIT = 5;
const ROUND_SECONDS = 12;

let state = null;
let timerId = null;

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

function pageEl() {
  return document.getElementById('page-content');
}

function clearTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function createRound(round) {
  const common = sample(SYMBOLS, 1)[0];
  const rest = SYMBOLS.filter(symbol => symbol !== common);
  const centerExtra = sample(rest, BOARD_SIZE - 1);
  const playerPool = rest.filter(symbol => !centerExtra.includes(symbol));
  return {
    round,
    common,
    center: shuffle([common, ...centerExtra]),
    player: shuffle([common, ...sample(playerPool.length >= BOARD_SIZE - 1 ? playerPool : rest, BOARD_SIZE - 1)]),
    selected: '',
    correct: false,
    timeLeft: ROUND_SECONDS,
    startedAt: Date.now(),
    responseMs: 0,
    message: '12개 중 중앙판과 내 판에 동시에 있는 그림을 누르세요.',
  };
}

function initState() {
  state = { phase: 'intro', round: 1, score: 0, correctCount: 0, totalMs: 0, current: createRound(1) };
}

function renderTopBar() {
  return `
    <header class="symbol-spy__topbar">
      <button class="symbol-spy__ghost" type="button" data-back>← 게임 목록</button>
      <div class="symbol-spy__brand"><span>👑</span><b>터치왕게임</b><small>혼자 연습</small></div>
      <div class="symbol-spy__score"><span>${state.score}점</span><span>${state.round}/${ROUND_LIMIT}판</span></div>
    </header>`;
}

function bindBack() {
  pageEl()?.querySelector('[data-back]')?.addEventListener('click', () => {
    clearTimer();
    location.hash = '/sosoland';
  });
}

function renderIntro() {
  clearTimer();
  const el = pageEl();
  if (!el) return;
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--intro touch-king-game">
      ${renderTopBar()}
      <div class="symbol-spy__hero">
        <div class="symbol-spy__glow symbol-spy__glow--a"></div>
        <div class="symbol-spy__glow symbol-spy__glow--b"></div>
        <div class="symbol-spy__kicker">12개 그림 빠른 터치 대결</div>
        <h1>같은 그림을 찾고<br>터치왕에 도전하라</h1>
        <p>중앙판 12개와 내 판 12개 중 동시에 있는 그림 하나를 가장 빠르게 누르는 순발력 게임입니다.</p>
        <div class="symbol-spy__rules"><span>👑 터치왕</span><span>🧩 12개 그림판</span><span>⏱ ${ROUND_SECONDS}초 라운드</span><span>🏁 ${ROUND_LIMIT}판 승부</span></div>
        <button class="symbol-spy__start" type="button" data-start>혼자 연습하기</button>
      </div>
      <div class="symbol-spy__notice"><b>게임 규칙</b><span>정답은 +100점, 남은 시간 × 5점 보너스, 오답은 -10점입니다.</span></div>
    </section>`;
  bindBack();
  el.querySelector('[data-start]')?.addEventListener('click', startGame);
}

function renderBoard(title, symbols, type, disabled = false) {
  return `
    <article class="symbol-board symbol-board--${type}">
      <div class="symbol-board__title">${esc(title)}</div>
      <div class="symbol-board__grid touch-king-grid">
        ${symbols.map(symbol => `<button class="symbol-tile" type="button" data-symbol="${esc(symbol)}" ${disabled ? 'disabled' : ''}><span>${symbol}</span></button>`).join('')}
      </div>
    </article>`;
}

function renderPlaying() {
  const el = pageEl();
  if (!el) return;
  const round = state.current;
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--play touch-king-game">
      <div class="touch-king-title">👑 터치왕게임</div>
      ${renderTopBar()}
      <div class="symbol-spy__playhead"><div><b>ROUND ${round.round}/${ROUND_LIMIT}</b><span>${esc(round.message)}</span></div><div class="symbol-spy__timer" data-timer>${round.timeLeft}</div></div>
      <div class="symbol-spy__arena">
        ${renderBoard('중앙판 · 12개', round.center, 'center', true)}
        <div class="symbol-spy__versus"><span>같은 그림 1개</span><b>12</b><small>빠를수록 고득점</small></div>
        ${renderBoard('내 판 · 12개', round.player, 'player')}
      </div>
      <div class="symbol-spy__hintline"><span>정답 +100점</span><span>빠른 보너스: 남은 시간 × 5점</span></div>
    </section>`;
  bindBack();
  el.querySelectorAll('[data-symbol]').forEach(btn => btn.addEventListener('click', () => selectSymbol(btn.dataset.symbol)));
}

function renderResult() {
  clearTimer();
  const el = pageEl();
  if (!el) return;
  const round = state.current;
  const final = round.round >= ROUND_LIMIT;
  const avg = state.correctCount ? (state.totalMs / state.correctCount / 1000).toFixed(1) : '-';
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--result touch-king-game">
      <div class="touch-king-title">👑 터치왕게임</div>
      ${renderTopBar()}
      <div class="symbol-result">
        <div class="symbol-result__badge">ROUND ${round.round} 결과</div>
        <h1>${final ? '최종 결과' : '라운드 결과'}</h1>
        <p>${round.correct ? `정답 ${round.common}을 ${(round.responseMs / 1000).toFixed(1)}초 만에 찾았습니다.` : `정답은 ${round.common} 입니다.`}</p>
        <div class="symbol-result__answer"><span>정답 그림</span><b>${round.common}</b></div>
        <div class="symbol-result__stats"><div><b>${state.score}</b><span>점수</span></div><div><b>${state.correctCount}</b><span>정답 수</span></div><div><b>${avg}</b><span>평균 초</span></div></div>
        <div class="symbol-result__actions"><button class="symbol-spy__ghost" type="button" data-restart>처음부터</button><button class="symbol-spy__start" type="button" data-next>${final ? '다시 하기' : '다음 라운드'}</button></div>
      </div>
    </section>`;
  bindBack();
  el.querySelector('[data-restart]')?.addEventListener('click', () => { initState(); renderIntro(); });
  el.querySelector('[data-next]')?.addEventListener('click', () => {
    if (final) { initState(); startGame(); return; }
    state.round += 1;
    state.current = createRound(state.round);
    state.phase = 'playing';
    renderPlaying();
    runTimer();
  });
}

function runTimer() {
  clearTimer();
  timerId = setInterval(() => {
    if (state.phase !== 'playing') return;
    state.current.timeLeft -= 1;
    const timer = pageEl()?.querySelector('[data-timer]');
    if (timer) timer.textContent = String(Math.max(0, state.current.timeLeft));
    if (state.current.timeLeft <= 0) finishRound();
  }, 1000);
}

function startGame() {
  clearTimer();
  state = { phase: 'playing', round: 1, score: 0, correctCount: 0, totalMs: 0, current: createRound(1) };
  renderPlaying();
  runTimer();
}

function selectSymbol(symbol) {
  const round = state.current;
  if (state.phase !== 'playing' || round.selected) return;
  round.selected = symbol;
  round.responseMs = Date.now() - round.startedAt;
  round.correct = symbol === round.common;
  if (round.correct) {
    state.score += 100 + Math.max(0, round.timeLeft) * 5;
    state.correctCount += 1;
    state.totalMs += round.responseMs;
  } else {
    state.score = Math.max(0, state.score - 10);
  }
  finishRound();
}

function finishRound() {
  state.phase = 'result';
  renderResult();
}

export function renderTouchKingSolo() {
  setMeta('터치왕게임');
  clearTimer();
  initState();
  renderIntro();
  return { destroy: clearTimer };
}
