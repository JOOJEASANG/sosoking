import { auth, db } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl, isRoomHost } from '../games/common.js';
import {
  createCodeRoom, joinCodeRoom, startCodeGame,
  submitCodeQuestion, submitCodeFinalGuess,
  addCodeAiToRoom, triggerAiIntel,
} from '../games/soso-code/actions.js';
import {
  renderCodeLobbyHTML, renderCodeLoadingHTML, renderCodeNotFoundHTML,
  renderCodeWrongGameHTML, renderCodeRoomHTML, renderCodePlayingHTML,
  renderCodeDoneHTML,
} from '../games/soso-code/render.js';

let unsubRoom = null;
let unsubPlayers = null;
let unsubActions = null;

let currentRoom = null;
let currentPlayers = [];
let currentActions = [];

// 현재 입력 상태 (4자리 선택)
let currentGuess = [null, null, null, null];

export async function renderSosoCodeGame(params = {}) {
  setMeta('소소코드 · AI 해커 코드 추리');
  destroySosoCodeGame();
  const roomId = params.id || '';
  if (roomId) return enterRoom(roomId);
  return showLobby();
}

export function destroySosoCodeGame() {
  if (unsubRoom) unsubRoom();
  if (unsubPlayers) unsubPlayers();
  if (unsubActions) unsubActions();
  unsubRoom = null;
  unsubPlayers = null;
  unsubActions = null;
  currentRoom = null;
  currentPlayers = [];
  currentActions = [];
  currentGuess = [null, null, null, null];
  if (window.__sosokingCurrentGameRoom?.game === 'soso-code') window.__sosokingCurrentGameRoom = null;
}

function pageEl() { return document.getElementById('page-content'); }

// ── 로비 ──────────────────────────────────────────────────────────────────────
function showLobby() {
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderCodeLobbyHTML();
  bindLobbyEvents();
}

function bindLobbyEvents() {
  document.getElementById('code-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('code-create-btn')?.addEventListener('click', handleCreateRoom);
  document.getElementById('code-join-btn')?.addEventListener('click', handleJoinByCode);
  document.getElementById('code-join-code')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoinByCode();
  });
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;
  const btn = document.getElementById('code-create-btn');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const difficulty = document.getElementById('code-difficulty')?.value || 'normal';
    const roomId = await createCodeRoom({
      title: document.getElementById('code-title')?.value.trim() || '소소코드',
      maxPlayers: Number(document.getElementById('code-max')?.value || 4),
      difficulty,
    });
    const aiResult = await addCodeAiToRoom(roomId, difficulty);
    if (!aiResult?.ok) toast.warn('AI 해커 추가에 실패했어요');
    toast.success('소소코드 방을 만들었어요');
    navigate(`/game/soso-code/${roomId}`);
  } catch (err) {
    console.error(err);
    toast.error(err.message || '방 만들기에 실패했어요');
    if (btn) { btn.disabled = false; btn.textContent = '방 만들기'; }
  }
}

async function handleJoinByCode() {
  const code = (document.getElementById('code-join-code')?.value || '').trim().toUpperCase();
  if (!code) return toast.warn('초대 코드를 입력해주세요');
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;
  try {
    const { query: q, collection: col, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDocs(q(col(db, 'game_rooms'), where('code', '==', code), where('game', '==', 'soso-code')));
    if (snap.empty) return toast.error('해당 코드의 소소코드 방을 찾지 못했어요');
    navigate(`/game/soso-code/${snap.docs[0].id}`);
  } catch (err) {
    toast.error(err.message || '참가에 실패했어요');
  }
}

// ── 방 입장 ───────────────────────────────────────────────────────────────────
async function enterRoom(roomId) {
  await ensureGameGuestAuth();
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderCodeLoadingHTML();

  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) { el.innerHTML = renderCodeNotFoundHTML(); return; }

  const initialData = { id: initial.id, ...initial.data() };
  if (initialData.game && initialData.game !== 'soso-code') { el.innerHTML = renderCodeWrongGameHTML(); return; }

  try { await joinCodeRoom(roomId); } catch {}

  unsubRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) { el.innerHTML = renderCodeNotFoundHTML(); return; }
    currentRoom = { id: snap.id, ...snap.data() };
    window.__sosokingCurrentGameRoom = currentRoom;
    redraw();
  });

  unsubPlayers = onSnapshot(
    query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')),
    snap => { currentPlayers = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() })); redraw(); }
  );

  unsubActions = onSnapshot(
    query(collection(db, 'game_rooms', roomId, 'actions'), orderBy('createdAt', 'asc'), limit(100)),
    snap => {
      currentActions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      redraw();
      maybeTriggerAiIntel();
    }
  );
}

// ── AI 인텔 트리거 (방장만, 매 새 라운드 시작 시) ───────────────────────────
let lastIntelRound = 0;
function maybeTriggerAiIntel() {
  if (!currentRoom?.aiPlayerUid) return;
  if (currentRoom.status !== 'playing') return;
  if (!isRoomHost(currentRoom)) return;
  const round = currentRoom.round || 1;
  if (round <= lastIntelRound) return;
  // 이번 라운드의 첫 액션이 등록되면 인텔 생성
  const thisRoundActions = currentActions.filter(a => a.round === round && a.type !== 'ai_intel');
  if (thisRoundActions.length === 0) return;
  lastIntelRound = round;
  setTimeout(async () => {
    try { await triggerAiIntel(currentRoom.id); } catch {}
  }, 2000 + Math.random() * 3000);
}

