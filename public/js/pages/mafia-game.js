import { auth, db } from '../firebase.js';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';

let unsubscribeRoom = null;
let unsubscribePlayers = null;
let currentRoom = null;
let currentPlayers = [];

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function inviteUrl(roomId) {
  return `${location.origin + location.pathname}#/game/mafia/${roomId}`;
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

function renderLobby() {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="game-detail-page game-detail-page--mafia">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="mafia-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🌙</div>
        <div class="game-detail-hero__eyebrow">NIGHT MISSION</div>
        <h1>마피아게임</h1>
        <p>정체를 숨긴 마피아를 대화와 투표로 찾아내는 추리 게임입니다.</p>
        <div class="game-detail-hero__chips"><span>역할 비공개</span><span>토론 투표</span><span>친구 초대</span></div>
      </section>

      <section class="game-detail-card">
        <div class="game-detail-card__head"><div><b>마피아게임 방 만들기</b><span>3명 이상 추천</span></div><i>🌙</i></div>
        <div class="form-group"><label class="form-label">방 제목</label><input id="mafia-title" class="form-input" maxlength="40" value="마피아게임" placeholder="방 제목"></div>
        <div class="liar-option-row">
          <div class="form-group"><label class="form-label">최대 인원</label><select id="mafia-max" class="form-select"><option value="4">4명</option><option value="6" selected>6명</option><option value="8">8명</option></select></div>
          <div class="form-group"><label class="form-label">마피아 수</label><select id="mafia-count" class="form-select"><option value="1" selected>1명</option><option value="2">2명</option></select></div>
        </div>
        <button class="btn btn--primary" id="mafia-create">방 만들기</button>
      </section>
    </div>`;
  document.getElementById('mafia-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('mafia-create')?.addEventListener('click', createRoom);
}

async function createRoom() {
  if (!auth.currentUser) { navigate('/login'); return; }
  const btn = document.getElementById('mafia-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const room = {
      game: 'mafia',
      status: 'waiting',
      phase: 'waiting',
      title: document.getElementById('mafia-title')?.value.trim() || '마피아게임',
      maxPlayers: Number(document.getElementById('mafia-max')?.value || 6),
      mafiaCount: Number(document.getElementById('mafia-count')?.value || 1),
      code: makeRoomCode(),
      hostId: auth.currentUser.uid,
      hostName: appState.nickname || auth.currentUser.displayName || '방장',
      day: 0,
      log: '참가자를 모은 뒤 게임을 시작하세요.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'game_rooms'), room);
    await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      name: appState.nickname || auth.currentUser.displayName || '익명',
      role: 'host',
      assignedRole: '',
      alive: true,
      votedFor: '',
      joinedAt: serverTimestamp(),
    });
    toast.success('마피아게임 방을 만들었어요');
    navigate(`/game/mafia/${ref.id}`);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '방 만들기에 실패했어요');
    btn.disabled = false;
    btn.textContent = '방 만들기';
  }
}

async function renderRoom(roomId) {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;
  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/mafia')">방 만들기</button></div>`;
    return;
  }

  unsubscribeRoom = onSnapshot(roomRef, snap => {
    currentRoom = { id: snap.id, ...snap.data() };
    drawRoom();
  });
  unsubscribePlayers = onSnapshot(query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')), snap => {
    currentPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    drawRoom();
  });
}

function myPlayer() {
  return currentPlayers.find(p => p.uid === auth.currentUser?.uid) || null;
}

function isHost() {
  return currentRoom?.hostId === auth.currentUser?.uid;
}

function alivePlayers() {
  return currentPlayers.filter(p => p.alive !== false);
}

function voteCounts() {
  const counts = {};
  currentPlayers.forEach(p => {
    if (p.alive !== false && p.votedFor) counts[p.votedFor] = (counts[p.votedFor] || 0) + 1;
  });
  return counts;
}

