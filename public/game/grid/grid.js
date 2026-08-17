import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import {
  ACTIONS,
  BOARD_SIZE,
  CELLS,
  MAX_ROUNDS,
  buildBoard,
  normalizeBoard,
  rankPlayers,
  resolveTurn
} from '/game/grid/grid-core.js?v=20260817-grid-2';

const app = document.getElementById('game-app');
const shareButton = document.getElementById('share-room');
const toast = document.getElementById('toast');

const MAX_PLAYERS = 8;
const ROUND_SECONDS = 10;
const GAME_TYPE = 'grid-rush';

let roomId = '';
let room = null;
let players = [];
let answers = [];
let currentUid = '';
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeAnswers = null;
let answerScope = '';
let timerId = null;
let toastId = null;
let resolving = false;

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastId);
  toastId = setTimeout(() => { toast.hidden = true; }, 2400);
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

function initialPlayer(nickname, previous = {}, now = Timestamp.now()) {
  return {
    uid: currentUid,
    nickname,
    score: 0,
    position: 0,
    shield: 0,
    scrap: 0,
    banked: 0,
    jammed: false,
    barrierDent: false,
    finishPower: 0,
    lastDelta: 0,
    joinOrder: Number(previous.joinOrder || Date.now()),
    joinedAt: previous.joinedAt || now,
    updatedAt: now
  };
}