// ── 렌더링 ────────────────────────────────────────────────────────────────────
function redraw() {
  const el = pageEl();
  if (!el || !currentRoom) return;
  const myUid = auth.currentUser?.uid || '';
  const status = currentRoom.status;

  if (status === 'waiting') {
    el.innerHTML = renderCodeRoomHTML(currentRoom, currentPlayers, myUid);
    bindWaitingEvents();
  } else if (status === 'playing') {
    el.innerHTML = renderCodePlayingHTML(currentRoom, currentPlayers, currentActions, myUid);
    bindPlayingEvents();
  } else if (status === 'done') {
    el.innerHTML = renderCodeDoneHTML(currentRoom, currentPlayers, myUid);
    bindDoneEvents();
  }
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────────────────
function bindBack() {
  document.getElementById('code-back')?.addEventListener('click', () => navigate('/sosoland'));
}

function bindCopyInvite() {
  document.querySelectorAll('[data-copy-invite]').forEach(btn => btn.addEventListener('click', async () => {
    const url = buildGameInviteUrl('soso-code', currentRoom.id);
    try { await navigator.clipboard.writeText(url); toast.success('초대 링크를 복사했어요'); }
    catch { toast.error('복사에 실패했어요: ' + url); }
  }));
}

function bindWaitingEvents() {
  bindBack();
  bindCopyInvite();

  document.getElementById('code-add-ai-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('code-add-ai-btn');
    try {
      if (btn) btn.disabled = true;
      await addCodeAiToRoom(currentRoom.id, currentRoom.difficulty || 'normal');
      toast.success('AI 해커를 추가했어요');
    } catch (err) { toast.error(err.message || 'AI 추가 실패'); if (btn) btn.disabled = false; }
  });

  document.getElementById('code-start-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('code-start-btn');
    try {
      if (btn) btn.disabled = true;
      await startCodeGame(currentRoom.id);
    } catch (err) {
      toast.error(err.message || '게임 시작 실패');
      if (btn) btn.disabled = false;
    }
  });
}

function bindPlayingEvents() {
  bindBack();

  // 숫자 버튼 (포지션별 선택)
  document.querySelectorAll('.code-digit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = Number(btn.dataset.pos);
      const val = Number(btn.dataset.val);
      currentGuess[pos] = val;

      // UI 업데이트
      document.querySelectorAll(`.code-digit-btn[data-pos="${pos}"]`).forEach(b => {
        b.classList.toggle('code-digit-btn--selected', Number(b.dataset.val) === val);
      });

      // 미리보기 업데이트
      const preview = document.getElementById('code-current-guess');
      if (preview) {
        preview.textContent = currentGuess.map(v => v !== null ? String(v) : '-').join(' ');
      }
    });
  });

  document.getElementById('code-btn-question')?.addEventListener('click', handleQuestion);
  document.getElementById('code-btn-final')?.addEventListener('click', handleFinalGuess);
}

function bindDoneEvents() {
  bindBack();
}

function getMyTurnUid() {
  if (!currentRoom?.turnOrder?.length) return null;
  const idx = currentRoom.currentTurnIdx || 0;
  return currentRoom.turnOrder[idx % currentRoom.turnOrder.length] || null;
}

function isMyTurn() {
  return auth.currentUser && getMyTurnUid() === auth.currentUser.uid;
}

function getValidGuess() {
  if (currentGuess.some(v => v === null)) {
    toast.warn('4자리를 모두 선택해주세요 (1~6)');
    return null;
  }
  return currentGuess;
}

async function handleQuestion() {
  if (!isMyTurn()) return toast.warn('내 차례가 아니에요');
  const guess = getValidGuess();
  if (!guess) return;

  const targetUid = document.getElementById('code-target-select')?.value;
  if (!targetUid) return toast.warn('대상을 선택해주세요');

  const btn = document.getElementById('code-btn-question');
  try {
    if (btn) btn.disabled = true;
    await submitCodeQuestion(currentRoom.id, targetUid, [...guess]);
    currentGuess = [null, null, null, null];
    toast.success('질문을 제출했어요');
  } catch (err) {
    toast.error(err.message || '제출 실패');
    if (btn) btn.disabled = false;
  }
}

async function handleFinalGuess() {
  if (!isMyTurn()) return toast.warn('내 차례가 아니에요');
  const guess = getValidGuess();
  if (!guess) return;

  const targetUid = document.getElementById('code-target-select')?.value;
  if (!targetUid) return toast.warn('대상을 선택해주세요');

  const btn = document.getElementById('code-btn-final');
  try {
    if (btn) btn.disabled = true;
    await submitCodeFinalGuess(currentRoom.id, targetUid, [...guess]);
    currentGuess = [null, null, null, null];
  } catch (err) {
    toast.error(err.message || '제출 실패');
    if (btn) btn.disabled = false;
  }
}
