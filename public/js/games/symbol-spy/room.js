import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../../router.js';
import { toast } from '../../components/toast.js';
import { ensureGameGuestAuth } from '../../game-guest-access.js';
import { buildGameInviteUrl, gamePlayerName, isRoomHost, makeRoomCode } from '../common.js';

const SYMBOLS = ['🐰','🦊','🐻','🐼','🐸','🐵','🦁','🐯','🐨','🐧','🐳','🦄','🍒','🍋','🍉','🍇','🥝','🌽','🍕','🍩','🍭','⚽','🎲','🎧','🚀','💎','🔥','⭐','🌙','☂️','🧩','🎯','🪐','🔔','🛸','🧃'];
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let currentRoom = null;
let currentPlayers = [];
let roomTick = null;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function ensureRoomStyles() {
  if (document.querySelector('link[href="/css/symbol-spy-room-sync.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/symbol-spy-room-sync.css';
  document.head.appendChild(link);
}

function pageEl() { return document.getElementById('page-content'); }
function myPlayer() { return currentPlayers.find(p => p.uid === auth.currentUser?.uid) || null; }
function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sample(list, count) { return shuffle(list).slice(0, count); }

function makePlayer(role = 'player') {
  return {
    uid: auth.currentUser.uid,
    name: gamePlayerName(),
    role,
    ready: role === 'host',
    score: 0,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildRoundData(players, roundNo, seconds = 14) {
  const common = sample(SYMBOLS, 1)[0];
  const rest = SYMBOLS.filter(symbol => symbol !== common);
  const centerExtra = sample(rest, 7);
  const center = shuffle([common, ...centerExtra]);
  const boards = {};
  const usedBase = new Set(centerExtra);

  players.forEach((player, index) => {
    const pool = rest.filter(symbol => !usedBase.has(symbol));
    const extra = sample(pool.length >= 7 ? pool : rest, 7);
    boards[player.uid] = shuffle([common, ...extra]);
  });

  const startedAtMs = Date.now();
  return {
    round: roundNo,
    common,
    center,
    boards,
    startedAtMs,
    endsAtMs: startedAtMs + Number(seconds || 14) * 1000,
  };
}

function secondsLeft(room = currentRoom) {
  const end = Number(room?.roundData?.endsAtMs || 0);
  if (!end) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

export async function createSymbolSpyRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요.');
  const room = {
    game: 'symbol-spy',
    title: '심볼스파이',
    status: 'waiting',
    phase: 'lobby',
    code: makeRoomCode(),
    hostId: auth.currentUser.uid,
    hostName: gamePlayerName('방장'),
    maxPlayers: 6,
    round: 0,
    roundLimit: 5,
    roundSeconds: 14,
    log: '초대 링크를 공유하고 참가자를 모아주세요.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'game_rooms'), room);
  await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), makePlayer('host'));
  return ref.id;
}

export async function joinSymbolSpyRoom(room) {
  await ensureGameGuestAuth();
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요.');
  if (!room || room.game !== 'symbol-spy') throw new Error('심볼스파이 방이 아닙니다.');
  if (!myPlayer() && currentPlayers.length >= Number(room.maxPlayers || 6)) throw new Error('방이 가득 찼어요.');
  const role = auth.currentUser.uid === room.hostId ? 'host' : 'player';
  await setDoc(doc(db, 'game_rooms', room.id, 'players', auth.currentUser.uid), makePlayer(role), { merge: true });
}

export function destroySymbolSpyRoom() {
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribePlayers) unsubscribePlayers();
  if (roomTick) clearInterval(roomTick);
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  roomTick = null;
  currentRoom = null;
  currentPlayers = [];
}

export async function renderSymbolSpyRoom(roomId) {
  destroySymbolSpyRoom();
  ensureRoomStyles();
  await ensureGameGuestAuth();
  const el = pageEl();
  if (!el) return;
  el.innerHTML = '<section class="symbol-spy"><div class="loading-center"><div class="spinner spinner--lg"></div></div></section>';

  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) {
    el.innerHTML = '<section class="symbol-spy"><div class="symbol-room-empty"><div>😢</div><h1>방을 찾을 수 없어요</h1><button class="symbol-spy__start" onclick="location.hash=\'/game/symbol-spy\'">심볼스파이로</button></div></section>';
    return;
  }
  const firstRoom = { id: initial.id, ...initial.data() };
  if (firstRoom.game !== 'symbol-spy') {
    el.innerHTML = `<section class="symbol-spy"><div class="symbol-room-empty"><div>⚠️</div><h1>심볼스파이 방이 아닙니다</h1><p>${esc(firstRoom.game || '알 수 없음')}</p></div></section>`;
    return;
  }

  unsubscribeRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) return;
    currentRoom = { id: snap.id, ...snap.data() };
    drawRoom();
  });
  unsubscribePlayers = onSnapshot(query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')), snap => {
    currentPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    drawRoom();
  });
  roomTick = setInterval(() => {
    if (currentRoom?.phase === 'playing') updateTimerOnly();
  }, 500);
}