function stopSubscriptions() {
  unsubscribeRoom?.();
  unsubscribePlayers?.();
  unsubscribeAnswers?.();
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  unsubscribeAnswers = null;
  answerScope = '';
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
  return `${location.origin}/game/grid/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const url = inviteUrl();
  const data = { title: '소소킹 칸폭주 30 초대', text: `칸폭주 30 방 ${roomId}에서 30칸 먼저 채우기!`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); showToast('초대 링크를 복사했습니다.'); }
  catch { window.prompt('이 링크를 복사해서 보내주세요.', url); }
}

function isHost() {
  return Boolean(room && currentUid && room.hostUid === currentUid);
}

function playerByUid(uid) {
  return players.find(player => player.uid === uid);
}

function orderedPlayers() {
  return [...players].sort((a, b) => Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function currentRoundAnswers() {
  return answers.filter(answer => Number(answer.round) === Number(room?.round || 0) && answer.kind === 'grid-action');
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function allSubmitted() {
  return players.length >= 2 && currentRoundAnswers().length >= players.length;
}

function canReveal() {
  return allSubmitted() || remainingSeconds() <= 0;
}

function submissionLabel(mine) {
  return isHost() ? `${mine ? '🔒 도구 선택 완료 · ' : ''}${currentRoundAnswers().length}/${players.length}명 선택` : mine ? '🔒 내 도구 선택 완료 · 다른 참가자를 기다리는 중' : '이번 턴 도구를 골라주세요.';
}

function progressListMarkup() {
  return rankPlayers(players).map((player, index) => {
    const position = Math.max(0, Math.min(BOARD_SIZE, Number(player.position || 0)));
    return `<li class="grid-racer ${player.uid === currentUid ? 'is-me' : ''}">
      <span class="grid-racer-rank">${index + 1}</span>
      <span class="grid-racer-info"><strong>${escapeText(player.nickname || '플레이어')}${player.uid === room?.hostUid ? '<em>방장</em>' : ''}</strong><span class="grid-progress"><i style="width:${(position / BOARD_SIZE) * 100}%"></i></span></span>
      <b>${position}/30</b>
    </li>`;
  }).join('');
}

function boardMarkup(player) {
  const board = normalizeBoard(room?.board);
  const position = Number(player?.position || 0);
  return `<div class="grid-board" role="grid" aria-label="30칸 진행판">${board.map((type, index) => {
    const meta = CELLS[type] || CELLS.clear;
    const filled = index < position;
    const current = index === position;
    const dent = current && type === 'barrier' && player?.barrierDent === true;
    const label = filled ? `${index + 1}번 채움` : `${index + 1}번 ${meta.label}`;
    return `<div class="grid-cell type-${meta.tone} ${filled ? 'is-filled' : ''} ${current ? 'is-current' : ''} ${dent ? 'is-dented' : ''}" role="gridcell" aria-label="${escapeText(label)}"><small>${index + 1}</small><span>${filled ? '✓' : escapeText(meta.emoji)}</span>${dent ? '<i>금감</i>' : ''}</div>`;
  }).join('')}</div>`;
}

function renderLanding(prefilledCode = '') {
  stopSubscriptions();
  room = null;
  players = [];
  answers = [];
  resolving = false;
  shareButton.hidden = true;
  app.innerHTML = `<section class="panel grid-landing">
    <span class="kicker">30-CELL OBSTACLE RACE</span>
    <h1>🏁 칸폭주 30</h1>
    <p class="lead">내 5×6 판의 30칸을 먼저 채우면 승리! 주사위 대신 매 턴 <b>질주·방어·역이용</b> 중 하나를 동시에 고릅니다.</p>
    <div class="grid-feature-strip"><span>⚡ 빠른 질주</span><span>🛡️ 방해물 방어</span><span>♻️ 방해물을 보너스로</span></div>
    <div class="grid-obstacle-preview"><b>칸 속 장치</b><span>🧱 이중벽</span><span>🕸️ 끈끈이</span><span>🔒 정지문</span><span>🪞 반사판</span><span>💣 폭탄</span><span>🚀 가속칸</span></div>
    <form id="create-room-form"><label class="field"><span>내 닉네임</span><input id="create-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="primary-button" type="submit">새 레이스 만들기</button></div></form>
    <div class="divider"></div>
    <form id="join-room-form"><label class="field"><span>초대 코드</span><input id="join-code" value="${escapeText(prefilledCode)}" maxlength="6" autocomplete="off" placeholder="예: AB7K2Q" required></label><label class="field"><span>내 닉네임</span><input id="join-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="secondary-button" type="submit">초대받은 레이스 입장</button></div></form>
  </section>`;
  document.getElementById('create-room-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void createRoom(document.getElementById('create-nickname')?.value);
  });
  document.getElementById('join-room-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void joinRoom(document.getElementById('join-code')?.value, document.getElementById('join-nickname')?.value);
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
      if (!(await getDoc(doc(db, 'game_rooms', candidate))).exists()) { code = candidate; break; }
    }
    if (!code) throw new Error('room-code-exhausted');
    const now = Timestamp.now();
    await setDoc(doc(db, 'game_rooms', code), {
      type: GAME_TYPE, status: 'lobby', hostUid: currentUid, maxPlayers: MAX_PLAYERS,
      round: 0, maxRounds: MAX_ROUNDS, roundState: 'waiting', roundSeconds: ROUND_SECONDS,
      board: buildBoard(code), lastResults: [], winnerUid: '', createdAt: now, updatedAt: now
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), initialPlayer(nickname, {}, now));
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error('create grid room failed', error);
    showToast('레이스 방을 만들지 못했습니다.');
    if (button) button.disabled = false;
  }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  const button = document.querySelector('#join-room-form button, #invite-form button');
  if (button) button.disabled = true;
  try {
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== GAME_TYPE) throw new Error('room');
    if (roomSnap.data().status !== 'lobby') throw new Error('started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [playersSnap, existing] = await Promise.all([
      getDocs(collection(db, 'game_rooms', code, 'players')),
      getDoc(playerRef)
    ]);
    if (playersSnap.size >= MAX_PLAYERS && !existing.exists()) throw new Error('full');
    await setDoc(playerRef, initialPlayer(nickname, existing.exists() ? existing.data() : {}));
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    const message = error?.message === 'full' ? '이 방은 8명이 모두 들어왔습니다.' : error?.message === 'started' ? '이미 출발한 레이스입니다.' : '레이스 방에 입장하지 못했습니다.';
    showToast(message);
    if (button) button.disabled = false;
  }
}

async function ensureMembership(code) {
  const snap = await getDoc(doc(db, 'game_rooms', code, 'players', currentUid));
  if (snap.exists()) return true;
  renderInvite(code, sessionStorage.getItem(`sosoking-game-nickname:${code}`) || '');
  return false;
}

function renderInvite(code, saved = '') {
  stopSubscriptions();
  shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">칸폭주 30 초대</span><h1>🏁 출발선에 합류하세요</h1><p class="lead">닉네임만 입력하면 같은 30칸 레이스에 들어갑니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div><form id="invite-form"><label class="field"><span>내 닉네임</span><input id="invite-name" maxlength="12" value="${escapeText(saved)}" autocomplete="nickname" required></label><div class="button-row"><button class="primary-button" type="submit">레이스 입장</button></div></form></section>`;
  document.getElementById('invite-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void joinRoom(code, document.getElementById('invite-name')?.value);
  });
}

