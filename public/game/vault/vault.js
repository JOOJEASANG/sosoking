import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const app = document.getElementById('game-app');
const shareButton = document.getElementById('share-room');
const toast = document.getElementById('toast');

const MAX_PLAYERS = 8;
const MAX_ROUNDS = 9;
const ROUND_SECONDS = 12;
const NORMAL_VALUES = [140, 190, 250, 320, 400, 500, 580];
const SPECIALS = ['gold', 'mystery', 'thief', 'comeback'];
const MYSTERY_EFFECTS = [
  { id: 'jackpot', emoji: '💎', label: '잭팟', delta: 850 },
  { id: 'bonus', emoji: '✨', label: '보너스', delta: 430 },
  { id: 'empty', emoji: '🫥', label: '텅 빈 금고', delta: 0 },
  { id: 'bomb', emoji: '💣', label: '폭탄', delta: -180 }
];

let roomId = '';
let room = null;
let players = [];
let answers = [];
let currentUid = '';
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeAnswers = null;
let timerId = null;
let toastId = null;

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastId);
  toastId = setTimeout(() => { toast.hidden = true; }, 2200);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

function normalizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 12);
}

function stopSubscriptions() {
  unsubscribeRoom?.();
  unsubscribePlayers?.();
  unsubscribeAnswers?.();
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  unsubscribeAnswers = null;
  clearInterval(timerId);
  timerId = null;
}

function setRoomUrl(nextRoomId) {
  const url = new URL(location.href);
  if (nextRoomId) url.searchParams.set('room', nextRoomId);
  else url.searchParams.delete('room');
  history.replaceState({}, '', url);
}

