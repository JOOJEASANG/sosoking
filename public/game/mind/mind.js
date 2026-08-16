import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { addDna, emptyDna, normalizeDna } from '/game/dna-profile.js?v=20260816-dna-1';

const app = document.getElementById('game-app');
const shareButton = document.getElementById('share-room');
const toast = document.getElementById('toast');

const MAX_PLAYERS = 8;
const ROOM_MAX_ROUNDS = 8;
const ROUND_SECONDS = 28;
const SCENARIOS = [
  { id: 'midnight-trip', prompt: '새벽 1시, 친구가 갑자기 “지금 바다 보러 갈래?”라고 보냈다.', options: ['A. 10분 안에 준비한다', 'B. 왜? 무슨 일인데?부터 묻는다', 'C. 읽고 아침에 답한다', 'D. 누구랑 가는지부터 확인한다'] },
  { id: 'old-photo', prompt: '단톡방에 내 흑역사 사진이 갑자기 올라왔다.', options: ['A. 당장 지우라고 한다', 'B. 더 센 사진으로 맞불 놓는다', 'C. 웃는 척하고 조용히 저장한다', 'D. 누가 올렸는지부터 추적한다'] },
  { id: 'lottery', prompt: '친구가 복권 1등에 당첨됐다고 진지하게 말한다.', options: ['A. 일단 밥부터 사라고 한다', 'B. 진짜인지 증거부터 요구한다', 'C. 비밀 지켜주고 계획을 듣는다', 'D. 나한테 왜 말했는지 의심한다'] },
  { id: 'phone-drop', prompt: '길에서 최신 스마트폰을 주웠는데 잠금화면에 “엄마” 전화가 계속 온다.', options: ['A. 바로 전화를 받는다', 'B. 가까운 경찰서에 맡긴다', 'C. 잠깐 기다리며 주인을 찾는다', 'D. 주변 가게 직원에게 맡긴다'] },
  { id: 'free-day', prompt: '내일 갑자기 아무 일정도 없는 완전한 휴일이 생겼다.', options: ['A. 늦잠과 집콕', 'B. 즉흥 여행', 'C. 밀린 일을 끝낸다', 'D. 친구부터 불러낸다'] },
  { id: 'secret-chat', prompt: '친구가 “절대 아무한테도 말하면 안 돼”라고 시작한다.', options: ['A. 바로 집중해서 듣는다', 'B. 감당 못 할 얘기면 말하지 말라 한다', 'C. 일단 누군지부터 묻는다', 'D. 벌써 불안해진다'] },
  { id: 'restaurant', prompt: '맛집에 90분 대기라고 적혀 있다.', options: ['A. 기다린다', 'B. 바로 다른 집 간다', 'C. 근처 카페에서 시간 보낸다', 'D. 포장 가능한지 먼저 묻는다'] },
  { id: 'wrong-transfer', prompt: '모르는 사람이 내 계좌로 30만 원을 잘못 보냈다.', options: ['A. 은행에 바로 연락한다', 'B. 입금자 연락을 기다린다', 'C. 일단 계좌를 건드리지 않는다', 'D. 사기인지 검색부터 한다'] },
  { id: 'zombie', prompt: '뉴스에 진짜 좀비 사태가 시작됐다는 속보가 떴다.', options: ['A. 편의점부터 턴다', 'B. 가족·친구에게 연락한다', 'C. 문부터 잠근다', 'D. 차에 기름부터 채운다'] },
  { id: 'ex-contact', prompt: '오래전에 끝난 인연에게 “잘 지내?”라는 메시지가 왔다.', options: ['A. 바로 답한다', 'B. 한참 고민하다 짧게 답한다', 'C. 읽고 답하지 않는다', 'D. 친구에게 캡처부터 보낸다'] },
  { id: 'office-mistake', prompt: '내 실수 때문에 단체 채팅방이 조용해졌다.', options: ['A. 바로 인정하고 사과한다', 'B. 해결책부터 찾는다', 'C. 누가 먼저 말할 때까지 기다린다', 'D. 개인톡으로 상황부터 파악한다'] },
  { id: 'million', prompt: '오늘 안에 무조건 100만 원을 써야 하고 남기면 사라진다.', options: ['A. 갖고 싶던 걸 산다', 'B. 가족·친구에게 쓴다', 'C. 여행 예약한다', 'D. 먹는 데 쓴다'] }
];