function subscribeRoom(code) {
  stopSubscriptions();
  roomId = code;
  shareButton.hidden = false;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snapshot => {
    if (!snapshot.exists()) { setRoomUrl(''); showToast('레이스 방이 종료되었습니다.'); return renderLanding(); }
    room = { id: snapshot.id, ...snapshot.data() };
    resolving = false;
    ensureAnswerSubscription(code);
    renderCurrent();
  }, error => { console.error('grid room subscription failed', error); renderError('레이스 정보를 불러오지 못했습니다.'); });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateRoundLive(); else renderCurrent();
  });
}

function ensureAnswerSubscription(code) {
  const nextScope = room?.status === 'playing' && room?.roundState === 'open' && !isHost() ? 'mine' : 'all';
  if (answerScope === nextScope && unsubscribeAnswers) return;
  unsubscribeAnswers?.();
  answerScope = nextScope;
  answers = [];
  const base = collection(db, 'game_rooms', code, 'answers');
  const source = nextScope === 'mine' ? query(base, where('uid', '==', currentUid)) : base;
  unsubscribeAnswers = onSnapshot(source, snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateRoundLive(); else renderCurrent();
  }, error => { console.error('grid answers subscription failed', error); showToast('도구 선택 정보를 불러오지 못했습니다.'); });
}

function renderCurrent() {
  if (!room) return;
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'playing' && room.roundState === 'open') return renderRound();
  if (room.status === 'playing' && room.roundState === 'reveal') return renderReveal();
  if (room.status === 'finished') return renderFinished();
  renderError('알 수 없는 레이스 상태입니다.');
}

function renderLobby() {
  clearInterval(timerId);
  timerId = null;
  const canStart = isHost() && players.length >= 2;
  app.innerHTML = `<section class="panel"><span class="kicker">30칸 출발 대기실</span><h2>2명 이상이면 출발</h2><p class="lead">모두 같은 장치 배치를 보지만, 어떤 도구를 고르느냐에 따라 길이 달라집니다. 채운 칸은 절대 사라지지 않습니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div><div class="button-row two"><button class="secondary-button" id="invite" type="button">카톡으로 초대</button><button class="secondary-button" id="copy" type="button">코드 복사</button></div><ul class="player-list">${orderedPlayers().map((player, index) => `<li class="player-item"><span class="player-name">${escapeText(player.nickname)}${player.uid === room.hostUid ? '<span class="host-label">방장</span>' : ''}</span><span class="seat-number">${index + 1}</span></li>`).join('')}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="start" type="button" ${canStart ? '' : 'disabled'}>30칸 레이스 시작 (${players.length}/${MAX_PLAYERS})</button></div>` : '<p class="lobby-note">방장이 출발시킬 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomId); showToast('초대 코드를 복사했습니다.'); }
    catch { showToast(`초대 코드: ${roomId}`); }
  });
  document.getElementById('start')?.addEventListener('click', startGame);
}

