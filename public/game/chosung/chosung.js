import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  doc,
  getDoc,
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
const MAX_ROUNDS = 7;
const ROUND_SECONDS = 20;
const TARGETS = [
  'ㄱㅅ', 'ㄱㅈ', 'ㄱㅂ', 'ㄴㅅ', 'ㄴㅈ', 'ㄷㄹ', 'ㄷㅅ', 'ㅁㅅ', 'ㅁㄹ', 'ㅂㄹ',
  'ㅅㄱ', 'ㅅㅈ', 'ㅇㅅ', 'ㅇㅈ', 'ㅈㅁ', 'ㅈㅅ', 'ㅊㅅ', 'ㅋㅍ', 'ㅍㅅ', 'ㅎㄱ'
];
const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

let roomId = '';
let room = null;
let players = [];
let answers = [];
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeAnswers = null;
let timerId = null;
let toastId = null;
let currentUid = '';

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

function cleanAnswer(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
}

function getInitials(value) {
  return Array.from(String(value || '')).map(char => {
    if (INITIALS.includes(char)) return char;
    const offset = char.charCodeAt(0) - 0xac00;
    if (offset >= 0 && offset <= 11171) return INITIALS[Math.floor(offset / 588)];
    return '';
  }).join('');
}

function normalizedAnswerKey(value) {
  return String(value || '').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

function isValidAnswer(text, target) {
  const answer = cleanAnswer(text);
  return answer.length >= 2 && getInitials(answer).startsWith(target);
}

function currentRoundAnswers() {
  return answers.filter(item => Number(item.round) === Number(room?.round || 0));
}

function answerEvaluation() {
  const list = currentRoundAnswers();
  const counts = new Map();
  for (const item of list) {
    if (!isValidAnswer(item.text, room?.target || '')) continue;
    const key = normalizedAnswerKey(item.text);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return list.map(item => {
    const valid = isValidAnswer(item.text, room?.target || '');
    const duplicate = valid && (counts.get(normalizedAnswerKey(item.text)) || 0) > 1;
    return { ...item, valid, duplicate, points: valid && !duplicate ? 2 : 0 };
  });
}

function playerByUid(uid) {
  return players.find(player => player.uid === uid);
}

function isHost() {
  return Boolean(room && currentUid && room.hostUid === currentUid);
}

function sortPlayers(list = players) {
  return [...list].sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDiff) return scoreDiff;
    return Number(a.joinOrder || 0) - Number(b.joinOrder || 0);
  });
}

function playerListMarkup(showScores = false) {
  return sortPlayers(showScores ? players : [...players].sort((a, b) => Number(a.joinOrder || 0) - Number(b.joinOrder || 0)))
    .map((player, index) => `
      <li class="player-item">
        <span class="player-copy">
          <span class="player-avatar" aria-hidden="true">${index + 1}</span>
          <span class="player-name">${escapeText(player.nickname || '플레이어')}</span>
          ${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}
        </span>
        ${showScores ? `<span class="player-score">${Number(player.score || 0)}점</span>` : ''}
      </li>`).join('');
}

function setRoomUrl(nextRoomId) {
  const url = new URL(location.href);
  if (nextRoomId) url.searchParams.set('room', nextRoomId);
  else url.searchParams.delete('room');
  history.replaceState({}, '', url);
}

