import { auth, db, functions } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl, isRoomHost } from '../games/common.js';
import { sendGameChat, scrollGameChatToBottom } from '../games/chat.js';
import { createLiarRoom, joinLiarRoom, startLiarGame } from '../games/liar/actions.js';
import { renderLiarLobbyHTML, renderLiarLoadingHTML, renderLiarNotFoundHTML, renderLiarRoomHTML, renderLiarWrongGameHTML } from '../games/liar/render.js';

let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeChats = null;
let currentRoom = null;
let currentPlayers = [];
let currentChats = [];
let aiResponseTimer = null;

const DIFFICULTY_HINTS = {
  easy: 'AI가 약간의 어색함을 내비쳐 잡기 쉬운 편이에요.',
  normal: 'AI가 자연스럽게 대화하지만 가끔 어색한 부분이 있습니다.',
  hard: 'AI가 완벽한 구어체로 위장해 구별이 매우 어렵습니다.',
};

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
  if (unsubscribeChats) unsubscribeChats();
  clearTimeout(aiResponseTimer);
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  unsubscribeChats = null;
  currentRoom = null;
  currentPlayers = [];
  currentChats = [];
  aiResponseTimer = null;
  if (window.__sosokingCurrentGameRoom?.game === 'liar') window.__sosokingCurrentGameRoom = null;
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

  const aiToggle = document.getElementById('liar-with-ai');
  const diffGroup = document.getElementById('liar-difficulty-group');
  if (aiToggle && diffGroup) {
    aiToggle.addEventListener('change', () => {
      diffGroup.style.display = aiToggle.checked ? '' : 'none';
    });
  }

  document.querySelectorAll('.difficulty-btn[data-difficulty]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const hidden = document.getElementById('liar-difficulty');
      if (hidden) hidden.value = btn.dataset.difficulty;
      const hint = document.getElementById('liar-difficulty-hint');
      if (hint) hint.textContent = DIFFICULTY_HINTS[btn.dataset.difficulty] || '';
    });
  });
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;

  const btn = document.getElementById('liar-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const withAI = document.getElementById('liar-with-ai')?.checked ?? true;
    const difficulty = document.getElementById('liar-difficulty')?.value || 'normal';
    const roomId = await createLiarRoom({
      title: document.getElementById('liar-title')?.value.trim() || '라이어게임',
      category: document.getElementById('liar-category')?.value || 'food',
      maxPlayers: Number(document.getElementById('liar-max')?.value || 6),
      liarCount: Number(document.getElementById('liar-count')?.value || 1),
      withAI,
      difficulty,
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
    window.__sosokingCurrentGameRoom = currentRoom;
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

  unsubscribeChats = onSnapshot(query(collection(db, 'game_rooms', roomId, 'chats'), orderBy('createdAt', 'asc'), limit(100)), snap => {
    currentChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    drawRoom(true);
    maybeTriggerAiChat();
  });
}

function maybeTriggerAiChat() {
  if (!currentRoom?.aiPlayerUid) return;
  if (currentRoom.status !== 'playing') return;
  if (!isRoomHost(currentRoom)) return;
  const lastChat = currentChats[currentChats.length - 1];
  if (!lastChat || lastChat.uid === currentRoom.aiPlayerUid || lastChat.type === 'system') return;
  clearTimeout(aiResponseTimer);
  aiResponseTimer = setTimeout(async () => {
    try {
      const fn = httpsCallable(functions, 'generateAiGameChat');
      await fn({ roomId: currentRoom.id });
    } catch (e) {
      console.warn('[AI liar]', e.message);
    }
  }, 3000 + Math.random() * 5000);
}

function drawRoom(scrollChat = false) {
  const el = pageEl();
  if (!el || !currentRoom) return;
  window.__sosokingCurrentGameRoom = currentRoom;
  el.innerHTML = renderLiarRoomHTML(currentRoom, currentPlayers, currentChats);
  bindRoomEvents();
  if (scrollChat) setTimeout(scrollGameChatToBottom, 20);
}

function bindRoomEvents() {
  document.getElementById('liar-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.querySelectorAll('[data-copy-invite]').forEach(btn => btn.addEventListener('click', handleCopyInvite));
  document.getElementById('liar-join')?.addEventListener('click', handleJoinRoom);
  document.getElementById('liar-chat-send')?.addEventListener('click', handleSendChat);
  document.getElementById('liar-chat-input')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendChat();
    }
  });
  const startBtn = document.getElementById('liar-start');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        startBtn.disabled = true;
        await startLiarGame(currentRoom, currentPlayers);
      } catch (e) {
        toast.error(e.message || '게임 시작에 실패했습니다.');
        startBtn.disabled = false;
      }
    });
  }
}

async function handleSendChat() {
  const input = document.getElementById('liar-chat-input');
  const text = input?.value || '';
  try {
    await sendGameChat(currentRoom.id, text);
    input.value = '';
    setTimeout(scrollGameChatToBottom, 20);
  } catch (error) {
    toast.warn(error.message || '채팅 전송에 실패했어요');
  }
}

async function handleCopyInvite() {
  const url = buildGameInviteUrl('liar', currentRoom.id);
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
    if (!auth.currentUser || !currentRoom) return;
    await joinLiarRoom(currentRoom);
    toast.success('방에 참가했어요');
  } catch (error) {
    toast.warn(error.message || '참가에 실패했어요');
  }
}