async function startGame() {
  if (!isHost() || players.length < 2) return;
  const now = Timestamp.now();
  const batch = writeBatch(db);
  players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
    score: 0, position: 0, shield: 0, scrap: 0, banked: 0, jammed: false,
    barrierDent: false, finishPower: 0, lastDelta: 0, updatedAt: now
  }));
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing', round: 1, roundState: 'open', board: buildBoard(roomId), lastResults: [], winnerUid: '',
    roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: now
  });
  try { await batch.commit(); }
  catch (error) { console.error('start grid race failed', error); showToast('레이스를 시작하지 못했습니다.'); }
}

function actionButton(action, selected) {
  return `<button class="grid-action ${selected === action.id ? 'is-selected' : ''}" data-grid-action="${action.id}" type="button"><span>${action.emoji}</span><strong>${action.label}</strong><small>${escapeText(action.description)}</small>${selected === action.id ? '<em>선택 완료</em>' : ''}</button>`;
}

function renderRound() {
  const mine = currentRoundAnswers().find(answer => answer.uid === currentUid);
  const player = playerByUid(currentUid);
  app.innerHTML = `<section class="panel grid-race-panel"><div class="round-head"><div><span class="round-label">TURN ${Number(room.round)} · 30칸 먼저</span><div class="grid-resource">🛡️ ${Number(player?.shield || 0)} · ♻️ ${Number(player?.scrap || 0)}/3${player?.banked ? ` · 🪞 +${Number(player.banked)}` : ''}${player?.jammed ? ' · 🕸️ 감속' : ''}</div></div><span class="timer" id="round-timer">${remainingSeconds()}</span></div>${boardMarkup(player)}<div class="grid-now"><strong>내 진행 ${Number(player?.position || 0)}/30</strong><span>앞의 장치를 보고 도구를 고르세요.</span></div><div class="grid-actions">${Object.values(ACTIONS).map(action => actionButton(action, mine?.text || '')).join('')}</div><div class="status-line" id="submitted-count">${submissionLabel(mine)}</div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal-round" type="button" ${canReveal() ? '' : 'disabled'}>${allSubmitted() ? '전원 선택 · 동시에 출발' : '시간 종료 후 출발'}</button></div>` : ''}<div class="divider"></div><ul class="grid-racers">${progressListMarkup()}</ul></section>`;
  document.querySelectorAll('[data-grid-action]').forEach(button => button.addEventListener('click', () => void chooseAction(button.dataset.gridAction)));
  document.getElementById('reveal-round')?.addEventListener('click', revealRound);
  runTimer();
}

async function chooseAction(actionId) {
  if (!Object.hasOwn(ACTIONS, actionId) || room?.roundState !== 'open' || remainingSeconds() <= 0) return;
  const player = playerByUid(currentUid);
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `choice-${currentUid}`), {
      uid: currentUid, nickname: player?.nickname || '플레이어', round: Number(room.round),
      kind: 'grid-action', text: actionId, createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
  } catch (error) { console.error('save grid action failed', error); showToast('도구 선택을 저장하지 못했습니다.'); }
}

function updateRoundLive() {
  if (room?.roundState !== 'open') return;
  const mine = currentRoundAnswers().find(answer => answer.uid === currentUid);
  document.querySelectorAll('[data-grid-action]').forEach(button => {
    button.classList.toggle('is-selected', button.dataset.gridAction === mine?.text);
    button.querySelector('em')?.remove();
    if (button.dataset.gridAction === mine?.text) {
      const tag = document.createElement('em'); tag.textContent = '선택 완료'; button.append(tag);
    }
  });
  const status = document.getElementById('submitted-count');
  if (status) status.textContent = submissionLabel(mine);
  const reveal = document.getElementById('reveal-round');
  if (reveal) {
    reveal.disabled = !canReveal() || resolving;
    reveal.textContent = allSubmitted() ? '전원 선택 · 동시에 출발' : remainingSeconds() <= 0 ? '시간 종료 · 출발' : '시간 종료 후 출발';
  }
}

function runTimer() {
  clearInterval(timerId);
  const tick = () => {
    const seconds = remainingSeconds();
    const timer = document.getElementById('round-timer');
    if (timer) { timer.textContent = String(seconds); timer.classList.toggle('is-urgent', seconds <= 3); }
    updateRoundLive();
    if (seconds <= 0) {
      document.querySelectorAll('[data-grid-action]').forEach(button => { button.disabled = true; });
      clearInterval(timerId); timerId = null;
    }
  };
  tick();
  timerId = setInterval(tick, 400);
}

async function revealRound() {
  if (!isHost() || resolving || room?.roundState !== 'open' || !canReveal()) return;
  resolving = true;
  updateRoundLive();
  const board = normalizeBoard(room.board);
  const now = Timestamp.now();
  const results = players.map(player => {
    const answer = currentRoundAnswers().find(item => item.uid === player.uid);
    const resolved = resolveTurn(player, answer?.text || 'idle', board);
    return {
      uid: player.uid,
      nickname: player.nickname || '플레이어',
      action: resolved.action,
      actionLabel: resolved.actionLabel,
      from: resolved.before.position,
      to: resolved.state.position,
      delta: resolved.delta,
      events: resolved.events.slice(0, 6),
      ...resolved.state,
      joinOrder: Number(player.joinOrder || 0)
    };
  });
  const finishers = rankPlayers(results.filter(result => result.position >= BOARD_SIZE));
  const timedOut = Number(room.round || 0) >= MAX_ROUNDS;
  const winner = finishers[0] || (timedOut ? rankPlayers(results)[0] : null);
  const batch = writeBatch(db);
  results.forEach(result => batch.update(doc(db, 'game_rooms', roomId, 'players', result.uid), {
    score: result.position,
    position: result.position,
    shield: result.shield,
    scrap: result.scrap,
    banked: result.banked,
    jammed: result.jammed,
    barrierDent: result.barrierDent,
    finishPower: result.finishPower,
    lastDelta: result.delta,
    updatedAt: now
  }));
  batch.update(doc(db, 'game_rooms', roomId), {
    status: winner ? 'finished' : 'playing',
    roundState: winner ? 'finished' : 'reveal',
    winnerUid: winner?.uid || '',
    lastResults: results.map(({ joinOrder, ...result }) => result),
    updatedAt: now
  });
  try { await batch.commit(); }
  catch (error) { resolving = false; console.error('resolve grid turn failed', error); showToast('턴 결과를 처리하지 못했습니다.'); updateRoundLive(); }
}

function resultEvents(result) {
  const events = Array.isArray(result?.events) && result.events.length ? result.events : ['평범한 칸을 통과'];
  return events.map(event => `<span>${escapeText(event)}</span>`).join('');
}

function renderReveal() {
  clearInterval(timerId);
  timerId = null;
  const results = Array.isArray(room.lastResults) ? room.lastResults : [];
  app.innerHTML = `<section class="panel"><span class="kicker">TURN ${Number(room.round)} RESULT</span><h2>동시 출발 결과</h2><p class="lead">채운 칸은 유지됩니다. 장치에 맞춰 다음 도구를 고르세요.</p><ul class="grid-turn-results">${rankPlayers(results).map(result => `<li><span class="grid-result-action">${escapeText(ACTIONS[result.action]?.emoji || '⌛')}</span><span><strong>${escapeText(result.nickname)} · ${Number(result.to || 0)}/30</strong><small>${escapeText(result.actionLabel)} · ${Number(result.delta || 0) > 0 ? `+${Number(result.delta)}` : '제자리'}</small><em>${resultEvents(result)}</em></span></li>`).join('')}</ul><div class="divider"></div><ul class="grid-racers">${progressListMarkup()}</ul>${isHost() ? '<div class="button-row"><button class="primary-button" id="next-round" type="button">다음 도구 선택</button></div>' : '<p class="lobby-note">방장이 다음 턴을 열 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('next-round')?.addEventListener('click', nextRound);
}