function inviteUrl() {
  return `${location.origin}/game/vault/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const url = inviteUrl();
  const data = {
    title: '소소킹 금고런 초대',
    text: `금고런 방 ${roomId}에서 한 판 붙자!`,
    url
  };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('초대 링크를 복사했습니다.');
  } catch {
    window.prompt('이 링크를 복사해서 보내주세요.', url);
  }
}

function currentRoundAnswers() {
  return answers.filter(item => Number(item.round) === Number(room?.round || 0) && item.kind === 'vault');
}

function playerByUid(uid) {
  return players.find(player => player.uid === uid);
}

function isHost() {
  return Boolean(room && currentUid && room.hostUid === currentUid);
}

function sortedPlayers() {
  return [...players].sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDiff) return scoreDiff;
    return Number(a.joinOrder || 0) - Number(b.joinOrder || 0);
  });
}

function playerListMarkup(showScores = false) {
  const source = showScores ? sortedPlayers() : [...players].sort((a, b) => Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
  return source.map((player, index) => `
    <li class="player-item">
      <span class="player-name">${escapeText(player.nickname || '플레이어')}${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}</span>
      ${showScores ? `<span class="player-score">${Number(player.score || 0).toLocaleString()}C ${Number(player.combo || 0) >= 2 ? `🔥${Number(player.combo)}콤보` : ''}</span>` : `<span class="seat-number">${index + 1}</span>`}
    </li>`).join('');
}

function roundMultiplier() {
  return Number(room?.round || 0) >= MAX_ROUNDS ? 2 : 1;
}

function buildVaults(roundNumber) {
  const normals = shuffle(NORMAL_VALUES).slice(0, 4).map((value, index) => ({
    id: `v${index + 1}`,
    kind: 'cash',
    emoji: '💼',
    title: `${value}C`,
    value
  }));
  const kind = pick(SPECIALS);
  let special;
  if (kind === 'gold') {
    special = { id: 'v5', kind, emoji: '👑', title: '황금', value: 720 };
  } else if (kind === 'mystery') {
    const effect = pick(MYSTERY_EFFECTS);
    special = { id: 'v5', kind, emoji: '❓', title: '???', effect: effect.id, value: effect.delta };
  } else if (kind === 'thief') {
    special = { id: 'v5', kind, emoji: '🥷', title: '도둑', value: 280 };
  } else {
    special = { id: 'v5', kind: 'comeback', emoji: '🚀', title: '역전', value: 220, comebackValue: 680 };
  }
  const cards = shuffle([...normals, special]).map((vault, index) => ({ ...vault, id: `v${index + 1}` }));
  if (roundNumber >= MAX_ROUNDS) return cards.map(vault => ({ ...vault, finalRound: true }));
  return cards;
}

function vaultById(id) {
  return (Array.isArray(room?.vaults) ? room.vaults : []).find(vault => vault.id === id);
}

function vaultCardMarkup(vault, selectedId = '') {
  const selected = selectedId === vault.id;
  let sub = '혼자 고르면 획득';
  if (vault.kind === 'mystery') sub = '열기 전엔 아무도 모름';
  if (vault.kind === 'thief') sub = '1등에게서 훔치기';
  if (vault.kind === 'comeback') sub = '꼴찌면 대박 보너스';
  if (vault.kind === 'gold') sub = '고액 · 충돌 주의';
  return `
    <button class="vault-card kind-${escapeText(vault.kind)}${selected ? ' is-selected' : ''}" type="button" data-vault="${escapeText(vault.id)}">
      <span class="vault-emoji">${escapeText(vault.emoji || '💼')}</span>
      <strong>${escapeText(vault.title || '')}</strong>
      <small>${escapeText(sub)}</small>
      ${selected ? '<em>선택 완료</em>' : ''}
    </button>`;
}

function renderLanding(prefilledCode = '') {
  stopSubscriptions();
  room = null;
  players = [];
  answers = [];
  shareButton.hidden = true;
  app.innerHTML = `
    <section class="panel landing-panel">
      <span class="kicker">ONE TAP PARTY GAME</span>
      <h1>💰 금고런</h1>
      <p class="lead">금고 하나만 고르세요. 혼자 고르면 먹고, 친구와 겹치면 둘 다 폭발합니다. 12초면 선택 끝.</p>
      <div class="rule-strip">
        <span>☝️ 한 번 클릭</span><span>💥 같은 금고 = 0</span><span>🔥 연속 성공 = 콤보</span><span>👑 마지막 2배</span>
      </div>
      <form id="create-room-form">
        <label class="field"><span>내 닉네임</span><input id="create-nickname" maxlength="12" autocomplete="nickname" placeholder="예: 재상" required></label>
        <div class="button-row"><button class="primary-button" type="submit">새 금고방 만들기</button></div>
      </form>
      <div class="divider"></div>
      <form id="join-room-form">
        <label class="field"><span>초대 코드</span><input id="join-code" value="${escapeText(prefilledCode)}" maxlength="6" autocomplete="off" placeholder="예: AB7K2Q" required></label>
        <label class="field"><span>내 닉네임</span><input id="join-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label>
        <div class="button-row"><button class="secondary-button" type="submit">초대받은 방 입장</button></div>
      </form>
    </section>`;
  document.getElementById('create-room-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void createRoom(document.getElementById('create-nickname').value);
  });
  document.getElementById('join-room-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void joinRoom(document.getElementById('join-code').value, document.getElementById('join-nickname').value);
  });
}

async function createRoom(nicknameValue) {
  const nickname = cleanNickname(nicknameValue);
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  const button = document.querySelector('#create-room-form button');
  if (button) button.disabled = true;
  try {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode();
      const snap = await getDoc(doc(db, 'game_rooms', candidate));
      if (!snap.exists()) { code = candidate; break; }
    }
    if (!code) throw new Error('room-code-exhausted');
    await setDoc(doc(db, 'game_rooms', code), {
      type: 'vault-run', status: 'lobby', hostUid: currentUid, maxPlayers: MAX_PLAYERS,
      round: 0, maxRounds: MAX_ROUNDS, roundState: 'waiting', roundSeconds: ROUND_SECONDS,
      vaults: [], lastResults: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid, nickname, score: 0, combo: 0, joinOrder: Date.now(), joinedAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error('create vault room failed', error);
    showToast('게임방을 만들지 못했습니다.');
    if (button) button.disabled = false;
  }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeRoomCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  const button = document.querySelector('#join-room-form button, #invite-join-form button');
  if (button) button.disabled = true;
  try {
    const roomRef = doc(db, 'game_rooms', code);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) throw new Error('room-not-found');
    const data = roomSnap.data();
    if (data.type !== 'vault-run') throw new Error('wrong-game');
    if (data.status !== 'lobby') throw new Error('game-started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [playersSnap, existing] = await Promise.all([getDocs(collection(db, 'game_rooms', code, 'players')), getDoc(playerRef)]);
    if (playersSnap.size >= MAX_PLAYERS && !existing.exists()) throw new Error('room-full');
    await setDoc(playerRef, {
      uid: currentUid, nickname,
      score: existing.exists() ? Number(existing.data().score || 0) : 0,
      combo: existing.exists() ? Number(existing.data().combo || 0) : 0,
      joinOrder: existing.exists() ? Number(existing.data().joinOrder || Date.now()) : Date.now(),
      joinedAt: existing.exists() ? existing.data().joinedAt || Timestamp.now() : Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error('join vault room failed', error);
    const message = error?.message === 'game-started' ? '이미 게임이 시작된 방입니다.' : error?.message === 'room-full' ? '이 방은 8명이 모두 들어왔습니다.' : '게임방에 입장하지 못했습니다.';
    showToast(message);
    if (button) button.disabled = false;
  }
}

async function ensureMembership(code) {
  const playerSnap = await getDoc(doc(db, 'game_rooms', code, 'players', currentUid));
  if (playerSnap.exists()) return true;
  renderJoinInvite(code, sessionStorage.getItem(`sosoking-game-nickname:${code}`) || '');
  return false;
}

function renderJoinInvite(code, savedNickname = '') {
  stopSubscriptions();
  shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">금고런 초대</span><h1>💰 한 자리 남았어?</h1><p class="lead">닉네임만 넣으면 바로 같은 금고방으로 들어갑니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div><form id="invite-join-form"><label class="field"><span>내 닉네임</span><input id="invite-nickname" maxlength="12" value="${escapeText(savedNickname)}" autocomplete="nickname" required></label><div class="button-row"><button class="primary-button" type="submit">금고방 입장</button></div></form></section>`;
  document.getElementById('invite-join-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void joinRoom(code, document.getElementById('invite-nickname').value);
  });
}

