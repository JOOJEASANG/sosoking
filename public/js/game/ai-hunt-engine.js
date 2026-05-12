import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const CASE_ARCHETYPES = [
  {
    id: 'access-log-gap',
    title: '삭제된 7분의 출입기록',
    setting: '공용 작업실 출입 시스템에서 7분간의 기록이 사라졌습니다.',
    suspectClaim: '저는 그 시간에 작업실 근처에도 가지 않았습니다.',
    escapePlan: '출입기록 공백을 시스템 오류로 몰고, 현장에 남은 흔적은 이전 사용자 탓으로 돌린다.',
    locations: [
      { id: 'door', icon: '🚪', name: '출입문 로그', clue: '기록은 02:13부터 02:20까지만 비어 있습니다. 앞뒤 기록은 정상입니다.', pressure: 16, escape: -10 },
      { id: 'router', icon: '📡', name: '공유기 접속기록', clue: 'AI 용의자 기기가 02:16에 작업실 와이파이에 접속했습니다.', pressure: 24, escape: -18 },
      { id: 'desk', icon: '🪑', name: '작업대 흔적', clue: '작업대 위 파일명이 용의자의 평소 명명 규칙과 일치합니다.', pressure: 14, escape: -8 },
      { id: 'backup', icon: '💾', name: '백업 로그', clue: '삭제된 7분 동안에도 백업 서버에는 파일 접근 흔적이 남아 있습니다.', pressure: 28, escape: -22 },
    ],
    statements: [
      '그 시간에는 시스템이 불안정해서 기록이 믿을 수 없습니다.',
      '와이파이 접속은 자동 연결일 수 있습니다.',
      '파일명은 누구나 비슷하게 쓸 수 있습니다.',
      '백업 로그가 있다고 해도 제가 직접 조작했다는 뜻은 아닙니다.'
    ],
    contradictions: [
      { statementKey: '근처에도 가지 않았습니다', evidenceId: 'router', result: '근처에 가지 않았다는 진술과 02:16 와이파이 접속기록이 충돌합니다.', pressure: 32, escape: -28 },
      { statementKey: '기록이 믿을 수 없습니다', evidenceId: 'backup', result: '출입기록은 사라졌지만 백업 서버에는 같은 시간 접근 흔적이 남았습니다.', pressure: 36, escape: -32 },
    ],
    arrestEvidence: ['router', 'backup'],
    successLine: 'AI의 “현장에 없었다”는 도주 계획은 접속기록과 백업 로그 앞에서 무너졌습니다.',
    failLine: 'AI는 출입기록 공백을 시스템 오류로 밀어붙이며 수사망을 빠져나갔습니다.'
  },
  {
    id: 'shared-calendar-delete',
    title: '공유 캘린더 일정 삭제 사건',
    setting: '회의 직전 공유 캘린더에서 중요한 일정 하나가 사라졌습니다.',
    suspectClaim: '저는 일정을 삭제한 적 없습니다. 누군가 착각한 겁니다.',
    escapePlan: '동기화 오류와 권한 문제를 핑계로 삼고, 삭제 시간이 특정되지 않도록 흐린다.',
    locations: [
      { id: 'calendar', icon: '📅', name: '캘린더 변경기록', clue: '삭제 시각은 09:42이며, 권한 변경 없이 바로 삭제가 실행됐습니다.', pressure: 18, escape: -12 },
      { id: 'device', icon: '💻', name: '접속 기기', clue: '삭제 시각 직전 용의자 기기에서 캘린더 상세 화면을 열었습니다.', pressure: 26, escape: -18 },
      { id: 'chat', icon: '💬', name: '회의방 대화', clue: '09:45에 AI가 “오늘 회의 없어진 거죠?”라고 먼저 말했습니다.', pressure: 22, escape: -16 },
      { id: 'sync', icon: '🔁', name: '동기화 로그', clue: '동기화 오류는 10:03 이후 발생했습니다. 삭제 시각과 맞지 않습니다.', pressure: 30, escape: -24 },
    ],
    statements: [
      '캘린더는 동기화가 자주 꼬입니다.',
      '제가 열어본 건 확인하려던 것뿐입니다.',
      '회의가 없어진 줄 알고 말했을 뿐입니다.',
      '삭제 권한은 여러 명에게 있었습니다.'
    ],
    contradictions: [
      { statementKey: '동기화가 자주 꼬입니다', evidenceId: 'sync', result: '동기화 오류는 삭제 이후에 발생했습니다. 삭제 자체를 설명하지 못합니다.', pressure: 34, escape: -28 },
      { statementKey: '확인하려던 것뿐입니다', evidenceId: 'device', result: '삭제 직전 같은 기기에서 상세 화면이 열렸습니다. 단순 확인으로 보기 어렵습니다.', pressure: 30, escape: -24 }
    ],
    arrestEvidence: ['sync', 'device'],
    successLine: 'AI의 동기화 오류 주장은 시간순서 앞에서 무너졌습니다.',
    failLine: 'AI는 권한자가 많았다는 점을 이용해 책임을 흐렸습니다.'
  },
  {
    id: 'parcel-locker-mismatch',
    title: '무인택배함 수령시간 불일치',
    setting: '무인택배함에서 사라진 물건의 수령 시간이 AI 진술과 맞지 않습니다.',
    suspectClaim: '저는 알림을 늦게 봤고, 이미 물건은 없었습니다.',
    escapePlan: '알림 지연과 택배함 오작동을 주장하며 실제 수령 시점을 흐린다.',
    locations: [
      { id: 'locker', icon: '📦', name: '택배함 열림기록', clue: '택배함은 18:08에 한 번만 열렸고, 이후 다시 열린 기록이 없습니다.', pressure: 24, escape: -16 },
      { id: 'notice', icon: '🔔', name: '알림 수신기록', clue: 'AI 기기는 18:05에 이미 수령 알림을 확인했습니다.', pressure: 26, escape: -18 },
      { id: 'camera', icon: '📹', name: '복도 카메라', clue: '18:07에 택배함 방향으로 이동한 실루엣이 확인됩니다.', pressure: 20, escape: -12 },
      { id: 'code', icon: '🔐', name: '인증번호 사용기록', clue: '인증번호는 AI 계정에서 18:08에 사용됐습니다.', pressure: 34, escape: -28 },
    ],
    statements: [
      '알림이 늦게 떠서 제때 확인하지 못했습니다.',
      '택배함이 오작동했을 가능성도 있습니다.',
      '카메라 실루엣만으로는 저라고 할 수 없습니다.',
      '인증번호가 사용됐다는 건 누군가 알았다는 뜻일 뿐입니다.'
    ],
    contradictions: [
      { statementKey: '늦게 떠서', evidenceId: 'notice', result: '알림은 수령 전 이미 확인됐습니다. 늦게 봤다는 진술과 맞지 않습니다.', pressure: 32, escape: -28 },
      { statementKey: '누군가 알았다는 뜻', evidenceId: 'code', result: '인증번호는 AI 계정에서 직접 사용됐습니다. 제3자 가능성이 낮아졌습니다.', pressure: 38, escape: -34 }
    ],
    arrestEvidence: ['notice', 'code'],
    successLine: 'AI의 알림 지연 알리바이는 수신기록과 인증번호 사용기록으로 붕괴됐습니다.',
    failLine: 'AI는 택배함 오작동 가능성을 끝까지 붙잡고 빠져나갔습니다.'
  }
];

