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
const MAX_ROUNDS = 5;
const MAX_STAGES = 5;
const ROUND_SECONDS = 10;
const STAGES = [
  { stage: 1, reward: 100, risk: 8 },
  { stage: 2, reward: 220, risk: 18 },
  { stage: 3, reward: 380, risk: 32 },
  { stage: 4, reward: 600, risk: 48 },
  { stage: 5, reward: 900, risk: 65 }
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
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastId);
  toastId = setTimeout(() => { toast.hidden = true; }, 2200);
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
  unsubscribeRoom?.(); unsubscribePlayers?.(); unsubscribeAnswers?.();
  unsubscribeRoom = null; unsubscribePlayers = null; unsubscribeAnswers = null;
  clearInterval(timerId); timerId = null;
}

function setRoomUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code); else url.searchParams.delete('room');
  history.replaceState({}, '', url);
}

function inviteUrl() {
  return `${location.origin}/game/greed/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const data = { title: '소소킹 욕심계단 초대', text: `욕심계단 방 ${roomId}에서 어디까지 갈래?`, url: inviteUrl() };
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(data.url); showToast('초대 링크를 복사했습니다.'); }
  catch { window.prompt('이 링크를 복사해서 보내주세요.', data.url); }
}

function isHost() { return Boolean(room && currentUid && room.hostUid === currentUid); }
function playerByUid(uid) { return players.find(player => player.uid === uid); }
function activePlayers() { return players.filter(player => (player.runState || 'active') === 'active'); }
function stageSpec(stage = Number(room?.stage || 1)) { return STAGES[Math.max(0, Math.min(MAX_STAGES - 1, stage - 1))]; }
function currentAnswers() {
  return answers.filter(item => item.kind === 'greed' && Number(item.round) === Number(room?.round || 0) && Number(item.stage) === Number(room?.stage || 0));
}
function myAnswer() { return currentAnswers().find(item => item.uid === currentUid); }
function sortedPlayers() {
  return [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function stateLabel(player) {
  const state = player.runState || 'waiting';
  if (state === 'active') return '<span class="run-state active">도전중</span>';
  if (state === 'cashed') return '<span class="run-state cashed">챙김</span>';
  if (state === 'busted') return '<span class="run-state busted">추락</span>';
  return '';
}

function playerListMarkup(showScores = false) {
  const source = showScores ? sortedPlayers() : [...players].sort((a, b) => Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
  return source.map(player => `<li class="player-item"><span class="player-name">${escapeText(player.nickname || '플레이어')}${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}${room?.status === 'playing' ? stateLabel(player) : ''}</span>${showScores ? `<span class="player-score">${Number(player.score || 0).toLocaleString()}C</span>` : ''}</li>`).join('');
}

function renderLanding(prefilledCode = '') {
  stopSubscriptions(); room = null; players = []; answers = []; shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">PUSH YOUR LUCK</span><h1>🧨 욕심계단</h1><p class="lead">매번 딱 두 개만 선택합니다. 지금까지의 보상을 챙길지, 더 큰 보상을 노리고 한 칸 더 오를지 결정하세요.</p><div class="rule-strip"><span>💰 챙기면 안전</span><span>🧨 올라가면 보상↑</span><span>💥 무너지면 이번 판 0</span></div><form id="create-room-form"><label class="field"><span>내 닉네임</span><input id="create-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="primary-button" type="submit">계단방 만들기</button></div></form><div class="divider"></div><form id="join-room-form"><label class="field"><span>초대 코드</span><input id="join-code" value="${escapeText(prefilledCode)}" maxlength="6" autocomplete="off" placeholder="예: AB7K2Q" required></label><label class="field"><span>내 닉네임</span><input id="join-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="secondary-button" type="submit">초대받은 방 입장</button></div></form></section>`;
  document.getElementById('create-room-form')?.addEventListener('submit', event => { event.preventDefault(); void createRoom(document.getElementById('create-nickname').value); });
  document.getElementById('join-room-form')?.addEventListener('submit', event => { event.preventDefault(); void joinRoom(document.getElementById('join-code').value, document.getElementById('join-nickname').value); });
}