function renderTopbar() {
  return `
    <header class="symbol-spy__topbar">
      <button class="symbol-spy__ghost" type="button" data-room-back>← 심볼스파이</button>
      <div class="symbol-spy__brand"><span>⚡</span><b>${esc(currentRoom.title || '심볼스파이')}</b><small>방 코드 ${esc(currentRoom.code || '')}</small></div>
      <div class="symbol-spy__score"><span>${currentPlayers.length}/${Number(currentRoom.maxPlayers || 6)}명</span><span>${esc(currentRoom.phase || 'lobby')}</span></div>
    </header>`;
}

function drawRoom() {
  const el = pageEl();
  if (!el || !currentRoom) return;
  el.innerHTML = currentRoom.phase === 'playing' && currentRoom.roundData ? renderPlayingHTML() : renderLobbyHTML();
  bindRoomEvents();
}

function renderLobbyHTML() {
  const joined = !!myPlayer();
  const host = isRoomHost(currentRoom);
  const inviteUrl = buildGameInviteUrl('symbol-spy', currentRoom.id);
  return `
    <section class="symbol-spy symbol-spy--room">
      ${renderTopbar()}
      <div class="symbol-room">
        <article class="symbol-room__hero">
          <div class="symbol-vote__badge">친구 초대 대기방</div>
          <h1>같이 할 참가자를 모으세요</h1>
          <p>${esc(currentRoom.log || '초대 링크를 공유하고 참가자를 모아주세요.')}</p>
          <div class="symbol-room__invite"><input class="form-input" readonly value="${esc(inviteUrl)}"><button class="symbol-spy__start" type="button" data-copy-room>초대 링크 복사</button></div>
          <div class="symbol-room__actions">
            ${joined ? '<button class="symbol-spy__ghost" type="button" data-ready-room>준비 상태 변경</button>' : '<button class="symbol-spy__start" type="button" data-join-room>방 참가하기</button>'}
            ${host ? '<button class="symbol-spy__start" type="button" data-host-start-round>실시간 라운드 시작</button>' : ''}
          </div>
        </article>
        ${renderPlayersPanel('이번 단계부터 같은 심볼판을 실시간으로 공유합니다.')}
      </div>
    </section>`;
}

function renderPlayersPanel(hint = '') {
  return `
    <article class="symbol-room__players">
      <h2>참가자</h2>
      <div class="symbol-room__player-list">
        ${currentPlayers.map(player => `
          <div class="symbol-room__player">
            <span>${player.uid === currentRoom.hostId ? '👑' : '⚡'}</span>
            <b>${esc(player.name || '게스트')}</b>
            <small>${player.selectedSymbol ? `${player.selectedSymbol} ${player.selectedCorrect ? '정답' : '오답'}` : (player.ready ? '준비 완료' : '대기 중')}</small>
          </div>`).join('') || '<div class="symbol-room__none">아직 참가자가 없습니다.</div>'}
      </div>
      <div class="symbol-room__hint">${esc(hint || '참가자 상태가 실시간으로 표시됩니다.')}</div>
    </article>`;
}

function renderTile(symbol, disabled = false) {
  return `<button class="symbol-tile" type="button" data-room-symbol="${esc(symbol)}" ${disabled ? 'disabled' : ''}><span>${symbol}</span></button>`;
}

function renderPlayingHTML() {
  const round = currentRoom.roundData || {};
  const player = myPlayer();
  const board = player ? (round.boards?.[player.uid] || []) : [];
  const host = isRoomHost(currentRoom);
  const selected = !!player?.selectedSymbol;
  const left = secondsLeft(currentRoom);
  return `
    <section class="symbol-spy symbol-spy--room symbol-spy--room-play">
      ${renderTopbar()}
      <div class="symbol-room-round">
        <div class="symbol-spy__playhead">
          <div><b>ROUND ${Number(currentRoom.round || 1)}/${Number(currentRoom.roundLimit || 5)}</b><span>${selected ? `내 선택: ${player.selectedSymbol} · ${player.selectedCorrect ? '정답' : '오답'}` : '중앙판과 내 판에 동시에 있는 심볼을 누르세요.'}</span></div>
          <div class="symbol-spy__timer" data-room-timer>${left}</div>
        </div>
        <div class="symbol-spy__arena">
          <article class="symbol-board symbol-board--center"><div class="symbol-board__title">공유 중앙판</div><div class="symbol-board__grid">${(round.center || []).map(symbol => renderTile(symbol, true)).join('')}</div></article>
          <div class="symbol-spy__versus"><span>모두 같은 정답</span><b>LIVE</b><small>선택 결과 실시간 표시</small></div>
          <article class="symbol-board symbol-board--player"><div class="symbol-board__title">내 탐색판</div><div class="symbol-board__grid">${board.length ? board.map(symbol => renderTile(symbol, selected || left <= 0)).join('') : '<div class="symbol-room__none">방 참가 후 플레이할 수 있어요.</div>'}</div></article>
        </div>
        <div class="symbol-room-round__actions">
          ${!player ? '<button class="symbol-spy__start" type="button" data-join-room>방 참가하기</button>' : ''}
          ${host ? '<button class="symbol-spy__start" type="button" data-host-start-round>다음 라운드</button>' : ''}
        </div>
        ${renderPlayersPanel('정답 여부와 점수가 실시간으로 동기화됩니다.')}
      </div>
    </section>`;
}

