import { auth, db } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl, isRoomHost } from '../games/common.js';
import {
  createSpyRoom, joinSpyRoom, startSpyGame,
  submitSpyHint, advanceToDiscussion, advanceToVote,
  submitSpyVote, resolveVote, advanceRound, addSpyAiToRoom,
} from '../games/soso-spy/actions.js';
import {
  renderSpyLobbyHTML, renderSpyLoadingHTML, renderSpyNotFoundHTML,
  renderSpyWrongGameHTML, renderSpyRoomHTML, renderSpyHintPhaseHTML,
  renderSpyDiscussionHTML, renderSpyVoteHTML, renderSpyRevealHTML,
  renderSpyDoneHTML,
} from '../games/soso-spy/render.js';

let unsubRoom = null;
let unsubPlayers = null;
let unsubHints = null;
let unsubVotes = null;
let timerInterval = null;

let currentRoom = null;
let currentPlayers = [];
let currentHints = [];
let currentVotes = [];
let myVote = null;
let myHint = null;

const DIFF_HINTS = {
  easy: 'AI가 약간의 어색함을 내비쳐 잡기 쉬운 편이에요.',
  normal: 'AI가 자연스럽지만 미세하게 어색한 힌트를 씁니다.',
  hard: 'AI가 완벽히 자연스러운 힌트를 내 구별이 매우 어렵습니다.',
};

export async function renderSosoSpyGame(params = {}) {
  setMeta('소소스파이 · AI 숨겨진 단어 추리');
  destroySosoSpyGame();
  const roomId = params.id || '';
  if (roomId) return enterRoom(roomId);
  return showLobby();
}

export function destroySosoSpyGame() {
  if (unsubRoom) unsubRoom();
  if (unsubPlayers) unsubPlayers();
  if (unsubHints) unsubHints();
  if (unsubVotes) unsubVotes();
  clearInterval(timerInterval);
  unsubRoom = null;
  unsubPlayers = null;
  unsubHints = null;
  unsubVotes = null;
  timerInterval = null;
  currentRoom = null;
  currentPlayers = [];
  currentHints = [];
  currentVotes = [];
  myVote = null;
  myHint = null;
  if (window.__sosokingCurrentGameRoom?.game === 'soso-spy') window.__sosokingCurrentGameRoom = null;
}

function pageEl() { return document.getElementById('page-content'); }

// ── 로비 ──────────────────────────────────────────────────────────────────────
function showLobby() {
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderSpyLobbyHTML();
  bindLobbyEvents();
}

function bindLobbyEvents() {
  document.getElementById('spy-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('spy-create-btn')?.addEventListener('click', handleCreateRoom);
  document.getElementById('spy-join-btn')?.addEventListener('click', handleJoinByCode);
  document.getElementById('spy-join-code')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoinByCode();
  });
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;
  const btn = document.getElementById('spy-create-btn');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const roomId = await createSpyRoom({
      title: document.getElementById('spy-title')?.value.trim() || '소소스파이',
      category: document.getElementById('spy-category')?.value || 'food',
      maxPlayers: Number(document.getElementById('spy-max')?.value || 6),
      difficulty: document.getElementById('spy-difficulty')?.value || 'normal',
    });
    const aiResult = await addSpyAiToRoom(roomId, document.getElementById('spy-difficulty')?.value || 'normal');
    if (!aiResult?.ok) toast.warn('AI 스파이 추가에 실패했어요. 나중에 다시 시도해주세요.');
    toast.success('소소스파이 방을 만들었어요');
    navigate(`/game/soso-spy/${roomId}`);
  } catch (err) {
    console.error(err);
    toast.error(err.message || '방 만들기에 실패했어요');
    if (btn) { btn.disabled = false; btn.textContent = '방 만들기'; }
  }
}

