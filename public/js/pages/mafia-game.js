import { auth, db } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl } from '../games/common.js';
import {
  createMafiaRoom,
  joinMafiaRoom,
  startMafiaGame,
  voteMafia,
  countMafiaVote,
  resetMafiaGame,
} from '../games/mafia/actions.js';
import {
  renderMafiaLobbyHTML,
  renderMafiaLoadingHTML,
  renderMafiaNotFoundHTML,
  renderMafiaRoomHTML,
  renderMafiaWrongGameHTML,
} from '../games/mafia/render.js';

let unsubscribeRoom = null;
let unsubscribePlayers = null;
let currentRoom = null;
let currentPlayers = [];

export async function renderMafiaGame(params = {}) {
  setMeta('게임 · 마피아게임');
  destroyMafiaGame();
  const roomId = params.id || '';
  if (roomId) return renderRoom(roomId);
  return renderLobby();
}

export function destroyMafiaGame() {
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
  el.innerHTML = renderMafiaLobbyHTML();
  bindLobbyEvents();
}

function bindLobbyEvents() {
  document.getElementById('mafia-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('mafia-create')?.addEventListener('click', handleCreateRoom);
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;

  const btn = document.getElementById('mafia-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const roomId = await createMafiaRoom({
      title: document.getElementById('mafia-title')?.value.trim() || '마피아게임',
      maxPlayers: Number(document.getElementById('mafia-max')?.value || 6),
      mafiaCount: Number(document.getElementById('mafia-count')?.value || 1),
    });
    toast.success('마피아게임 방을 만들었어요');
    navigate(`/game/mafia/${roomId}`);
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
  el.innerHTML = renderMafiaLoadingHTML();

  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) {
    el.innerHTML = renderMafiaNotFoundHTML();
    return;
  }
  const initialRoom = { id: initial.id, ...initial.data() };
  if (initialRoom.game && initialRoom.game !== 'mafia') {
    el.innerHTML = renderMafiaWrongGameHTML(initialRoom.game);
    return;
  }

  unsubscribeRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) {
      el.innerHTML = renderMafiaNotFoundHTML();
      return;
    }
    currentRoom = { id: snap.id, ...snap.data() };
    if (currentRoom.game && currentRoom.game !== 'mafia') {
      destroyMafiaGame();
      el.innerHTML = renderMafiaWrongGameHTML(currentRoom.game);
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
  el.innerHTML = renderMafiaRoomHTML(currentRoom, currentPlayers);
  bindRoomEvents();
}

function bindRoomEvents() {
  document.getElementById('mafia-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('mafia-copy')?.addEventListener('click', handleCopyInvite);
  document.getElementById('mafia-join')?.addEventListener('click', handleJoinRoom);
  document.getElementById('mafia-start')?.addEventListener('click', handleStartGame);
  document.getElementById('mafia-count-vote')?.addEventListener('click', handleCountVote);
  document.getElementById('mafia-reset')?.addEventListener('click', handleResetGame);
  document.querySelectorAll('[data-mafia-vote]').forEach(btn => {
    btn.addEventListener('click', () => handleVote(btn.dataset.mafiaVote));
  });
}

async function handleCopyInvite() {
  const url = buildGameInviteUrl('mafia', currentRoom.id);
  try {
    await navigator.clipboard.writeText(url);
    toast.success('초대 링크를 복사했어요');
  } catch {
    toast.error('클립보드 복사에 실패했습니다. 직접 복사해주세요: ' + url);
  }
}

async function handleJoinRoom() {
  try {
    await ensureGameGuestAuth();
    if (!auth.currentUser) return;
    await joinMafiaRoom(currentRoom, currentPlayers.length);
    toast.success('마피아게임 방에 참가했어요');
  } catch (error) {
    toast.warn(error.message || '참가에 실패했어요');
  }
}

async function handleStartGame() {
  try {
    await startMafiaGame(currentRoom);
  } catch (error) {
    toast.warn(error.message || '게임 시작에 실패했어요');
  }
}

async function handleVote(targetUid) {
  try {
    if (!auth.currentUser || !currentRoom) return;
    await voteMafia(currentRoom.id, targetUid);
    toast.success('투표했어요');
  } catch {
    toast.error('투표에 실패했어요');
  }
}

async function handleCountVote() {
  try {
    await countMafiaVote(currentRoom, currentPlayers);
  } catch (error) {
    toast.warn(error.message || '투표 집계에 실패했어요');
  }
}

async function handleResetGame() {
  try {
    await resetMafiaGame(currentRoom, currentPlayers);
  } catch {
    toast.error('새 게임 준비에 실패했어요');
  }
}