let roomId = '';
let room = null;
let players = [];
let answers = [];
let currentUid = '';
let timerId = null;
let toastId = null;
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeAnswers = null;

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

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 12);
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
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
  return `${location.origin}/game/mind/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const data = {
    title: '소소킹 관심법 초대',
    text: `내 선택을 얼마나 잘 아는지 보자. 관심법 방 ${roomId}`,
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
    window.prompt('이 링크를 카카오톡으로 보내주세요.', data.url);
  }
}

function isHost() {
  return Boolean(room && room.hostUid === currentUid);
}

function orderedPlayers() {
  return [...players].sort((a, b) => Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function rankedPlayers() {
  return [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function playerByUid(uid) {
  return players.find(player => player.uid === uid);
}

function scenarioById(id) {
  return SCENARIOS.find(item => item.id === id) || SCENARIOS[0];
}

function currentScenario() {
  return scenarioById(room?.promptId || SCENARIOS[0].id);
}

function currentTarget() {
  return playerByUid(room?.targetUid || '');
}

function currentRoundAnswers(kind = '') {
  const round = Number(room?.round || 0);
  return answers.filter(item => Number(item.round) === round && (!kind || item.kind === kind));
}

function playerListMarkup(showScores = false) {
  const source = showScores ? rankedPlayers() : orderedPlayers();
  return source.map(player => `
    <li class="player-item">
      <span class="player-name">${escapeText(player.nickname || '플레이어')}${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}</span>
      ${showScores ? `<span class="player-score">${Number(player.score || 0)}점</span>` : ''}
    </li>`).join('');
}

function renderLanding(prefilled = '') {
  stopSubscriptions();
  room = null;
  players = [];
  answers = [];
  shareButton.hidden = true;
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">SOSOKING ORIGINAL</span>
      <h1>🧠 관심법</h1>
      <p class="lead">한 명은 친구들의 선택을 사람별로 예측하고, 나머지는 자기 반응을 몰래 고릅니다. “역시 날 아네”와 “나를 그렇게 봤어?”가 동시에 터지는 심리게임입니다.</p>
      <form id="create-form">
        <label class="field"><span>내 닉네임</span><input id="create-name" maxlength="12" placeholder="예: 재구" required></label>
        <div class="button-row"><button class="primary-button" type="submit">새 게임방 만들기</button></div>
      </form>
      <div class="divider"></div>
      <form id="join-form">
        <label class="field"><span>초대 코드</span><input id="join-code" maxlength="6" value="${escapeText(prefilled)}" required></label>
        <label class="field"><span>내 닉네임</span><input id="join-name" maxlength="12" placeholder="예: 친구1" required></label>
        <div class="button-row"><button class="secondary-button" type="submit">초대받은 방 입장</button></div>
      </form>
    </section>`;
  document.getElementById('create-form').addEventListener('submit', event => {
    event.preventDefault();
    void createRoom(document.getElementById('create-name').value);
  });
  document.getElementById('join-form').addEventListener('submit', event => {
    event.preventDefault();
    void joinRoom(document.getElementById('join-code').value, document.getElementById('join-name').value);
  });
}

