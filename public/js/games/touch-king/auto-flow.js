import { auth, db } from '../../firebase.js';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SYMBOLS = ['🐰','🦊','🐻','🐼','🐸','🐵','🦁','🐯','🐨','🐧','🐳','🦄','🍒','🍋','🍉','🍇','🥝','🌽','🍕','🍩','🍭','⚽','🎲','🎧','🚀','💎','🔥','⭐','🌙','☂️','🧩','🎯','🪐','🔔','🛸','🧃','🍔','🍟','🌈','🎮','🎁','🦖','🐙','🍀','🍎','🥨','🏀','🎸'];
const BOARD_SIZE = 12;
const EXTRA_COUNT = BOARD_SIZE - 1;

let unsubRoom = null;
let unsubPlayers = null;
let timer = null;
let currentRoom = null;
let currentPlayers = [];
let activeRoomId = '';
let lastAdvanceKey = '';

function routeRoomId() {
  const path = location.hash.slice(1).split('?')[0] || '';
  const match = path.match(/^\/game\/touch-king\/([^/]+)$/);
  return match ? match[1] : '';
}

function cleanup() {
  if (unsubRoom) unsubRoom();
  if (unsubPlayers) unsubPlayers();
  if (timer) clearInterval(timer);
  unsubRoom = null;
  unsubPlayers = null;
  timer = null;
  currentRoom = null;
  currentPlayers = [];
  activeRoomId = '';
  lastAdvanceKey = '';
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

function buildRound(roundNo) {
  const common = sample(SYMBOLS, 1)[0];
  const rest = SYMBOLS.filter(symbol => symbol !== common);
  const centerExtra = sample(rest, EXTRA_COUNT);
  const center = shuffle([common, ...centerExtra]);
  const boards = {};
  currentPlayers.forEach(player => {
    const pool = rest.filter(symbol => !centerExtra.includes(symbol));
    boards[player.uid] = shuffle([common, ...sample(pool.length >= EXTRA_COUNT ? pool : rest, EXTRA_COUNT)]);
  });
  const startedAtMs = Date.now();
  return {
    round: roundNo,
    common,
    center,
    boards,
    boardSize: BOARD_SIZE,
    startedAtMs,
    endsAtMs: startedAtMs + Number(currentRoom?.roundSeconds || 12) * 1000,
  };
}

function secondsLeft(room = currentRoom) {
  const end = Number(room?.roundData?.endsAtMs || 0);
  if (!end) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function firstCorrectPlayer() {
  return currentPlayers
    .filter(player => player.selectedCorrect)
    .sort((a, b) => Number(a.responseMs || 999999) - Number(b.responseMs || 999999))[0] || null;
}

function shouldAdvanceRound() {
  if (!currentRoom || currentRoom.phase !== 'playing') return false;
  if (!auth.currentUser || auth.currentUser.uid !== currentRoom.hostId) return false;
  if (!currentPlayers.length) return false;
  return !!firstCorrectPlayer() || secondsLeft(currentRoom) <= 0;
}

async function finishGame(reason = 'finish') {
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), {
    phase: 'result',
    status: 'finished',
    log: reason === 'time-up' ? '마지막 판이 시간 종료되어 최종 결과가 공개되었습니다.' : '마지막 판 정답자가 나와 최종 결과가 공개되었습니다.',
    updatedAt: serverTimestamp(),
  });
}

async function startNextRound(reason = 'first-correct') {
  const nextRound = Number(currentRoom.round || 0) + 1;
  const roundData = buildRound(nextRound);
  await Promise.all(currentPlayers.map(player => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', player.uid), {
    selectedSymbol: '',
    selectedCorrect: false,
    responseMs: 0,
    ready: true,
    updatedAt: serverTimestamp(),
  }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), {
    status: 'playing',
    phase: 'playing',
    round: nextRound,
    roundData,
    log: reason === 'time-up'
      ? `ROUND ${nextRound} 진행 중. 이전 판은 시간 종료로 무득점입니다.`
      : `ROUND ${nextRound} 진행 중. 이전 판 정답자가 나와 바로 다음 판으로 넘어왔습니다.`,
    updatedAt: serverTimestamp(),
  });
}

async function advanceRound() {
  if (!currentRoom?.id) return;
  const winner = firstCorrectPlayer();
  const reason = winner ? 'first-correct' : 'time-up';
  const key = `${currentRoom.id}:${currentRoom.round}:${reason}:${winner?.uid || 'none'}`;
  if (lastAdvanceKey === key) return;
  lastAdvanceKey = key;

  try {
    const round = Number(currentRoom.round || 1);
    const limit = Number(currentRoom.roundLimit || 5);
    if (round >= limit) await finishGame(reason);
    else await startNextRound(reason);
  } catch (error) {
    console.warn('[touch-king auto-flow] advance failed', error);
    lastAdvanceKey = '';
  }
}

function checkFlow() {
  if (!shouldAdvanceRound()) return;
  advanceRound();
}

function startForRoom(roomId) {
  cleanup();
  if (!roomId) return;
  activeRoomId = roomId;
  const roomRef = doc(db, 'game_rooms', roomId);
  unsubRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) return;
    const data = { id: snap.id, ...snap.data() };
    if (data.game !== 'touch-king') return;
    currentRoom = data;
    checkFlow();
  });
  unsubPlayers = onSnapshot(query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')), snap => {
    currentPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    checkFlow();
  });
  timer = setInterval(checkFlow, 350);
}

function syncRoute() {
  const id = routeRoomId();
  if (id === activeRoomId) return;
  if (!id) cleanup();
  else startForRoom(id);
}

window.addEventListener('hashchange', syncRoute);
setTimeout(syncRoute, 0);
