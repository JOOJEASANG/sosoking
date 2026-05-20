import { auth, db } from '../firebase.js';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';

let unsubscribeRoom = null;
let unsubscribePlayers = null;
let currentRoom = null;
let currentPlayers = [];

const BOARD = [
  { name: '출발', value: 20 }, { name: '카페', value: 5 }, { name: '공원', value: 7 }, { name: '찬스', value: 0 },
  { name: '영화관', value: 10 }, { name: '휴식', value: -5 }, { name: '학교', value: 8 }, { name: '보너스', value: 15 },
  { name: '마트', value: 12 }, { name: '감옥', value: -10 }, { name: '호텔', value: 18 }, { name: '킹존', value: 25 },
];

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function inviteUrl(roomId) {
  return `${location.origin + location.pathname}#/game/marble/${roomId}`;
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

export async function renderMarbleGame(params = {}) {
  setMeta('게임 · 마블게임');
  destroyMarbleGame();
  const roomId = params.id || '';
  if (roomId) return renderRoom(roomId);
  return renderLobby();
}

export function destroyMarbleGame() {
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribePlayers) unsubscribePlayers();
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  currentRoom = null;
  currentPlayers = [];
}

function renderLobby() {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="game-detail-page game-detail-page--marble">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="marble-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🎲</div>
        <div class="game-detail-hero__eyebrow">DICE BOARD</div>
        <h1>마블게임</h1>
        <p>주사위를 굴려 칸을 이동하고 점수를 모으는 가벼운 보드게임입니다.</p>
        <div class="game-detail-hero__chips"><span>주사위</span><span>턴 진행</span><span>점수 승부</span></div>
      </section>

      <section class="game-detail-card">
        <div class="game-detail-card__head"><div><b>마블게임 방 만들기</b><span>2명 이상 추천</span></div><i>🎲</i></div>
        <div class="form-group"><label class="form-label">방 제목</label><input id="marble-title" class="form-input" maxlength="40" value="마블게임" placeholder="방 제목"></div>
        <div class="liar-option-row">
          <div class="form-group"><label class="form-label">최대 인원</label><select id="marble-max" class="form-select"><option value="2">2명</option><option value="4" selected>4명</option><option value="6">6명</option></select></div>
          <div class="form-group"><label class="form-label">목표 점수</label><select id="marble-goal" class="form-select"><option value="80">80점</option><option value="120" selected>120점</option><option value="180">180점</option></select></div>
        </div>
        <button class="btn btn--primary" id="marble-create">방 만들기</button>
      </section>
    </div>`;
  document.getElementById('marble-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('marble-create')?.addEventListener('click', createRoom);
}

async function createRoom() {
  if (!auth.currentUser) { navigate('/login'); return; }
  const btn = document.getElementById('marble-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const room = {
      game: 'marble',
      status: 'waiting',
      title: document.getElementById('marble-title')?.value.trim() || '마블게임',
      maxPlayers: Number(document.getElementById('marble-max')?.value || 4),
      goalScore: Number(document.getElementById('marble-goal')?.value || 120),
      code: makeRoomCode(),
      hostId: auth.currentUser.uid,
      hostName: appState.nickname || auth.currentUser.displayName || '방장',
      turnIndex: 0,
      round: 1,
      lastRoll: 0,
      log: '참가자를 모은 뒤 게임을 시작하세요.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'game_rooms'), room);
    await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), makePlayer('host'));
    toast.success('마블게임 방을 만들었어요');
    navigate(`/game/marble/${ref.id}`);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '방 만들기에 실패했어요');
    btn.disabled = false;
    btn.textContent = '방 만들기';
  }
}

function makePlayer(role = 'player') {
  return {
    uid: auth.currentUser.uid,
    name: appState.nickname || auth.currentUser.displayName || '익명',
    role,
    position: 0,
    score: 30,
    finished: false,
    joinedAt: serverTimestamp(),
  };
}

async function renderRoom(roomId) {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;
  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/marble')">방 만들기</button></div>`;
    return;
  }
  unsubscribeRoom = onSnapshot(roomRef, snap => { currentRoom = { id: snap.id, ...snap.data() }; drawRoom(); });
  unsubscribePlayers = onSnapshot(query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')), snap => { currentPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() })); drawRoom(); });
}

function myPlayer() {
  return currentPlayers.find(p => p.uid === auth.currentUser?.uid) || null;
}

function isHost() {
  return currentRoom?.hostId === auth.currentUser?.uid;
}

function currentTurnPlayer() {
  if (!currentPlayers.length) return null;
  return currentPlayers[Number(currentRoom?.turnIndex || 0) % currentPlayers.length];
}