function inviteUrl() {
  return `${location.origin}/game/chosung/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const url = inviteUrl();
  const data = {
    title: '소소킹 초성 폭탄 초대',
    text: `초성 폭탄 방 ${roomId}에 같이 들어와!`,
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
    showToast('초대 링크를 복사했습니다. 카카오톡에 붙여넣어 주세요.');
  } catch {
    window.prompt('이 링크를 복사해 카카오톡으로 보내주세요.', url);
  }
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

function renderLanding(prefilledCode = '') {
  stopSubscriptions();
  room = null;
  players = [];
  answers = [];
  shareButton.hidden = true;
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">SOSOKING FAMILY GAME</span>
      <h1>💣 초성 폭탄</h1>
      <p class="lead">초성이 뜨면 제한시간 안에 단어를 적어주세요. 정답 초성이 맞고 다른 사람과 겹치지 않으면 2점입니다.</p>
      <form id="create-room-form">
        <label class="field"><span>내 닉네임</span><input id="create-nickname" maxlength="12" autocomplete="nickname" placeholder="예: 아빠" required></label>
        <div class="button-row"><button class="primary-button" type="submit">새 게임방 만들기</button></div>
      </form>
      <div class="divider"></div>
      <form id="join-room-form">
        <label class="field"><span>초대 코드</span><input id="join-code" value="${escapeText(prefilledCode)}" maxlength="6" inputmode="text" autocomplete="off" placeholder="예: AB7K2Q" required></label>
        <label class="field"><span>내 닉네임</span><input id="join-nickname" maxlength="12" autocomplete="nickname" placeholder="예: 엄마" required></label>
        <div class="button-row"><button class="secondary-button" type="submit">초대받은 방 입장</button></div>
      </form>
    </section>`;

  document.getElementById('create-room-form').addEventListener('submit', event => {
    event.preventDefault();
    createRoom(document.getElementById('create-nickname').value);
  });
  document.getElementById('join-room-form').addEventListener('submit', event => {
    event.preventDefault();
    joinRoom(document.getElementById('join-code').value, document.getElementById('join-nickname').value);
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

    const roomRef = doc(db, 'game_rooms', code);
    await setDoc(roomRef, {
      type: 'chosung-bomb',
      status: 'lobby',
      hostUid: currentUid,
      maxPlayers: MAX_PLAYERS,
      round: 0,
      maxRounds: MAX_ROUNDS,
      roundState: 'waiting',
      target: '',
      usedTargets: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid,
      nickname,
      score: 0,
      joinOrder: Date.now(),
      joinedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error('create room failed', error);
    showToast('게임방을 만들지 못했습니다. 다시 시도해주세요.');
    if (button) button.disabled = false;
  }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeRoomCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  const button = document.querySelector('#join-room-form button');
  if (button) button.disabled = true;
  try {
    const roomRef = doc(db, 'game_rooms', code);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('room-not-found');
    const data = snap.data();
    if (data.type !== 'chosung-bomb') throw new Error('wrong-game');
    if (data.status !== 'lobby') throw new Error('game-started');

    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid,
      nickname,
      score: 0,
      joinOrder: Date.now(),
      joinedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error('join room failed', error);
    const message = error?.message === 'game-started'
      ? '이미 게임이 시작된 방입니다.'
      : error?.message === 'room-not-found'
        ? '게임방을 찾지 못했습니다.'
        : '게임방에 입장하지 못했습니다.';
    showToast(message);
    if (button) button.disabled = false;
  }
}

async function ensureMembership(code) {
  const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
  const playerSnap = await getDoc(playerRef);
  if (playerSnap.exists()) return true;
  const saved = sessionStorage.getItem(`sosoking-game-nickname:${code}`) || '';
  renderJoinInvite(code, saved);
  return false;
}

function renderJoinInvite(code, savedNickname = '') {
  stopSubscriptions();
  shareButton.hidden = true;
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">게임 초대</span>
      <h1>💣 초성 폭탄에 초대됐어요</h1>
      <p class="lead">닉네임만 정하면 바로 가족·친구가 기다리는 방으로 들어갑니다.</p>
      <div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div>
      <form id="invite-join-form">
        <label class="field"><span>내 닉네임</span><input id="invite-nickname" maxlength="12" value="${escapeText(savedNickname)}" autocomplete="nickname" placeholder="예: 우주" required></label>
        <div class="button-row"><button class="primary-button" type="submit">게임방 입장</button></div>
      </form>
    </section>`;
  document.getElementById('invite-join-form').addEventListener('submit', event => {
    event.preventDefault();
    joinRoom(code, document.getElementById('invite-nickname').value);
  });
}

function subscribeRoom(code) {
  stopSubscriptions();
  roomId = code;
  shareButton.hidden = false;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snapshot => {
    if (!snapshot.exists()) {
      showToast('게임방이 종료되었습니다.');
      setRoomUrl('');
      renderLanding();
      return;
    }
    room = { id: snapshot.id, ...snapshot.data() };
    renderCurrentState();
  }, error => {
    console.error('room subscription failed', error);
    renderError('게임방 정보를 불러오지 못했습니다.');
  });

  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (players.length > MAX_PLAYERS && isHost()) showToast('권장 인원 8명을 넘었습니다.');
    renderCurrentState();
  });

  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderCurrentState();
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
  clearInterval(timerId);
  timerId = null;
  const host = isHost();
  const canStart = host && players.length >= 2;
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">게임 대기실</span>
      <h2>가족이 들어오면 시작하세요</h2>
      <div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div>
      <div class="button-row two">
        <button class="secondary-button" id="copy-invite" type="button">카톡으로 초대</button>
        <button class="secondary-button" id="copy-code" type="button">코드 복사</button>
      </div>
      <ul class="player-list">${playerListMarkup(false)}</ul>
      <p class="lobby-note">${host ? '방장만 게임을 시작할 수 있습니다. 2명 이상 모이면 시작 버튼이 활성화됩니다.' : '방장이 게임을 시작할 때까지 기다려주세요.'}</p>
      ${host ? `<div class="button-row"><button class="primary-button" id="start-game" type="button" ${canStart ? '' : 'disabled'}>게임 시작 (${players.length}/${MAX_PLAYERS})</button></div>` : ''}
    </section>`;

  document.getElementById('copy-invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy-code')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomId); showToast('초대 코드를 복사했습니다.'); }
    catch { showToast(`초대 코드: ${roomId}`); }
  });
  document.getElementById('start-game')?.addEventListener('click', startGame);
}

