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
const ROOM_SCHEMA_ROUNDS = 24;
const MAX_TOTAL_TURNS = 48;
const ROLL_SECONDS = 18;
const LANDING_SECONDS = 5;
const EVENT_SECONDS = 24;
const INSTANT_EVENT_SECONDS = 6;
const CHOSUNG_SECONDS = 32;
const RESULT_DELAY = 8000;
const MIN_EVENT_DWELL = 6000;
const CROWN_TURN_BONUS = 60;
const CROWN_FINAL_BONUS = 600;
const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_TARGETS = ['ㄱㅅ','ㄱㅈ','ㄴㅁ','ㄷㄹ','ㅁㅅ','ㅂㄹ','ㅅㄱ','ㅇㅅ','ㅇㅈ','ㅈㅁ','ㅎㄱ','ㄱㄱㅁ','ㄴㄹㅂ','ㄷㄹㅁ','ㅁㅋㄹ','ㅅㄴㅇ','ㅇㄹㅈ','ㅈㄷㄱ','ㅊㅋㄹ'];

const TILES = [
  { kind: 'start', icon: '🚩', name: '출발', sub: '+100C' },
  { kind: 'coin', icon: '💰', name: '코인광장', sub: '+200C' },
  { kind: 'vault', icon: '🔐', name: '금고런', sub: '전원 미니게임' },
  { kind: 'property', icon: '🏦', name: '금고 연구소', sub: '영역 점령' },
  { kind: 'caught', icon: '🎯', name: '딱걸렸어', sub: '전원 미니게임' },
  { kind: 'steal', icon: '🥷', name: '도둑골목', sub: '1등 코인 강탈' },
  { kind: 'crown', icon: '👑', name: '왕관광장', sub: '왕관 획득' },
  { kind: 'greed', icon: '🧨', name: '욕심계단', sub: '안전 vs 도전' },
  { kind: 'property', icon: '🏢', name: '욕심 타워', sub: '영역 점령' },
  { kind: 'tax', icon: '💸', name: '세금폭탄', sub: '-150C' },
  { kind: 'chosung', icon: '💣', name: '초성 폭탄', sub: '전원 미니게임' },
  { kind: 'lucky', icon: '🎁', name: '행운상자', sub: '랜덤 보상' },
  { kind: 'minority', icon: '🌗', name: '소수파 대결', sub: '적게 고른 편 승리' },
  { kind: 'vault', icon: '💎', name: '황금금고', sub: '전원 미니게임' },
  { kind: 'property', icon: '🏟️', name: '숫자 광장', sub: '영역 점령' },
  { kind: 'caught', icon: '🎯', name: '눈치광장', sub: '전원 미니게임' },
  { kind: 'revenge', icon: '😈', name: '복수찬스', sub: '꼴찌 지원' },
  { kind: 'greed', icon: '🔥', name: '불타는 계단', sub: '안전 vs 도전' },
  { kind: 'crown', icon: '👑', name: '왕관쟁탈', sub: '왕관 교체' },
  { kind: 'property', icon: '🏭', name: '폭탄 공장', sub: '영역 점령' },
  { kind: 'chaos', icon: '🌪️', name: '카오스홀', sub: '대형 랜덤 사건' },
  { kind: 'chosung', icon: '⚡', name: '번개 초성', sub: '전원 미니게임' },
  { kind: 'minority', icon: '🌙', name: '달빛 편가르기', sub: '소수파 보너스' },
  { kind: 'throne', icon: '🏆', name: '왕좌', sub: '왕관 + 보너스' }
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
let hostBusy = false;
let lastRenderedKey = '';

function esc(value) {
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
  toastId = setTimeout(() => { toast.hidden = true; }, 2600);
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 12);
}

function rand(max) {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return data[0] % max;
}