function subscribeRoom(code) {
  stopSubscriptions();
  roomId = code;
  shareButton.hidden = false;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snapshot => {
    if (!snapshot.exists()) { showToast('게임방이 종료되었습니다.'); setRoomUrl(''); renderLanding(); return; }
    room = { id: snapshot.id, ...snapshot.data() };
    renderCurrentState();
  }, error => { console.error('vault room subscription failed', error); renderError('게임방 정보를 불러오지 못했습니다.'); });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateRoundLiveStatus(); else renderCurrentState();
  });
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateRoundLiveStatus(); else renderCurrentState();
  });
}

function renderCurrentState() {
  if (!room) return;
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'playing' && room.roundState === 'open') return renderRound();
  if (room.status === 'playing' && room.roundState === 'reveal') return renderReveal();
  if (room.status === 'finished') return renderFinished();
  renderError('알 수 없는 게임 상태입니다.');
}

function renderLobby() {
  clearInterval(timerId); timerId = null;
  const canStart = isHost() && players.length >= 2;
  app.innerHTML = `<section class="panel"><span class="kicker">금고 대기실</span><h2>2명만 모여도 바로 시작</h2><p class="lead">9라운드. 매번 금고 하나만 클릭하면 됩니다. 같은 금고를 고른 사람끼리는 함께 터집니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div><div class="button-row two"><button class="secondary-button" id="invite-button" type="button">카톡으로 초대</button><button class="secondary-button" id="copy-code" type="button">코드 복사</button></div><ul class="player-list">${playerListMarkup(false)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="start-game" type="button" ${canStart ? '' : 'disabled'}>금고런 시작 (${players.length}/${MAX_PLAYERS})</button></div>` : '<p class="lobby-note">방장이 시작할 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('invite-button')?.addEventListener('click', shareRoom);
  document.getElementById('copy-code')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(roomId); showToast('초대 코드를 복사했습니다.'); } catch { showToast(`초대 코드: ${roomId}`); } });
  document.getElementById('start-game')?.addEventListener('click', startGame);
}

async function startGame() {
  if (!isHost() || players.length < 2) return;
  const batch = writeBatch(db);
  players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, combo: 0, updatedAt: Timestamp.now() }));
  batch.update(doc(db, 'game_rooms', roomId), { status: 'playing', round: 1, roundState: 'open', vaults: buildVaults(1), lastResults: [], roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now() });
  try { await batch.commit(); } catch (error) { console.error('start vault run failed', error); showToast('게임을 시작하지 못했습니다.'); }
}

function remainingSeconds() {
  const millis = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((millis - Date.now()) / 1000));
}
function allSubmitted() { return players.length >= 2 && currentRoundAnswers().length >= players.length; }
function canRevealNow() { return remainingSeconds() <= 0 || allSubmitted(); }