function chooseTarget(used = []) {
  const available = TARGETS.filter(target => !used.includes(target));
  const pool = available.length ? available : TARGETS;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function startGame() {
  if (!isHost() || players.length < 2) return;
  const target = chooseTarget([]);
  const batch = writeBatch(db);
  for (const player of players) {
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() });
  }
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing',
    round: 1,
    roundState: 'open',
    target,
    usedTargets: [target],
    roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000),
    updatedAt: Timestamp.now()
  });
  try { await batch.commit(); }
  catch (error) { console.error('start game failed', error); showToast('게임을 시작하지 못했습니다.'); }
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function renderRound() {
  const myAnswer = currentRoundAnswers().find(item => item.uid === currentUid);
  app.innerHTML = `
    <section class="panel">
      <div class="round-head">
        <span class="round-label">ROUND ${Number(room.round || 1)} / ${Number(room.maxRounds || MAX_ROUNDS)}</span>
        <span class="timer" id="round-timer">${remainingSeconds()}</span>
      </div>
      <div class="consonants">${escapeText(room.target || '')}</div>
      <p class="round-help">이 초성으로 시작하는 단어를 하나 적어주세요.</p>
      <form id="answer-form">
        <label class="field"><span>내 단어</span><input id="answer-input" maxlength="24" autocomplete="off" value="${escapeText(myAnswer?.text || '')}" placeholder="예: ㄱㅅ → 가수, 과식, 고생"></label>
        <div class="button-row"><button class="primary-button" id="answer-submit" type="submit">${myAnswer ? '답 수정하기' : '답 제출하기'}</button></div>
      </form>
      <div class="answer-status">${myAnswer ? `제출 완료 · ${escapeText(myAnswer.text)}` : ''}</div>
      <div class="submitted-count">현재 ${currentRoundAnswers().length}/${players.length}명 제출</div>
      ${isHost() ? '<div class="button-row"><button class="secondary-button" id="reveal-round" type="button" disabled>시간 종료 후 답 공개</button></div>' : ''}
    </section>`;

  const answerForm = document.getElementById('answer-form');
  answerForm?.addEventListener('submit', submitAnswer);
  document.getElementById('reveal-round')?.addEventListener('click', revealRound);
  runTimer();
}

