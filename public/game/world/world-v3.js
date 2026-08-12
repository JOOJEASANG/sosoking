import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import { collection, doc, onSnapshot, Timestamp, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const app = document.getElementById('game-app');
const TILE_COUNT = 24;
const QUICK_LAPS = 1;
const STANDARD_LAPS = 2;
const PASS_START_BONUS = 250;
const LANDING_SECONDS = 8;
const SAFETY_TURN_LIMIT = 200;
const TILE_LABELS = [
  ['🚩','출발'],['💰','코인광장'],['🔐','금고런'],['🏦','금고 연구소'],['🎯','딱걸렸어'],['🥷','도둑골목'],
  ['👑','왕관광장'],['🧨','욕심계단'],['🏢','욕심 타워'],['💸','세금폭탄'],['💣','초성 폭탄'],['🎁','행운상자'],
  ['🌗','소수파 대결'],['💎','황금금고'],['🏟️','숫자 광장'],['🎯','눈치광장'],['😈','복수찬스'],['🔥','불타는 계단'],
  ['👑','왕관쟁탈'],['🏭','폭탄 공장'],['🌪️','카오스홀'],['⚡','번개 초성'],['🌙','달빛 편가르기'],['🏆','왕좌']
];

let currentUid = '';
let roomId = '';
let room = null;
let players = [];
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let hostBusy = false;
let decorateQueued = false;
let lastMoveKey = '';
let lastThrowKey = '';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function targetLaps() {
  return room?.pace === 'quick' ? QUICK_LAPS : STANDARD_LAPS;
}

function lapsOf(player) {
  return Math.max(0, Number(player?.laps || 0));
}

function playerByUid(uid) {
  return players.find(player => player.uid === uid);
}

function rankedPlayers() {
  return [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function isHost() {
  return Boolean(room && currentUid && room.hostUid === currentUid);
}

function crossedStart(endPosition, dice) {
  const end = Number(endPosition || 0);
  const move = Number(dice || 0);
  if (move <= 0) return false;
  const start = (end - move + TILE_COUNT) % TILE_COUNT;
  return start + move >= TILE_COUNT;
}

function stopRoomWatch() {
  unsubscribeRoom?.();
  unsubscribePlayers?.();
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  room = null;
  players = [];
}

function watchRoom(code) {
  stopRoomWatch();
  roomId = code;
  if (!code) return;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snapshot => {
    if (!snapshot.exists()) return;
    room = { id: snapshot.id, ...snapshot.data() };
    queueDecorate();
    void manageLapGame();
  });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    queueDecorate();
    void manageLapGame();
  });
}

function syncRoomFromUrl() {
  const code = normalizeCode(new URL(location.href).searchParams.get('room') || '');
  if (code === roomId) return;
  watchRoom(code);
}

async function manageLapGame() {
  if (!isHost() || hostBusy || !roomId || players.length < 2) return;
  hostBusy = true;
  try {
    const target = targetLaps();
    const roomRef = doc(db, 'game_rooms', roomId);
    const now = Timestamp.now();

    if (room.status === 'lobby') {
      const needsReset = room.lapModeActive === true || Number(room.targetLaps || 0) !== target || players.some(player => lapsOf(player) > 0);
      if (needsReset) {
        const batch = writeBatch(db);
        players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { laps: 0, updatedAt: now }));
        batch.update(roomRef, {
          lapModeActive: false,
          targetLaps: target,
          totalTurns: 0,
          lapProcessedRound: 0,
          lapNotice: '',
          lapNoticeRound: 0,
          v3LandingRound: 0,
          updatedAt: now
        });
        await batch.commit();
      }
      return;
    }

    if (room.status !== 'playing') return;

    if (room.lapModeActive !== true) {
      const batch = writeBatch(db);
      players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { laps: 0, updatedAt: now }));
      batch.update(roomRef, {
        lapModeActive: true,
        targetLaps: target,
        totalTurns: SAFETY_TURN_LIMIT,
        lapProcessedRound: 0,
        lapNotice: '',
        lapNoticeRound: 0,
        v3LandingRound: 0,
        updatedAt: now
      });
      await batch.commit();
      return;
    }

    const everyoneFinished = players.every(player => lapsOf(player) >= target);
    if (everyoneFinished && Number(room.totalTurns || 0) !== Number(room.round || 0)) {
      await updateDoc(roomRef, { totalTurns: Number(room.round || 0), updatedAt: now });
      return;
    }

    if (room.worldPhase !== 'landing') return;
    const round = Number(room.round || 0);
    const alreadyProcessed = Number(room.lapProcessedRound || 0) === round;
    const alreadyExtended = Number(room.v3LandingRound || 0) === round;
    if (alreadyProcessed && alreadyExtended) return;

    const active = playerByUid(room.activeUid);
    const batch = writeBatch(db);
    const roomPatch = {
      roundEndsAt: Timestamp.fromMillis(Date.now() + LANDING_SECONDS * 1000),
      v3LandingRound: round,
      lapProcessedRound: round,
      updatedAt: now
    };

    if (!alreadyProcessed && active && crossedStart(active.position, room.lastDice)) {
      const nextLap = lapsOf(active) + 1;
      const nextScore = Number(active.score || 0) + PASS_START_BONUS;
      batch.update(doc(db, 'game_rooms', roomId, 'players', active.uid), {
        laps: nextLap,
        score: nextScore,
        updatedAt: now
      });
      const allDoneAfterThis = players.every(player => player.uid === active.uid ? nextLap >= target : lapsOf(player) >= target);
      roomPatch.lapNotice = `🏁 ${active.nickname} ${nextLap}바퀴 완주 · 출발 통과 보너스 +${PASS_START_BONUS}C`;
      roomPatch.lapNoticeRound = round;
      if (allDoneAfterThis) roomPatch.totalTurns = round;
    }

    batch.update(roomRef, roomPatch);
    await batch.commit();
  } catch (error) {
    console.error('world v3 lap manager failed', error);
  } finally {
    hostBusy = false;
  }
}

