import { auth, db } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl } from '../games/common.js';
import { createLiarRoom, joinLiarRoom } from '../games/liar/actions.js';
import { renderLiarLobbyHTML, renderLiarLoadingHTML, renderLiarNotFoundHTML, renderLiarRoomHTML, renderLiarWrongGameHTML } from '../games/liar/render.js';

let unsubscribeRoom = null;
let unsubscribePlayers = null;
let currentRoom = null;
let currentPlayers = [];

export async function renderLiarGame(params = {}) {
  setMeta('게임 · 라이어게임');
  destroyLiarGame();
  const roomId = params.id || '';
  if (roomId) return renderRoom(roomId);
  return renderLobby();
}

export function destroyLiarGame() {
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribePlayers) unsubscribePlayers();
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  currentRoom = null;
  currentPlayers = [];
}

function pageEl() {
  return document.getElementById('page-content');
}

function renderLobby() {
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderLiarLobbyHTML();
  bindLobbyEvents();
}

function bindLobbyEvents() {
  document.getElementById('liar-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('liar-create')?.addEventListener('click', handleCreateRoom);
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;

  const btn = document.getElementById('liar-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const roomId = await createLiarRoom({
      title: document.getElementById('liar-title')?.value.trim() || '라이어게임',
      category: document.getElementById('liar-category')?.value || 'food',
      maxPlayers: Number(document.getElementById('liar-max')?.value || 6),
      liarCount: Number(document.getElementById('liar-count')?.value || 1),
    });
    toast.success('라이어게임 방을 만들었어요');
    navigate(`/game/liar/${roomId}`);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '방 만들기에 실패했어요');
    btn.disabled = false;
    btn.textContent = '방 만들기';
  }
}

async function renderRoom(roomId) {
  await ensureGameGuestAuth();
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderLiarLoadingHTML();

  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) {
    el.innerHTML = renderLiarNotFoundHTML();
    return;
  }
  const initialRoom = { id: initial.id, ...initial.data() };
  if (initialRoom.game && initialRoom.game !== 'liar') {
    el.innerHTML = renderLiarWrongGameHTML(initialRoom.game);
    return;
  }

  unsubscribeRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) {
      el.innerHTML = renderLiarNotFoundHTML();
      return;
    }
    currentRoom = { id: snap.id, ...snap.data() };
    if (currentRoom.game && currentRoom.game !== 'liar') {
      destroyLiarGame();
      el.innerHTML = renderLiarWrongGameHTML(currentRoom.game);
      return;
    }
    drawRoom();
  });

  unsubscribePlayers = onSnapshot(query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')), snap => {
    currentPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    drawRoom();
  });
}

function drawRoom() {
  const el = pageEl();
  if (!el || !currentRoom) return;
  el.innerHTML = renderLiarRoomHTML(currentRoom, currentPlayers);
  bindRoomEvents();
}

function bindRoomEvents() {
  document.getElementById('liar-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('liar-copy')?.addEventListener('click', handleCopyInvite);
  document.getElementById('liar-join')?.addEventListener('click', handleJoinRoom);
}

async function handleCopyInvite() {
  const url = buildGameInviteUrl('liar', currentRoom.id);
  await navigator.clipboard?.writeText(url);
  toast.success('초대 링크를 복사했어요');
}

async function handleJoinRoom() {
  try {
    await ensureGameGuestAuth();
    if (!auth.currentUser || !currentRoom) return;
    await joinLiarRoom(currentRoom);
    toast.success('방에 참가했어요');
  } catch (error) {
    toast.warn(error.message || '참가에 실패했어요');
  }
}