async function createRoom(nicknameValue) {
  const nickname = cleanNickname(nicknameValue);
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode();
      if (!(await getDoc(doc(db, 'game_rooms', candidate))).exists()) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error('room-code');
    await setDoc(doc(db, 'game_rooms', code), {
      type: 'mind-reader',
      status: 'lobby',
      hostUid: currentUid,
      maxPlayers: MAX_PLAYERS,
      round: 0,
      maxRounds: ROOM_MAX_ROUNDS,
      roundState: 'waiting',
      promptId: '',
      targetUid: '',
      usedPrompts: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid,
      nickname,
      score: 0,
      dna: emptyDna(),
      joinOrder: Date.now(),
      joinedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    console.error('create mind room failed', error);
    showToast('게임방을 만들지 못했습니다.');
  }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== 'mind-reader') throw new Error('room');
    if (roomSnap.data().status !== 'lobby') throw new Error('started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [playersSnap, existing] = await Promise.all([
      getDocs(collection(db, 'game_rooms', code, 'players')),
      getDoc(playerRef)
    ]);
    if (playersSnap.size >= MAX_PLAYERS && !existing.exists()) throw new Error('full');
    await setDoc(playerRef, {
      uid: currentUid,
      nickname,
      score: 0,
      dna: normalizeDna(existing.exists() ? existing.data().dna : {}),
      joinOrder: existing.exists() ? Number(existing.data().joinOrder || Date.now()) : Date.now(),
      joinedAt: existing.exists() ? existing.data().joinedAt || Timestamp.now() : Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    const message = error?.message === 'full' ? '이 방은 8명이 모두 들어왔습니다.' : error?.message === 'started' ? '이미 게임이 시작된 방입니다.' : '게임방에 입장하지 못했습니다.';
    showToast(message);
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
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">게임 초대</span>
      <h1>🧠 관심법에 초대됐어요</h1>
      <p class="lead">닉네임만 정하면 바로 입장합니다.</p>
      <div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div>
      <form id="invite-form">
        <label class="field"><span>내 닉네임</span><input id="invite-name" maxlength="12" value="${escapeText(saved)}" required></label>
        <div class="button-row"><button class="primary-button" type="submit">게임방 입장</button></div>
      </form>
    </section>`;
  document.getElementById('invite-form').addEventListener('submit', event => {
    event.preventDefault();
    void joinRoom(code, document.getElementById('invite-name').value);
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
    renderError('게임방 정보를 불러오지 못했습니다.');
  });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateLiveStatus();
    else renderCurrent();
  });
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateLiveStatus();
    else renderCurrent();
  });
}

function renderCurrent() {
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
  const canStart = isHost() && players.length >= 3;
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">게임 대기실</span>
      <h2>3명부터 더 재미있어요</h2>
      <p class="lead">매 라운드 관찰자 한 명이 바뀝니다. 관찰자는 다른 사람들의 선택을 각각 예측하고, 나머지는 자기 반응을 숨깁니다.</p>
      <div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div>
      <div class="button-row two"><button class="secondary-button" id="invite" type="button">카톡으로 초대</button><button class="secondary-button" id="copy" type="button">코드 복사</button></div>
      <ul class="player-list">${playerListMarkup(false)}</ul>
      <p class="lobby-note">${isHost() ? '3명 이상 모이면 시작할 수 있습니다.' : '방장이 시작할 때까지 기다려주세요.'}</p>
      ${isHost() ? `<div class="button-row"><button class="primary-button" id="start" type="button" ${canStart ? '' : 'disabled'}>관심법 시작 (${players.length}/${MAX_PLAYERS})</button></div>` : ''}
    </section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomId); showToast('초대 코드를 복사했습니다.'); } catch { showToast(roomId); }
  });
  document.getElementById('start')?.addEventListener('click', startGame);
}

function pickPrompt(used = []) {
  const available = SCENARIOS.filter(item => !used.includes(item.id));
  const pool = available.length ? available : SCENARIOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function targetForRound(roundNumber) {
  const ordered = orderedPlayers();
  return ordered[(roundNumber - 1) % ordered.length];
}

async function startGame() {
  if (!isHost() || players.length < 3) return;
  const prompt = pickPrompt([]);
  const target = targetForRound(1);
  const batch = writeBatch(db);
  for (const player of players) {
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() });
  }
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing',
    round: 1,
    maxRounds: players.length,
    roundState: 'open',
    promptId: prompt.id,
    targetUid: target.uid,
    usedPrompts: [prompt.id],
    roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000),
    updatedAt: Timestamp.now()
  });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('게임을 시작하지 못했습니다.'); }
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function myChoice() {
  return currentRoundAnswers('choice').find(item => item.uid === currentUid);
}

function myGuesses() {
  return currentRoundAnswers('guess').filter(item => item.uid === currentUid);
}

function expectedSubmissionCount() {
  return Math.max(0, (players.length - 1) * 2);
}

function submittedCount() {
  return currentRoundAnswers('choice').length + currentRoundAnswers('guess').length;
}

function allSubmitted() {
  return players.length >= 3 && submittedCount() >= expectedSubmissionCount();
}

function optionButtons(selected = '', prefix = '') {
  const scenario = currentScenario();
  return `<div class="balance-grid">${scenario.options.map((option, index) => {
    const key = String.fromCharCode(65 + index);
    return `<button type="button" class="balance-button ${selected === key ? 'is-selected' : ''}" data-choice="${key}" ${prefix ? `data-subject="${escapeText(prefix)}"` : ''}><b>${key}</b><span>${escapeText(option.slice(3))}</span></button>`;
  }).join('')}</div>`;
}

function renderRound() {
  const target = currentTarget();
  const scenario = currentScenario();
  const amTarget = target?.uid === currentUid;
  const choice = myChoice();
  const guesses = myGuesses();
  app.innerHTML = `
    <section class="panel">
      <div class="round-head"><span class="round-label">ROUND ${Number(room.round)} / ${Number(room.maxRounds)}</span><span class="timer" id="timer">${remainingSeconds()}</span></div>
      <div class="question-box"><small>${amTarget ? '오늘의 관찰자' : `오늘의 관찰자: ${escapeText(target?.nickname || '')}`}</small><strong>${escapeText(scenario.prompt)}</strong></div>
      ${amTarget ? `
        <p class="lead">친구 한 명씩 “이 사람이라면 뭘 고를까?”를 예측하세요. 전부 맞히면 진짜 관심법 인정.</p>
        <div id="guess-list">${orderedPlayers().filter(player => player.uid !== currentUid).map(player => {
          const existing = guesses.find(item => item.subjectUid === player.uid)?.text || '';
          return `<div class="question-box"><strong>${escapeText(player.nickname)}의 선택은?</strong>${optionButtons(existing, player.uid)}</div>`;
        }).join('')}</div>`
        : `
        <p class="lead">관찰자에게 들키지 않게, 평소의 나라면 진짜 어떻게 할지 하나를 고르세요.</p>
        ${optionButtons(choice?.text || '')}`}
      <div class="status-line" id="status-line"></div>
      ${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal" type="button" ${allSubmitted() || remainingSeconds() <= 0 ? '' : 'disabled'}>${allSubmitted() ? '전원 선택 완료 · 공개' : '시간 종료 후 공개'}</button></div>` : ''}
    </section>`;

  document.querySelectorAll('.balance-button').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.choice || '';
      const subject = button.dataset.subject || '';
      if (amTarget) void submitGuess(subject, value);
      else void submitChoice(value);
    });
  });
  document.getElementById('reveal')?.addEventListener('click', revealRound);
  runTimer();
  updateLiveStatus();
}

async function submitChoice(value) {
  if (remainingSeconds() <= 0 || room?.roundState !== 'open') return;
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `choice-${room.round}-${currentUid}`), {
      uid: currentUid,
      nickname: playerByUid(currentUid)?.nickname || '플레이어',
      round: Number(room.round),
      kind: 'choice',
      text: value,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('선택을 저장하지 못했습니다.'); }
}

async function submitGuess(subjectUid, value) {
  if (!subjectUid || remainingSeconds() <= 0 || room?.roundState !== 'open') return;
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `guess-${room.round}-${subjectUid}`), {
      uid: currentUid,
      nickname: playerByUid(currentUid)?.nickname || '관찰자',
      round: Number(room.round),
      kind: 'guess',
      subjectUid,
      text: value,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('예측을 저장하지 못했습니다.'); }
}

function updateLiveStatus() {
  if (!room || room.roundState !== 'open') return;
  const status = document.getElementById('status-line');
  if (status) status.textContent = `준비 ${Math.min(submittedCount(), expectedSubmissionCount())}/${expectedSubmissionCount()}`;
  const reveal = document.getElementById('reveal');
  if (reveal) {
    const ready = allSubmitted() || remainingSeconds() <= 0;
    reveal.disabled = !ready;
    reveal.textContent = allSubmitted() ? '전원 선택 완료 · 공개' : remainingSeconds() <= 0 ? '시간 종료 · 공개' : '시간 종료 후 공개';
  }
}

function runTimer() {
  clearInterval(timerId);
  const tick = () => {
    const seconds = remainingSeconds();
    const timer = document.getElementById('timer');
    if (timer) {
      timer.textContent = String(seconds);
      timer.classList.toggle('is-urgent', seconds <= 5);
    }
    updateLiveStatus();
    if (seconds <= 0) {
      document.querySelectorAll('.balance-button').forEach(button => { button.disabled = true; });
      clearInterval(timerId);
      timerId = null;
    }
  };
  tick();
  timerId = setInterval(tick, 500);
}

function roundEvaluation() {
  const choices = currentRoundAnswers('choice');
  const guesses = currentRoundAnswers('guess');
  return orderedPlayers().filter(player => player.uid !== room.targetUid).map(player => {
    const choice = choices.find(item => item.uid === player.uid)?.text || '';
    const guess = guesses.find(item => item.subjectUid === player.uid)?.text || '';
    return { player, choice, guess, correct: Boolean(choice && guess && choice === guess) };
  });
}

async function revealRound() {
  if (!isHost() || room?.roundState !== 'open' || (!allSubmitted() && remainingSeconds() > 0)) return;
  const evaluation = roundEvaluation();
  const targetUid = room.targetUid;
  const deltas = new Map(players.map(player => [player.uid, 0]));
  for (const item of evaluation) {
    if (item.correct) deltas.set(targetUid, Number(deltas.get(targetUid) || 0) + 2);
    else deltas.set(item.player.uid, Number(deltas.get(item.player.uid) || 0) + 1);
  }
  const batch = writeBatch(db);
  for (const player of players) {
    const subjectResult = evaluation.find(item => item.player.uid === player.uid);
    const correctReads = player.uid === targetUid ? evaluation.filter(item => item.correct).length : 0;
    const dna = player.uid === targetUid
      ? addDna(player.dna, { reader: correctReads, samples: evaluation.length })
      : subjectResult
        ? addDna(player.dna, { safe: subjectResult.correct ? 1 : 0, unique: subjectResult.correct ? 0 : 1, samples: 1 })
        : normalizeDna(player.dna);
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: Number(player.score || 0) + Number(deltas.get(player.uid) || 0),
      dna,
      updatedAt: Timestamp.now()
    });
  }
  batch.update(doc(db, 'game_rooms', roomId), { roundState: 'reveal', updatedAt: Timestamp.now() });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('결과를 공개하지 못했습니다.'); }
}

function renderReveal() {
  clearInterval(timerId);
  timerId = null;
  const scenario = currentScenario();
  const target = currentTarget();
  const evaluation = roundEvaluation();
  const correctCount = evaluation.filter(item => item.correct).length;
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">관심법 공개</span>
      <h2>${escapeText(target?.nickname || '관찰자')}의 적중 ${correctCount}/${evaluation.length}</h2>
      <p class="lead">${escapeText(scenario.prompt)}</p>
      <ul class="result-list">${evaluation.map(item => {
        const option = scenario.options['ABCD'.indexOf(item.choice)] || item.choice || '미선택';
        const guessOption = scenario.options['ABCD'.indexOf(item.guess)] || item.guess || '미예측';
        return `<li class="result-item"><span><strong>${escapeText(item.player.nickname)}</strong><small>실제: ${escapeText(option)}</small><small>예측: ${escapeText(guessOption)}</small></span><span class="result-tag ${item.correct ? 'good' : 'bad'}">${item.correct ? '딱 걸림 +2' : '관찰자 속임 +1'}</span></li>`;
      }).join('')}</ul>
      <div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul>
      ${isHost() ? `<div class="button-row"><button class="primary-button" id="next" type="button">${Number(room.round) >= Number(room.maxRounds) ? '최종 결과 보기' : '다음 사람 관심법'}</button></div>` : '<p class="lobby-note">방장이 다음 라운드를 열 때까지 기다려주세요.</p>'}
    </section>`;
  document.getElementById('next')?.addEventListener('click', nextRound);
}

async function nextRound() {
  if (!isHost() || room?.roundState !== 'reveal') return;
  const current = Number(room.round || 0);
  if (current >= Number(room.maxRounds || players.length)) {
    try { await updateDoc(doc(db, 'game_rooms', roomId), { status: 'finished', updatedAt: Timestamp.now() }); } catch (error) { console.error(error); }
    return;
  }
  const next = current + 1;
  const used = Array.isArray(room.usedPrompts) ? room.usedPrompts : [];
  const prompt = pickPrompt(used);
  const target = targetForRound(next);
  try {
    await updateDoc(doc(db, 'game_rooms', roomId), {
      round: next,
      roundState: 'open',
      promptId: prompt.id,
      targetUid: target.uid,
      usedPrompts: [...used, prompt.id],
      roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000),
      updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('다음 라운드를 열지 못했습니다.'); }
}

function renderFinished() {
  const ranking = rankedPlayers();
  app.innerHTML = `
    <section class="panel">
      <span class="kicker">MIND READER</span>
      <h1>🏆 관심법 결과</h1>
      <p class="lead">오늘 사람 마음을 가장 잘 읽은 사람은 <strong>${escapeText(ranking[0]?.nickname || '플레이어')}</strong>!</p>
      <ol class="ranking">${ranking.map((player, index) => `<li class="rank-item"><span class="rank-number">${index + 1}</span><span class="rank-name">${escapeText(player.nickname)}</span><span class="rank-score">${Number(player.score || 0)}점</span></li>`).join('')}</ol>
      ${isHost() ? '<div class="button-row"><button class="primary-button" id="restart" type="button">같은 멤버로 다시 하기</button></div>' : '<p class="lobby-note">방장이 다시 시작하면 같은 방에서 이어갈 수 있습니다.</p>'}
      <div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none">소소킹 플레이 홈</a></div>
    </section>`;
  document.getElementById('restart')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  try {
    const answerSnap = await getDocs(collection(db, 'game_rooms', roomId, 'answers'));
    const batch = writeBatch(db);
    answerSnap.docs.forEach(item => batch.delete(item.ref));
    for (const player of players) {
      batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() });
    }
    batch.update(doc(db, 'game_rooms', roomId), {
      status: 'lobby',
      round: 0,
      maxRounds: ROOM_MAX_ROUNDS,
      roundState: 'waiting',
      promptId: '',
      targetUid: '',
      usedPrompts: [],
      roundEndsAt: deleteField(),
      updatedAt: Timestamp.now()
    });
    await batch.commit();
  } catch (error) { console.error(error); showToast('다시 시작하지 못했습니다.'); }
}

function renderError(message) {
  clearInterval(timerId);
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-button" href="/game/mind/" style="display:grid;place-items:center;text-decoration:none">처음 화면으로</a></div></section>`;
}

async function boot() {
  try {
    await initAuth();
    currentUid = auth.currentUser?.uid || '';
    if (!currentUid) throw new Error('auth');
    const code = normalizeCode(new URL(location.href).searchParams.get('room'));
    if (!code) return renderLanding();
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== 'mind-reader') {
      renderLanding(code);
      return showToast('초대받은 관심법 방을 찾지 못했습니다.');
    }
    roomId = code;
    if (await ensureMembership(code)) subscribeRoom(code);
  } catch (error) {
    console.error(error);
    renderError('게임을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.');
  }
}

shareButton.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
void boot();