function dieFaces() {
  return [1,2,3,4,5,6].map(number => `<span class="v3-die-face face-${number}" aria-hidden="true">${['⚀','⚁','⚂','⚃','⚄','⚅'][number - 1]}</span>`).join('');
}

function diceMarkup(value = 1, throwing = false, compact = false) {
  const result = Math.max(1, Math.min(8, Number(value || 1)));
  const cubeResult = Math.min(result, 6);
  const power = result > 6 ? `<span class="v3-power-result">${result}</span>` : '';
  return `<div class="v3-dice-scene ${compact ? 'is-compact' : ''}"><div class="v3-dice-shadow"></div><div class="v3-dice-cube result-${cubeResult} ${throwing ? 'is-throwing' : 'is-idle'}">${dieFaces()}</div>${power}</div>`;
}

function centerMarkup() {
  const active = playerByUid(room?.activeUid);
  const [icon, name] = TILE_LABELS[Number(room?.eventTile || 0)] || ['🎲','소소킹 월드'];
  const target = targetLaps();
  if (!room || room.status !== 'playing') return `<div class="v3-center-title"><span>🎲</span><b>소소킹 월드</b><small>바깥 길을 따라 한 바퀴씩 돌아요</small></div>`;
  if (room.worldPhase === 'roll') {
    return `<div class="v3-center-stage"><span class="v3-center-kicker">${esc(active?.nickname || '플레이어')} 차례</span>${diceMarkup(1, false)}<b>주사위를 선택하세요</b><small>목표 ${target}바퀴 · 출발 통과 +${PASS_START_BONUS}C</small></div>`;
  }
  if (room.worldPhase === 'landing') {
    return `<div class="v3-center-stage"><span class="v3-center-kicker">주사위 결과</span>${diceMarkup(room.lastDice || 1, true)}<b>${Number(room.lastDice || 0)}칸 이동</b><small>${icon} ${esc(name)} 도착</small></div>`;
  }
  if (room.worldPhase === 'event') {
    return `<div class="v3-center-stage event"><span class="v3-center-kicker">도착한 칸</span><span class="v3-center-icon">${icon}</span><b>${esc(name)}</b><small>아래 ‘지금 할 일’을 확인하세요</small></div>`;
  }
  if (room.worldPhase === 'reveal' || room.roundState === 'reveal') {
    return `<div class="v3-center-stage result"><span class="v3-center-kicker">이번 차례 결과</span><span class="v3-center-icon">${icon}</span><b>${esc(name)}</b><small>점수 변화를 확인하세요</small></div>`;
  }
  return `<div class="v3-center-title"><span>🎲</span><b>소소킹 월드</b><small>목표 ${target}바퀴</small></div>`;
}

function decorateBoard() {
  const board = document.querySelector('.world-board');
  if (!board || !room) return;
  board.classList.add('world-loop-board');
  [...board.querySelectorAll(':scope > .world-tile')].slice(0, TILE_COUNT).forEach((tile, index) => {
    tile.dataset.tileIndex = String(index);
    if (index === 0) tile.classList.add('is-start-tile');
  });

  let center = board.querySelector(':scope > .world-board-center');
  if (!center) {
    center = document.createElement('div');
    center.className = 'world-board-center';
    board.appendChild(center);
  }
  const key = `${room.round}:${room.worldPhase}:${room.lastDice}:${room.eventTile}:${room.activeUid}`;
  if (center.dataset.key !== key) {
    center.dataset.key = key;
    center.innerHTML = centerMarkup();
  }
}

