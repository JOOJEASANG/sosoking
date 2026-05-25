import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../../router.js';
import { toast } from '../../components/toast.js';
import { ensureGameGuestAuth } from '../../game-guest-access.js';
import { buildGameInviteUrl, gamePlayerName, isRoomHost, makeRoomCode } from '../common.js';

let unsubscribeRoom = null;
let unsubscribePlayers = null;
let currentRoom = null;
let currentPlayers = [];

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function pageEl() { return document.getElementById('page-content'); }
function myPlayer() { return currentPlayers.find(p => p.uid === auth.currentUser?.uid) || null; }

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
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  currentRoom = null;
  currentPlayers = [];
}

export async function renderSymbolSpyRoom(roomId) {
  destroySymbolSpyRoom();
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
}

function drawRoom() {
  const el = pageEl();
  if (!el || !currentRoom) return;
  const joined = !!myPlayer();
  const host = isRoomHost(currentRoom);
  const inviteUrl = buildGameInviteUrl('symbol-spy', currentRoom.id);
  el.innerHTML = `
    <section class="symbol-spy symbol-spy--room">
      <header class="symbol-spy__topbar">
        <button class="symbol-spy__ghost" type="button" data-room-back>← 심볼스파이</button>
        <div class="symbol-spy__brand"><span>⚡</span><b>${esc(currentRoom.title || '심볼스파이')}</b><small>방 코드 ${esc(currentRoom.code || '')}</small></div>
        <div class="symbol-spy__score"><span>${currentPlayers.length}/${Number(currentRoom.maxPlayers || 6)}명</span><span>${esc(currentRoom.phase || 'lobby')}</span></div>
      </header>
      <div class="symbol-room">
        <article class="symbol-room__hero">
          <div class="symbol-vote__badge">친구 초대 대기방</div>
          <h1>같이 할 참가자를 모으세요</h1>
          <p>${esc(currentRoom.log || '초대 링크를 공유하고 참가자를 모아주세요.')}</p>
          <div class="symbol-room__invite"><input class="form-input" readonly value="${esc(inviteUrl)}"><button class="symbol-spy__start" type="button" data-copy-room>초대 링크 복사</button></div>
          <div class="symbol-room__actions">
            ${joined ? '<button class="symbol-spy__ghost" type="button" data-ready-room>준비 상태 변경</button>' : '<button class="symbol-spy__start" type="button" data-join-room>방 참가하기</button>'}
            ${host ? '<button class="symbol-spy__start" type="button" data-host-ready>라운드 동기화 준비</button>' : ''}
          </div>
        </article>
        <article class="symbol-room__players">
          <h2>참가자</h2>
          <div class="symbol-room__player-list">${currentPlayers.map(player => `<div class="symbol-room__player"><span>${player.uid === currentRoom.hostId ? '👑' : '⚡'}</span><b>${esc(player.name || '게스트')}</b><small>${player.ready ? '준비 완료' : '대기 중'}</small></div>`).join('') || '<div class="symbol-room__none">아직 참가자가 없습니다.</div>'}</div>
          <div class="symbol-room__hint">이번 단계는 방 생성/초대/참가자 동기화입니다. 다음 단계에서 실시간 라운드를 연결합니다.</div>
        </article>
      </div>
    </section>`;
  bindRoomEvents();
}

function bindRoomEvents() {
  document.querySelector('[data-room-back]')?.addEventListener('click', () => navigate('/game/symbol-spy'));
  document.querySelector('[data-copy-room]')?.addEventListener('click', copyInvite);
  document.querySelector('[data-join-room]')?.addEventListener('click', async () => {
    try { await joinSymbolSpyRoom(currentRoom); toast.success('방에 참가했어요'); }
    catch (error) { toast.warn(error.message || '참가에 실패했어요'); }
  });
  document.querySelector('[data-ready-room]')?.addEventListener('click', toggleReady);
  document.querySelector('[data-host-ready]')?.addEventListener('click', hostReady);
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

async function hostReady() {
  if (!isRoomHost(currentRoom)) return;
  if (currentPlayers.length < 2) { toast.warn('2명 이상 모이면 시작할 수 있어요.'); return; }
  try {
    await updateDoc(doc(db, 'game_rooms', currentRoom.id), {
      status: 'ready',
      phase: 'round-sync-ready',
      log: '라운드 동기화 준비 완료. 다음 업데이트에서 실시간 심볼판이 연결됩니다.',
      updatedAt: serverTimestamp(),
    });
    toast.success('라운드 동기화 준비 상태로 변경했어요');
  } catch (error) {
    toast.error(error.message || '방 상태 변경에 실패했어요');
  }
}