function drawRoom() {
  const el = document.getElementById('page-content');
  if (!el || !currentRoom) return;
  const me = myPlayer();
  const joined = !!me;
  const turn = currentTurnPlayer();
  const url = inviteUrl(currentRoom.id);
  const winner = currentPlayers.find(p => p.score >= Number(currentRoom.goalScore || 120));

  el.innerHTML = `
    <div class="game-detail-page game-detail-page--marble">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="marble-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🎲</div>
        <div class="game-detail-hero__eyebrow">방 코드 ${esc(currentRoom.code || '')}</div>
        <h1>${esc(currentRoom.title || '마블게임')}</h1>
        <p>${esc(currentRoom.log || '주사위를 굴려 점수를 모으세요.')}</p>
        <div class="game-detail-hero__chips"><span>${currentRoom.status === 'waiting' ? '대기중' : winner ? '종료' : `${currentRoom.round || 1}라운드`}</span><span>목표 ${currentRoom.goalScore || 120}점</span><span>마지막 주사위 ${currentRoom.lastRoll || '-'}</span></div>
      </section>

      <section class="liar-room-card">
        <div class="liar-room-info"><span>상태</span><b>${currentRoom.status === 'waiting' ? '대기중' : winner ? '종료' : '진행중'}</b></div>
        <div class="liar-room-info"><span>참가자</span><b>${currentPlayers.length}/${currentRoom.maxPlayers || 0}명</b></div>
        <div class="liar-room-info"><span>현재 턴</span><b>${esc(turn?.name || '-')}</b></div>
        <div class="liar-room-info"><span>승자</span><b>${esc(winner?.name || '-')}</b></div>
      </section>

      <section class="marble-board-card">
        <div class="marble-board">
          ${BOARD.map((cell, idx) => `
            <div class="marble-cell ${idx === 0 ? 'is-start' : ''}">
              <b>${esc(cell.name)}</b><span>${cell.value > 0 ? '+' : ''}${cell.value}</span>
              <div class="marble-pawns">${currentPlayers.filter(p => Number(p.position || 0) === idx).map(p => `<i title="${esc(p.name)}">${esc((p.name || '?')[0])}</i>`).join('')}</div>
            </div>`).join('')}
        </div>
      </section>

      <section class="liar-invite-card">
        <label class="form-label">초대 링크</label>
        <div class="liar-invite-row"><input class="form-input" id="marble-invite-url" value="${url}" readonly><button class="btn btn--primary btn--sm" id="marble-copy">복사</button></div>
      </section>

      <section class="liar-player-card">
        <h2>참가자</h2>
        <div class="liar-player-list">
          ${currentPlayers.map(p => `<div class="liar-player-item"><span>${esc(p.name)} ${p.uid === currentRoom.hostId ? '<small>방장</small>' : ''}</span><b>${Number(p.score || 0)}점 · ${BOARD[Number(p.position || 0)]?.name || '출발'}</b></div>`).join('') || '<div class="hall-empty">참가자가 없습니다.</div>'}
        </div>
        ${!joined ? '<button class="btn btn--primary" id="marble-join">참가하기</button>' : ''}
        ${isHost() && currentRoom.status === 'waiting' ? '<button class="btn btn--primary" id="marble-start">게임 시작</button>' : ''}
        ${currentRoom.status === 'playing' && turn?.uid === auth.currentUser?.uid && !winner ? '<button class="btn btn--primary" id="marble-roll">주사위 굴리기</button>' : ''}
        ${isHost() && winner ? '<button class="btn btn--ghost" id="marble-reset">새 게임 준비</button>' : ''}
      </section>
    </div>`;

  document.getElementById('marble-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('marble-copy')?.addEventListener('click', async () => { await navigator.clipboard?.writeText(url); toast.success('초대 링크를 복사했어요'); });
  document.getElementById('marble-join')?.addEventListener('click', joinRoom);
  document.getElementById('marble-start')?.addEventListener('click', startGame);
  document.getElementById('marble-roll')?.addEventListener('click', rollDice);
  document.getElementById('marble-reset')?.addEventListener('click', resetGame);
}

async function joinRoom() {
  if (!auth.currentUser) { navigate('/login'); return; }
  if (currentPlayers.length >= Number(currentRoom.maxPlayers || 0)) { toast.warn('방이 가득 찼어요'); return; }
  await setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', auth.currentUser.uid), makePlayer(auth.currentUser.uid === currentRoom.hostId ? 'host' : 'player'), { merge: true });
  toast.success('마블게임 방에 참가했어요');
}

async function startGame() {
  if (!isHost()) return;
  if (currentPlayers.length < 2) { toast.warn('마블게임은 2명 이상부터 추천해요'); return; }
  await Promise.all(currentPlayers.map(p => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', p.uid), { position: 0, score: 30, finished: false }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), { status: 'playing', turnIndex: 0, round: 1, lastRoll: 0, log: '게임이 시작됐어요. 첫 번째 플레이어가 주사위를 굴립니다.', updatedAt: serverTimestamp() });
}

async function rollDice() {
  const me = myPlayer();
  const turn = currentTurnPlayer();
  if (!me || !turn || me.uid !== turn.uid) return;
  const roll = Math.floor(Math.random() * 6) + 1;
  const nextPos = (Number(me.position || 0) + roll) % BOARD.length;
  const cell = BOARD[nextPos];
  const nextScore = Math.max(0, Number(me.score || 0) + Number(cell.value || 0));
  const winner = nextScore >= Number(currentRoom.goalScore || 120);
  await setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', me.uid), { position: nextPos, score: nextScore, finished: winner }, { merge: true });
  const nextTurn = (Number(currentRoom.turnIndex || 0) + 1) % currentPlayers.length;
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), {
    status: winner ? 'ended' : 'playing',
    turnIndex: nextTurn,
    round: nextTurn === 0 ? Number(currentRoom.round || 1) + 1 : Number(currentRoom.round || 1),
    lastRoll: roll,
    log: winner ? `${me.name}님이 ${nextScore}점으로 승리했습니다!` : `${me.name}님이 ${roll}칸 이동해 ${cell.name}에 도착했습니다. ${cell.value >= 0 ? '+' : ''}${cell.value}점`,
    updatedAt: serverTimestamp(),
  });
}

async function resetGame() {
  if (!isHost()) return;
  await Promise.all(currentPlayers.map(p => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', p.uid), { position: 0, score: 30, finished: false }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), { status: 'waiting', turnIndex: 0, round: 1, lastRoll: 0, log: '새 게임을 준비합니다. 방장이 다시 시작할 수 있어요.', updatedAt: serverTimestamp() });
}