function decorateLapStatus() {
  if (!room) return;
  const target = targetLaps();
  const badge = document.querySelector('.world-turn-badge');
  if (badge) badge.textContent = `🏁 ${target}바퀴 승부`;

  const ranking = rankedPlayers();
  document.querySelectorAll('.world-rank-list li').forEach((item, index) => {
    const player = ranking[index];
    if (!player) return;
    let lap = item.querySelector('.v3-lap-badge');
    if (!lap) {
      lap = document.createElement('small');
      lap.className = 'v3-lap-badge';
      item.appendChild(lap);
    }
    lap.textContent = `${Math.min(lapsOf(player), target)}/${target}바퀴`;
  });

  const notice = String(room.lapNotice || '');
  if (notice && Number(room.lapNoticeRound || 0) === Number(room.round || 0)) {
    const card = document.querySelector('.world-event-card');
    if (card && !card.querySelector('.v3-lap-notice')) {
      const banner = document.createElement('div');
      banner.className = 'v3-lap-notice';
      banner.textContent = notice;
      card.prepend(banner);
    }
  }
}

function decorateLobby() {
  const lead = document.querySelector('.panel > .lead');
  if (room?.status === 'lobby' && lead && /이번 버전|기본 모드/.test(lead.textContent || '')) {
    lead.innerHTML = '말이 <b>24칸 테두리를 실제로 한 바퀴씩</b> 돕니다. 보통은 2바퀴, 짧게는 1바퀴로 끝납니다.';
  }
  document.querySelectorAll('[data-pace]').forEach(button => {
    const small = button.querySelector('small');
    if (!small) return;
    small.textContent = button.dataset.pace === 'quick' ? '1바퀴 · 가볍게 한 판' : '2바퀴 · 권장 모드';
  });
}

function decorateDiceControls() {
  document.querySelectorAll('[data-roll-choice]').forEach(button => {
    if (button.dataset.v3Dice === '1') return;
    button.dataset.v3Dice = '1';
    const oldIcon = button.querySelector(':scope > span');
    if (oldIcon) oldIcon.outerHTML = `<span class="v3-roll-button-die">${diceMarkup(1, false, true)}</span>`;
  });
  const landingDice = document.querySelector('.landing-dice');
  if (landingDice && landingDice.dataset.v3Dice !== '1') {
    landingDice.dataset.v3Dice = '1';
    landingDice.classList.add('v3-landing-dice');
    landingDice.innerHTML = diceMarkup(room?.lastDice || 1, true);
  }
}

function animatePawnMove() {
  if (!room || room.worldPhase !== 'landing') return;
  const dice = Number(room.lastDice || 0);
  const end = Number(room.eventTile ?? -1);
  if (dice <= 0 || end < 0) return;
  const key = `${room.id}:${room.round}:${end}:${dice}`;
  if (lastMoveKey === key) return;
  const board = document.querySelector('.world-loop-board');
  if (!board) return;
  const tiles = [...board.querySelectorAll(':scope > .world-tile')];
  if (tiles.length < TILE_COUNT) return;
  lastMoveKey = key;
  const active = playerByUid(room.activeUid);
  const start = (end - dice + TILE_COUNT) % TILE_COUNT;
  const ghost = document.createElement('span');
  ghost.className = 'v3-moving-pawn';
  ghost.textContent = esc((active?.nickname || '?').slice(0, 1));
  tiles[start]?.appendChild(ghost);
  for (let step = 1; step <= dice; step += 1) {
    window.setTimeout(() => {
      const index = (start + step) % TILE_COUNT;
      tiles[index]?.appendChild(ghost);
      ghost.classList.remove('hop');
      void ghost.offsetWidth;
      ghost.classList.add('hop');
      if (step === dice) {
        navigator.vibrate?.([25, 25, 55]);
        window.setTimeout(() => ghost.remove(), 650);
      }
    }, 260 * step);
  }
}

function pulseThrow() {
  if (!room || room.worldPhase !== 'landing') return;
  const key = `${room.id}:${room.round}:${room.lastDice}`;
  if (lastThrowKey === key) return;
  lastThrowKey = key;
  navigator.vibrate?.([18, 28, 18]);
}

function decorateHeader() {
  const strong = document.querySelector('.topbar strong');
  const small = document.querySelector('.topbar small');
  if (strong && strong.textContent !== '🎲 소소킹 월드') strong.textContent = '🎲 소소킹 월드';
  if (small) small.textContent = '한바퀴 보드 · 3D 주사위 · 왕관 · 미니게임';
}

function decorate() {
  decorateHeader();
  decorateLobby();
  if (!room || room.status !== 'playing') return;
  decorateBoard();
  decorateLapStatus();
  decorateDiceControls();
  animatePawnMove();
  pulseThrow();
}

function queueDecorate() {
  if (decorateQueued) return;
  decorateQueued = true;
  requestAnimationFrame(() => {
    decorateQueued = false;
    decorate();
  });
}

const observer = new MutationObserver(queueDecorate);
observer.observe(app, { childList: true, subtree: true });
document.addEventListener('pointerdown', event => {
  if (event.target.closest?.('[data-roll-choice]')) navigator.vibrate?.(22);
}, { passive: true });

async function boot() {
  try {
    const user = auth.currentUser || await initAuth();
    currentUid = user?.uid || auth.currentUser?.uid || '';
  } catch (error) {
    console.warn('world v3 auth observer skipped', error);
  }
  syncRoomFromUrl();
  setInterval(syncRoomFromUrl, 800);
  queueDecorate();
}

void boot();
