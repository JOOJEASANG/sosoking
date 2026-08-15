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
const MAX_ROUNDS = 8;
const ROUND_SECONDS = 10;
const NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

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
  toast.textContent = message; toast.hidden = false; clearTimeout(toastId);
  toastId = setTimeout(() => { toast.hidden = true; }, 2200);
}
function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = new Uint8Array(6); crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}
function normalizeRoomCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6); }
function cleanNickname(value) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 12); }
function pickNumber(exclude = []) {
  const pool = NUMBERS.filter(number => !exclude.includes(number));
  const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return pool[bytes[0] % pool.length];
}
function stopSubscriptions() {
  unsubscribeRoom?.(); unsubscribePlayers?.(); unsubscribeAnswers?.();
  unsubscribeRoom = null; unsubscribePlayers = null; unsubscribeAnswers = null;
  clearInterval(timerId); timerId = null;
}
function setRoomUrl(code) {
  const url = new URL(location.href); if (code) url.searchParams.set('room', code); else url.searchParams.delete('room'); history.replaceState({}, '', url);
}
function inviteUrl() { return `${location.origin}/game/caught/?room=${encodeURIComponent(roomId)}`; }
async function shareRoom() {
  if (!roomId) return;
  const data = { title: '소소킹 딱걸렸어 초대', text: `딱걸렸어 방 ${roomId}에서 숫자 눈치싸움 하자!`, url: inviteUrl() };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(data.url); showToast('초대 링크를 복사했습니다.'); }
  catch { window.prompt('이 링크를 복사해서 보내주세요.', data.url); }
}
function isHost() { return Boolean(room && currentUid && room.hostUid === currentUid); }
function currentAnswers() { return answers.filter(item => item.kind === 'number' && Number(item.round) === Number(room?.round || 0)); }
function myAnswer() { return currentAnswers().find(item => item.uid === currentUid); }
function sortedPlayers() {
  return [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}
function playerListMarkup(showScores = false) {
  const source = showScores ? sortedPlayers() : [...players].sort((a, b) => Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
  return source.map(player => `<li class="player-item"><span class="player-name">${escapeText(player.nickname || '플레이어')}${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}</span>${showScores ? `<span class="player-score">${Number(player.score || 0)}점</span>` : ''}</li>`).join('');
}
function renderLanding(prefilledCode = '') {
  stopSubscriptions(); room = null; players = []; answers = []; shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">UNIQUE LOW</span><h1>🎯 딱걸렸어</h1><p class="lead">1~12 중 숫자 하나만 고르세요. 겹친 숫자는 탈락하고, 혼자 고른 숫자 중 가장 작은 숫자가 이깁니다.</p><div class="rule-strip"><span>☝️ 숫자 1개</span><span>💥 중복 탈락</span><span>🏆 가장 작은 단독 숫자 승</span></div><form id="create-room-form"><label class="field"><span>내 닉네임</span><input id="create-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="primary-button" type="submit">숫자방 만들기</button></div></form><div class="divider"></div><form id="join-room-form"><label class="field"><span>초대 코드</span><input id="join-code" value="${escapeText(prefilledCode)}" maxlength="6" autocomplete="off" placeholder="예: AB7K2Q" required></label><label class="field"><span>내 닉네임</span><input id="join-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="secondary-button" type="submit">초대받은 방 입장</button></div></form></section>`;
  document.getElementById('create-room-form')?.addEventListener('submit', event => { event.preventDefault(); void createRoom(document.getElementById('create-nickname').value); });
  document.getElementById('join-room-form')?.addEventListener('submit', event => { event.preventDefault(); void joinRoom(document.getElementById('join-code').value, document.getElementById('join-nickname').value); });
}
async function createRoom(nicknameValue) {
  const nickname = cleanNickname(nicknameValue); if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode(); const snap = await getDoc(doc(db, 'game_rooms', candidate)); if (!snap.exists()) { code = candidate; break; }
    }
    if (!code) throw new Error('room-code');
    await setDoc(doc(db, 'game_rooms', code), {
      type: 'unique-low', status: 'lobby', hostUid: currentUid, maxPlayers: MAX_PLAYERS,
      round: 0, maxRounds: MAX_ROUNDS, roundState: 'waiting', roundSeconds: ROUND_SECONDS,
      bannedNumber: 0, bonusNumber: 0, lastResults: [], winnerUid: '', winnerNumber: 0,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid, nickname, score: 0, joinOrder: Date.now(), joinedAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname); roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) { console.error(error); showToast('게임방을 만들지 못했습니다.'); }
}
async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeRoomCode(codeValue); const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.'); if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    const roomSnap = await getDoc(doc(db, 'game_rooms', code)); if (!roomSnap.exists()) throw new Error('room-not-found');
    if (roomSnap.data().type !== 'unique-low') throw new Error('wrong-game'); if (roomSnap.data().status !== 'lobby') throw new Error('game-started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [playerSnap, playerDocs] = await Promise.all([getDoc(playerRef), getDocs(collection(db, 'game_rooms', code, 'players'))]);
    if (playerDocs.size >= MAX_PLAYERS && !playerSnap.exists()) throw new Error('room-full');
    await setDoc(playerRef, {
      uid: currentUid, nickname, score: 0,
      joinOrder: playerSnap.exists() ? Number(playerSnap.data().joinOrder || Date.now()) : Date.now(),
      joinedAt: playerSnap.exists() ? playerSnap.data().joinedAt || Timestamp.now() : Timestamp.now(), updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname); roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) {
    console.error(error); const message = error?.message === 'game-started' ? '이미 시작된 방입니다.' : error?.message === 'room-full' ? '8명이 모두 들어왔습니다.' : '게임방에 입장하지 못했습니다.'; showToast(message);
  }
}
async function ensureMembership(code) {
  const snap = await getDoc(doc(db, 'game_rooms', code, 'players', currentUid)); if (snap.exists()) return true;
  renderInviteJoin(code, sessionStorage.getItem(`sosoking-game-nickname:${code}`) || ''); return false;
}
function renderInviteJoin(code, saved = '') {
  stopSubscriptions(); shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">게임 초대</span><h1>🎯 딱걸렸어에 초대됐어요</h1><div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div><form id="invite-join-form"><label class="field"><span>내 닉네임</span><input id="invite-nickname" maxlength="12" value="${escapeText(saved)}" required></label><div class="button-row"><button class="primary-button" type="submit">입장하기</button></div></form></section>`;
  document.getElementById('invite-join-form')?.addEventListener('submit', event => { event.preventDefault(); void joinRoom(code, document.getElementById('invite-nickname').value); });
}
function subscribeRoom(code) {
  stopSubscriptions(); roomId = code; shareButton.hidden = false;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snap => { if (!snap.exists()) return renderLanding(); room = { id: snap.id, ...snap.data() }; renderCurrent(); }, error => { console.error(error); renderError('게임방을 불러오지 못했습니다.'); });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snap => { players = snap.docs.map(item => ({ id: item.id, ...item.data() })); renderCurrent(); });
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snap => { answers = snap.docs.map(item => ({ id: item.id, ...item.data() })); updateLiveStatus(); });
}
function renderCurrent() {
  if (!room) return; if (room.status === 'lobby') return renderLobby();
  if (room.status === 'playing' && room.roundState === 'open') return renderRound();
  if (room.status === 'playing' && room.roundState === 'reveal') return renderReveal();
  if (room.status === 'finished') return renderFinished();
}
function renderLobby() {
  clearInterval(timerId); timerId = null;
  app.innerHTML = `<section class="panel"><span class="kicker">대기실</span><h2>2명 이상 모이면 시작</h2><p class="lead">8라운드 동안 숫자 하나만 고르면 됩니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div><div class="button-row two"><button class="secondary-button" id="invite" type="button">카톡으로 초대</button><button class="secondary-button" id="copy-code" type="button">코드 복사</button></div><ul class="player-list">${playerListMarkup(false)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="start" type="button" ${players.length >= 2 ? '' : 'disabled'}>게임 시작 (${players.length}/${MAX_PLAYERS})</button></div>` : '<p class="lobby-note">방장이 시작할 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy-code')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(roomId); showToast('코드를 복사했습니다.'); } catch { showToast(roomId); } });
  document.getElementById('start')?.addEventListener('click', startGame);
}
function nextRoundNumbers() {
  const bannedNumber = pickNumber(); const bonusNumber = pickNumber([bannedNumber]); return { bannedNumber, bonusNumber };
}
async function startGame() {
  if (!isHost() || players.length < 2) return; const { bannedNumber, bonusNumber } = nextRoundNumbers(); const batch = writeBatch(db);
  players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() }));
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing', round: 1, roundState: 'open', bannedNumber, bonusNumber, lastResults: [], winnerUid: '', winnerNumber: 0,
    roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now()
  });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('게임을 시작하지 못했습니다.'); }
}
function remainingSeconds() { const end = room?.roundEndsAt?.toMillis?.() || 0; return Math.max(0, Math.ceil((end - Date.now()) / 1000)); }
function allSubmitted() { return players.length >= 2 && currentAnswers().length >= players.length; }
function renderRound() {
  clearInterval(timerId); const mine = myAnswer();
  app.innerHTML = `<section class="panel"><div class="round-head"><span class="round-label">ROUND ${Number(room.round)} / ${MAX_ROUNDS}</span><span class="timer" id="round-timer">${remainingSeconds()}</span></div><h2>숫자 하나만 고르세요</h2><p class="lead">겹치면 탈락. 혼자 고른 숫자 중 가장 작은 숫자가 이번 라운드 승자입니다.${Number(room.round) === MAX_ROUNDS ? ' 마지막 라운드는 점수 2배!' : ''}</p><div class="round-flags"><div class="flag-card bad">🚫 금지 숫자<strong>${Number(room.bannedNumber)}</strong></div><div class="flag-card good">✨ 보너스 숫자<strong>${Number(room.bonusNumber)}</strong></div></div><div class="number-grid">${NUMBERS.map(number => `<button class="number-button ${number === Number(room.bannedNumber) ? 'is-banned' : ''} ${number === Number(room.bonusNumber) ? 'is-bonus' : ''} ${Number(mine?.number) === number ? 'is-selected' : ''}" data-number="${number}" type="button">${number}</button>`).join('')}</div><div class="status-line" id="submit-status">${mine ? `선택 완료 · ${Number(mine.number)}번` : '공개 전까지 선택을 바꿀 수 있습니다.'}</div><div class="submitted-count" id="submitted-count">현재 ${currentAnswers().length}/${players.length}명 선택</div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal" type="button" ${(remainingSeconds() <= 0 || allSubmitted()) ? '' : 'disabled'}>${allSubmitted() ? '전원 선택! 공개' : '시간 종료 후 공개'}</button></div>` : ''}<div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul></section>`;
  document.querySelectorAll('[data-number]').forEach(button => button.addEventListener('click', () => void submitNumber(Number(button.dataset.number))));
  document.getElementById('reveal')?.addEventListener('click', revealRound); runTimer(); updateLiveStatus();
}
function updateLiveStatus() {
  if (!room || room.status !== 'playing' || room.roundState !== 'open') return; const mine = myAnswer();
  document.querySelectorAll('[data-number]').forEach(button => button.classList.toggle('is-selected', Number(button.dataset.number) === Number(mine?.number)));
  const status = document.getElementById('submit-status'); if (status && mine) status.textContent = `선택 완료 · ${Number(mine.number)}번`;
  const count = document.getElementById('submitted-count'); if (count) count.textContent = `현재 ${currentAnswers().length}/${players.length}명 선택`;
  const reveal = document.getElementById('reveal'); if (reveal) { reveal.disabled = !(remainingSeconds() <= 0 || allSubmitted()); reveal.textContent = allSubmitted() ? '전원 선택! 공개' : '시간 종료 후 공개'; }
}
function runTimer() {
  clearInterval(timerId);
  const tick = () => {
    const seconds = remainingSeconds(); const timer = document.getElementById('round-timer');
    if (timer) { timer.textContent = String(seconds); timer.classList.toggle('is-urgent', seconds <= 3); }
    if (seconds <= 0) { document.querySelectorAll('[data-number]').forEach(button => { button.disabled = true; }); clearInterval(timerId); timerId = null; }
    updateLiveStatus();
  };
  tick(); timerId = setInterval(tick, 400);
}
async function submitNumber(number) {
  if (!NUMBERS.includes(number) || !room || room.roundState !== 'open' || remainingSeconds() <= 0) return;
  const player = players.find(item => item.uid === currentUid);
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `number-${room.round}-${currentUid}`), {
      uid: currentUid, nickname: player?.nickname || '플레이어', kind: 'number', round: Number(room.round), number, text: String(number), createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('선택을 저장하지 못했습니다.'); }
}
function evaluateRound() {
  const submitted = currentAnswers(); const counts = new Map();
  submitted.forEach(answer => counts.set(Number(answer.number), (counts.get(Number(answer.number)) || 0) + 1));
  const uniqueNumbers = [...counts.entries()].filter(([, count]) => count === 1).map(([number]) => number).filter(number => number !== Number(room.bannedNumber)).sort((a, b) => a - b);
  const winnerNumber = uniqueNumbers[0] || 0; const winner = submitted.find(answer => Number(answer.number) === winnerNumber);
  const multiplier = Number(room.round) >= MAX_ROUNDS ? 2 : 1;
  const bonusUnique = (counts.get(Number(room.bonusNumber)) || 0) === 1;
  return players.map(player => {
    const answer = submitted.find(item => item.uid === player.uid); const number = Number(answer?.number || 0); let delta = 0; const labels = [];
    if (!answer) labels.push('미선택');
    else if (number === Number(room.bannedNumber)) { delta -= 120 * multiplier; labels.push('금지 숫자'); }
    else if ((counts.get(number) || 0) > 1) labels.push('중복 탈락');
    else labels.push('단독 숫자');
    if (winner?.uid === player.uid) { delta += 500 * multiplier; labels.push('이번 라운드 승리'); }
    if (answer && number === Number(room.bonusNumber) && bonusUnique) { delta += 180 * multiplier; labels.push('보너스 숫자'); }
    return { uid: player.uid, nickname: player.nickname, number, delta, label: labels.join(' · ') || '0점' };
  });
}
async function revealRound() {
  if (!isHost() || room.roundState !== 'open' || !(remainingSeconds() <= 0 || allSubmitted())) return;
  const results = evaluateRound(); const winner = results.filter(result => result.label.includes('이번 라운드 승리'))[0]; const batch = writeBatch(db);
  results.forEach(result => {
    const player = players.find(item => item.uid === result.uid); batch.update(doc(db, 'game_rooms', roomId, 'players', result.uid), { score: Number(player?.score || 0) + Number(result.delta || 0), updatedAt: Timestamp.now() });
  });
  batch.update(doc(db, 'game_rooms', roomId), { roundState: 'reveal', lastResults: results, winnerUid: winner?.uid || '', winnerNumber: winner?.number || 0, updatedAt: Timestamp.now() });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('결과를 계산하지 못했습니다.'); }
}
function renderReveal() {
  clearInterval(timerId); timerId = null; const results = Array.isArray(room.lastResults) ? room.lastResults : [];
  const rows = results.map(result => {
    const count = results.filter(item => Number(item.number) === Number(result.number) && Number(result.number) > 0).length; const cls = count === 1 ? 'unique' : 'duplicate';
    const deltaClass = Number(result.delta) > 0 ? 'delta-plus' : Number(result.delta) < 0 ? 'delta-minus' : 'delta-zero';
    return `<li class="result-item"><span class="choice-pill ${cls}">${Number(result.number) || '-'}</span><span style="flex:1"><strong>${escapeText(result.nickname || '플레이어')}</strong><small>${escapeText(result.label || '')}</small></span><span class="${deltaClass}">${Number(result.delta) > 0 ? '+' : ''}${Number(result.delta)}점</span></li>`;
  }).join('');
  app.innerHTML = `<section class="panel"><span class="kicker">ROUND ${Number(room.round)} 결과</span><h2>${room.winnerUid ? `🎯 ${Number(room.winnerNumber)}번이 살아남았습니다` : '💥 이번엔 승자가 없습니다'}</h2>${room.winnerUid ? `<div class="winner-banner"><b>${escapeText(results.find(item => item.uid === room.winnerUid)?.nickname || '플레이어')}</b><br>가장 작은 단독 숫자 성공</div>` : ''}<ul class="result-list">${rows}</ul><div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="next" type="button">${Number(room.round) >= MAX_ROUNDS ? '최종 순위 보기' : '다음 숫자 열기'}</button></div>` : '<p class="lobby-note">방장이 다음 라운드를 열 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('next')?.addEventListener('click', nextRound);
}
async function nextRound() {
  if (!isHost() || room.roundState !== 'reveal') return;
  if (Number(room.round) >= MAX_ROUNDS) {
    try { await updateDoc(doc(db, 'game_rooms', roomId), { status: 'finished', updatedAt: Timestamp.now() }); } catch (error) { console.error(error); }
    return;
  }
  const { bannedNumber, bonusNumber } = nextRoundNumbers();
  try { await updateDoc(doc(db, 'game_rooms', roomId), { round: Number(room.round) + 1, roundState: 'open', bannedNumber, bonusNumber, lastResults: [], winnerUid: '', winnerNumber: 0, roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now() }); }
  catch (error) { console.error(error); showToast('다음 라운드를 열지 못했습니다.'); }
}
function renderFinished() {
  clearInterval(timerId); timerId = null; const ranking = sortedPlayers(); const medals = ['👑','🥈','🥉'];
  app.innerHTML = `<section class="panel"><span class="kicker">GAME OVER</span><h1>🏆 눈치왕은 ${escapeText(ranking[0]?.nickname || '플레이어')}</h1><p class="lead">작게 고를수록 욕심나고, 남과 겹칠수록 위험한 8라운드가 끝났습니다.</p><ol class="ranking">${ranking.map((player, index) => `<li class="rank-item ${index === 0 ? 'winner' : ''}"><span class="rank-number">${medals[index] || index + 1}</span><span class="rank-name">${escapeText(player.nickname)}</span><span class="rank-score">${Number(player.score || 0)}점</span></li>`).join('')}</ol>${isHost() ? '<div class="button-row"><button class="primary-button" id="restart" type="button">같은 멤버로 한 판 더</button></div>' : ''}<div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none">소소킹 플레이 홈</a></div></section>`;
  document.getElementById('restart')?.addEventListener('click', restartGame);
}
async function restartGame() {
  if (!isHost()) return;
  try {
    const answerSnap = await getDocs(collection(db, 'game_rooms', roomId, 'answers')); const batch = writeBatch(db); answerSnap.docs.forEach(answer => batch.delete(answer.ref));
    players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() }));
    batch.update(doc(db, 'game_rooms', roomId), { status: 'lobby', round: 0, roundState: 'waiting', bannedNumber: 0, bonusNumber: 0, lastResults: [], winnerUid: '', winnerNumber: 0, updatedAt: Timestamp.now() });
    await batch.commit();
  } catch (error) { console.error(error); showToast('다시 시작하지 못했습니다.'); }
}
function renderError(message) {
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-button" href="/game/caught/" style="display:grid;place-items:center;text-decoration:none">처음으로</a></div></section>`;
}
async function boot() {
  try {
    await initAuth(); currentUid = auth.currentUser?.uid || ''; if (!currentUid) throw new Error('auth');
    const code = normalizeRoomCode(new URL(location.href).searchParams.get('room')); if (!code) return renderLanding();
    const roomSnap = await getDoc(doc(db, 'game_rooms', code)); if (!roomSnap.exists()) { renderLanding(code); return showToast('초대받은 방이 없거나 종료되었습니다.'); }
    if (roomSnap.data().type !== 'unique-low') { renderLanding(); return showToast('다른 게임의 방입니다.'); }
    roomId = code; if (await ensureMembership(code)) subscribeRoom(code);
  } catch (error) { console.error(error); renderError('게임을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.'); }
}
shareButton.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
void boot();