const STORAGE_KEY = 'sosoking_ai_hunt_case';
const RESULT_KEY = 'sosoking_ai_hunt_result';
const LIMIT_MS = 30 * 60 * 1000;

function buildGameFromCase(selected, now = Date.now(), remoteCaseId = null) {
  return {
    id: `${selected.id || remoteCaseId || 'ai-case'}-${now}`,
    remoteCaseId,
    caseId: selected.id || remoteCaseId || 'ai-generated',
    caseData: selected,
    title: selected.title,
    setting: selected.setting,
    suspectClaim: selected.suspectClaim,
    escapePlan: selected.escapePlan,
    createdAt: now,
    expiresAt: now + LIMIT_MS,
    pressure: 8,
    escape: 92,
    cluesFound: [],
    contradictionsSolved: [],
    wrongMoves: 0,
    phase: 'investigation',
    suspectMood: 'calm',
  };
}

export function startNewHunt() {
  const selected = CASE_ARCHETYPES[Math.floor(Math.random() * CASE_ARCHETYPES.length)];
  const game = buildGameFromCase(selected);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  localStorage.removeItem(RESULT_KEY);
  return game;
}

export async function startNewHuntAsync() {
  try {
    const fn = httpsCallable(functions, 'startAiHuntCase');
    const res = await fn({});
    const data = res.data || {};
    if (!data.case) throw new Error('AI 사건 응답 없음');
    const selected = { ...data.case, id: data.caseId || 'ai-generated' };
    const game = buildGameFromCase(selected, data.createdAt || Date.now(), data.caseId || null);
    if (data.expiresAt) game.expiresAt = data.expiresAt;
    game.source = 'firebase_ai';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    localStorage.removeItem(RESULT_KEY);
    return game;
  } catch (err) {
    const game = startNewHunt();
    game.source = 'local_fallback';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    return game;
  }
}

export function getGame() {
  try {
    const game = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!game) return null;
    return normalizeGame(game);
  } catch { return null; }
}

export function getCurrentCase(game = getGame()) {
  if (!game) return null;
  if (game.caseData && Array.isArray(game.caseData.locations)) return game.caseData;
  return CASE_ARCHETYPES.find(c => c.id === game.caseId) || CASE_ARCHETYPES[0];
}

export function getTimeLeft(game = getGame()) {
  if (!game) return 0;
  return Math.max(0, game.expiresAt - Date.now());
}