async function handleJoinByCode() {
  const code = (document.getElementById('spy-join-code')?.value || '').trim().toUpperCase();
  if (!code) return toast.warn('초대 코드를 입력해주세요');
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;
  try {
    const snap = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      .then(({ query: q, collection: col, where, getDocs }) =>
        getDocs(q(col(db, 'game_rooms'), where('code', '==', code), where('game', '==', 'soso-spy'))));
    if (snap.empty) return toast.error('해당 코드의 소소스파이 방을 찾지 못했어요');
    const roomId = snap.docs[0].id;
    navigate(`/game/soso-spy/${roomId}`);
  } catch (err) {
    toast.error(err.message || '참가에 실패했어요');
  }
}

// ── 방 입장 ───────────────────────────────────────────────────────────────────
async function enterRoom(roomId) {
  await ensureGameGuestAuth();
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderSpyLoadingHTML();

  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) { el.innerHTML = renderSpyNotFoundHTML(); return; }

  const initialData = { id: initial.id, ...initial.data() };
  if (initialData.game && initialData.game !== 'soso-spy') { el.innerHTML = renderSpyWrongGameHTML(); return; }

  // Auto-join if not in players
  try { await joinSpyRoom(roomId); } catch {}

  unsubRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) { el.innerHTML = renderSpyNotFoundHTML(); return; }
    currentRoom = { id: snap.id, ...snap.data() };
    window.__sosokingCurrentGameRoom = currentRoom;
    redraw();
  });

  unsubPlayers = onSnapshot(
    query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')),
    snap => { currentPlayers = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() })); redraw(); }
  );

  unsubHints = onSnapshot(
    collection(db, 'game_rooms', roomId, 'hints'),
    snap => {
      currentHints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const myUid = auth.currentUser?.uid;
      myHint = myUid ? currentHints.find(h => h.id === myUid)?.text || null : null;
      redraw();
    }
  );

  unsubVotes = onSnapshot(
    collection(db, 'game_rooms', roomId, 'votes'),
    snap => {
      currentVotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const myUid = auth.currentUser?.uid;
      myVote = myUid ? currentVotes.find(v => v.id === myUid)?.targetUid || null : null;
      redraw();
    }
  );

  // Timer tick
  timerInterval = setInterval(() => {
    if (currentRoom?.timerEnd && ['hint', 'discussion', 'vote'].includes(currentRoom.status)) redraw();
  }, 1000);
}

// ── 렌더링 ────────────────────────────────────────────────────────────────────
function redraw() {
  const el = pageEl();
  if (!el || !currentRoom) return;
  const myUid = auth.currentUser?.uid || '';
  const status = currentRoom.status;

  if (status === 'waiting') {
    el.innerHTML = renderSpyRoomHTML(currentRoom, currentPlayers, myUid);
    bindWaitingEvents();
  } else if (status === 'hint') {
    const submittedCount = currentHints.filter(h => h.id !== currentRoom.aiPlayerUid).length;
    el.innerHTML = renderSpyHintPhaseHTML(currentRoom, currentPlayers, myUid, myHint, submittedCount);
    bindHintEvents();
  } else if (status === 'discussion') {
    el.innerHTML = renderSpyDiscussionHTML(currentRoom, currentPlayers, myUid, currentHints);
    bindDiscussionEvents();
  } else if (status === 'vote') {
    el.innerHTML = renderSpyVoteHTML(currentRoom, currentPlayers, myUid, myVote);
    bindVoteEvents();
  } else if (status === 'reveal') {
    el.innerHTML = renderSpyRevealHTML(currentRoom, currentPlayers, currentRoom.revealedUid, currentRoom.wasAI);
    bindRevealEvents();
  } else if (status === 'done') {
    el.innerHTML = renderSpyDoneHTML(currentRoom, currentPlayers, myUid);
    bindDoneEvents();
  }
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────────────────
function bindBack() {
  document.getElementById('spy-back')?.addEventListener('click', () => navigate('/sosoland'));
}

function bindCopyInvite() {
  document.querySelectorAll('[data-copy-invite]').forEach(btn => btn.addEventListener('click', async () => {
    const url = buildGameInviteUrl('soso-spy', currentRoom.id);
    try { await navigator.clipboard.writeText(url); toast.success('초대 링크를 복사했어요'); }
    catch { toast.error('복사에 실패했어요: ' + url); }
  }));
}

function bindWaitingEvents() {
  bindBack();
  bindCopyInvite();

  document.getElementById('spy-add-ai-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('spy-add-ai-btn');
    if (btn) btn.disabled = true;
    try {
      await addSpyAiToRoom(currentRoom.id, currentRoom.difficulty || 'normal');
      toast.success('AI 스파이를 추가했어요');
    } catch (err) { toast.error(err.message || 'AI 추가에 실패했어요'); if (btn) btn.disabled = false; }
  });

  document.getElementById('spy-start-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('spy-start-btn');
    try {
      if (btn) btn.disabled = true;
      await startSpyGame(currentRoom.id);
    } catch (err) {
      toast.error(err.message || '게임 시작에 실패했어요');
      if (btn) btn.disabled = false;
    }
  });
}