function bindRoomEvents() {
  document.querySelector('[data-room-back]')?.addEventListener('click', () => navigate('/game/symbol-spy'));
  document.querySelector('[data-copy-room]')?.addEventListener('click', copyInvite);
  document.querySelector('[data-join-room]')?.addEventListener('click', async () => {
    try { await joinSymbolSpyRoom(currentRoom); toast.success('방에 참가했어요'); }
    catch (error) { toast.warn(error.message || '참가에 실패했어요'); }
  });
  document.querySelector('[data-ready-room]')?.addEventListener('click', toggleReady);
  document.querySelector('[data-host-start-round]')?.addEventListener('click', startSyncedRound);
  document.querySelectorAll('[data-room-symbol]').forEach(btn => btn.addEventListener('click', () => selectRoomSymbol(btn.dataset.roomSymbol)));
}

function updateTimerOnly() {
  const timer = document.querySelector('[data-room-timer]');
  if (timer) timer.textContent = String(secondsLeft(currentRoom));
}

async function copyInvite() {
  const url = buildGameInviteUrl('symbol-spy', currentRoom.id);
  try { await navigator.clipboard.writeText(url); toast.success('초대 링크를 복사했어요'); }
  catch { toast.error('복사에 실패했어요. 링크를 직접 복사해주세요.'); }
}

async function toggleReady() {
  const player = myPlayer();
  if (!player || !currentRoom) return;
  try {
    await updateDoc(doc(db, 'game_rooms', currentRoom.id, 'players', auth.currentUser.uid), { ready: !player.ready, updatedAt: serverTimestamp() });
  } catch (error) {
    toast.warn(error.message || '준비 상태 변경에 실패했어요');
  }
}

async function startSyncedRound() {
  if (!isRoomHost(currentRoom)) return;
  if (currentPlayers.length < 1) { toast.warn('참가자가 필요합니다.'); return; }
  const nextRound = Number(currentRoom.round || 0) + 1;
  const roundData = buildRoundData(currentPlayers, nextRound, Number(currentRoom.roundSeconds || 14));
  try {
    await Promise.all(currentPlayers.map(player => setDoc(doc(db, 'game_rooms', currentRoom.id, 'players', player.uid), {
      selectedSymbol: '',
      selectedCorrect: false,
      selectedAtMs: 0,
      ready: true,
      updatedAt: serverTimestamp(),
    }, { merge: true })));
    await updateDoc(doc(db, 'game_rooms', currentRoom.id), {
      status: 'playing',
      phase: 'playing',
      round: nextRound,
      roundData,
      log: `ROUND ${nextRound} 진행 중. 같은 심볼을 빠르게 찾으세요!`,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    toast.error(error.message || '라운드 시작에 실패했어요');
  }
}

async function selectRoomSymbol(symbol) {
  const player = myPlayer();
  if (!player || !currentRoom?.roundData || player.selectedSymbol) return;
  if (secondsLeft(currentRoom) <= 0) { toast.warn('시간이 종료됐어요.'); return; }
  const correct = symbol === currentRoom.roundData.common;
  const add = correct ? 100 + secondsLeft(currentRoom) * 5 : -15;
  try {
    await updateDoc(doc(db, 'game_rooms', currentRoom.id, 'players', auth.currentUser.uid), {
      selectedSymbol: symbol,
      selectedCorrect: correct,
      selectedAtMs: Date.now(),
      score: Math.max(0, Number(player.score || 0) + add),
      updatedAt: serverTimestamp(),
    });
    toast[correct ? 'success' : 'warn'](correct ? '정답입니다!' : '오답입니다.');
  } catch (error) {
    toast.error(error.message || '선택 저장에 실패했어요');
  }
}