async function nextRound() {
  if (!isHost() || room?.roundState !== 'reveal') return;
  try {
    await updateDoc(doc(db, 'game_rooms', roomId), {
      round: Number(room.round || 0) + 1,
      roundState: 'open',
      lastResults: [],
      roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000),
      updatedAt: Timestamp.now()
    });
  } catch (error) { console.error('open next grid turn failed', error); showToast('다음 턴을 열지 못했습니다.'); }
}

function renderFinished() {
  clearInterval(timerId);
  timerId = null;
  const ranking = rankPlayers(players);
  const winner = playerByUid(room.winnerUid) || ranking[0];
  app.innerHTML = `<section class="panel grid-finished"><span class="kicker">30 CELLS COMPLETE</span><div class="grid-trophy">🏁</div><h1>${escapeText(winner?.nickname || '플레이어')} 완주!</h1><p class="lead">30칸을 가장 먼저 채웠습니다.${Number(winner?.finishPower || 0) ? ` 동시 완주 승부는 남은 힘 ${Number(winner.finishPower)}로 결정됐어요.` : ''}</p><ol class="ranking">${ranking.map((player, index) => `<li class="rank-item ${player.uid === winner?.uid ? 'winner' : ''}"><span class="rank-number">${['🥇','🥈','🥉'][index] || index + 1}</span><span class="rank-name">${escapeText(player.nickname)}</span><span class="rank-score">${Number(player.position || 0)}/30</span></li>`).join('')}</ol>${isHost() ? '<div class="button-row"><button class="primary-button" id="restart-game" type="button">같은 멤버로 다시 달리기</button></div>' : '<p class="lobby-note">방장이 다시 출발시키면 같은 방에서 이어집니다.</p>'}<div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none">소소킹 플레이 홈</a></div></section>`;
  document.getElementById('restart-game')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  try {
    const answerSnap = await getDocs(collection(db, 'game_rooms', roomId, 'answers'));
    const now = Timestamp.now();
    const batch = writeBatch(db);
    answerSnap.docs.forEach(item => batch.delete(item.ref));
    players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: 0, position: 0, shield: 0, scrap: 0, banked: 0, jammed: false,
      barrierDent: false, finishPower: 0, lastDelta: 0, updatedAt: now
    }));
    batch.update(doc(db, 'game_rooms', roomId), {
      status: 'lobby', round: 0, roundState: 'waiting', board: buildBoard(`${roomId}-${Date.now()}`),
      lastResults: [], winnerUid: '', roundEndsAt: deleteField(), updatedAt: now
    });
    await batch.commit();
  } catch (error) { console.error('restart grid race failed', error); showToast('새 레이스를 준비하지 못했습니다.'); }
}

function renderError(message) {
  clearInterval(timerId);
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-button" href="/game/grid/" style="display:grid;place-items:center;text-decoration:none">처음 화면으로</a></div></section>`;
}

async function boot() {
  try {
    await initAuth();
    currentUid = auth.currentUser?.uid || '';
    if (!currentUid) throw new Error('auth');
    const code = normalizeCode(new URL(location.href).searchParams.get('room'));
    if (!code) return renderLanding();
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== GAME_TYPE) {
      renderLanding(code);
      return showToast('초대받은 칸폭주 30 방을 찾지 못했습니다.');
    }
    roomId = code;
    if (await ensureMembership(code)) subscribeRoom(code);
  } catch (error) {
    console.error('boot grid race failed', error);
    renderError('레이스를 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.');
  }
}

shareButton?.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
void boot();
