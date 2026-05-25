import { auth, db } from '../../firebase.js';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let unsubRoom = null;
let unsubPlayers = null;
let timer = null;
let currentRoom = null;
let currentPlayers = [];
let activeRoomId = '';
let lastResultKey = '';

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
  lastResultKey = '';
}

function secondsLeft(room = currentRoom) {
  const end = Number(room?.roundData?.endsAtMs || 0);
  if (!end) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function shouldRevealResult() {
  if (!currentRoom || currentRoom.phase !== 'playing') return false;
  if (!auth.currentUser || auth.currentUser.uid !== currentRoom.hostId) return false;
  if (!currentPlayers.length) return false;
  const everyoneSelected = currentPlayers.every(player => player.selectedSymbol);
  return secondsLeft(currentRoom) <= 0 || everyoneSelected;
}

async function revealResult(reason = 'auto') {
  if (!currentRoom?.id) return;
  const key = `${currentRoom.id}:${currentRoom.round}:${reason}`;
  if (lastResultKey === key) return;
  lastResultKey = key;
  try {
    await updateDoc(doc(db, 'game_rooms', currentRoom.id), {
      phase: 'result',
      status: 'playing',
      log: reason === 'all-selected' ? '모든 참가자가 선택해서 라운드 결과가 공개되었습니다.' : '시간이 종료되어 라운드 결과가 공개되었습니다.',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[touch-king auto-flow] result update failed', error);
    lastResultKey = '';
  }
}

function checkFlow() {
  if (!shouldRevealResult()) return;
  const everyoneSelected = currentPlayers.every(player => player.selectedSymbol);
  revealResult(everyoneSelected ? 'all-selected' : 'time-up');
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
  timer = setInterval(checkFlow, 700);
}

function syncRoute() {
  const id = routeRoomId();
  if (id === activeRoomId) return;
  if (!id) cleanup();
  else startForRoom(id);
}

window.addEventListener('hashchange', syncRoute);
setTimeout(syncRoute, 0);
