import { auth, db } from '../../firebase.js';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from '../../components/toast.js';

let activeRoomId = '';
let currentRoom = null;
let currentPlayers = [];
let unsubRoom = null;
let unsubPlayers = null;

function routeRoomId() {
  const path = location.hash.slice(1).split('?')[0] || '';
  const match = path.match(/^\/game\/touch-king\/([^/]+)$/);
  return match ? match[1] : '';
}

function cleanup() {
  if (unsubRoom) unsubRoom();
  if (unsubPlayers) unsubPlayers();
  unsubRoom = null;
  unsubPlayers = null;
  activeRoomId = '';
  currentRoom = null;
  currentPlayers = [];
}

function myPlayer() {
  return currentPlayers.find(player => player.uid === auth.currentUser?.uid) || null;
}

function elapsedMs() {
  const start = Number(currentRoom?.roundData?.startedAtMs || 0);
  return start ? Math.max(0, Date.now() - start) : 0;
}

function secondsLeft() {
  const end = Number(currentRoom?.roundData?.endsAtMs || 0);
  return end ? Math.max(0, Math.ceil((end - Date.now()) / 1000)) : 0;
}

function startForRoom(roomId) {
  cleanup();
  if (!roomId) return;
  activeRoomId = roomId;
  unsubRoom = onSnapshot(doc(db, 'game_rooms', roomId), snap => {
    currentRoom = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  });
  unsubPlayers = onSnapshot(query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')), snap => {
    currentPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

function syncRoute() {
  const roomId = routeRoomId();
  if (roomId === activeRoomId) return;
  if (!roomId) cleanup();
  else startForRoom(roomId);
}

async function saveSelection(symbol) {
  const player = myPlayer();
  if (!currentRoom || currentRoom.phase !== 'playing') return;
  if (!player || !auth.currentUser) return;
  if (player.selectedSymbol) return;
  if (secondsLeft() <= 0) {
    toast.warn('시간이 종료됐어요.');
    return;
  }

  const correct = symbol === currentRoom.roundData?.common;
  const responseMs = elapsedMs();
  try {
    await updateDoc(doc(db, 'game_rooms', currentRoom.id, 'players', auth.currentUser.uid), {
      selectedSymbol: symbol,
      selectedCorrect: correct,
      selectedAtMs: Date.now(),
      responseMs,
      updatedAt: serverTimestamp(),
    });
    if (correct) toast.success(`찾았다! ${(responseMs / 1000).toFixed(1)}초`);
    else toast.warn('오답입니다. 이 판은 다른 사람이 가져갈 수 있어요.');
  } catch (error) {
    toast.error(error.message || '선택 저장에 실패했어요');
  }
}

function captureTileClick(event) {
  const btn = event.target?.closest?.('.touch-king-game .symbol-board--player [data-symbol]');
  if (!btn) return;
  if (!routeRoomId()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  saveSelection(btn.dataset.symbol || '');
}

window.addEventListener('hashchange', syncRoute);
document.addEventListener('click', captureTileClick, true);
setTimeout(syncRoute, 0);