function runTimer() {
  clearInterval(timerId);
  const update = () => {
    const seconds = remainingSeconds();
    const timer = document.getElementById('round-timer');
    if (timer) {
      timer.textContent = String(seconds);
      timer.classList.toggle('is-urgent', seconds <= 5);
    }
    const input = document.getElementById('answer-input');
    const submit = document.getElementById('answer-submit');
    const reveal = document.getElementById('reveal-round');
    if (seconds <= 0) {
      if (input) input.disabled = true;
      if (submit) submit.disabled = true;
      if (reveal) { reveal.disabled = false; reveal.textContent = '답 공개하고 채점'; }
      clearInterval(timerId);
      timerId = null;
    }
  };
  update();
  timerId = setInterval(update, 500);
}

async function submitAnswer(event) {
  event.preventDefault();
  if (!room || room.roundState !== 'open' || remainingSeconds() <= 0) return showToast('이번 라운드 제출 시간이 끝났습니다.');
  const input = document.getElementById('answer-input');
  const answer = cleanAnswer(input?.value);
  if (!answer) return showToast('단어를 입력해주세요.');
  if (!isValidAnswer(answer, room.target || '')) return showToast(`${room.target} 초성으로 시작하는 단어를 적어주세요.`);
  const player = playerByUid(currentUid);
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `${room.round}-${currentUid}`), {
      uid: currentUid,
      nickname: player?.nickname || '플레이어',
      round: Number(room.round),
      text: answer,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    showToast('답을 제출했습니다.');
  } catch (error) {
    console.error('submit answer failed', error);
    showToast('답을 제출하지 못했습니다.');
  }
}

async function revealRound() {
  if (!isHost() || remainingSeconds() > 0 || room.roundState !== 'open') return;
  const evaluation = answerEvaluation();
  const pointsByUid = new Map(evaluation.map(item => [item.uid, item.points]));
  const batch = writeBatch(db);
  for (const player of players) {
    const nextScore = Number(player.score || 0) + Number(pointsByUid.get(player.uid) || 0);
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: nextScore,
      updatedAt: Timestamp.now()
    });
  }
  batch.update(doc(db, 'game_rooms', roomId), {
    roundState: 'reveal',
    updatedAt: Timestamp.now()
  });
  try { await batch.commit(); }
  catch (error) { console.error('reveal round failed', error); showToast('채점하지 못했습니다.'); }
}