function bindHintEvents() {
  bindBack();

  document.getElementById('spy-hint-submit-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('spy-hint-input');
    const text = (input?.value || '').trim();
    if (!text) return toast.warn('힌트를 입력해주세요');
    const btn = document.getElementById('spy-hint-submit-btn');
    try {
      if (btn) btn.disabled = true;
      await submitSpyHint(currentRoom.id, text);
      toast.success('힌트를 제출했어요');
    } catch (err) {
      toast.error(err.message || '제출에 실패했어요');
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('spy-hint-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('spy-hint-submit-btn')?.click();
  });

  document.getElementById('spy-reveal-hints-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('spy-reveal-hints-btn');
    try {
      if (btn) btn.disabled = true;
      await advanceToDiscussion(currentRoom.id);
    } catch (err) {
      toast.error(err.message || '단계 이동에 실패했어요');
      if (btn) btn.disabled = false;
    }
  });
}

function bindDiscussionEvents() {
  bindBack();
  document.getElementById('spy-to-vote-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('spy-to-vote-btn');
    try {
      if (btn) btn.disabled = true;
      await advanceToVote(currentRoom.id);
    } catch (err) {
      toast.error(err.message || '투표 시작에 실패했어요');
      if (btn) btn.disabled = false;
    }
  });
}

function bindVoteEvents() {
  bindBack();
  document.querySelectorAll('[data-vote-uid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetUid = btn.dataset.voteUid;
      if (!targetUid || myVote) return;
      try {
        document.querySelectorAll('[data-vote-uid]').forEach(b => b.disabled = true);
        await submitSpyVote(currentRoom.id, targetUid);
        toast.success('투표했어요');
      } catch (err) {
        toast.error(err.message || '투표에 실패했어요');
        document.querySelectorAll('[data-vote-uid]').forEach(b => b.disabled = false);
      }
    });
  });

  document.getElementById('spy-resolve-vote-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('spy-resolve-vote-btn');
    try {
      if (btn) btn.disabled = true;
      await resolveVote(currentRoom.id);
    } catch (err) {
      toast.error(err.message || '결과 처리에 실패했어요');
      if (btn) btn.disabled = false;
    }
  });
}

function bindRevealEvents() {
  bindBack();
  document.getElementById('spy-next-round-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('spy-next-round-btn');
    try {
      if (btn) btn.disabled = true;
      await advanceRound(currentRoom.id);
    } catch (err) {
      toast.error(err.message || '다음 라운드 이동에 실패했어요');
      if (btn) btn.disabled = false;
    }
  });
  document.getElementById('spy-done-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('spy-done-btn');
    try {
      if (btn) btn.disabled = true;
      await advanceRound(currentRoom.id);
    } catch (err) {
      toast.error(err.message || '게임 종료에 실패했어요');
      if (btn) btn.disabled = false;
    }
  });
}

function bindDoneEvents() {
  bindBack();
  // Play again button uses inline onclick="navigate('/game/soso-spy')"
}
