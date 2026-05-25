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

function buildSpyCast(common, decoyPool, aiName, aiPick) {
  const decoys = shuffle(decoyPool.filter(symbol => symbol !== common));
  const speed = () => `${(1.5 + Math.random() * 5.8).toFixed(1)}초`;
  return shuffle([
    { id: 'ai-spy', name: aiName, avatar: '🤖', pick: aiPick, speed: `${(0.6 + Math.random() * 1.7).toFixed(1)}초`, behavior: '정답과 관계없는 심볼을 너무 자신 있게 골랐습니다.', isSpy: true },
    { id: 'rabbit-scout', name: '토끼탐정', avatar: '🐰', pick: common, speed: speed(), behavior: '중앙판을 두 번 확인한 뒤 정답을 눌렀습니다.', isSpy: false },
    { id: 'fox-runner', name: '여우눈치', avatar: '🦊', pick: sample([common, decoys[0]], 1)[0], speed: speed(), behavior: '처음엔 망설였지만 마지막에 이유를 설명했습니다.', isSpy: false },
    { id: 'bear-rush', name: '곰돌급발진', avatar: '🐻', pick: sample([common, decoys[1] || decoys[0]], 1)[0], speed: speed(), behavior: '빠르게 눌렀지만 채팅에서 정답 근거를 말했습니다.', isSpy: false },
  ]);
}

function createRound(round) {
  const common = sample(SYMBOLS, 1)[0];
  const rest = SYMBOLS.filter(symbol => symbol !== common);
  const centerExtra = sample(rest, 7);
  const playerExtra = sample(rest.filter(symbol => !centerExtra.includes(symbol)), 7);
  const decoyPool = [...centerExtra, ...playerExtra];
  const aiName = sample(AI_NAMES, 1)[0];
  const aiPick = sample(decoyPool, 1)[0];
  const cast = buildSpyCast(common, decoyPool, aiName, aiPick);
  return {
    round,
    common,
    center: shuffle([common, ...centerExtra]),
    player: shuffle([common, ...playerExtra]),
    aiName,
    aiPick,
    cast,
    spyId: cast.find(member => member.isSpy)?.id || 'ai-spy',
    selected: null,
    winner: null,
    spyGuess: null,
    spyCorrect: false,
    spyBonus: 0,
    timeLeft: ROUND_SECONDS,
    mistakes: 0,
    message: '중앙판과 내 판에 동시에 있는 심볼을 찾아 터치하세요.',
  };
}