function renderReveal() {
  clearInterval(timerId);
  timerId = null;
  const evaluation = answerEvaluation().sort((a, b) => String(a.nickname).localeCompare(String(b.nickname), 'ko'));
  const answerRows = players.map(player => {
    const answer = evaluation.find(item => item.uid === player.uid);
    if (!answer) {
      return `<li class="answer-item"><strong>${escapeText(player.nickname)}</strong><small>미제출</small><span class="answer-tag bad">0점</span></li>`;
    }
    const label = !answer.valid ? '초성 불일치' : answer.duplicate ? '중복' : '+2점';
    const className = answer.valid && !answer.duplicate ? 'good' : 'bad';
    return `<li class="answer-item"><strong>${escapeText(answer.text)}</strong><small>${escapeText(player.nickname)}</small><span class="answer-tag ${className}">${label}</span></li>`;
  }).join('');

  const lastRound = Number(room.round || 0) >= Number(room.maxRounds || MAX_ROUNDS);
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">ROUND ${Number(room.round)} 결과</span>
      <h2>${escapeText(room.target)} 답 공개</h2>
      <p class="lead">초성이 맞고 다른 사람과 단어가 겹치지 않으면 2점입니다.</p>
      <ul class="answer-list">${answerRows}</ul>
      <div class="divider"></div>
      <ul class="player-list">${playerListMarkup(true)}</ul>
      ${isHost() ? `<div class="button-row"><button class="primary-button" id="next-round" type="button">${lastRound ? '최종 결과 보기' : '다음 라운드'}</button></div>` : '<p class="lobby-note">방장이 다음 라운드를 열 때까지 기다려주세요.</p>'}
    </section>`;
  document.getElementById('next-round')?.addEventListener('click', nextRound);
}

async function nextRound() {
  if (!isHost() || room.roundState !== 'reveal') return;
  const currentRound = Number(room.round || 0);
  const maxRounds = Number(room.maxRounds || MAX_ROUNDS);
  if (currentRound >= maxRounds) {
    try {
      await updateDoc(doc(db, 'game_rooms', roomId), { status: 'finished', updatedAt: Timestamp.now() });
    } catch (error) { console.error('finish game failed', error); showToast('최종 결과로 넘어가지 못했습니다.'); }
    return;
  }
  const used = Array.isArray(room.usedTargets) ? room.usedTargets : [];
  const target = chooseTarget(used);
  try {
    await updateDoc(doc(db, 'game_rooms', roomId), {
      round: currentRound + 1,
      roundState: 'open',
      target,
      usedTargets: [...used, target],
      roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000),
      updatedAt: Timestamp.now()
    });
  } catch (error) { console.error('next round failed', error); showToast('다음 라운드를 열지 못했습니다.'); }
}

function renderFinished() {
  const ranking = sortPlayers();
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">GAME OVER</span>
      <h1>🏆 최종 결과</h1>
      <p class="lead">오늘의 초성 폭탄 우승자는 <strong>${escapeText(ranking[0]?.nickname || '플레이어')}</strong>!</p>
      <ol class="ranking">
        ${ranking.map((player, index) => `<li class="rank-item"><span class="rank-number">${index + 1}</span><span class="rank-name">${escapeText(player.nickname)}</span><span class="rank-score">${Number(player.score || 0)}점</span></li>`).join('')}
      </ol>
      ${isHost() ? '<div class="button-row"><button class="primary-button" id="restart-game" type="button">같은 멤버로 다시 하기</button></div>' : '<p class="lobby-note">방장이 다시 시작하면 같은 방에서 한 판 더 할 수 있습니다.</p>'}
      <div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none;">게임소로 돌아가기</a></div>
    </section>`;
  document.getElementById('restart-game')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  const batch = writeBatch(db);
  for (const player of players) {
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() });
  }
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'lobby',
    round: 0,
    roundState: 'waiting',
    target: '',
    usedTargets: [],
    updatedAt: Timestamp.now()
  });
  try { await batch.commit(); }
  catch (error) { console.error('restart game failed', error); showToast('게임을 다시 시작하지 못했습니다.'); }
}

function renderError(message) {
  clearInterval(timerId);
  app.innerHTML = `
    <section class="panel">
      <div class="error-box">${escapeText(message)}</div>
      <div class="button-row"><a class="secondary-button" href="/game/chosung/" style="display:grid;place-items:center;text-decoration:none;">처음 화면으로</a></div>
    </section>`;
}

async function boot() {
  try {
    await initAuth();
    currentUid = auth.currentUser?.uid || '';
    if (!currentUid) throw new Error('auth-not-ready');
    const code = normalizeRoomCode(new URL(location.href).searchParams.get('room'));
    if (!code) {
      renderLanding();
      return;
    }
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists()) {
      renderLanding(code);
      showToast('초대받은 방이 없거나 종료되었습니다.');
      return;
    }
    roomId = code;
    const member = await ensureMembership(code);
    if (member) subscribeRoom(code);
  } catch (error) {
    console.error('game boot failed', error);
    renderError('게임을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.');
  }
}

shareButton.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
boot();