async function createRoom(nicknameValue) {
  const nickname = cleanNickname(nicknameValue); if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode(); const snap = await getDoc(doc(db, 'game_rooms', candidate));
      if (!snap.exists()) { code = candidate; break; }
    }
    if (!code) throw new Error('room-code');
    await setDoc(doc(db, 'game_rooms', code), {
      type: 'greed-stairs', status: 'lobby', hostUid: currentUid, maxPlayers: MAX_PLAYERS,
      round: 0, maxRounds: MAX_ROUNDS, roundState: 'waiting', stage: 0, maxStages: MAX_STAGES,
      reward: 0, risk: 0, roundSeconds: ROUND_SECONDS, collapsed: false, lastResults: [],
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid, nickname, score: 0, runState: 'waiting', joinOrder: Date.now(), joinedAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) { console.error(error); showToast('게임방을 만들지 못했습니다.'); }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeRoomCode(codeValue); const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists()) throw new Error('room-not-found');
    if (roomSnap.data().type !== 'greed-stairs') throw new Error('wrong-game');
    if (roomSnap.data().status !== 'lobby') throw new Error('game-started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [playerSnap, playerDocs] = await Promise.all([getDoc(playerRef), getDocs(collection(db, 'game_rooms', code, 'players'))]);
    if (playerDocs.size >= MAX_PLAYERS && !playerSnap.exists()) throw new Error('room-full');
    await setDoc(playerRef, {
      uid: currentUid, nickname, score: 0, runState: 'waiting',
      joinOrder: playerSnap.exists() ? Number(playerSnap.data().joinOrder || Date.now()) : Date.now(),
      joinedAt: playerSnap.exists() ? playerSnap.data().joinedAt || Timestamp.now() : Timestamp.now(), updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) {
    console.error(error);
    const message = error?.message === 'game-started' ? '이미 시작된 방입니다.' : error?.message === 'room-full' ? '8명이 모두 들어왔습니다.' : '게임방에 입장하지 못했습니다.';
    showToast(message);
  }
}

async function ensureMembership(code) {
  const snap = await getDoc(doc(db, 'game_rooms', code, 'players', currentUid));
  if (snap.exists()) return true;
  renderInviteJoin(code, sessionStorage.getItem(`sosoking-game-nickname:${code}`) || ''); return false;
}

function renderInviteJoin(code, saved = '') {
  stopSubscriptions(); shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">게임 초대</span><h1>🧨 욕심계단에 초대됐어요</h1><div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div><form id="invite-join-form"><label class="field"><span>내 닉네임</span><input id="invite-nickname" maxlength="12" value="${escapeText(saved)}" required></label><div class="button-row"><button class="primary-button" type="submit">입장하기</button></div></form></section>`;
  document.getElementById('invite-join-form')?.addEventListener('submit', event => { event.preventDefault(); void joinRoom(code, document.getElementById('invite-nickname').value); });
}

function subscribeRoom(code) {
  stopSubscriptions(); roomId = code; shareButton.hidden = false;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snap => {
    if (!snap.exists()) return renderLanding();
    room = { id: snap.id, ...snap.data() }; renderCurrent();
  }, error => { console.error(error); renderError('게임방을 불러오지 못했습니다.'); });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snap => { players = snap.docs.map(item => ({ id: item.id, ...item.data() })); renderCurrent(); });
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snap => { answers = snap.docs.map(item => ({ id: item.id, ...item.data() })); updateLiveStatus(); });
}

function renderCurrent() {
  if (!room) return;
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'playing' && room.roundState === 'open') return renderStep();
  if (room.status === 'playing' && room.roundState === 'reveal') return renderReveal();
  if (room.status === 'finished') return renderFinished();
}

function renderLobby() {
  clearInterval(timerId); timerId = null;
  app.innerHTML = `<section class="panel"><span class="kicker">대기실</span><h2>2명 이상 모이면 시작</h2><p class="lead">총 5번의 등반. 각 등반은 최대 5계단입니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div><div class="button-row two"><button class="secondary-button" id="invite" type="button">카톡으로 초대</button><button class="secondary-button" id="copy-code" type="button">코드 복사</button></div><ul class="player-list">${playerListMarkup(false)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="start" type="button" ${players.length >= 2 ? '' : 'disabled'}>게임 시작 (${players.length}/${MAX_PLAYERS})</button></div>` : '<p class="lobby-note">방장이 시작할 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy-code')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(roomId); showToast('코드를 복사했습니다.'); } catch { showToast(roomId); } });
  document.getElementById('start')?.addEventListener('click', startGame);
}

