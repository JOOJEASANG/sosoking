export const BOARD_SIZE = 30;
export const MAX_ROUNDS = 24;

export const ACTIONS = Object.freeze({
  rush: Object.freeze({ id: 'rush', emoji: '⚡', label: '질주', stamps: 3, description: '3칸을 빠르게 채우지만 방해물을 그대로 맞습니다.' }),
  guard: Object.freeze({ id: 'guard', emoji: '🛡️', label: '방어', stamps: 2, description: '2칸을 채우고 방해물 1개를 막는 보호막을 얻습니다.' }),
  recycle: Object.freeze({ id: 'recycle', emoji: '♻️', label: '역이용', stamps: 1, description: '1칸을 채우며 만난 방해물을 고철로 바꿉니다.' })
});

export const CELLS = Object.freeze({
  clear: Object.freeze({ emoji: '', label: '빈칸', tone: 'clear' }),
  barrier: Object.freeze({ emoji: '🧱', label: '이중벽', tone: 'danger' }),
  sticky: Object.freeze({ emoji: '🕸️', label: '끈끈이', tone: 'danger' }),
  lock: Object.freeze({ emoji: '🔒', label: '정지문', tone: 'danger' }),
  mirror: Object.freeze({ emoji: '🪞', label: '반사판', tone: 'danger' }),
  bomb: Object.freeze({ emoji: '💣', label: '고철폭탄', tone: 'danger' }),
  boost: Object.freeze({ emoji: '🚀', label: '가속칸', tone: 'bonus' })
});

const OBSTACLE_SET = [
  'barrier', 'barrier', 'barrier',
  'sticky', 'sticky', 'sticky',
  'lock', 'lock',
  'mirror', 'mirror',
  'bomb', 'bomb',
  'boost', 'boost'
];
const OBSTACLE_POSITIONS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function seedNumber(value) {
  let hash = 2166136261;
  for (const char of String(value || 'SOSOKING')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function buildBoard(seed = 'SOSOKING') {
  const board = Array(BOARD_SIZE).fill('clear');
  const obstacles = shuffled(OBSTACLE_SET, randomFromSeed(seedNumber(seed)));
  OBSTACLE_POSITIONS.forEach((position, index) => { board[position] = obstacles[index]; });
  return board;
}

export function normalizeBoard(value) {
  if (!Array.isArray(value) || value.length !== BOARD_SIZE) return buildBoard();
  return value.map(type => Object.hasOwn(CELLS, type) ? type : 'clear');
}

export function normalizePlayerState(value = {}) {
  return {
    position: Math.trunc(clamp(value.position, 0, BOARD_SIZE)),
    shield: Math.trunc(clamp(value.shield, 0, 2)),
    scrap: Math.trunc(clamp(value.scrap, 0, 2)),
    banked: Math.trunc(clamp(value.banked, 0, 2)),
    jammed: value.jammed === true,
    barrierDent: value.barrierDent === true,
    finishPower: Math.trunc(clamp(value.finishPower, 0, 20))
  };
}

function collectScrap(state, events, stampBox) {
  state.scrap += 1;
  events.push('♻️ 방해물을 고철로 회수');
  if (state.scrap >= 3) {
    state.scrap -= 3;
    stampBox.value += 4;
    events.push('✨ 고철 3개 재조립 · 보너스 4칸');
  }
}

function spendShield(state, events, label) {
  if (state.shield <= 0) return false;
  state.shield -= 1;
  events.push(`🛡️ ${label} 무효화`);
  return true;
}

export function resolveTurn(player = {}, actionId = 'idle', boardValue = []) {
  const board = normalizeBoard(boardValue);
  const before = normalizePlayerState(player);
  const state = { ...before };
  const action = ACTIONS[actionId] || null;
  const events = [];
  const stampBox = { value: action?.stamps || 0 };
  const recycling = action?.id === 'recycle';

  if (action?.id === 'guard') {
    state.shield = Math.min(2, state.shield + 1);
    events.push('🛡️ 보호막 충전');
  }
  if (state.banked > 0) {
    stampBox.value += state.banked;
    events.push(`🪞 보관 도장 +${state.banked}`);
    state.banked = 0;
  }
  if (state.jammed) {
    stampBox.value = Math.max(0, stampBox.value - 1);
    state.jammed = false;
    events.push('🕸️ 끈끈이로 도장 -1');
  }
  if (!action) events.push('⌛ 미선택 · 이번 턴 정지');

  let safety = 40;
  while (stampBox.value > 0 && state.position < BOARD_SIZE && safety > 0) {
    safety -= 1;
    const type = board[state.position] || 'clear';
    const meta = CELLS[type] || CELLS.clear;

    if (type === 'barrier') {
      if (recycling) {
        stampBox.value -= 1;
        state.position += 1;
        state.barrierDent = false;
        collectScrap(state, events, stampBox);
        continue;
      }
      if (spendShield(state, events, meta.label)) {
        stampBox.value -= 1;
        state.position += 1;
        state.barrierDent = false;
        continue;
      }
      const needed = state.barrierDent ? 1 : 2;
      if (stampBox.value < needed) {
        stampBox.value = 0;
        state.barrierDent = true;
        events.push('🧱 이중벽에 금을 냄 · 다음 도장에 파괴');
        break;
      }
      stampBox.value -= needed;
      state.position += 1;
      state.barrierDent = false;
      events.push('🧱 도장 2개로 이중벽 돌파');
      continue;
    }

    stampBox.value -= 1;
    state.position += 1;
    state.barrierDent = false;
    if (type === 'clear') continue;
    if (type === 'boost') {
      stampBox.value += 1;
      events.push('🚀 가속칸 · 보너스 1칸');
      continue;
    }
    if (recycling) {
      collectScrap(state, events, stampBox);
      continue;
    }
    if (spendShield(state, events, meta.label)) continue;
    if (type === 'sticky') {
      if (stampBox.value > 0) stampBox.value -= 1;
      state.jammed = true;
      events.push('🕸️ 남은 도장 -1 · 다음 턴도 -1');
    } else if (type === 'lock') {
      stampBox.value = 0;
      events.push('🔒 정지문 · 남은 도장 소멸');
    } else if (type === 'mirror') {
      state.banked = Math.min(2, state.banked + stampBox.value);
      stampBox.value = 0;
      events.push(`🪞 남은 도장 ${state.banked}개를 다음 턴으로 반사`);
    } else if (type === 'bomb') {
      if (state.scrap > 0) state.scrap -= 1;
      stampBox.value = 0;
      events.push('💣 폭발 · 남은 도장 소멸, 고철 1개 손실');
    }
  }

  const delta = state.position - before.position;
  if (state.position >= BOARD_SIZE) {
    state.position = BOARD_SIZE;
    state.finishPower = stampBox.value + state.shield + state.scrap + state.banked;
    events.push(`🏁 완주 파워 ${state.finishPower}`);
  } else {
    state.finishPower = 0;
  }
  return {
    action: action?.id || 'idle',
    actionLabel: action?.label || '미선택',
    before,
    state,
    delta,
    events,
    finished: state.position >= BOARD_SIZE
  };
}

export function rankPlayers(players = []) {
  return [...players].sort((a, b) => {
    const position = Number(b.position || 0) - Number(a.position || 0);
    if (position) return position;
    const finishPower = Number(b.finishPower || 0) - Number(a.finishPower || 0);
    if (finishPower) return finishPower;
    const scrap = Number(b.scrap || 0) - Number(a.scrap || 0);
    if (scrap) return scrap;
    return Number(a.joinOrder || 0) - Number(b.joinOrder || 0);
  });
}
