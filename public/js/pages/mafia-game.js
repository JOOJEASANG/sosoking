import { auth, db, functions } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl, isRoomHost } from '../games/common.js';
import { sendGameChat, scrollGameChatToBottom } from '../games/chat.js';
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
  if (unsubscribeChats) unsubscribeChats();
  clearTimeout(aiResponseTimer);
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  unsubscribeChats = null;
  currentRoom = null;
  currentPlayers = [];
  currentChats = [];
  aiResponseTimer = null;
  if (window.__sosokingCurrentGameRoom?.game === 'mafia') window.__sosokingCurrentGameRoom = null;
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

  const aiToggle = document.getElementById('mafia-with-ai');
  const diffGroup = document.getElementById('mafia-difficulty-group');
  if (aiToggle && diffGroup) {
    aiToggle.addEventListener('change', () => {
      diffGroup.style.display = aiToggle.checked ? '' : 'none';
    });
  }

  document.querySelectorAll('.difficulty-btn[data-difficulty]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const hidden = document.getElementById('mafia-difficulty');
      if (hidden) hidden.value = btn.dataset.difficulty;
      const hint = document.getElementById('mafia-difficulty-hint');
      if (hint) hint.textContent = DIFFICULTY_HINTS[btn.dataset.difficulty] || '';
    });
  });
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;

  const btn = document.getElementById('mafia-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const withAI = document.getElementById('mafia-with-ai')?.checked ?? true;
    const difficulty = document.getElementById('mafia-difficulty')?.value || 'normal';
    const roomId = await createMafiaRoom({
      title: document.getElementById('mafia-title')?.value.trim() || '마피아게임',
      maxPlayers: Number(document.getElementById('mafia-max')?.value || 6),
      mafiaCount: Number(document.getElementById('mafia-count')?.value || 1),
      withAI,
      difficulty,
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
    window.__sosokingCurrentGameRoom = currentRoom;
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
      console.warn('[AI mafia]', e.message);
    }
  }, 3000 + Math.random() * 5000);
}

function drawRoom(scrollChat = false) {
  const el = pageEl();
  if (!el || !currentRoom) return;
  window.__sosokingCurrentGameRoom = currentRoom;
  el.innerHTML = renderMafiaRoomHTML(currentRoom, currentPlayers, currentChats);
  bindRoomEvents();
  if (scrollChat) setTimeout(scrollGameChatToBottom, 20);
}

function bindRoomEvents() {
  document.getElementById('mafia-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.querySelectorAll('[data-copy-invite]').forEach(btn => btn.addEventListener('click', handleCopyInvite));
  document.getElementById('mafia-join')?.addEventListener('click', handleJoinRoom);
  document.getElementById('mafia-start')?.addEventListener('click', handleStartGame);
  document.getElementById('mafia-count-vote')?.addEventListener('click', handleCountVote);
  document.getElementById('mafia-reset')?.addEventListener('click', handleResetGame);
  document.getElementById('mafia-chat-send')?.addEventListener('click', handleSendChat);
  document.getElementById('mafia-chat-input')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendChat();
    }
  });
  document.querySelectorAll('[data-mafia-vote]').forEach(btn => {
    btn.addEventListener('click', () => handleVote(btn.dataset.mafiaVote));
  });
}

async function handleSendChat() {
  const input = document.getElementById('mafia-chat-input');
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
  const btn = document.getElementById('mafia-start');
  try {
    if (btn) btn.disabled = true;
    await startMafiaGame(currentRoom);
  } catch (error) {
    toast.warn(error.message || '게임 시작에 실패했어요');
    if (btn) btn.disabled = false;
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
  const btn = document.getElementById('mafia-count-vote');
  try {
    if (btn) btn.disabled = true;

    // Trigger AI vote before counting if AI is alive
    if (currentRoom.aiPlayerUid) {
      const aiPlayer = currentPlayers.find(p => p.uid === currentRoom.aiPlayerUid);
      if (aiPlayer?.alive !== false && !aiPlayer?.votedFor) {
        try {
          const triggerFn = httpsCallable(functions, 'triggerAiMafiaVote');
          await triggerFn({ roomId: currentRoom.id });
        } catch (e) {
          console.warn('[AI mafia vote]', e.message);
        }
      }
    }

    await countMafiaVote(currentRoom, currentPlayers);
  } catch (error) {
    toast.warn(error.message || '투표 집계에 실패했어요');
    if (btn) btn.disabled = false;
  }
}

async function handleResetGame() {
  try {
    await resetMafiaGame(currentRoom, currentPlayers);
  } catch {
    toast.error('새 게임 준비에 실패했어요');
  }
}