async function startGame() {
  if (!isHost() || players.length < 2) return;
  const spec = STAGES[0]; const batch = writeBatch(db);
  players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, runState: 'active', updatedAt: Timestamp.now() }));
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing', round: 1, roundState: 'open', stage: 1, reward: spec.reward, risk: spec.risk,
    collapsed: false, lastResults: [], roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now()
  });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('게임을 시작하지 못했습니다.'); }
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0; return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function allActiveSubmitted() {
  const active = activePlayers(); const ids = new Set(currentAnswers().map(item => item.uid));
  return active.length > 0 && active.every(player => ids.has(player.uid));
}

function stairMarkup() {
  return [...STAGES].reverse().map(spec => `<div class="stair-step ${spec.stage === Number(room.stage) ? 'is-current' : spec.stage < Number(room.stage) ? 'is-past' : ''}"><span>${spec.stage}층</span><strong>${spec.reward}C</strong><small>기본 위험 ${spec.risk}%</small></div>`).join('');
}

function effectiveRisk() {
  const climbers = currentAnswers().filter(item => item.text === 'climb').length;
  return Math.min(85, Number(room?.risk || 0) + Math.max(0, climbers - 1) * 5);
}

function renderStep() {
  clearInterval(timerId);
  const me = playerByUid(currentUid); const active = (me?.runState || '') === 'active'; const mine = myAnswer();
  app.innerHTML = `<section class="panel"><div class="round-head"><span class="round-label">RUN ${Number(room.round)} / ${MAX_ROUNDS} · ${Number(room.stage)}층</span><span class="timer" id="round-timer">${remainingSeconds()}</span></div><h2>지금 ${Number(room.reward).toLocaleString()}C</h2><p class="lead">챙기면 이번 등반 보상을 안전하게 확보합니다. 한 칸 더 가면 다음 보상이 커지지만 계단이 무너질 수 있습니다.</p><div class="stair-visual">${stairMarkup()}</div><div class="risk-meter"><div class="risk-top"><span>현재 붕괴 위험</span><strong id="risk-value">${Number(room.risk)}%</strong></div><div class="risk-track"><div class="risk-fill" id="risk-fill" style="width:${Number(room.risk)}%"></div></div><small class="lobby-note">같이 올라가는 사람이 많으면 붕괴 위험이 조금 더 올라갑니다.</small></div>${active ? `<div class="greed-actions"><button class="greed-choice cash ${mine?.text === 'cash' ? 'is-selected' : ''}" data-choice="cash" type="button"><b>💰 먹고 나가기</b><small>${Number(room.reward)}C 확보</small></button><button class="greed-choice climb ${mine?.text === 'climb' ? 'is-selected' : ''}" data-choice="climb" type="button"><b>🧨 한 칸 더</b><small>더 큰 보상 도전</small></button></div><div class="status-line" id="submit-status">${mine ? '선택 완료 · 공개 전까지 변경 가능' : '둘 중 하나를 선택하세요.'}</div>` : `<div class="score-banner">이번 등반은 이미 ${me?.runState === 'cashed' ? '안전하게 챙겼습니다.' : '추락했습니다.'} 다른 사람의 결과를 지켜보세요.</div>`}<div class="submitted-count" id="submitted-count">도전자 ${currentAnswers().length}/${activePlayers().length}명 선택</div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal" type="button" ${(remainingSeconds() <= 0 || allActiveSubmitted()) ? '' : 'disabled'}>${allActiveSubmitted() ? '전원 선택! 결과 공개' : '시간 종료 후 공개'}</button></div>` : ''}<div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul></section>`;
  document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => void submitChoice(button.dataset.choice)));
  document.getElementById('reveal')?.addEventListener('click', resolveStep);
  runTimer(); updateLiveStatus();
}

function updateLiveStatus() {
  if (!room || room.status !== 'playing' || room.roundState !== 'open') return;
  const count = document.getElementById('submitted-count'); if (count) count.textContent = `도전자 ${currentAnswers().length}/${activePlayers().length}명 선택`;
  const mine = myAnswer();
  document.querySelectorAll('[data-choice]').forEach(button => button.classList.toggle('is-selected', button.dataset.choice === mine?.text));
  const status = document.getElementById('submit-status'); if (status && mine) status.textContent = '선택 완료 · 공개 전까지 변경 가능';
  const risk = effectiveRisk(); const riskText = document.getElementById('risk-value'); const riskFill = document.getElementById('risk-fill');
  if (riskText) riskText.textContent = `${risk}%`; if (riskFill) riskFill.style.width = `${risk}%`;
  const reveal = document.getElementById('reveal'); if (reveal) { reveal.disabled = !(remainingSeconds() <= 0 || allActiveSubmitted()); reveal.textContent = allActiveSubmitted() ? '전원 선택! 결과 공개' : '시간 종료 후 공개'; }
}

function runTimer() {
  clearInterval(timerId);
  const tick = () => {
    const seconds = remainingSeconds(); const timer = document.getElementById('round-timer');
    if (timer) { timer.textContent = String(seconds); timer.classList.toggle('is-urgent', seconds <= 3); }
    if (seconds <= 0) { document.querySelectorAll('[data-choice]').forEach(button => { button.disabled = true; }); clearInterval(timerId); timerId = null; }
    updateLiveStatus();
  };
  tick(); timerId = setInterval(tick, 400);
}

async function submitChoice(choice) {
  const me = playerByUid(currentUid);
  if (!room || room.roundState !== 'open' || me?.runState !== 'active' || remainingSeconds() <= 0) return;
  if (!['cash', 'climb'].includes(choice)) return;
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `greed-${room.round}-${room.stage}-${currentUid}`), {
      uid: currentUid, nickname: me.nickname || '플레이어', kind: 'greed', round: Number(room.round), stage: Number(room.stage), text: choice, createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('선택을 저장하지 못했습니다.'); }
}

function secureRandomPercent() {
  const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return bytes[0] / 4294967296 * 100;
}

async function resolveStep() {
  if (!isHost() || room.roundState !== 'open' || !(remainingSeconds() <= 0 || allActiveSubmitted())) return;
  const active = activePlayers(); const answerMap = new Map(currentAnswers().map(item => [item.uid, item.text]));
  const cashers = active.filter(player => answerMap.get(player.uid) === 'cash');
  const climbers = active.filter(player => answerMap.get(player.uid) === 'climb');
  const effective = Math.min(85, Number(room.risk || 0) + Math.max(0, climbers.length - 1) * 5);
  const collapsed = climbers.length > 0 && secureRandomPercent() < effective;
  const atTop = Number(room.stage) >= MAX_STAGES;
  const batch = writeBatch(db); const results = [];

  cashers.forEach(player => {
    const delta = Number(room.reward || 0);
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: Number(player.score || 0) + delta, runState: 'cashed', updatedAt: Timestamp.now() });
    results.push({ uid: player.uid, nickname: player.nickname, choice: 'cash', delta, label: `안전하게 ${delta}C 확보` });
  });

  climbers.forEach(player => {
    if (collapsed) {
      batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { runState: 'busted', updatedAt: Timestamp.now() });
      results.push({ uid: player.uid, nickname: player.nickname, choice: 'climb', delta: 0, label: '계단 붕괴 · 이번 등반 0C' });
    } else if (atTop) {
      const delta = Number(room.reward || 0) + 250;
      batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: Number(player.score || 0) + delta, runState: 'cashed', updatedAt: Timestamp.now() });
      results.push({ uid: player.uid, nickname: player.nickname, choice: 'climb', delta, label: `정상 정복! ${delta}C` });
    } else {
      results.push({ uid: player.uid, nickname: player.nickname, choice: 'climb', delta: 0, label: '생존! 다음 층 도전' });
    }
  });

  active.filter(player => !answerMap.has(player.uid)).forEach(player => {
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { runState: 'busted', updatedAt: Timestamp.now() });
    results.push({ uid: player.uid, nickname: player.nickname, choice: 'timeout', delta: 0, label: '시간 초과 · 이번 등반 0C' });
  });

  batch.update(doc(db, 'game_rooms', roomId), { roundState: 'reveal', collapsed, effectiveRisk: effective, lastResults: results, updatedAt: Timestamp.now() });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('결과를 계산하지 못했습니다.'); }
}

function renderReveal() {
  clearInterval(timerId); timerId = null;
  const results = Array.isArray(room.lastResults) ? room.lastResults : [];
  const continuePossible = !room.collapsed && Number(room.stage) < MAX_STAGES && players.some(player => player.runState === 'active');
  const rows = results.map(result => `<li class="result-item"><span><strong>${escapeText(result.nickname || '플레이어')}</strong><small>${escapeText(result.label || '')}</small></span><span class="result-delta ${Number(result.delta) > 0 ? 'plus' : 'zero'}">${Number(result.delta) > 0 ? `+${Number(result.delta)}C` : '0C'}</span></li>`).join('');
  app.innerHTML = `<section class="panel"><span class="kicker">RUN ${Number(room.round)} · ${Number(room.stage)}층 결과</span><h2>${room.collapsed ? '💥 계단이 무너졌습니다' : continuePossible ? '😈 아직 더 올라갈 수 있습니다' : '🏁 이번 등반 종료'}</h2>${room.collapsed ? '<div class="collapse-banner">한 칸 더를 고른 사람은 이번 등반 보상을 잃었습니다.</div>' : '<div class="safe-banner">이번 계단은 버텼습니다.</div>'}<ul class="result-list">${rows}</ul><div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="next" type="button">${continuePossible ? '다음 층 열기' : Number(room.round) >= MAX_ROUNDS ? '최종 순위 보기' : '다음 등반 시작'}</button></div>` : '<p class="lobby-note">방장이 다음 단계를 열 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('next')?.addEventListener('click', () => void nextStepOrRound(continuePossible));
}

async function nextStepOrRound(continuePossible) {
  if (!isHost() || room.roundState !== 'reveal') return;
  if (continuePossible) {
    const next = stageSpec(Number(room.stage) + 1);
    try { await updateDoc(doc(db, 'game_rooms', roomId), { roundState: 'open', stage: next.stage, reward: next.reward, risk: next.risk, collapsed: false, lastResults: [], roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now() }); }
    catch (error) { console.error(error); showToast('다음 층을 열지 못했습니다.'); }
    return;
  }
  if (Number(room.round) >= MAX_ROUNDS) {
    try { await updateDoc(doc(db, 'game_rooms', roomId), { status: 'finished', updatedAt: Timestamp.now() }); } catch (error) { console.error(error); }
    return;
  }
  const batch = writeBatch(db); players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { runState: 'active', updatedAt: Timestamp.now() }));
  const first = STAGES[0];
  batch.update(doc(db, 'game_rooms', roomId), { round: Number(room.round) + 1, roundState: 'open', stage: 1, reward: first.reward, risk: first.risk, collapsed: false, lastResults: [], roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now() });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('다음 등반을 시작하지 못했습니다.'); }
}

function renderFinished() {
  clearInterval(timerId); timerId = null; const ranking = sortedPlayers(); const medals = ['👑','🥈','🥉'];
  app.innerHTML = `<section class="panel"><span class="kicker">GAME OVER</span><h1>🏆 욕심왕은 ${escapeText(ranking[0]?.nickname || '플레이어')}</h1><p class="lead">안전하게 챙길지 끝까지 밀어붙일지, 5번의 등반이 끝났습니다.</p><ol class="ranking">${ranking.map((player, index) => `<li class="rank-item ${index === 0 ? 'winner' : ''}"><span class="rank-number">${medals[index] || index + 1}</span><span class="rank-name">${escapeText(player.nickname)}</span><span class="rank-score">${Number(player.score || 0).toLocaleString()}C</span></li>`).join('')}</ol>${isHost() ? '<div class="button-row"><button class="primary-button" id="restart" type="button">같은 멤버로 한 판 더</button></div>' : ''}<div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none">소소킹 플레이 홈</a></div></section>`;
  document.getElementById('restart')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  try {
    const answerSnap = await getDocs(collection(db, 'game_rooms', roomId, 'answers')); const batch = writeBatch(db);
    answerSnap.docs.forEach(answer => batch.delete(answer.ref));
    players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, runState: 'waiting', updatedAt: Timestamp.now() }));
    batch.update(doc(db, 'game_rooms', roomId), { status: 'lobby', round: 0, roundState: 'waiting', stage: 0, reward: 0, risk: 0, collapsed: false, lastResults: [], updatedAt: Timestamp.now() });
    await batch.commit();
  } catch (error) { console.error(error); showToast('다시 시작하지 못했습니다.'); }
}

function renderError(message) {
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-button" href="/game/greed/" style="display:grid;place-items:center;text-decoration:none">처음으로</a></div></section>`;
}

async function boot() {
  try {
    await initAuth(); currentUid = auth.currentUser?.uid || ''; if (!currentUid) throw new Error('auth');
    const code = normalizeRoomCode(new URL(location.href).searchParams.get('room'));
    if (!code) return renderLanding();
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists()) { renderLanding(code); return showToast('초대받은 방이 없거나 종료되었습니다.'); }
    if (roomSnap.data().type !== 'greed-stairs') { renderLanding(); return showToast('다른 게임의 방입니다.'); }
    roomId = code; if (await ensureMembership(code)) subscribeRoom(code);
  } catch (error) { console.error(error); renderError('게임을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.'); }
}

shareButton.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
void boot();