function initState() {
  state = { phase: 'intro', score: 0, aiScore: 0, round: 1, history: [], current: createRound(1) };
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
        <h1>같은 심볼을 찾고<br>수상한 스파이까지 찍어라</h1>
        <p>중앙판과 내 판에 딱 하나 겹치는 심볼이 있습니다. 먼저 맞힌 뒤에는 선택 기록을 보고 AI 스파이를 한 번 더 추리합니다.</p>
        <div class="symbol-spy__rules">
          <span>👆 큰 터치 버튼</span><span>⏱ ${ROUND_SECONDS}초 라운드</span><span>🕵️ 스파이 투표</span><span>🏁 ${ROUND_LIMIT}라운드 승부</span>
        </div>
        <button class="symbol-spy__start" type="button" data-action="start">2차 플레이 시작</button>
      </div>
      <div class="symbol-spy__notice"><b>저작권 회피 설계</b><span>상업 보드게임의 이름, 카드 디자인, 심볼 세트, 구성품 형태를 쓰지 않고 소소킹 전용 번개판 UI와 AI 스파이 투표 규칙으로 구성했습니다.</span></div>
    </section>`;
  bindCommonActions();
  el.querySelector('[data-action="start"]')?.addEventListener('click', startGame);
}

function renderBoard(title, symbols, type) {
  return `
    <article class="symbol-board symbol-board--${type}">
      <div class="symbol-board__title">${esc(title)}</div>
      <div class="symbol-board__grid">
        ${symbols.map(symbol => `<button class="symbol-tile" type="button" data-symbol="${esc(symbol)}" ${type === 'center' ? 'disabled' : ''}><span>${symbol}</span></button>`).join('')}
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
      <div class="symbol-spy__playhead"><div><b>ROUND ${round.round}/${ROUND_LIMIT}</b><span>${esc(round.message)}</span></div><div class="symbol-spy__timer" data-timer>${round.timeLeft}</div></div>
      <div class="symbol-spy__arena">
        ${renderBoard('중앙 번개판', round.center, 'center')}
        <div class="symbol-spy__versus"><span>겹치는 심볼 1개</span><b>VS</b><small>${esc(round.aiName)}도 노리는 중</small></div>
        ${renderBoard('내 탐색판', round.player, 'player')}
      </div>
      <div class="symbol-spy__hintline"><span>오답 ${round.mistakes}/3</span><span>정답 보너스: 남은 시간 × 5점 · 스파이 추리 +80점</span></div>
    </section>`;
  bindCommonActions();
  el.querySelectorAll('.symbol-board--player .symbol-tile').forEach(btn => btn.addEventListener('click', () => selectSymbol(btn.dataset.symbol)));
}

function renderSpyVote() {
  const el = pageEl();
  if (!el || !state?.current) return;
  clearTimers();
  const round = state.current;
  const roundText = round.winner === 'user'
    ? `정답 ${round.common}을 먼저 찾았습니다. 이제 선택 기록에서 AI 스파이를 찾아보세요.`
    : `정답은 ${round.common}이었습니다. 그래도 스파이를 맞히면 보너스 점수를 얻습니다.`;
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--vote">
      ${renderTopBar()}
      <div class="symbol-vote">
        <div class="symbol-vote__badge">ROUND ${round.round} · 스파이 투표</div>
        <h1>누가 목표를 모르고 찍었을까?</h1>
        <p>${esc(roundText)}</p>
        <div class="symbol-vote__answer"><span>이번 라운드 정답</span><b>${round.common}</b></div>
        <div class="symbol-vote__grid">
          ${round.cast.map(member => `
            <button class="symbol-suspect" type="button" data-spy-vote="${esc(member.id)}">
              <span class="symbol-suspect__avatar">${member.avatar}</span>
              <strong>${esc(member.name)}</strong>
              <em>선택 ${member.pick} · ${esc(member.speed)}</em>
              <small>${esc(member.behavior)}</small>
            </button>`).join('')}
        </div>
        <div class="symbol-vote__tip">정답과 전혀 관계없는 심볼을 너무 빠르게 고른 참가자가 수상합니다.</div>
      </div>
    </section>`;
  bindCommonActions();
  el.querySelectorAll('[data-spy-vote]').forEach(btn => btn.addEventListener('click', () => voteSpy(btn.dataset.spyVote)));
}