function renderRound() {
  const mine = currentRoundAnswers().find(item => item.uid === currentUid);
  const myPlayer = playerByUid(currentUid);
  app.innerHTML = `<section class="panel vault-panel"><div class="round-head"><div><span class="round-label">ROUND ${Number(room.round)} / ${MAX_ROUNDS}</span><div class="mini-score">내 금고액 <strong>${Number(myPlayer?.score || 0).toLocaleString()}C</strong>${Number(myPlayer?.combo || 0) >= 2 ? ` · 🔥 ${Number(myPlayer.combo)}콤보` : ''}</div></div><span class="timer" id="round-timer">${remainingSeconds()}</span></div>${roundMultiplier() > 1 ? '<div class="final-banner">👑 FINAL RUN · 이번 라운드 보상 2배</div>' : ''}<h2 class="pick-title">어느 금고를 열까?</h2><p class="round-copy">다른 사람과 겹치지 않을 것 같은 금고 하나를 고르세요. 마감 전에는 바꿀 수 있습니다.</p><div class="vault-grid" id="vault-grid">${(room.vaults || []).map(vault => vaultCardMarkup(vault, mine?.text || '')).join('')}</div><div class="status-line" id="submitted-count">${mine ? '🔒 선택 완료 · ' : ''}현재 ${currentRoundAnswers().length}/${players.length}명 선택</div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal-round" type="button" ${canRevealNow() ? '' : 'disabled'}>${allSubmitted() ? '전원 선택! 금고 열기' : '선택 종료 후 금고 열기'}</button></div>` : ''}</section>`;
  document.querySelectorAll('[data-vault]').forEach(button => button.addEventListener('click', () => void chooseVault(button.dataset.vault)));
  document.getElementById('reveal-round')?.addEventListener('click', revealRound);
  runTimer();
}

async function chooseVault(vaultId) {
  if (!room || room.roundState !== 'open' || remainingSeconds() <= 0 || !vaultById(vaultId)) return;
  const player = playerByUid(currentUid);
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `${room.round}-${currentUid}`), { uid: currentUid, nickname: player?.nickname || '플레이어', round: Number(room.round), kind: 'vault', text: vaultId, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    updateRoundLiveStatus();
  } catch (error) { console.error('choose vault failed', error); showToast('금고 선택을 저장하지 못했습니다.'); }
}

function updateRoundLiveStatus() {
  if (!room || room.roundState !== 'open') return;
  const mine = currentRoundAnswers().find(item => item.uid === currentUid);
  document.querySelectorAll('[data-vault]').forEach(button => {
    button.classList.toggle('is-selected', button.dataset.vault === mine?.text);
    const old = button.querySelector('em'); if (old) old.remove();
    if (button.dataset.vault === mine?.text) { const tag = document.createElement('em'); tag.textContent = '선택 완료'; button.append(tag); }
  });
  const count = document.getElementById('submitted-count');
  if (count) count.textContent = `${mine ? '🔒 선택 완료 · ' : ''}현재 ${currentRoundAnswers().length}/${players.length}명 선택`;
  const reveal = document.getElementById('reveal-round');
  if (reveal) { reveal.disabled = !canRevealNow(); reveal.textContent = allSubmitted() ? '전원 선택! 금고 열기' : remainingSeconds() <= 0 ? '금고 열고 결과 공개' : '선택 종료 후 금고 열기'; }
}

function runTimer() {
  clearInterval(timerId);
  const tick = () => {
    const seconds = remainingSeconds();
    const timer = document.getElementById('round-timer');
    if (timer) { timer.textContent = String(seconds); timer.classList.toggle('is-urgent', seconds <= 4); }
    if (seconds <= 0) { document.querySelectorAll('[data-vault]').forEach(button => { button.disabled = true; }); updateRoundLiveStatus(); clearInterval(timerId); timerId = null; }
  };
  tick(); timerId = setInterval(tick, 400);
}

function startScoreSnapshot() {
  const scores = players.map(player => Number(player.score || 0));
  return { min: scores.length ? Math.min(...scores) : 0, max: scores.length ? Math.max(...scores) : 0 };
}
function resultFor(uid, label, delta, combo, vaultId, status = 'success') {
  const player = playerByUid(uid);
  return { uid, nickname: player?.nickname || '플레이어', vaultId, label, delta, combo, status };
}
function mysteryMeta(vault) { return MYSTERY_EFFECTS.find(effect => effect.id === vault.effect) || MYSTERY_EFFECTS[2]; }

async function revealRound() {
  if (!isHost() || room.roundState !== 'open' || !canRevealNow()) return;
  const selections = currentRoundAnswers();
  const groups = new Map();
  selections.forEach(answer => { const list = groups.get(answer.text) || []; list.push(answer.uid); groups.set(answer.text, list); });
  const snapshot = startScoreSnapshot();
  const multiplier = roundMultiplier();
  const deltas = new Map(players.map(player => [player.uid, 0]));
  const combos = new Map(players.map(player => [player.uid, Number(player.combo || 0)]));
  const results = [];
  const handled = new Set();

  for (const player of players) {
    const answer = selections.find(item => item.uid === player.uid);
    if (!answer) { combos.set(player.uid, 0); results.push(resultFor(player.uid, '시간 초과 · 선택 없음', 0, 0, '', 'miss')); handled.add(player.uid); }
  }

  for (const vault of room.vaults || []) {
    const uids = groups.get(vault.id) || [];
    if (!uids.length) continue;
    if (uids.length > 1) {
      uids.forEach(uid => { combos.set(uid, 0); results.push(resultFor(uid, `💥 ${uids.length}명 충돌 · 금고 폭발`, 0, 0, vault.id, 'collision')); handled.add(uid); });
      continue;
    }
    const uid = uids[0];
    const player = playerByUid(uid);
    let base = Number(vault.value || 0);
    let label = `${vault.emoji || '💼'} ${vault.title || '금고'} 성공`;
    let status = 'success';
    if (vault.kind === 'comeback') {
      const isLast = Number(player?.score || 0) === snapshot.min && snapshot.min < snapshot.max;
      base = isLast ? Number(vault.comebackValue || 680) : Number(vault.value || 220);
      label = isLast ? '🚀 꼴찌 역전 보너스 발동' : '🚀 역전 금고 기본 보상';
    } else if (vault.kind === 'mystery') {
      const effect = mysteryMeta(vault); base = Number(effect.delta || 0); label = `${effect.emoji} 미스터리 → ${effect.label}`; status = base > 0 ? 'success' : base < 0 ? 'bad' : 'empty';
    } else if (vault.kind === 'thief') {
      const leaders = sortedPlayers().filter(candidate => Number(candidate.score || 0) === snapshot.max && candidate.uid !== uid);
      const victim = leaders[0];
      if (victim) {
        const steal = Math.min(Number(vault.value || 280) * multiplier, Number(victim.score || 0));
        deltas.set(victim.uid, (deltas.get(victim.uid) || 0) - steal);
        base = steal / multiplier;
        label = `🥷 ${victim.nickname}에게서 ${steal.toLocaleString()}C 훔침`;
      } else { base = 120; label = '🥷 훔칠 1등이 없어 비상금 획득'; }
    }
    let delta = base * multiplier;
    let nextCombo = Number(combos.get(uid) || 0);
    if (delta > 0 || vault.kind === 'thief') {
      nextCombo += 1;
      const comboBonus = nextCombo >= 2 ? Math.min(300, (nextCombo - 1) * 100) : 0;
      if (comboBonus) { delta += comboBonus; label += ` · 🔥 콤보 +${comboBonus}C`; }
    } else nextCombo = 0;
    deltas.set(uid, (deltas.get(uid) || 0) + delta);
    combos.set(uid, nextCombo);
    results.push(resultFor(uid, label, delta, nextCombo, vault.id, status));
    handled.add(uid);
  }

  players.forEach(player => { if (!handled.has(player.uid)) { combos.set(player.uid, 0); results.push(resultFor(player.uid, '선택 처리 없음', 0, 0, '', 'miss')); } });
  const batch = writeBatch(db);
  players.forEach(player => {
    const score = Math.max(0, Number(player.score || 0) + Number(deltas.get(player.uid) || 0));
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score, combo: Number(combos.get(player.uid) || 0), updatedAt: Timestamp.now() });
  });
  batch.update(doc(db, 'game_rooms', roomId), { roundState: 'reveal', lastResults: results, updatedAt: Timestamp.now() });
  try { await batch.commit(); } catch (error) { console.error('reveal vault round failed', error); showToast('결과를 공개하지 못했습니다.'); }
}

function renderReveal() {
  clearInterval(timerId); timerId = null;
  const results = Array.isArray(room.lastResults) ? room.lastResults : [];
  const rows = results.map(result => {
    const delta = Number(result.delta || 0); const cls = delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral'; const deltaText = delta > 0 ? `+${delta.toLocaleString()}C` : `${delta.toLocaleString()}C`;
    return `<li class="result-item vault-result ${escapeText(result.status || '')}"><span><strong>${escapeText(result.nickname)}</strong><small>${escapeText(result.label)}</small></span><span class="result-tag ${cls}">${deltaText}</span></li>`;
  }).join('');
  const lastRound = Number(room.round || 0) >= MAX_ROUNDS;
  app.innerHTML = `<section class="panel"><span class="kicker">ROUND ${Number(room.round)} RESULT</span><h2>${lastRound ? '👑 마지막 금고 결과' : '🔓 금고 개봉!'}</h2><ul class="result-list">${rows}</ul><div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="next-round" type="button">${lastRound ? '최종 순위 보기' : '다음 금고 열기'}</button></div>` : '<p class="lobby-note">방장이 다음 라운드를 열 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('next-round')?.addEventListener('click', nextRound);
}

async function nextRound() {
  if (!isHost() || room.roundState !== 'reveal') return;
  const current = Number(room.round || 0);
  if (current >= MAX_ROUNDS) {
    try { await updateDoc(doc(db, 'game_rooms', roomId), { status: 'finished', updatedAt: Timestamp.now() }); } catch (error) { console.error('finish vault run failed', error); showToast('최종 결과로 넘어가지 못했습니다.'); }
    return;
  }
  const next = current + 1;
  try { await updateDoc(doc(db, 'game_rooms', roomId), { round: next, roundState: 'open', vaults: buildVaults(next), lastResults: [], roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now() }); } catch (error) { console.error('open next vault round failed', error); showToast('다음 라운드를 열지 못했습니다.'); }
}

function renderFinished() {
  clearInterval(timerId);
  const ranking = sortedPlayers();
  const medals = ['👑', '🥈', '🥉'];
  app.innerHTML = `<section class="panel final-panel"><span class="kicker">RUN COMPLETE</span><h1>🏆 금고왕은 ${escapeText(ranking[0]?.nickname || '플레이어')}</h1><p class="lead">충돌을 피하고 가장 많은 코인을 챙긴 사람이 승리합니다.</p><ol class="ranking">${ranking.map((player, index) => `<li class="rank-item ${index === 0 ? 'winner' : ''}"><span class="rank-number">${medals[index] || index + 1}</span><span class="rank-name">${escapeText(player.nickname)}</span><span class="rank-score">${Number(player.score || 0).toLocaleString()}C</span></li>`).join('')}</ol>${isHost() ? '<div class="button-row"><button class="primary-button" id="restart-game" type="button">같은 멤버로 한 판 더</button></div>' : '<p class="lobby-note">방장이 다시 시작하면 같은 방에서 바로 한 판 더 할 수 있습니다.</p>'}<div class="button-row"><a class="secondary-link" href="/game/">소소킹 플레이 홈</a></div></section>`;
  document.getElementById('restart-game')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  try {
    const answersSnap = await getDocs(collection(db, 'game_rooms', roomId, 'answers'));
    const batch = writeBatch(db);
    answersSnap.docs.forEach(answer => batch.delete(answer.ref));
    players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, combo: 0, updatedAt: Timestamp.now() }));
    batch.update(doc(db, 'game_rooms', roomId), { status: 'lobby', round: 0, roundState: 'waiting', vaults: [], lastResults: [], updatedAt: Timestamp.now() });
    await batch.commit();
  } catch (error) { console.error('restart vault run failed', error); showToast('새 게임을 준비하지 못했습니다.'); }
}

function renderError(message) {
  clearInterval(timerId);
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-link" href="/game/vault/">처음 화면으로</a></div></section>`;
}

async function boot() {
  try {
    await initAuth();
    currentUid = auth.currentUser?.uid || '';
    if (!currentUid) throw new Error('auth-not-ready');
    const code = normalizeRoomCode(new URL(location.href).searchParams.get('room'));
    if (!code) { renderLanding(); return; }
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== 'vault-run') { renderLanding(code); showToast('금고런 방을 찾지 못했습니다.'); return; }
    roomId = code;
    const member = await ensureMembership(code);
    if (member) subscribeRoom(code);
  } catch (error) { console.error('vault run boot failed', error); renderError('금고런을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.'); }
}

shareButton.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
void boot();