function drawRoom() {
  const el = document.getElementById('page-content');
  if (!el || !currentRoom) return;
  const me = myPlayer();
  const joined = !!me;
  const url = inviteUrl(currentRoom.id);
  const counts = voteCounts();
  const alive = alivePlayers();
  const gameOver = currentRoom.status === 'ended';

  el.innerHTML = `
    <div class="game-detail-page game-detail-page--mafia">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="mafia-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🌙</div>
        <div class="game-detail-hero__eyebrow">방 코드 ${esc(currentRoom.code || '')}</div>
        <h1>${esc(currentRoom.title || '마피아게임')}</h1>
        <p>${esc(currentRoom.log || '참가자를 모아 게임을 시작하세요.')}</p>
        <div class="game-detail-hero__chips"><span>${currentRoom.status === 'waiting' ? '대기중' : gameOver ? '종료' : `${currentRoom.day || 1}라운드`}</span><span>생존 ${alive.length}명</span><span>마피아 ${currentRoom.mafiaCount || 1}명</span></div>
      </section>

      <section class="liar-room-card">
        <div class="liar-room-info"><span>상태</span><b>${currentRoom.status === 'waiting' ? '대기중' : gameOver ? '종료' : '진행중'}</b></div>
        <div class="liar-room-info"><span>참가자</span><b>${currentPlayers.length}/${currentRoom.maxPlayers || 0}명</b></div>
        <div class="liar-room-info"><span>마피아</span><b>${currentRoom.mafiaCount || 1}명</b></div>
        <div class="liar-room-info"><span>내 역할</span><b>${me?.assignedRole ? roleLabel(me.assignedRole) : '-'}</b></div>
      </section>

      <section class="liar-invite-card">
        <label class="form-label">초대 링크</label>
        <div class="liar-invite-row"><input class="form-input" id="mafia-invite-url" value="${url}" readonly><button class="btn btn--primary btn--sm" id="mafia-copy">복사</button></div>
      </section>

      <section class="liar-player-card">
        <h2>참가자</h2>
        <div class="liar-player-list">
          ${currentPlayers.map(p => `
            <div class="liar-player-item mafia-player ${p.alive === false ? 'is-dead' : ''}">
              <span>${esc(p.name)} ${p.uid === currentRoom.hostId ? '<small>방장</small>' : ''}</span>
              <b>${p.alive === false ? '탈락' : p.assignedRole && gameOver ? roleLabel(p.assignedRole) : `${counts[p.uid] || 0}표`}</b>
            </div>`).join('') || '<div class="hall-empty">참가자가 없습니다.</div>'}
        </div>
        ${!joined ? '<button class="btn btn--primary" id="mafia-join">참가하기</button>' : ''}
        ${isHost() && currentRoom.status === 'waiting' ? '<button class="btn btn--primary" id="mafia-start">게임 시작</button>' : ''}
      </section>

      ${currentRoom.status === 'playing' && joined && me?.alive !== false ? renderVoteBox(me) : ''}
      ${isHost() && currentRoom.status === 'playing' ? '<button class="btn btn--primary btn--full" id="mafia-count-vote">투표 집계 / 처형</button>' : ''}
      ${gameOver ? '<button class="btn btn--ghost btn--full" id="mafia-reset">새 게임 준비</button>' : ''}
    </div>`;

  document.getElementById('mafia-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('mafia-copy')?.addEventListener('click', async () => { await navigator.clipboard?.writeText(url); toast.success('초대 링크를 복사했어요'); });
  document.getElementById('mafia-join')?.addEventListener('click', joinRoom);
  document.getElementById('mafia-start')?.addEventListener('click', startGame);
  document.getElementById('mafia-count-vote')?.addEventListener('click', countVote);
  document.getElementById('mafia-reset')?.addEventListener('click', resetGame);
  document.querySelectorAll('[data-mafia-vote]').forEach(btn => btn.addEventListener('click', () => vote(btn.dataset.mafiaVote)));
}

function roleLabel(role) {
  return role === 'mafia' ? '마피아' : '시민';
}

function renderVoteBox(me) {
  const targets = alivePlayers().filter(p => p.uid !== me.uid);
  return `
    <section class="game-detail-card">
      <div class="game-detail-card__head"><div><b>투표하기</b><span>${me.votedFor ? '투표 완료' : '의심되는 사람 선택'}</span></div><i>🗳️</i></div>
      <div class="mafia-vote-grid">
        ${targets.map(p => `<button class="btn ${me.votedFor === p.uid ? 'btn--primary' : 'btn--ghost'} btn--sm" data-mafia-vote="${p.uid}">${esc(p.name)}</button>`).join('') || '<div class="hall-empty">투표할 대상이 없습니다.</div>'}
      </div>
    </section>`;
}

async function joinRoom() {
  if (!auth.currentUser) { navigate('/login'); return; }
  if (currentPlayers.length >= Number(currentRoom.maxPlayers || 0)) { toast.warn('방이 가득 찼어요'); return; }
  await setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', auth.currentUser.uid), {
    uid: auth.currentUser.uid,
    name: appState.nickname || auth.currentUser.displayName || '익명',
    role: auth.currentUser.uid === currentRoom.hostId ? 'host' : 'player',
    assignedRole: '',
    alive: true,
    votedFor: '',
    joinedAt: serverTimestamp(),
  }, { merge: true });
  toast.success('마피아게임 방에 참가했어요');
}