function renderResult() {
  const el = pageEl();
  if (!el || !state?.current) return;
  clearTimers();
  const round = state.current;
  const isFinal = round.round >= ROUND_LIMIT;
  const spy = round.cast.find(member => member.isSpy);
  const guessed = round.cast.find(member => member.id === round.spyGuess);
  const resultTitle = isFinal ? (state.score > state.aiScore ? '최종 승리!' : state.score === state.aiScore ? '무승부!' : 'AI에게 패배!') : (round.winner === 'user' ? '라운드 승리!' : round.winner === 'ai' ? `${round.aiName}가 먼저 찾았습니다` : '시간 종료');
  const resultDesc = round.spyCorrect ? `${guessed?.name || '선택한 참가자'}를 정확히 지목했습니다. 스파이 보너스 ${round.spyBonus}점을 획득했습니다.` : `스파이는 ${spy?.name || round.aiName}였습니다. ${guessed ? `${guessed.name}은` : '선택한 참가자는'} 스파이가 아니었습니다.`;
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--result">
      ${renderTopBar()}
      <div class="symbol-result">
        <div class="symbol-result__badge">ROUND ${round.round} · ${round.spyCorrect ? '스파이 적중' : '스파이 실패'}</div>
        <h1>${esc(resultTitle)}</h1><p>${esc(resultDesc)}</p>
        <div class="symbol-result__answer"><span>정답 심볼</span><b>${round.common}</b></div>
        <div class="symbol-result__spy"><span>진짜 스파이</span><b>${spy?.avatar || '🤖'} ${esc(spy?.name || round.aiName)}</b><small>선택 ${spy?.pick || round.aiPick} · ${esc(spy?.behavior || '수상한 선택 기록')}</small></div>
        <div class="symbol-result__stats"><div><b>${state.score}</b><span>내 점수</span></div><div><b>${state.aiScore}</b><span>AI 점수</span></div><div><b>${round.mistakes}</b><span>이번 라운드 오답</span></div></div>
        <div class="symbol-result__actions"><button class="symbol-spy__ghost" type="button" data-action="restart">처음부터</button><button class="symbol-spy__start" type="button" data-action="next">${isFinal ? '한 번 더 하기' : '다음 라운드'}</button></div>
      </div>
    </section>`;
  bindCommonActions();
  el.querySelector('[data-action="restart"]')?.addEventListener('click', () => { initState(); renderIntro(); });
  el.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    if (isFinal) { initState(); startGame(); return; }
    state.round += 1;
    state.current = createRound(state.round);
    state.phase = 'playing';
    renderPlaying();
    startRoundTimers();
  });
}

function bindCommonActions() {
  pageEl()?.querySelector('[data-action="back"]')?.addEventListener('click', () => { clearTimers(); location.hash = '/sosoland'; });
}

function startGame() {
  clearTimers();
  state = { phase: 'playing', score: 0, aiScore: 0, round: 1, history: [], current: createRound(1) };
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
  aiTimerId = setTimeout(() => {
    if (!state?.current || state.phase !== 'playing') return;
    if (Math.random() > 0.34) finishRound('ai');
  }, Math.floor(3800 + Math.random() * 5200));
}

function selectSymbol(symbol) {
  if (!state?.current || state.phase !== 'playing') return;
  const round = state.current;
  round.selected = symbol;
  if (symbol === round.common) {
    state.score += 120 + Math.max(0, round.timeLeft) * 5;
    finishRound('user');
    return;
  }
  round.mistakes += 1;
  state.score = Math.max(0, state.score - 15);
  round.message = `오답입니다. ${3 - round.mistakes}번 더 틀리면 AI에게 점수가 넘어갑니다.`;
  const btn = pageEl()?.querySelector(`[data-symbol="${CSS.escape(symbol)}"]`);
  if (btn) { btn.disabled = true; btn.classList.add('is-wrong'); }
  const hint = pageEl()?.querySelector('.symbol-spy__playhead span');
  if (hint) hint.textContent = round.message;
  const wrong = pageEl()?.querySelector('.symbol-spy__hintline span');
  if (wrong) wrong.textContent = `오답 ${round.mistakes}/3`;
  if (round.mistakes >= 3) finishRound('ai');
}

function finishRound(winner) {
  if (!state?.current || state.phase !== 'playing') return;
  clearTimers();
  state.phase = 'spy-vote';
  state.current.winner = winner;
  if (winner === 'ai' || winner === 'timeout') state.aiScore += winner === 'ai' ? 100 : 60;
  renderSpyVote();
}

function voteSpy(spyId) {
  if (!state?.current || state.phase !== 'spy-vote') return;
  const round = state.current;
  round.spyGuess = spyId;
  round.spyCorrect = spyId === round.spyId;
  round.spyBonus = round.spyCorrect ? 80 : 0;
  if (round.spyCorrect) state.score += round.spyBonus;
  else state.aiScore += 35;
  state.phase = 'result';
  state.history.push({ round: round.round, winner: round.winner, answer: round.common, mistakes: round.mistakes, spyGuess: round.spyGuess, spyCorrect: round.spyCorrect });
  renderResult();
}

export function renderSymbolSpyGame() {
  setMeta('심볼스파이');
  clearTimers();
  initState();
  renderIntro();
  return { destroy: clearTimers };
}