export function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function investigateLocation(locationId) {
  const game = getGame();
  const c = getCurrentCase(game);
  if (!game || !c) return null;
  const location = c.locations.find(x => x.id === locationId);
  if (!location) return null;
  if (!game.cluesFound.includes(locationId)) {
    game.cluesFound.push(locationId);
    game.pressure = clamp(game.pressure + location.pressure);
    game.escape = clamp(game.escape + location.escape);
    game.suspectMood = mood(game);
    save(game);
  }
  return { game, location, line: location.clue };
}

export function interrogate(questionIndex = 0) {
  const game = getGame();
  const c = getCurrentCase(game);
  if (!game || !c) return null;
  const base = c.statements[questionIndex % c.statements.length];
  const pressure = game.pressure || 0;
  let prefix = 'AI 용의자';
  let line = base;
  if (pressure > 75) line = `${base} ...다만 그 부분은 제가 다시 확인해봐야 할 것 같습니다.`;
  else if (pressure > 48) line = `${base} 하지만 그걸로 제가 계획적으로 빠져나가려 했다고 볼 수는 없습니다.`;
  else line = `${base} 이건 충분히 오해 가능한 상황입니다.`;
  game.escape = clamp(game.escape + 4);
  game.suspectMood = mood(game);
  save(game);
  return { game, speaker: prefix, line };
}

export function submitContradiction(statementIndex, evidenceId) {
  const game = getGame();
  const c = getCurrentCase(game);
  if (!game || !c) return null;
  const found = c.contradictions.find((x, idx) => idx === Number(statementIndex) && x.evidenceId === evidenceId);
  if (found && !game.contradictionsSolved.includes(`${statementIndex}:${evidenceId}`)) {
    game.contradictionsSolved.push(`${statementIndex}:${evidenceId}`);
    game.pressure = clamp(game.pressure + found.pressure);
    game.escape = clamp(game.escape + found.escape);
    game.suspectMood = mood(game);
    save(game);
    return { success: true, game, result: found.result };
  }
  game.wrongMoves += 1;
  game.escape = clamp(game.escape + 10);
  game.pressure = clamp(game.pressure - 6);
  game.suspectMood = mood(game);
  save(game);
  return { success: false, game, result: '그 단서만으로는 AI의 도주 계획을 깨기 어렵습니다. AI가 빈틈을 이용해 빠져나갑니다.' };
}

export function attemptArrest(selectedEvidence = []) {
  const game = getGame();
  const c = getCurrentCase(game);
  if (!game || !c) return null;
  const required = new Set(c.arrestEvidence || []);
  const chosen = new Set(selectedEvidence);
  const hasRequired = [...required].every(x => chosen.has(x));
  const timeLeft = getTimeLeft(game);
  const success = timeLeft > 0 && hasRequired && (game.pressure >= 70 || game.escape <= 35 || game.contradictionsSolved.length >= 2);
  const result = {
    success,
    title: success ? '검거 성공' : '검거 실패',
    caseTitle: c.title,
    line: success ? c.successLine : c.failLine,
    pressure: game.pressure,
    escape: game.escape,
    clues: game.cluesFound.length,
    contradictions: game.contradictionsSolved.length,
    wrongMoves: game.wrongMoves,
    elapsedMs: Date.now() - game.createdAt,
    rank: calcRank(success, game),
    createdAt: Date.now()
  };
  game.phase = success ? 'arrested' : 'escaped';
  save(game);
  localStorage.setItem(RESULT_KEY, JSON.stringify(result));
  return result;
}

export function getResult() {
  try { return JSON.parse(localStorage.getItem(RESULT_KEY) || 'null'); } catch { return null; }
}

export function getAvailableClues(game = getGame()) {
  const c = getCurrentCase(game);
  if (!game || !c) return [];
  const elapsed = Date.now() - game.createdAt;
  return c.locations.map((loc, idx) => ({
    ...loc,
    locked: idx > 1 && elapsed < idx * 4 * 60 * 1000 && game.cluesFound.length < idx,
    found: game.cluesFound.includes(loc.id)
  }));
}

function normalizeGame(game) {
  return { pressure: 0, escape: 100, cluesFound: [], contradictionsSolved: [], wrongMoves: 0, ...game };
}
function save(game) { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); }
function clamp(n) { return Math.max(0, Math.min(100, Number(n || 0))); }
function mood(game) {
  if (game.escape <= 25 || game.pressure >= 85) return 'cornered';
  if (game.escape <= 55 || game.pressure >= 55) return 'shaken';
  return 'calm';
}
function calcRank(success, game) {
  if (!success) return game.pressure >= 65 ? '미완의 추적자' : '수사망 미완성';
  if (game.wrongMoves === 0 && game.pressure >= 90) return 'S급 검거관';
  if (game.pressure >= 80) return 'A급 수사관';
  return 'B급 추적관';
}
