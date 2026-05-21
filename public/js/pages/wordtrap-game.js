import { auth, db } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl } from '../games/common.js';
import { scrollGameChatToBottom } from '../games/chat.js';
import { createWordtrapRoom, joinWordtrapRoom, startWordtrapGame, resetWordtrapGame, sendWordtrapChat } from '../games/wordtrap/actions.js';
import { renderWordtrapLobbyHTML, renderWordtrapLoadingHTML, renderWordtrapNotFoundHTML, renderWordtrapRoomHTML, renderWordtrapWrongGameHTML } from '../games/wordtrap/render.js';

let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeChats = null;
let currentRoom = null;
let currentPlayers = [];
let currentChats = [];

export async function renderWordtrapGame(params = {}) {
  setMeta('게임 · 금칙어 채팅게임');
  destroyWordtrapGame();
  const roomId = params.id || '';
  if (roomId) return renderRoom(roomId);
  return renderLobby();
}

export function destroyWordtrapGame() {
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribePlayers) unsubscribePlayers();
  if (unsubscribeChats) unsubscribeChats();
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  unsubscribeChats = null;
  currentRoom = null;
  currentPlayers = [];
  currentChats = [];
}

function pageEl() {
  return document.getElementById('page-content');
}

function renderLobby() {
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderWordtrapLobbyHTML();
  bindLobbyEvents();
}

function bindLobbyEvents() {
  document.getElementById('wordtrap-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('wordtrap-create')?.addEventListener('click', handleCreateRoom);
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;
  const btn = document.getElementById('wordtrap-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const roomId = await createWordtrapRoom({
      title: document.getElementById('wordtrap-title')?.value.trim() || '금칙어 채팅게임',
      preset: document.getElementById('wordtrap-preset')?.value || 'daily',
      maxPlayers: Number(document.getElementById('wordtrap-max')?.value || 6),
      customWords: document.getElementById('wordtrap-words')?.value || '',
    });
    toast.success('금칙어 게임방을 만들었어요');
    navigate(`/game/wordtrap/${roomId}`);
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
  el.innerHTML = renderWordtrapLoadingHTML();

  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) {
    el.innerHTML = renderWordtrapNotFoundHTML();
    return;
  }
  const initialRoom = { id: initial.id, ...initial.data() };
  if (initialRoom.game && initialRoom.game !== 'wordtrap') {
    el.innerHTML = renderWordtrapWrongGameHTML(initialRoom.game);
    return;
  }

  unsubscribeRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) {
      el.innerHTML = renderWordtrapNotFoundHTML();
      return;
    }
    currentRoom = { id: snap.id, ...snap.data() };
    if (currentRoom.game && currentRoom.game !== 'wordtrap') {
      destroyWordtrapGame();
      el.innerHTML = renderWordtrapWrongGameHTML(currentRoom.game);
      return;
    }
    drawRoom();
  });

  unsubscribePlayers = onSnapshot(query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')), snap => {
    currentPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    drawRoom();
  });

  unsubscribeChats = onSnapshot(query(collection(db, 'game_rooms', roomId, 'chats'), orderBy('createdAt', 'asc'), limit(100)), snap => {
    currentChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    drawRoom(true);
  });
}

function drawRoom(scrollChat = false) {
  const el = pageEl();
  if (!el || !currentRoom) return;
  el.innerHTML = renderWordtrapRoomHTML(currentRoom, currentPlayers, currentChats);
  bindRoomEvents();
  if (scrollChat) setTimeout(scrollGameChatToBottom, 20);
}

function bindRoomEvents() {
  document.getElementById('wordtrap-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('wordtrap-copy')?.addEventListener('click', handleCopyInvite);
  document.getElementById('wordtrap-join')?.addEventListener('click', handleJoinRoom);
  document.getElementById('wordtrap-start')?.addEventListener('click', handleStartGame);
  document.getElementById('wordtrap-reset')?.addEventListener('click', handleResetGame);
  document.getElementById('wordtrap-chat-send')?.addEventListener('click', handleSendChat);
  document.getElementById('wordtrap-chat-input')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendChat();
    }
  });
}

async function handleCopyInvite() {
  const url = buildGameInviteUrl('wordtrap', currentRoom.id);
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
    await joinWordtrapRoom(currentRoom, currentPlayers.length);
    toast.success('금칙어 게임방에 참가했어요');
  } catch (error) {
    toast.warn(error.message || '참가에 실패했어요');
  }
}

async function handleStartGame() {
  try {
    await startWordtrapGame(currentRoom, currentPlayers);
  } catch (error) {
    toast.warn(error.message || '게임 시작에 실패했어요');
  }
}

async function handleResetGame() {
  try {
    await resetWordtrapGame(currentRoom, currentPlayers);
  } catch (error) {
    toast.warn(error.message || '새 게임 준비에 실패했어요');
  }
}

async function handleSendChat() {
  const input = document.getElementById('wordtrap-chat-input');
  const text = input?.value || '';
  const me = currentPlayers.find(p => p.uid === auth.currentUser?.uid) || null;
  try {
    await sendWordtrapChat(currentRoom, me, text);
    input.value = '';
    setTimeout(scrollGameChatToBottom, 20);
  } catch (error) {
    toast.warn(error.message || '채팅 전송에 실패했어요');
  }
}