async function startGame() {
  if (!isHost()) return;
  const playersSnap = await getDocs(query(collection(db, 'game_rooms', currentRoom.id, 'players'), orderBy('joinedAt', 'asc')));
  const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (players.length < 3) { toast.warn('마피아게임은 3명 이상부터 추천해요'); return; }
  const mafiaCount = Math.min(Number(currentRoom.mafiaCount || 1), Math.max(1, players.length - 2));
  const roles = shuffle([...Array(mafiaCount).fill('mafia'), ...Array(players.length - mafiaCount).fill('citizen')]);
  await Promise.all(players.map((p, i) => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', p.id), {
    assignedRole: roles[i],
    alive: true,
    votedFor: '',
  }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), {
    status: 'playing',
    phase: 'day',
    day: 1,
    log: '역할이 배정됐어요. 서로 질문하고 마피아를 찾아 투표하세요.',
    updatedAt: serverTimestamp(),
  });
}

async function vote(targetUid) {
  if (!auth.currentUser || !currentRoom) return;
  await setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', auth.currentUser.uid), { votedFor: targetUid }, { merge: true });
  toast.success('투표했어요');
}

async function countVote() {
  if (!isHost()) return;
  const counts = voteCounts();
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { toast.warn('아직 투표가 없습니다'); return; }
  if (entries[1] && entries[0][1] === entries[1][1]) {
    await clearVotes(`동표입니다. 탈락자 없이 ${Number(currentRoom.day || 1) + 1}라운드로 넘어갑니다.`);
    return;
  }
  const target = currentPlayers.find(p => p.uid === entries[0][0]);
  if (!target) return;
  await setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', target.uid), { alive: false, votedFor: '' }, { merge: true });
  const nextPlayers = currentPlayers.map(p => p.uid === target.uid ? { ...p, alive: false, votedFor: '' } : { ...p, votedFor: '' });
  const mafiaAlive = nextPlayers.filter(p => p.alive !== false && p.assignedRole === 'mafia').length;
  const citizenAlive = nextPlayers.filter(p => p.alive !== false && p.assignedRole !== 'mafia').length;
  let status = 'playing';
  let log = `${target.name}님이 투표로 탈락했습니다.`;
  if (mafiaAlive === 0) { status = 'ended'; log = `시민 승리! ${target.name}님이 탈락했고 마피아가 모두 사라졌습니다.`; }
  else if (mafiaAlive >= citizenAlive) { status = 'ended'; log = `마피아 승리! 마피아 수가 시민 수 이상이 되었습니다.`; }
  await Promise.all(nextPlayers.map(p => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', p.uid), { votedFor: '' }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), { status, day: Number(currentRoom.day || 1) + 1, log, updatedAt: serverTimestamp() });
}

async function clearVotes(log) {
  await Promise.all(currentPlayers.map(p => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', p.uid), { votedFor: '' }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), { day: Number(currentRoom.day || 1) + 1, log, updatedAt: serverTimestamp() });
}

async function resetGame() {
  if (!isHost()) return;
  await Promise.all(currentPlayers.map(p => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', p.uid), { assignedRole: '', alive: true, votedFor: '' }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', currentRoom.id), { status: 'waiting', phase: 'waiting', day: 0, log: '새 게임을 준비합니다. 방장이 다시 시작할 수 있어요.', updatedAt: serverTimestamp() });
}