function pick(list) {
  return list[rand(list.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isHost() {
  return Boolean(room && currentUid && room.hostUid === currentUid);
}

function turnLimit() {
  if (Number(room?.totalTurns) > 0) return Number(room.totalTurns);
  if (players.length >= 2) return clamp(players.length * 7, 18, MAX_TOTAL_TURNS);
  return ROOM_SCHEMA_ROUNDS;
}

function isChaos() {
  return Number(room?.round || 0) > turnLimit() - 6;
}

function multiplier() {
  return isChaos() ? 2 : 1;
}

function tileAt(index) {
  const normalized = ((Number(index) || 0) % TILES.length + TILES.length) % TILES.length;
  return TILES[normalized];
}

function playerByUid(uid) {
  return players.find(player => player.uid === uid);
}

function orderedPlayers() {
  return [...players].sort((a, b) => Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function rankedPlayers() {
  return [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function phaseAgeMs() {
  const start = room?.phaseStartedAt?.toMillis?.() || room?.updatedAt?.toMillis?.() || Date.now();
  return Math.max(0, Date.now() - start);
}

function currentAnswers(kind) {
  return answers.filter(answer => Number(answer.round) === Number(room?.round || 0) && answer.kind === kind);
}

function answerOf(uid, kind) {
  return currentAnswers(kind).find(answer => answer.uid === uid);
}

function allPlayersAnswered(kind) {
  return players.length >= 2 && currentAnswers(kind).length >= players.length;
}

function nextActiveUid() {
  const list = orderedPlayers();
  if (!list.length) return '';
  const index = Math.max(0, list.findIndex(player => player.uid === room?.activeUid));
  return list[(index + 1) % list.length].uid;
}

function initials(value) {
  return Array.from(String(value || '').replace(/\s+/g, '')).map(char => {
    if (INITIALS.includes(char)) return char;
    const offset = char.charCodeAt(0) - 0xac00;
    return offset >= 0 && offset <= 11171 ? INITIALS[Math.floor(offset / 588)] : '';
  }).join('');
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

function setRoomUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState({}, '', url);
}

function inviteUrl() {
  return `${location.origin}/game/world/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const data = {
    title: '소소킹 월드 초대',
    text: `🎲 소소킹 월드 ${roomId} 방에서 같이 놀자!`,
    url: inviteUrl()
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
    await navigator.clipboard.writeText(data.url);
    showToast('초대 링크를 복사했습니다.');
  } catch {
    window.prompt('이 링크를 복사해서 보내주세요.', data.url);
  }
}

function phaseIndex() {
  if (room?.roundState === 'reveal' || room?.worldPhase === 'reveal') return 3;
  if (room?.worldPhase === 'event') return 2;
  if (room?.worldPhase === 'landing') return 1;
  return 0;
}

function phaseProgressMarkup() {
  const active = phaseIndex();
  const labels = [
    ['①', '주사위'],
    ['②', '이동'],
    ['③', '칸 행동'],
    ['④', '결과']
  ];
  return `<div class="world-phase-bar">${labels.map(([num, label], index) => `
    <div class="world-phase-step ${index === active ? 'is-active' : ''} ${index < active ? 'is-done' : ''}">
      <span>${num}</span><strong>${label}</strong>
    </div>`).join('')}</div>`;
}

function boardMarkup() {
  const owners = room?.ownedTiles || {};
  const activePosition = Number(playerByUid(room?.activeUid)?.position ?? -1);
  const eventTile = Number(room?.eventTile ?? -1);
  return TILES.map((tile, index) => {
    const pawns = players.filter(player => Number(player.position || 0) === index).map(player => `
      <span class="world-pawn ${player.uid === room?.crownUid ? 'has-crown' : ''}" title="${esc(player.nickname)}">${esc((player.nickname || '?').slice(0, 1))}</span>`).join('');
    const ownerUid = owners[String(index)];
    const owner = playerByUid(ownerUid);
    const isActive = activePosition === index;
    const isEvent = eventTile === index && ['landing', 'event', 'reveal'].includes(room?.worldPhase);
    return `<div class="world-tile ${isActive ? 'is-active' : ''} ${isEvent ? 'is-event' : ''} ${isChaos() ? 'is-chaos' : ''}">
      <span class="tile-no">${index}</span>
      ${owner ? `<span class="world-owner">${esc(owner.nickname)} 소유</span>` : ''}
      <span class="tile-icon">${tile.icon}</span>
      <strong>${esc(tile.name)}</strong>
      <small>${esc(tile.sub)}</small>
      <div class="world-pawns">${pawns}</div>
    </div>`;
  }).join('');
}

function rankMarkup() {
  return rankedPlayers().map((player, index) => `
    <li>
      <strong>${index + 1}. ${player.uid === room?.crownUid ? '👑 ' : ''}${esc(player.nickname || '플레이어')}</strong>
      <span>${Number(player.score || 0).toLocaleString()}C</span>
    </li>`).join('');
}

function statusSide() {
  const active = playerByUid(room?.activeUid);
  const crown = playerByUid(room?.crownUid);
  return `<aside class="world-side">
    <section class="world-status">
      <h3>🎙️ 게임마스터</h3>
      <span class="world-turn-badge">전체 ${Number(room?.round || 0)} / ${turnLimit()}턴</span>
      ${active ? `<p><b>${esc(active.nickname)}</b> 차례 · ${Number(active.score || 0).toLocaleString()}C</p>` : ''}
      ${crown ? `<div class="world-crown-status">👑 현재 왕관 <b>${esc(crown.nickname)}</b><small>자기 차례 +${CROWN_TURN_BONUS}C · 최종 +${CROWN_FINAL_BONUS}C</small></div>` : '<div class="world-crown-status muted">👑 아직 왕관 주인 없음</div>'}
      ${isChaos() ? '<div class="chaos-banner">🚨 FINAL CHAOS · 보상 2배</div>' : ''}
      ${isHost() ? `<div class="world-action-row">
        <button class="secondary-button" id="world-auto" type="button">${room?.autoMode === false ? '⏭ 자동 OFF' : '⏭ 자동 ON'}</button>
        <button class="secondary-button" id="world-pause" type="button">${room?.paused ? '▶ 계속' : '⏸ 잠시멈춤'}</button>
        ${room?.autoMode === false ? '<button class="secondary-button" id="world-step" type="button">지금 처리</button>' : ''}
      </div>` : `<div class="world-auto-note">${room?.paused ? '⏸ 방장이 진행을 잠시 멈췄습니다.' : '🎙️ 단계별 자동 진행 중입니다.'}</div>`}
    </section>
    <section class="world-rank"><h3>현재 순위</h3><ul class="world-rank-list">${rankMarkup()}</ul></section>
  </aside>`;
}

function wireHostControls() {
  document.getElementById('world-auto')?.addEventListener('click', () => void updateDoc(doc(db, 'game_rooms', roomId), {
    autoMode: room?.autoMode === false,
    updatedAt: Timestamp.now()
  }));
  document.getElementById('world-pause')?.addEventListener('click', async () => {
    const nextPaused = !room?.paused;
    const pauseRemaining = Math.max(remainingSeconds(), 5);
    await updateDoc(doc(db, 'game_rooms', roomId), nextPaused ? {
      paused: true,
      pauseRemaining,
      updatedAt: Timestamp.now()
    } : {
      paused: false,
      roundEndsAt: Timestamp.fromMillis(Date.now() + Math.max(5, Number(room?.pauseRemaining || 5)) * 1000),
      phaseStartedAt: Timestamp.now(),
      pauseRemaining: 0,
      updatedAt: Timestamp.now()
    });
  });
  document.getElementById('world-step')?.addEventListener('click', () => void driveHost(true));
}

function renderLanding(prefilled = '') {
  stopSubscriptions();
  room = null;
  players = [];
  answers = [];
  shareButton.hidden = true;
  app.innerHTML = `<section class="panel world-hero">
    <span class="kicker">SOSOKING WORLD v2</span>
    <h1>🎲 소소킹 월드</h1>
    <p class="lead">이번에는 빨리 넘기지 않습니다. <b>주사위 → 이동 → 칸 설명 → 선택 → 결과</b> 순서로 한 단계씩 보여줍니다.</p>
    <div class="rule-strip"><span>👥 2~8명</span><span>🎲 주사위 선택</span><span>🌗 소수파 대결</span><span>👑 왕관 쟁탈</span></div>
    <details class="world-guide" open>
      <summary>📖 처음 하는 사람용 30초 설명</summary>
      <div class="world-guide-body">
        <b>① 내 차례:</b> 안전 주사위(1~6) 또는 승부 주사위(1~8)를 누릅니다.<br>
        <b>② 이동 후:</b> 어디에 도착했는지 5초 동안 먼저 보여줍니다.<br>
        <b>③ 칸 행동:</b> 화면 가운데 ‘지금 할 일’만 보면 됩니다. 선택형은 버튼만 누르면 됩니다.<br>
        <b>④ 왕관:</b> 왕관 보유자는 자기 차례마다 +${CROWN_TURN_BONUS}C, 게임 종료 때 +${CROWN_FINAL_BONUS}C입니다.<br>
        <b>⑤ 게임 길이:</b> 기본은 한 사람당 약 7번 움직입니다. 방장이 짧게 모드로 줄일 수도 있습니다.
      </div>
    </details>
    <form id="create-room-form">
      <label class="field"><span>내 닉네임</span><input id="create-nickname" maxlength="12" autocomplete="nickname" placeholder="예: 주사위왕" required></label>
      <div class="button-row"><button class="primary-button" type="submit">새 월드 만들기</button></div>
    </form>
    <div class="divider"></div>
    <form id="join-room-form">
      <label class="field"><span>초대 코드</span><input id="join-code" value="${esc(prefilled)}" maxlength="6" placeholder="예: AB7K2Q" required></label>
      <label class="field"><span>내 닉네임</span><input id="join-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label>
      <div class="button-row"><button class="secondary-button" type="submit">초대받은 월드 입장</button></div>
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
  try {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode();
      const snapshot = await getDoc(doc(db, 'game_rooms', candidate));
      if (!snapshot.exists()) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error('code');
    await setDoc(doc(db, 'game_rooms', code), {
      type: 'sosoking-world',
      status: 'lobby',
      hostUid: currentUid,
      maxPlayers: MAX_PLAYERS,
      round: 0,
      maxRounds: ROOM_SCHEMA_ROUNDS,
      totalTurns: 0,
      pace: 'standard',
      roundState: 'waiting',
      worldPhase: 'waiting',
      activeUid: '',
      crownUid: '',
      ownedTiles: {},
      autoMode: true,
      paused: false,
      pauseRemaining: 0,
      lastResults: [],
      lastEvent: '',
      eventKind: '',
      eventTarget: '',
      eventTile: -1,
      lastDice: 0,
      rollMode: '',
      rollPenalty: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid,
      nickname,
      score: 0,
      position: 0,
      joinOrder: Date.now(),
      joinedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error(error);
    showToast('월드를 만들지 못했습니다.');
  }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    const roomSnapshot = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnapshot.exists() || roomSnapshot.data().type !== 'sosoking-world') throw new Error('not-found');
    if (roomSnapshot.data().status !== 'lobby') throw new Error('started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [existing, list] = await Promise.all([
      getDoc(playerRef),
      getDocs(collection(db, 'game_rooms', code, 'players'))
    ]);
    if (list.size >= MAX_PLAYERS && !existing.exists()) throw new Error('full');
    await setDoc(playerRef, {
      uid: currentUid,
      nickname,
      score: 0,
      position: 0,
      joinOrder: existing.exists() ? Number(existing.data().joinOrder || Date.now()) : Date.now(),
      joinedAt: existing.exists() ? existing.data().joinedAt || Timestamp.now() : Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error(error);
    showToast(error?.message === 'started' ? '이미 시작된 월드입니다.' : error?.message === 'full' ? '8명이 모두 들어왔습니다.' : '월드에 입장하지 못했습니다.');
  }
}

async function ensureMembership(code) {
  const snapshot = await getDoc(doc(db, 'game_rooms', code, 'players', currentUid));
  if (snapshot.exists()) return true;
  renderInviteJoin(code, sessionStorage.getItem(`sosoking-game-nickname:${code}`) || '');
  return false;
}

function renderInviteJoin(code, saved = '') {
  stopSubscriptions();
  shareButton.hidden = true;
  app.innerHTML = `<section class="panel world-hero">
    <span class="kicker">WORLD INVITE</span><h1>🎲 소소킹 월드 초대</h1>
    <p class="lead">빠르게 넘어가지 않는 v2 월드입니다. 화면의 ‘지금 할 일’만 따라가면 됩니다.</p>
    <div class="room-code"><small>초대 코드</small><strong>${esc(code)}</strong></div>
    <form id="invite-join-form"><label class="field"><span>내 닉네임</span><input id="invite-nickname" maxlength="12" value="${esc(saved)}" required></label><div class="button-row"><button class="primary-button" type="submit">월드 입장</button></div></form>
  </section>`;
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
    if (!snapshot.exists()) return renderLanding();
    room = { id: snapshot.id, ...snapshot.data() };
    renderCurrent();
  }, error => {
    console.error(error);
    showToast('월드를 불러오지 못했습니다.');
  });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderCurrent();
  });
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderCurrent();
  });
}

function renderCurrent() {
  if (!room) return;
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'finished') return renderFinished();
  renderPlaying();
}

function estimatedTurns() {
  const standard = clamp(players.length * 7, 18, MAX_TOTAL_TURNS);
  const quick = clamp(players.length * 4, 12, 32);
  return { standard, quick };
}

function renderLobby() {
  clearInterval(timerId);
  const estimate = estimatedTurns();
  const pace = room?.pace === 'quick' ? 'quick' : 'standard';
  app.innerHTML = `<section class="panel">
    <span class="kicker">WORLD LOBBY · v2</span>
    <h2>2명 이상 모이면 출발</h2>
    <p class="lead">이번 버전은 한 단계씩 설명하고, 기본 모드는 <b>한 사람당 약 7번</b> 움직입니다.</p>
    <div class="room-code"><small>자동 생성 초대코드</small><strong>${esc(roomId)}</strong></div>
    <div class="button-row two"><button class="secondary-button" id="invite" type="button">카톡으로 초대</button><button class="secondary-button" id="copy-code" type="button">코드 복사</button></div>
    <ul class="player-list">${orderedPlayers().map((player, index) => `<li class="player-item"><span class="player-name">${index + 1}. ${esc(player.nickname)}${player.uid === room.hostUid ? '<span class="host-label">방장</span>' : ''}</span><span>🚩</span></li>`).join('')}</ul>
    ${isHost() ? `<div class="pace-picker"><strong>게임 길이</strong><div class="pace-options">
      <button type="button" class="pace-option ${pace === 'standard' ? 'is-selected' : ''}" data-pace="standard"><b>🎲 보통 · 권장</b><small>총 ${estimate.standard}턴 · 1인 약 7회</small></button>
      <button type="button" class="pace-option ${pace === 'quick' ? 'is-selected' : ''}" data-pace="quick"><b>⚡ 짧게</b><small>총 ${estimate.quick}턴 · 1인 약 4회</small></button>
    </div></div><div class="world-auto-note">🎙️ 자동 진행은 켜두되, 이동 설명 5초 · 선택 24초 · 결과 8초를 보장합니다.</div><div class="button-row"><button class="primary-button" id="start" ${players.length >= 2 ? '' : 'disabled'} type="button">소소킹 월드 출발 (${players.length}/${MAX_PLAYERS})</button></div>` : '<p class="lobby-note">방장이 게임 길이를 정하고 출발할 때까지 기다려주세요.</p>'}
  </section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy-code')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      showToast('코드를 복사했습니다.');
    } catch {
      showToast(roomId);
    }
  });
  document.querySelectorAll('[data-pace]').forEach(button => button.addEventListener('click', () => void updateDoc(doc(db, 'game_rooms', roomId), {
    pace: button.dataset.pace,
    updatedAt: Timestamp.now()
  })));
  document.getElementById('start')?.addEventListener('click', startGame);
}

async function startGame() {
  if (!isHost() || players.length < 2) return;
  const first = orderedPlayers()[0];
  const totalTurns = room?.pace === 'quick'
    ? clamp(players.length * 4, 12, 32)
    : clamp(players.length * 7, 18, MAX_TOTAL_TURNS);
  const now = Timestamp.now();
  const batch = writeBatch(db);
  players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
    score: 0,
    position: 0,
    updatedAt: now
  }));
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing',
    round: 1,
    totalTurns,
    roundState: 'open',
    worldPhase: 'roll',
    activeUid: first.uid,
    crownUid: '',
    ownedTiles: {},
    autoMode: true,
    paused: false,
    pauseRemaining: 0,
    lastResults: [],
    lastEvent: `${first.nickname}부터 시작합니다. 안전/승부 주사위를 골라주세요.`,
    eventKind: '',
    eventTarget: '',
    eventTile: -1,
    lastDice: 0,
    rollMode: '',
    rollPenalty: 0,
    roundEndsAt: Timestamp.fromMillis(Date.now() + ROLL_SECONDS * 1000),
    phaseStartedAt: now,
    updatedAt: now
  });
  try {
    await batch.commit();
  } catch (error) {
    console.error(error);
    showToast('월드를 시작하지 못했습니다.');
  }
}

function renderPlaying() {
  const key = [
    room.round,
    room.roundState,
    room.worldPhase,
    room.updatedAt?.toMillis?.(),
    room.paused,
    room.eventKind,
    room.eventTile,
    room.lastDice,
    players.map(player => `${player.uid}:${player.score}:${player.position}`).join('|'),
    answers.length
  ].join(':');
  if (key === lastRenderedKey) {
    updateTimerOnly();
    return;
  }
  lastRenderedKey = key;
  app.innerHTML = `<div class="world-board-wrap">
    <section>
      ${phaseProgressMarkup()}
      <div class="world-board">${boardMarkup()}</div>
      <section class="world-event-card">${phaseMarkup()}</section>
    </section>
    ${statusSide()}
  </div>`;
  wirePhase();
  wireHostControls();
  startTimer();
}

function phaseMarkup() {
  if (room.paused) return `<div class="event-hero"><span class="event-icon">⏸</span><h2>게임 일시정지</h2><p class="lead">시간도 같이 멈췄습니다. 방장이 계속을 누르면 이어집니다.</p></div>`;
  if (room.roundState === 'reveal' || room.worldPhase === 'reveal') return revealMarkup();
  if (room.worldPhase === 'roll') return rollMarkup();
  if (room.worldPhase === 'landing') return landingMarkup();
  if (room.worldPhase === 'event') return eventMarkup();
  return '<p>게임마스터가 다음 단계를 준비 중입니다.</p>';
}

function rollMarkup() {
  const active = playerByUid(room.activeUid);
  const mine = answerOf(room.activeUid, 'world-roll');
  const myTurn = active?.uid === currentUid;
  return `<div class="dice-stage">
    <span class="kicker">지금은 ① 주사위 단계</span>
    <h2>${myTurn ? `${esc(active?.nickname || '플레이어')}님, 주사위를 고르세요` : `${esc(active?.nickname || '플레이어')}님의 주사위 선택을 기다립니다`}</h2>
    <div class="world-now-card"><b>지금 할 일</b><span>${myTurn ? '아래 두 버튼 중 하나만 누르면 됩니다.' : '다른 사람 차례입니다. 잠시 구경하세요.'}</span></div>
    ${myTurn ? `<div class="roll-choice-grid">
      <button class="roll-choice ${mine?.text === 'normal' ? 'is-selected' : ''}" data-roll-choice="normal" type="button"><span>🎲</span><b>안전 주사위</b><small>1~6 · 손해 없음</small></button>
      <button class="roll-choice risky ${mine?.text === 'risky' ? 'is-selected' : ''}" data-roll-choice="risky" type="button"><span>🔥</span><b>승부 주사위</b><small>1~8 · 1~2면 최대 -100C</small></button>
    </div>` : ''}
    <div class="world-countdown-row"><span>자동 선택까지</span><strong data-world-timer>${remainingSeconds()}초</strong></div>
    <div class="world-log">${esc(room.lastEvent || '게임마스터가 차례를 준비했습니다.')}</div>
  </div>`;
}

function eventPreviewText(kind, tile) {
  const previews = {
    start: '출발칸 보너스 100C를 받습니다.',
    coin: '코인 200C를 바로 받습니다.',
    tax: '현재 코인에서 최대 150C가 빠집니다.',
    steal: '현재 1등에게서 코인을 훔칩니다.',
    crown: `왕관을 차지합니다. 왕관은 자기 차례 +${CROWN_TURN_BONUS}C, 최종 +${CROWN_FINAL_BONUS}C입니다.`,
    lucky: '행운상자를 열어 보너스 또는 작은 꽝을 확인합니다.',
    revenge: '현재 꼴찌에게 역전 보너스가 지급됩니다.',
    chaos: '코인·세금·왕관·강탈 중 하나의 큰 사건이 터집니다.',
    throne: '왕좌를 차지하고 왕관과 큰 보너스를 얻습니다.',
    property: '빈 땅이면 200C로 살지 결정하고, 남의 땅이면 통행료를 냅니다.',
    vault: '전원이 금고 하나를 고릅니다. 혼자 고른 사람만 성공합니다.',
    caught: '전원이 숫자를 고릅니다. 중복을 피한 가장 작은 숫자가 승리합니다.',
    greed: '안전 보상과 큰 보상 도전 중 하나를 고릅니다.',
    chosung: '초성에 맞는 단어를 입력합니다. 같은 정답이 겹치면 0C입니다.',
    minority: '전원이 달/해 중 하나를 고릅니다. 적게 고른 편이 보너스를 받습니다.'
  };
  return previews[kind] || `${tile.name} 사건을 진행합니다.`;
}

function landingMarkup() {
  const active = playerByUid(room.activeUid);
  const tile = tileAt(room.eventTile);
  const penalty = Number(room.rollPenalty || 0);
  return `<div class="landing-stage">
    <span class="kicker">지금은 ② 이동 확인 단계</span>
    <h2>${esc(active?.nickname || '플레이어')} · ${room.rollMode === 'risky' ? '🔥 승부 주사위' : '🎲 안전 주사위'}</h2>
    <div class="landing-route"><div class="landing-dice">${Number(room.lastDice || 0)}</div><div class="landing-arrow">→</div><div class="landing-tile"><span>${tile.icon}</span><b>${esc(tile.name)}</b></div></div>
    ${penalty < 0 ? `<div class="risk-penalty">🔥 승부 주사위 저수 발생 · ${Math.abs(penalty)}C 손실</div>` : ''}
    <div class="world-now-card"><b>도착한 칸은?</b><span>${esc(eventPreviewText(room.eventKind, tile))}</span></div>
    <div class="world-countdown-row"><span>설명 확인 후 다음 단계</span><strong data-world-timer>${remainingSeconds()}초</strong></div>
  </div>`;
}

function eventMarkup() {
  const tile = tileAt(room.eventTile);
  const kind = room.eventKind || tile.kind;
  const active = playerByUid(room.activeUid);
  const header = `<div class="event-context"><span>③ 칸 행동</span><b>${esc(active?.nickname || '플레이어')} · 🎲 ${Number(room.lastDice || 0)} → ${tile.icon} ${esc(tile.name)}</b></div>`;
  if (['coin','tax','steal','crown','lucky','revenge','chaos','throne','start'].includes(kind)) {
    return `${header}<div class="event-hero"><span class="event-icon">${tile.icon}</span><h2>${esc(tile.name)}</h2><div class="world-now-card"><b>무슨 일이 생기나요?</b><span>${esc(eventPreviewText(kind, tile))}</span></div><div class="world-countdown-row"><span>사건 결과 공개까지</span><strong data-world-timer>${remainingSeconds()}초</strong></div></div>`;
  }
  if (kind === 'property') return `${header}${propertyMarkup()}`;
  if (kind === 'vault') return `${header}${vaultMarkup()}`;
  if (kind === 'caught') return `${header}${caughtMarkup()}`;
  if (kind === 'greed') return `${header}${greedMarkup()}`;
  if (kind === 'chosung') return `${header}${chosungMarkup()}`;
  if (kind === 'minority') return `${header}${minorityMarkup()}`;
  return `${header}<p>사건 처리 중...</p>`;
}

function propertyMarkup() {
  const key = String(room.eventTile);
  const ownerUid = room.ownedTiles?.[key];
  const active = playerByUid(room.activeUid);
  const owner = playerByUid(ownerUid);
  const mine = answerOf(room.activeUid, 'world-event');
  if (ownerUid) {
    return `<div class="world-property"><span class="event-icon">🏢</span><strong>${esc(tileAt(room.eventTile).name)}</strong><div class="world-now-card"><b>무슨 일이 생기나요?</b><span>${ownerUid === room.activeUid ? '내 영역에 다시 도착해서 보너스를 받습니다.' : `${esc(owner?.nickname || '소유자')}에게 통행료를 냅니다.`}</span></div><div class="world-countdown-row"><span>결과 공개까지</span><strong data-world-timer>${remainingSeconds()}초</strong></div></div>`;
  }
  const myTurn = active?.uid === currentUid;
  return `<div class="world-property"><span class="event-icon">🏗️</span><strong>${esc(tileAt(room.eventTile).name)}</strong><div class="world-now-card"><b>지금 할 일</b><span>${myTurn ? '200C로 이 땅을 살지, 그냥 지나갈지 고르세요.' : `${esc(active?.nickname || '플레이어')}의 결정을 기다립니다.`}</span></div>${myTurn ? `<div class="event-choices"><button class="event-choice ${mine?.text === 'claim' ? 'is-selected' : ''}" data-world-choice="claim" type="button">🏰 점령하기<small>200C 사용 · 다른 사람 통행료 120C</small></button><button class="event-choice ${mine?.text === 'skip' ? 'is-selected' : ''}" data-world-choice="skip" type="button">🚶 지나가기<small>코인 보존</small></button></div>` : ''}<div class="world-countdown-row"><span>선택 시간</span><strong data-world-timer>${remainingSeconds()}초</strong></div></div>`;
}

function vaultMarkup() {
  const mine = answerOf(currentUid, 'world-event');
  return `<div class="event-hero"><span class="event-icon">🔐</span><h2>월드 금고런</h2><div class="world-now-card"><b>지금 할 일</b><span>금고 하나만 고르세요. 다른 사람과 겹치지 않으면 그 금액을 받습니다.</span></div></div><div class="event-choices">${[1,2,3,4].map((number, index) => `<button class="event-choice ${mine?.text === `v${number}` ? 'is-selected' : ''}" data-world-choice="v${number}" type="button">${['💼 160C','💰 220C','💎 300C','👑 450C'][index]}<small>겹치면 0C</small></button>`).join('')}</div><div class="world-countdown-row"><span>${currentAnswers('world-event').length}/${players.length}명 선택 · 남은 시간</span><strong data-world-timer>${remainingSeconds()}초</strong></div>`;
}

function caughtMarkup() {
  const mine = answerOf(currentUid, 'world-event');
  return `<div class="event-hero"><span class="event-icon">🎯</span><h2>월드 딱걸렸어</h2><div class="world-now-card"><b>지금 할 일</b><span>1~8 중 하나를 고르세요. 중복되지 않은 숫자 중 가장 작은 숫자가 승리합니다.</span></div></div><div class="world-number-grid">${Array.from({ length: 8 }, (_, index) => index + 1).map(number => `<button class="${mine?.text === String(number) ? 'is-selected' : ''}" data-world-choice="${number}" type="button">${number}</button>`).join('')}</div><div class="world-countdown-row"><span>${currentAnswers('world-event').length}/${players.length}명 선택 · 남은 시간</span><strong data-world-timer>${remainingSeconds()}초</strong></div>`;
}

function greedMarkup() {
  const mine = answerOf(currentUid, 'world-event');
  return `<div class="event-hero"><span class="event-icon">🧨</span><h2>월드 욕심계단</h2><div class="world-now-card"><b>지금 할 일</b><span>안전하게 120C를 챙기거나, 38% 붕괴 위험을 감수하고 340C에 도전하세요.</span></div></div><div class="event-choices"><button class="event-choice ${mine?.text === 'cash' ? 'is-selected' : ''}" data-world-choice="cash" type="button">💰 챙기기<small>안전 +120C</small></button><button class="event-choice ${mine?.text === 'climb' ? 'is-selected' : ''}" data-world-choice="climb" type="button">🧨 도전<small>성공 +340C · 실패 0C</small></button></div><div class="world-countdown-row"><span>${currentAnswers('world-event').length}/${players.length}명 선택 · 남은 시간</span><strong data-world-timer>${remainingSeconds()}초</strong></div>`;
}

function chosungMarkup() {
  const mine = answerOf(currentUid, 'world-event');
  return `<div class="event-hero"><span class="event-icon">💣</span><h2>초성 ${esc(room.eventTarget || '')}</h2><div class="world-now-card"><b>지금 할 일</b><span>초성에 맞는 단어를 하나 입력하세요. 같은 단어가 겹치면 0C입니다.</span></div></div><form id="world-answer-form" class="world-answer-form"><input id="world-answer" maxlength="24" value="${esc(mine?.text || '')}" placeholder="정답 입력" autocomplete="off"><button class="primary-button" type="submit">제출</button></form><div class="world-countdown-row"><span>${currentAnswers('world-event').length}/${players.length}명 제출 · 남은 시간</span><strong data-world-timer>${remainingSeconds()}초</strong></div>`;
}

function minorityMarkup() {
  const mine = answerOf(currentUid, 'world-event');
  return `<div class="event-hero"><span class="event-icon">🌗</span><h2>소수파 대결</h2><div class="world-now-card"><b>지금 할 일</b><span>🌙 달 또는 ☀️ 해를 고르세요. <b>더 적게 고른 편</b>이 320C를 받습니다. 동률이면 모두 100C.</span></div></div><div class="event-choices"><button class="event-choice ${mine?.text === 'moon' ? 'is-selected' : ''}" data-world-choice="moon" type="button">🌙 달<small>소수파를 노려요</small></button><button class="event-choice ${mine?.text === 'sun' ? 'is-selected' : ''}" data-world-choice="sun" type="button">☀️ 해<small>다른 사람을 읽어봐요</small></button></div><div class="world-countdown-row"><span>${currentAnswers('world-event').length}/${players.length}명 선택 · 남은 시간</span><strong data-world-timer>${remainingSeconds()}초</strong></div>`;
}

function revealMarkup() {
  const rows = Array.isArray(room.lastResults) ? room.lastResults : [];
  const tile = tileAt(room.eventTile || 0);
  return `<div class="event-context"><span>④ 결과 확인</span><b>${tile.icon} ${esc(tile.name)}</b></div><div class="event-hero"><span class="event-icon">${tile.icon}</span><h2>${esc(room.lastEvent || '결과 공개')}</h2><div class="world-now-card result"><b>지금 할 일</b><span>점수가 왜 바뀌었는지 아래 결과를 확인하세요. 바로 다음 차례로 넘기지 않습니다.</span></div></div><ul class="result-list">${rows.map(row => `<li class="result-item"><span><strong>${esc(row.nickname || '플레이어')}</strong><small>${esc(row.label || '')}</small></span><span class="result-delta ${Number(row.delta) > 0 ? 'plus' : Number(row.delta) < 0 ? 'minus' : 'zero'}">${Number(row.delta) > 0 ? '+' : ''}${Number(row.delta || 0)}C</span></li>`).join('') || '<li class="result-item"><span>사건 처리 완료</span></li>'}</ul><div class="world-countdown-row result-timer"><span>${room.autoMode === false ? '수동 진행 모드' : '다음 사람 차례까지'}</span><strong data-world-timer>${remainingSeconds()}초</strong></div>`;
}

function wirePhase() {
  document.querySelectorAll('[data-roll-choice]').forEach(button => button.addEventListener('click', () => void submitAnswer('world-roll', button.dataset.rollChoice)));
  document.querySelectorAll('[data-world-choice]').forEach(button => button.addEventListener('click', () => void submitAnswer('world-event', button.dataset.worldChoice)));
  document.getElementById('world-answer-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const value = String(document.getElementById('world-answer')?.value || '').trim();
    if (value) void submitAnswer('world-event', value);
  });
}

async function submitAnswer(kind, text) {
  if (!room || room.paused || room.status !== 'playing' || room.roundState !== 'open' || remainingSeconds() <= 0) return;
  if (kind === 'world-roll' && currentUid !== room.activeUid) return;
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `${currentUid}-${room.round}-${kind}`), {
      uid: currentUid,
      round: Number(room.round),
      kind,
      text: String(text).slice(0, 120),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error(error);
    showToast('선택을 저장하지 못했습니다.');
  }
}

function updateTimerOnly() {
  if (room?.paused) return;
  document.querySelectorAll('[data-world-timer]').forEach(element => {
    element.textContent = `${remainingSeconds()}초`;
  });
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    updateTimerOnly();
    void driveHost(false);
  }, 500);
  void driveHost(false);
}

function eventDuration(kind) {
  if (kind === 'chosung') return CHOSUNG_SECONDS;
  if (['vault','caught','greed','minority'].includes(kind)) return EVENT_SECONDS;
  if (kind === 'property') return room?.ownedTiles?.[String(room.eventTile)] ? INSTANT_EVENT_SECONDS : EVENT_SECONDS;
  return INSTANT_EVENT_SECONDS;
}

async function driveHost(force = false) {
  if (!isHost() || hostBusy || room?.paused || room?.status !== 'playing') return;
  if (room?.autoMode === false && !force) return;
  hostBusy = true;
  try {
    if (room.roundState === 'reveal' || room.worldPhase === 'reveal') {
      if (force || remainingSeconds() <= 0 || phaseAgeMs() >= RESULT_DELAY) await nextTurn();
      return;
    }
    if (room.roundState !== 'open') return;
    if (room.worldPhase === 'roll') {
      const requested = Boolean(answerOf(room.activeUid, 'world-roll'));
      if (force || requested || remainingSeconds() <= 0) await resolveRoll();
      return;
    }
    if (room.worldPhase === 'landing') {
      if (force || remainingSeconds() <= 0) await openEvent();
      return;
    }
    if (room.worldPhase === 'event') {
      const kind = room.eventKind;
      const enoughTime = phaseAgeMs() >= MIN_EVENT_DWELL;
      const propertyReady = kind === 'property' && !room.ownedTiles?.[String(room.eventTile)] && Boolean(answerOf(room.activeUid, 'world-event'));
      const groupReady = ['vault','caught','greed','chosung','minority'].includes(kind) && allPlayersAnswered('world-event');
      if (force || remainingSeconds() <= 0 || enoughTime && (propertyReady || groupReady)) await resolveEvent();
    }
  } catch (error) {
    console.error('world v2 game master failed', error);
  } finally {
    hostBusy = false;
  }
}

async function resolveRoll() {
  if (room.worldPhase !== 'roll') return;
  const active = playerByUid(room.activeUid);
  if (!active) return;
  const answer = answerOf(active.uid, 'world-roll');
  const mode = answer?.text === 'risky' ? 'risky' : 'normal';
  const dice = mode === 'risky' ? rand(8) + 1 : rand(6) + 1;
  const newPosition = (Number(active.position || 0) + dice) % TILES.length;
  const tile = tileAt(newPosition);
  const penalty = mode === 'risky' && dice <= 2 ? -Math.min(Number(active.score || 0), 100) : 0;
  const target = tile.kind === 'chosung' ? pick(CHOSUNG_TARGETS) : '';
  const now = Timestamp.now();
  const batch = writeBatch(db);
  batch.update(doc(db, 'game_rooms', roomId, 'players', active.uid), {
    position: newPosition,
    score: Math.max(0, Number(active.score || 0) + penalty),
    updatedAt: now
  });
  batch.update(doc(db, 'game_rooms', roomId), {
    worldPhase: 'landing',
    roundState: 'open',
    eventTile: newPosition,
    eventKind: tile.kind,
    eventTarget: target,
    lastDice: dice,
    rollMode: mode,
    rollPenalty: penalty,
    lastEvent: `${active.nickname} · ${mode === 'risky' ? '🔥 승부' : '🎲 안전'} ${dice} → ${tile.icon} ${tile.name}`,
    roundEndsAt: Timestamp.fromMillis(Date.now() + LANDING_SECONDS * 1000),
    phaseStartedAt: now,
    updatedAt: now
  });
  await batch.commit();
}

async function openEvent() {
  if (room.worldPhase !== 'landing') return;
  const now = Timestamp.now();
  const seconds = eventDuration(room.eventKind);
  await updateDoc(doc(db, 'game_rooms', roomId), {
    worldPhase: 'event',
    roundState: 'open',
    roundEndsAt: Timestamp.fromMillis(Date.now() + seconds * 1000),
    phaseStartedAt: now,
    updatedAt: now
  });
}

function addDelta(map, uid, delta) {
  map.set(uid, (map.get(uid) || 0) + delta);
}

function resultRow(uid, delta, label) {
  return { uid, nickname: playerByUid(uid)?.nickname || '플레이어', delta, label };
}

async function resolveEvent() {
  if (room.worldPhase !== 'event') return;
  const kind = room.eventKind;
  const tile = tileAt(room.eventTile);
  const active = playerByUid(room.activeUid);
  if (!active) return;
  const mult = multiplier();
  const deltas = new Map();
  const results = [];
  let lastEvent = `${tile.icon} ${tile.name}`;
  let crownUid = room.crownUid || '';
  const ownedTiles = { ...(room.ownedTiles || {}) };

  if (kind === 'coin' || kind === 'start') {
    const base = kind === 'coin' ? 200 : 100;
    const delta = base * mult;
    addDelta(deltas, active.uid, delta);
    results.push(resultRow(active.uid, delta, kind === 'coin' ? '코인광장 보너스' : '출발 보너스'));
    lastEvent = `${active.nickname} +${delta}C`;
  } else if (kind === 'tax') {
    const delta = -Math.min(Number(active.score || 0), 150 * mult);
    addDelta(deltas, active.uid, delta);
    results.push(resultRow(active.uid, delta, '세금폭탄'));
    lastEvent = `${active.nickname} 세금 ${Math.abs(delta)}C`;
  } else if (kind === 'steal') {
    const target = rankedPlayers().find(player => player.uid !== active.uid);
    if (target) {
      const amount = Math.min(Number(target.score || 0), 180 * mult);
      addDelta(deltas, target.uid, -amount);
      addDelta(deltas, active.uid, amount);
      results.push(resultRow(active.uid, amount, `${target.nickname}에게서 강탈`));
      results.push(resultRow(target.uid, -amount, `${active.nickname}에게 털림`));
      lastEvent = `🥷 ${active.nickname}이 ${target.nickname}에게서 ${amount}C 강탈`;
    }
  } else if (kind === 'crown') {
    crownUid = active.uid;
    const delta = 160 * mult;
    addDelta(deltas, active.uid, delta);
    results.push(resultRow(active.uid, delta, '왕관 획득 보너스'));
    lastEvent = `👑 ${active.nickname}이 왕관을 차지했습니다!`;
  } else if (kind === 'throne') {
    crownUid = active.uid;
    const delta = 320 * mult;
    addDelta(deltas, active.uid, delta);
    results.push(resultRow(active.uid, delta, '왕좌 점령 + 왕관'));
    lastEvent = `🏆 ${active.nickname} 왕좌 점령!`;
  } else if (kind === 'revenge') {
    const low = [...players].sort((a, b) => Number(a.score || 0) - Number(b.score || 0))[0];
    const delta = 280 * mult;
    addDelta(deltas, low.uid, delta);
    results.push(resultRow(low.uid, delta, '꼴찌 역전 지원'));
    lastEvent = `😈 ${low.nickname}에게 역전 찬스!`;
  } else if (kind === 'lucky') {
    const raw = pick([-100, 120, 260, 420]) * mult;
    const safe = raw < 0 ? -Math.min(Number(active.score || 0), Math.abs(raw)) : raw;
    addDelta(deltas, active.uid, safe);
    results.push(resultRow(active.uid, safe, safe >= 0 ? '행운상자 당첨' : '행운상자 꽝'));
    lastEvent = `🎁 ${active.nickname} ${safe >= 0 ? '+' : ''}${safe}C`;
  } else if (kind === 'chaos') {
    const effect = pick(['coin','tax','crown','steal']);
    if (effect === 'crown') {
      crownUid = active.uid;
      addDelta(deltas, active.uid, 400 * mult);
      results.push(resultRow(active.uid, 400 * mult, '카오스 왕관'));
      lastEvent = `🌪️👑 ${active.nickname} 왕관 강탈!`;
    } else if (effect === 'coin') {
      addDelta(deltas, active.uid, 500 * mult);
      results.push(resultRow(active.uid, 500 * mult, '카오스 잭팟'));
      lastEvent = `🌪️💰 ${active.nickname} +${500 * mult}C`;
    } else if (effect === 'tax') {
      const loss = Math.min(Number(active.score || 0), 250 * mult);
      addDelta(deltas, active.uid, -loss);
      results.push(resultRow(active.uid, -loss, '카오스 폭탄'));
      lastEvent = `🌪️💥 ${active.nickname} -${loss}C`;
    } else {
      const target = rankedPlayers().find(player => player.uid !== active.uid);
      if (target) {
        const amount = Math.min(Number(target.score || 0), 260 * mult);
        addDelta(deltas, target.uid, -amount);
        addDelta(deltas, active.uid, amount);
        results.push(resultRow(active.uid, amount, '카오스 강탈'));
        results.push(resultRow(target.uid, -amount, '카오스 피해'));
        lastEvent = `🌪️🥷 ${active.nickname}이 ${amount}C 강탈`;
      }
    }
  } else if (kind === 'property') {
    const key = String(room.eventTile);
    const ownerUid = ownedTiles[key];
    const answer = answerOf(active.uid, 'world-event');
    if (!ownerUid) {
      if (answer?.text === 'claim' && Number(active.score || 0) >= 200) {
        ownedTiles[key] = active.uid;
        addDelta(deltas, active.uid, -200);
        results.push(resultRow(active.uid, -200, `${tile.name} 점령 비용`));
        lastEvent = `🏰 ${active.nickname}이 ${tile.name} 점령`;
      } else if (answer?.text === 'claim') {
        results.push(resultRow(active.uid, 0, '코인이 부족해 점령 실패'));
        lastEvent = `💸 ${active.nickname}은 점령 비용이 부족합니다`;
      } else {
        results.push(resultRow(active.uid, 0, '영역을 지나감'));
        lastEvent = `🚶 ${active.nickname}이 영역을 지나갑니다`;
      }
    } else if (ownerUid === active.uid) {
      const bonus = 80 * mult;
      addDelta(deltas, active.uid, bonus);
      results.push(resultRow(active.uid, bonus, '내 영역 재방문 보너스'));
      lastEvent = `🏢 내 영역 보너스 +${bonus}C`;
    } else {
      const owner = playerByUid(ownerUid);
      const toll = Math.min(Number(active.score || 0), 120 * mult);
      addDelta(deltas, active.uid, -toll);
      addDelta(deltas, ownerUid, toll);
      results.push(resultRow(active.uid, -toll, `${owner?.nickname || '소유자'}에게 통행료`));
      results.push(resultRow(ownerUid, toll, `${active.nickname} 통행료 수익`));
      lastEvent = `🏢 ${active.nickname} → ${owner?.nickname || '소유자'} 통행료 ${toll}C`;
    }
  } else if (kind === 'vault') {
    const list = currentAnswers('world-event');
    const groups = new Map();
    const values = { v1: 160, v2: 220, v3: 300, v4: 450 };
    list.forEach(answer => groups.set(answer.text, (groups.get(answer.text) || 0) + 1));
    players.forEach(player => {
      const answer = list.find(item => item.uid === player.uid);
      const delta = answer && groups.get(answer.text) === 1 ? (values[answer.text] || 0) * mult : 0;
      addDelta(deltas, player.uid, delta);
      results.push(resultRow(player.uid, delta, !answer ? '시간 초과' : groups.get(answer.text) === 1 ? '단독 금고 성공' : '같은 금고 선택으로 충돌'));
    });
    lastEvent = `🔐 금고런 · 단독 성공 ${results.filter(row => row.delta > 0).length}명`;
  } else if (kind === 'caught') {
    const list = currentAnswers('world-event');
    const counts = new Map();
    list.forEach(answer => counts.set(Number(answer.text), (counts.get(Number(answer.text)) || 0) + 1));
    const unique = [...counts.entries()].filter(([, count]) => count === 1).map(([number]) => number).sort((a, b) => a - b);
    const winnerNumber = unique[0];
    players.forEach(player => {
      const answer = list.find(item => item.uid === player.uid);
      const delta = answer && Number(answer.text) === winnerNumber ? 400 * mult : 0;
      addDelta(deltas, player.uid, delta);
      results.push(resultRow(player.uid, delta, !answer ? '시간 초과' : delta > 0 ? `${winnerNumber} 단독 최저 숫자 승리` : '중복 또는 더 큰 숫자'));
    });
    lastEvent = winnerNumber ? `🎯 ${winnerNumber}번이 가장 작은 단독 숫자!` : '🎯 단독 숫자가 없습니다';
  } else if (kind === 'greed') {
    const list = currentAnswers('world-event');
    const climbers = list.filter(answer => answer.text === 'climb');
    const collapsed = climbers.length > 0 && rand(100) < 38;
    players.forEach(player => {
      const answer = list.find(item => item.uid === player.uid);
      let delta = 0;
      let label = '시간 초과';
      if (answer?.text === 'cash') {
        delta = 120 * mult;
        label = '안전하게 챙김';
      } else if (answer?.text === 'climb') {
        delta = collapsed ? 0 : 340 * mult;
        label = collapsed ? '💥 계단 붕괴' : '🔥 욕심 성공';
      }
      addDelta(deltas, player.uid, delta);
      results.push(resultRow(player.uid, delta, label));
    });
    lastEvent = collapsed ? '🧨💥 욕심계단 붕괴!' : '🧨 욕심계단 생존!';
  } else if (kind === 'chosung') {
    const list = currentAnswers('world-event');
    const valid = list.filter(answer => initials(answer.text) === room.eventTarget);
    const counts = new Map();
    valid.forEach(answer => {
      const key = answer.text.replace(/\s+/g, '').toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    players.forEach(player => {
      const answer = list.find(item => item.uid === player.uid);
      const key = answer?.text?.replace(/\s+/g, '').toLowerCase();
      const ok = answer && initials(answer.text) === room.eventTarget && counts.get(key) === 1;
      const delta = ok ? 300 * mult : 0;
      addDelta(deltas, player.uid, delta);
      results.push(resultRow(player.uid, delta, !answer ? '시간 초과' : initials(answer.text) !== room.eventTarget ? '초성 불일치' : counts.get(key) > 1 ? '같은 정답 중복' : '단독 정답'));
    });
    lastEvent = `💣 초성 ${room.eventTarget} · 단독 정답 ${results.filter(row => row.delta > 0).length}명`;
  } else if (kind === 'minority') {
    const list = currentAnswers('world-event');
    const moon = list.filter(answer => answer.text === 'moon');
    const sun = list.filter(answer => answer.text === 'sun');
    const tie = moon.length > 0 && moon.length === sun.length;
    let winningSide = '';
    if (!tie && moon.length > 0 && sun.length > 0) winningSide = moon.length < sun.length ? 'moon' : 'sun';
    players.forEach(player => {
      const answer = list.find(item => item.uid === player.uid);
      let delta = 0;
      let label = '시간 초과';
      if (answer) {
        if (tie) {
          delta = 100 * mult;
          label = '동률 보너스';
        } else if (winningSide && answer.text === winningSide) {
          delta = 320 * mult;
          label = '🌗 소수파 승리';
        } else if (!winningSide) {
          label = '한쪽으로 몰려 소수파 없음';
        } else {
          label = '다수파 패배';
        }
      }
      addDelta(deltas, player.uid, delta);
      results.push(resultRow(player.uid, delta, label));
    });
    lastEvent = tie ? '🌗 정확히 반반! 모두 동률 보너스' : winningSide ? `🌗 ${winningSide === 'moon' ? '달' : '해'} 팀이 소수파 승리!` : '🌗 모두 같은 편을 골라 승자 없음';
  }

  const now = Timestamp.now();
  const batch = writeBatch(db);
  players.forEach(player => {
    const nextScore = Math.max(0, Number(player.score || 0) + (deltas.get(player.uid) || 0));
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: nextScore, updatedAt: now });
  });
  batch.update(doc(db, 'game_rooms', roomId), {
    roundState: 'reveal',
    worldPhase: 'reveal',
    crownUid,
    ownedTiles,
    lastResults: results,
    lastEvent,
    roundEndsAt: Timestamp.fromMillis(Date.now() + RESULT_DELAY),
    phaseStartedAt: now,
    updatedAt: now
  });
  await batch.commit();
}

async function nextTurn() {
  if (room.roundState !== 'reveal' && room.worldPhase !== 'reveal') return;
  if (Number(room.round) >= turnLimit()) {
    await finishGame();
    return;
  }
  const nextUid = nextActiveUid();
  const next = playerByUid(nextUid);
  const crownBonus = nextUid && nextUid === room.crownUid ? CROWN_TURN_BONUS : 0;
  const now = Timestamp.now();
  const batch = writeBatch(db);
  if (next && crownBonus) {
    batch.update(doc(db, 'game_rooms', roomId, 'players', next.uid), { score: Number(next.score || 0) + crownBonus, updatedAt: now });
  }
  batch.update(doc(db, 'game_rooms', roomId), {
    round: Number(room.round) + 1,
    roundState: 'open',
    worldPhase: 'roll',
    activeUid: nextUid,
    eventKind: '',
    eventTarget: '',
    eventTile: -1,
    lastResults: [],
    lastDice: 0,
    rollMode: '',
    rollPenalty: 0,
    lastEvent: crownBonus ? `👑 ${next?.nickname || '왕관 보유자'} 차례 시작 보너스 +${crownBonus}C` : `${next?.nickname || '다음 플레이어'} 차례입니다. 주사위를 골라주세요.`,
    roundEndsAt: Timestamp.fromMillis(Date.now() + ROLL_SECONDS * 1000),
    phaseStartedAt: now,
    updatedAt: now
  });
  await batch.commit();
}

async function finishGame() {
  const now = Timestamp.now();
  const batch = writeBatch(db);
  if (room.crownUid) {
    const crowned = playerByUid(room.crownUid);
    if (crowned) batch.update(doc(db, 'game_rooms', roomId, 'players', crowned.uid), { score: Number(crowned.score || 0) + CROWN_FINAL_BONUS, updatedAt: now });
  }
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'finished',
    roundState: 'finished',
    worldPhase: 'finished',
    lastEvent: `👑 최종 왕관 보너스 ${CROWN_FINAL_BONUS}C 반영 · 최종 소소킹 결정`,
    updatedAt: now
  });
  await batch.commit();
}

function renderFinished() {
  clearInterval(timerId);
  const ranked = rankedPlayers();
  const winner = ranked[0];
  app.innerHTML = `<section class="panel world-final">
    <div class="crown-big">👑</div><span class="kicker">SOSOKING WORLD v2 FINAL</span><h1>${esc(winner?.nickname || '플레이어')}</h1><p class="lead">오늘의 소소킹 월드 챔피언!</p>
    <div class="world-now-card result"><b>최종 계산</b><span>왕관 보유자에게 마지막 ${CROWN_FINAL_BONUS}C 보너스까지 반영했습니다.</span></div>
    <ul class="world-final-list">${ranked.map((player, index) => `<li><span>${index + 1}. ${player.uid === room.crownUid ? '👑 ' : ''}${esc(player.nickname)}</span><strong>${Number(player.score || 0).toLocaleString()}C</strong></li>`).join('')}</ul>
    ${isHost() ? '<div class="button-row"><button class="primary-button" id="restart-world" type="button">같은 멤버로 다시 시작</button></div>' : ''}<div class="button-row"><a class="secondary-button" href="/game/">게임소로 돌아가기</a></div>
  </section>`;
  document.getElementById('restart-world')?.addEventListener('click', restartWorld);
}

async function restartWorld() {
  if (!isHost()) return;
  const answerSnapshot = await getDocs(collection(db, 'game_rooms', roomId, 'answers'));
  const now = Timestamp.now();
  const batch = writeBatch(db);
  answerSnapshot.docs.forEach(answer => batch.delete(answer.ref));
  players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, position: 0, updatedAt: now }));
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'lobby',
    round: 0,
    totalTurns: 0,
    roundState: 'waiting',
    worldPhase: 'waiting',
    activeUid: '',
    crownUid: '',
    ownedTiles: {},
    paused: false,
    pauseRemaining: 0,
    autoMode: true,
    lastResults: [],
    lastEvent: '',
    eventKind: '',
    eventTarget: '',
    eventTile: -1,
    lastDice: 0,
    rollMode: '',
    rollPenalty: 0,
    updatedAt: now
  });
  try {
    await batch.commit();
  } catch (error) {
    console.error(error);
    showToast('다시 시작하지 못했습니다.');
  }
}

async function boot() {
  try {
    const user = await initAuth();
    currentUid = user?.uid || auth.currentUser?.uid || '';
    if (!currentUid) throw new Error('auth');
    const code = normalizeCode(new URL(location.href).searchParams.get('room') || '');
    if (code) {
      roomId = code;
      setRoomUrl(code);
      if (await ensureMembership(code)) subscribeRoom(code);
    } else {
      renderLanding();
    }
  } catch (error) {
    console.error(error);
    app.innerHTML = '<section class="panel"><h2>게임을 시작하지 못했습니다.</h2><p class="lead">로그인 세션을 확인하고 다시 시도해주세요.</p></section>';
  }
}

shareButton.addEventListener('click', shareRoom);
void boot();
