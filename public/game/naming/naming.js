import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import {
  activePlayers,
  annotateEntries,
  cleanName,
  cleanTopic,
  evaluateTurn,
  isDuplicateName,
  normalizeName,
  orderedPlayers
} from '/game/naming/naming-core.js?v=20260817-naming-1';

const app = document.getElementById('game-app');
const shareButton = document.getElementById('share-room');
const toast = document.getElementById('toast');
const GAME_TYPE = 'naming-survival';
const TURN_SECONDS = 30;
const TOPIC_SUGGESTIONS = [
  '새로 문 여는 카페 이름',
  '아이돌 그룹 이름',
  '동네 치킨집 이름',
  '게임 길드 이름',
  '유튜브 채널 이름',
  '반려동물 이름',
  '신제품 과자 이름',
  '회사 프로젝트 이름'
];

let roomId = '';
let room = null;
let players = [];
let entries = [];
let currentUid = '';
let timerId = null;
let toastId = null;
let processingTurn = false;
let timeoutWriting = false;
let playersReady = false;
let entriesReady = false;
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeEntries = null;
let entryScope = '';

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
  toastId = setTimeout(() => { toast.hidden = true; }, 2400);
}

function randomToken(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

function randomCode() {
  return randomToken(6);
}

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 12);
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function isHost() {
  return Boolean(room && room.hostUid === currentUid);
}

function playerByUid(uid) {
  return players.find(player => player.uid === uid);
}

function myPlayer() {
  return playerByUid(currentUid);
}

function sessionEntriesPath(sessionId = room?.sessionId || '') {
  return collection(db, 'game_rooms', roomId, 'naming_sessions', sessionId, 'entries');
}

function sessionDocRef(sessionId = room?.sessionId || '') {
  return doc(db, 'game_rooms', roomId, 'naming_sessions', sessionId);
}

function stopSubscriptions() {
  unsubscribeRoom?.();
  unsubscribePlayers?.();
  unsubscribeEntries?.();
  unsubscribeRoom = null;
  unsubscribePlayers = null;
  unsubscribeEntries = null;
  entryScope = '';
  playersReady = false;
  entriesReady = false;
  clearInterval(timerId);
  timerId = null;
}

function stopEntrySubscription() {
  unsubscribeEntries?.();
  unsubscribeEntries = null;
  entryScope = '';
  entries = [];
  entriesReady = false;
}

function setRoomUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState({}, '', url);
}

function inviteUrl() {
  return `${location.origin}/game/naming/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const data = {
    title: '소소킹 작명톡 생존전 초대',
    text: `주제 “${room?.topic || '비밀 주제'}”로 이름 대결! 방 ${roomId}`,
    url: inviteUrl()
  };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    showToast('초대 링크를 복사했습니다.');
  } catch {
    window.prompt('이 링크를 보내주세요.', data.url);
  }
}

function orderedRoster() {
  return orderedPlayers(players);
}

function rankedPlayers() {
  return [...players].sort((a, b) => (
    Number(a.eliminated === true) - Number(b.eliminated === true)
    || Number(b.score || 0) - Number(a.score || 0)
    || Number(a.joinOrder || 0) - Number(b.joinOrder || 0)
  ));
}

function playerListMarkup(showScore = false) {
  return orderedRoster().map(player => {
    const eliminated = player.eliminated === true;
    return `<li class="player-item ${eliminated ? 'is-eliminated' : ''}">
      <span class="player-name">${escapeText(player.nickname)}${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}</span>
      <span class="player-score">${eliminated ? '탈락' : showScore ? `${Number(player.score || 0)}개` : '생존'}</span>
    </li>`;
  }).join('');
}

function renderLanding(prefilled = '') {
  stopSubscriptions();
  room = null;
  players = [];
  entries = [];
  shareButton.hidden = true;
  app.innerHTML = `<section class="panel naming-landing">
    <span class="kicker">SOSOKING ORIGINAL · SAVED CHAT</span>
    <h1>✍️ 작명톡 생존전</h1>
    <p class="lead">주제에 맞는 이름을 채팅처럼 한 명씩 올립니다. 이미 나온 이름은 금지, 포기하거나 시간이 끝나면 탈락! 마지막 한 명이 작명왕입니다.</p>
    <form id="create">
      <label class="field"><span>내 닉네임</span><input id="cn" maxlength="12" placeholder="예: 재구" required></label>
      <label class="field"><span>작명 주제 · 최대 40자</span><input id="ct" maxlength="40" list="topic-suggestions" placeholder="예: 새로 문 여는 카페 이름" required></label>
      <datalist id="topic-suggestions">${TOPIC_SUGGESTIONS.map(topic => `<option value="${escapeText(topic)}"></option>`).join('')}</datalist>
      <div class="button-row"><button class="primary-button">작명방 만들기</button></div>
    </form>
    <div class="divider"></div>
    <form id="join">
      <label class="field"><span>초대 코드</span><input id="jc" maxlength="6" value="${escapeText(prefilled)}" required></label>
      <label class="field"><span>내 닉네임</span><input id="jn" maxlength="12" placeholder="예: 친구1" required></label>
      <div class="button-row"><button class="secondary-button">초대받은 작명방 입장</button></div>
    </form>
    <div class="naming-data-note">🗂️ 제출된 이름과 탈락 기록은 세션별 데이터로 보관됩니다.</div>
  </section>`;
  document.getElementById('create').addEventListener('submit', event => {
    event.preventDefault();
    void createRoom(document.getElementById('cn').value, document.getElementById('ct').value);
  });
  document.getElementById('join').addEventListener('submit', event => {
    event.preventDefault();
    void joinRoom(document.getElementById('jc').value, document.getElementById('jn').value);
  });
}

async function createRoom(nicknameValue, topicValue) {
  const nickname = cleanNickname(nicknameValue);
  const topic = cleanTopic(topicValue);
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  if (!topic) return showToast('작명 주제를 입력해주세요.');
  try {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode();
      if (!(await getDoc(doc(db, 'game_rooms', candidate))).exists()) { code = candidate; break; }
    }
    if (!code) throw new Error('room-code');
    await setDoc(doc(db, 'game_rooms', code), {
      type: GAME_TYPE,
      status: 'lobby',
      hostUid: currentUid,
      maxPlayers: 0,
      round: 0,
      maxRounds: 0,
      roundState: 'waiting',
      phase: 'waiting',
      topic,
      sessionId: '',
      currentTurnUid: '',
      turnToken: '',
      turnNumber: 0,
      cycle: 0,
      lastProcessedToken: '',
      winnerUid: '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid,
      nickname,
      score: 0,
      eliminated: false,
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
    showToast('작명방을 만들지 못했습니다.');
  }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== GAME_TYPE) throw new Error('room');
    if (roomSnap.data().status !== 'lobby') throw new Error('started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const existing = await getDoc(playerRef);
    await setDoc(playerRef, {
      uid: currentUid,
      nickname,
      score: 0,
      eliminated: false,
      joinOrder: existing.exists() ? Number(existing.data().joinOrder || Date.now()) : Date.now(),
      joinedAt: existing.exists() ? existing.data().joinedAt || Timestamp.now() : Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code;
    setRoomUrl(code);
    subscribeRoom(code);
  } catch (error) {
    showToast(error?.message === 'started' ? '이미 작명 대결이 시작된 방입니다.' : '작명방에 입장하지 못했습니다.');
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
  app.innerHTML = `<section class="panel">
    <span class="kicker">UNLIMITED LOBBY</span>
    <h1>✍️ 작명톡 생존전에 초대됐어요</h1>
    <div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div>
    <form id="invite-form">
      <label class="field"><span>내 닉네임</span><input id="invite-name" maxlength="12" value="${escapeText(saved)}" required></label>
      <div class="button-row"><button class="primary-button">인원 제한 없이 입장</button></div>
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
    ensureEntrySubscription();
    renderCurrent();
    queueHostProcessing();
  }, error => {
    console.error(error);
    renderError('작명방 정보를 불러오지 못했습니다.');
  });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    playersReady = true;
    renderCurrent();
    queueHostProcessing();
  });
}

function ensureEntrySubscription() {
  const sessionId = room?.sessionId || '';
  if (!sessionId || room?.type !== GAME_TYPE) {
    stopEntrySubscription();
    return;
  }
  if (entryScope === sessionId && unsubscribeEntries) return;
  stopEntrySubscription();
  entryScope = sessionId;
  unsubscribeEntries = onSnapshot(query(sessionEntriesPath(sessionId), orderBy('turn', 'asc')), snapshot => {
    entries = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    entriesReady = true;
    renderCurrent();
    queueHostProcessing();
  }, error => {
    console.error('naming entries subscription failed', error);
    showToast('작명 기록을 불러오지 못했습니다.');
  });
}

function renderCurrent() {
  if (!room) return;
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'playing' && room.roundState === 'open') return renderPlaying();
  if (room.status === 'finished') return renderFinished();
  renderError('알 수 없는 작명게임 상태입니다.');
}

function renderLobby() {
  clearInterval(timerId);
  timerId = null;
  const canStart = isHost() && players.length >= 2 && Boolean(cleanTopic(room.topic));
  const topicForm = isHost()
    ? `<form id="topic-form" class="naming-topic-form">
        <label class="field"><span>이번 판 주제</span><input id="topic-input" maxlength="40" list="lobby-topics" value="${escapeText(room.topic || '')}" required></label>
        <datalist id="lobby-topics">${TOPIC_SUGGESTIONS.map(topic => `<option value="${escapeText(topic)}"></option>`).join('')}</datalist>
        <button class="secondary-button" type="submit">주제 저장</button>
      </form>`
    : `<div class="question-box"><small>방장이 정한 주제</small><strong>${escapeText(room.topic || '정하는 중…')}</strong></div>`;
  app.innerHTML = `<section class="panel">
    <span class="kicker">작명 대기실 · 인원 제한 없음</span>
    <h2>2명 이상이면 바로 시작</h2>
    <p class="lead">한 명씩 이름을 올리고 다음 사람에게 차례가 넘어갑니다. 중복 이름·포기·30초 시간초과는 즉시 탈락합니다.</p>
    <div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div>
    <div class="button-row two"><button class="secondary-button" id="invite">링크로 초대</button><button class="secondary-button" id="copy">코드 복사</button></div>
    ${topicForm}
    <div class="naming-roster-head"><strong>참가자 ${players.length}명</strong><span>제한 없음</span></div>
    <ul class="player-list">${playerListMarkup(false)}</ul>
    ${isHost()
      ? `<div class="button-row"><button class="primary-button" id="start" ${canStart ? '' : 'disabled'}>작명 생존전 시작</button></div>`
      : '<p class="lobby-note">방장이 시작할 때까지 기다려주세요.</p>'}
    <div class="naming-data-note">🗂️ 게임을 다시 해도 이전 세션의 작명 기록은 삭제하지 않습니다.</div>
  </section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomId); showToast('코드를 복사했습니다.'); }
    catch { showToast(roomId); }
  });
  document.getElementById('topic-form')?.addEventListener('submit', saveTopic);
  document.getElementById('start')?.addEventListener('click', startGame);
}

async function saveTopic(event) {
  event?.preventDefault();
  if (!isHost() || room?.status !== 'lobby') return;
  const topic = cleanTopic(document.getElementById('topic-input')?.value);
  if (!topic) return showToast('주제를 입력해주세요.');
  try {
    await updateDoc(doc(db, 'game_rooms', roomId), { topic, updatedAt: Timestamp.now() });
    showToast('주제를 저장했습니다.');
  } catch (error) {
    console.error(error);
    showToast('주제를 저장하지 못했습니다.');
  }
}

async function startGame() {
  if (!isHost() || players.length < 2) return;
  const topic = cleanTopic(document.getElementById('topic-input')?.value || room.topic);
  if (!topic) return showToast('먼저 주제를 정해주세요.');
  const ordered = orderedRoster();
  const sessionId = randomToken(18);
  const turnToken = randomToken(22);
  const now = Timestamp.now();
  const batch = writeBatch(db);
  for (const player of ordered) {
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: 0,
      eliminated: false,
      eliminatedAt: deleteField(),
      updatedAt: now
    });
  }
  batch.set(sessionDocRef(sessionId), {
    sessionId,
    roomId,
    topic,
    hostUid: currentUid,
    participantCount: ordered.length,
    status: 'playing',
    winnerUid: '',
    winnerNickname: '',
    totalTurns: 0,
    startedAt: now,
    updatedAt: now
  });
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing',
    round: 1,
    roundState: 'open',
    phase: 'turn',
    topic,
    sessionId,
    currentTurnUid: ordered[0].uid,
    turnToken,
    turnNumber: 1,
    cycle: 1,
    lastProcessedToken: '',
    lastEvent: {},
    winnerUid: '',
    roundEndsAt: Timestamp.fromMillis(Date.now() + TURN_SECONDS * 1000),
    updatedAt: now
  });
  try {
    await batch.commit();
  } catch (error) {
    console.error(error);
    showToast('작명 생존전을 시작하지 못했습니다.');
  }
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function submittedThisTurn() {
  return entries.find(entry => entry.id === room?.turnToken);
}

function entryMarkup() {
  const annotated = annotateEntries(entries);
  if (!annotated.length) return '<div class="naming-chat-empty">첫 이름을 기다리는 중입니다…</div>';
  return annotated.map(entry => {
    const nickname = escapeText(entry.nickname || playerByUid(entry.uid)?.nickname || '플레이어');
    if (entry.kind === 'forfeit') {
      return `<li class="naming-system-message"><span>🏳️</span><strong>${nickname}</strong> 님이 포기해 탈락했습니다.</li>`;
    }
    if (entry.kind === 'timeout') {
      return `<li class="naming-system-message"><span>⏰</span><strong>${nickname}</strong> 님이 시간초과로 탈락했습니다.</li>`;
    }
    return `<li class="naming-message ${entry.duplicate ? 'is-duplicate' : ''}">
      <div class="naming-avatar">${escapeText(String(entry.nickname || '?').slice(0, 1))}</div>
      <div><small>${nickname} · ${Number(entry.turn || 0)}번째</small><strong>${escapeText(entry.text)}</strong>${entry.duplicate ? '<em>중복 이름 · 탈락</em>' : ''}</div>
    </li>`;
  }).join('');
}

function renderPlaying() {
  const current = playerByUid(room.currentTurnUid);
  const mine = myPlayer();
  const myTurn = room.currentTurnUid === currentUid && mine?.eliminated !== true;
  const submitted = submittedThisTurn();
  const activeCount = activePlayers(players).length;
  const controls = mine?.eliminated === true
    ? '<div class="naming-spectator">👀 탈락했지만 끝까지 채팅 기록을 관전할 수 있습니다.</div>'
    : myTurn
      ? submitted
        ? '<div class="naming-spectator">제출 완료 · 다음 차례로 넘기는 중입니다.</div>'
        : `<form id="name-form" class="naming-compose">
            <input id="name-input" maxlength="24" autocomplete="off" placeholder="주제에 맞는 새 이름 입력" aria-label="작명 입력" required>
            <button class="primary-button" type="submit">전송</button>
            <button class="naming-forfeit" id="forfeit" type="button">포기 · 탈락</button>
          </form>`
      : `<div class="naming-spectator"><strong>${escapeText(current?.nickname || '다음 참가자')}</strong> 님이 작명 중입니다…</div>`;
  app.innerHTML = `<section class="panel naming-play">
    <div class="round-head">
      <span class="round-label">CYCLE ${Number(room.cycle || 1)} · TURN ${Number(room.turnNumber || 1)}</span>
      <span class="timer" id="turn-timer">${remainingSeconds()}</span>
    </div>
    <div class="naming-topic-banner"><small>오늘의 작명 주제</small><strong>${escapeText(room.topic)}</strong><span>생존 ${activeCount}명 · 전체 ${players.length}명</span></div>
    <div class="naming-turn"><span>지금 차례</span><strong>${escapeText(current?.nickname || '확인 중')}</strong></div>
    <ol class="naming-chat" id="naming-chat">${entryMarkup()}</ol>
    ${controls}
    <ul class="player-list naming-mini-roster">${playerListMarkup(true)}</ul>
    <div class="naming-data-note">🗂️ 이 대화는 세션 ${escapeText(room.sessionId)} 기록으로 저장 중</div>
  </section>`;
  document.getElementById('name-form')?.addEventListener('submit', submitName);
  document.getElementById('forfeit')?.addEventListener('click', forfeitTurn);
  requestAnimationFrame(() => {
    const chat = document.getElementById('naming-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
    if (myTurn && !submitted) document.getElementById('name-input')?.focus();
  });
  runTimer();
}

async function submitName(event) {
  event.preventDefault();
  if (room?.currentTurnUid !== currentUid || submittedThisTurn() || remainingSeconds() <= 0) return;
  const text = cleanName(document.getElementById('name-input')?.value);
  const normalized = normalizeName(text);
  if (!text || !normalized) return showToast('글자나 숫자가 들어간 이름을 입력해주세요.');
  if (isDuplicateName(entries, text)) return showToast('이미 나온 이름입니다. 다른 이름을 지어주세요.');
  try {
    await setDoc(doc(sessionEntriesPath(), room.turnToken), {
      sessionId: room.sessionId,
      topic: room.topic,
      turn: Number(room.turnNumber),
      cycle: Number(room.cycle),
      uid: currentUid,
      nickname: myPlayer()?.nickname || '플레이어',
      kind: 'name',
      text,
      normalized,
      createdAt: Timestamp.now()
    });
    showToast('새 이름을 기록했습니다.');
  } catch (error) {
    console.error(error);
    showToast('이름을 저장하지 못했습니다.');
  }
}

async function forfeitTurn() {
  if (room?.currentTurnUid !== currentUid || submittedThisTurn() || remainingSeconds() <= 0) return;
  if (!window.confirm('포기하면 이번 게임에서 바로 탈락합니다. 포기할까요?')) return;
  try {
    await setDoc(doc(sessionEntriesPath(), room.turnToken), {
      sessionId: room.sessionId,
      topic: room.topic,
      turn: Number(room.turnNumber),
      cycle: Number(room.cycle),
      uid: currentUid,
      nickname: myPlayer()?.nickname || '플레이어',
      kind: 'forfeit',
      text: '',
      normalized: '',
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error(error);
    showToast('포기 기록을 저장하지 못했습니다.');
  }
}

async function ensureTimeoutEntry() {
  if (!isHost() || timeoutWriting || submittedThisTurn() || room?.status !== 'playing' || remainingSeconds() > 0) return;
  const timedOut = playerByUid(room.currentTurnUid);
  if (!timedOut || !room.turnToken) return;
  timeoutWriting = true;
  try {
    await setDoc(doc(sessionEntriesPath(), room.turnToken), {
      sessionId: room.sessionId,
      topic: room.topic,
      turn: Number(room.turnNumber),
      cycle: Number(room.cycle),
      uid: timedOut.uid,
      nickname: timedOut.nickname || '플레이어',
      kind: 'timeout',
      text: '',
      normalized: '',
      createdAt: Timestamp.now()
    });
  } catch (error) {
    if (error?.code !== 'permission-denied') console.warn('timeout entry skipped', error);
  } finally {
    timeoutWriting = false;
  }
}

function queueHostProcessing() {
  if (!isHost() || processingTurn) return;
  setTimeout(() => void maybeProcessTurn(), 0);
}

async function maybeProcessTurn() {
  if (
    !isHost()
    || processingTurn
    || !playersReady
    || !entriesReady
    || room?.status !== 'playing'
    || room?.roundState !== 'open'
    || !playerByUid(room.currentTurnUid)
  ) return;
  const entry = submittedThisTurn();
  if (!entry || room.lastProcessedToken === room.turnToken) return;
  processingTurn = true;
  const expectedToken = room.turnToken;
  const expectedSession = room.sessionId;
  const expectedTurn = Number(room.turnNumber);
  const newTurnToken = randomToken(22);
  try {
    await runTransaction(db, async transaction => {
      const roomRef = doc(db, 'game_rooms', roomId);
      const entryRef = doc(sessionEntriesPath(expectedSession), expectedToken);
      const latestRoomSnap = await transaction.get(roomRef);
      const latestEntrySnap = await transaction.get(entryRef);
      if (!latestRoomSnap.exists() || !latestEntrySnap.exists()) return;
      const latestRoom = latestRoomSnap.data();
      if (
        latestRoom.status !== 'playing'
        || latestRoom.sessionId !== expectedSession
        || latestRoom.turnToken !== expectedToken
        || Number(latestRoom.turnNumber) !== expectedTurn
        || latestRoom.lastProcessedToken === expectedToken
      ) return;
      const latestEntry = { id: latestEntrySnap.id, ...latestEntrySnap.data() };
      const currentPlayerRef = doc(db, 'game_rooms', roomId, 'players', latestRoom.currentTurnUid);
      const currentPlayerSnap = await transaction.get(currentPlayerRef);
      const sessionRef = sessionDocRef(expectedSession);
      const sessionSnap = await transaction.get(sessionRef);
      if (!currentPlayerSnap.exists() || !sessionSnap.exists()) return;

      const latestPlayers = orderedPlayers(players).map(player => (
        player.uid === latestRoom.currentTurnUid ? { ...player, ...currentPlayerSnap.data() } : player
      ));
      const priorEntries = entries.filter(item => Number(item.turn) < expectedTurn);
      const outcome = evaluateTurn({
        players: latestPlayers,
        entries: priorEntries,
        currentUid: latestRoom.currentTurnUid,
        kind: latestEntry.kind,
        text: latestEntry.text
      });
      const now = Timestamp.now();
      const currentPlayer = currentPlayerSnap.data();
      const playerUpdate = outcome.accepted
        ? { score: Number(currentPlayer.score || 0) + 1, eliminated: false, updatedAt: now }
        : { eliminated: true, eliminatedAt: now, updatedAt: now };
      transaction.update(currentPlayerRef, playerUpdate);

      const currentIndex = latestPlayers.findIndex(player => player.uid === latestRoom.currentTurnUid);
      const nextIndex = latestPlayers.findIndex(player => player.uid === outcome.nextUid);
      const nextCycle = outcome.finished
        ? Number(latestRoom.cycle || 1)
        : Number(latestRoom.cycle || 1) + (nextIndex >= 0 && nextIndex <= currentIndex ? 1 : 0);
      const eventKind = outcome.duplicate ? 'duplicate' : latestEntry.kind;
      const event = {
        kind: eventKind,
        uid: latestRoom.currentTurnUid,
        nickname: currentPlayer.nickname || '플레이어',
        text: latestEntry.text || '',
        turn: expectedTurn
      };
      if (outcome.finished) {
        const winner = latestPlayers.find(player => player.uid === outcome.winnerUid);
        transaction.update(roomRef, {
          status: 'finished',
          roundState: 'finished',
          phase: 'finished',
          currentTurnUid: '',
          winnerUid: outcome.winnerUid,
          lastProcessedToken: expectedToken,
          lastEvent: event,
          roundEndsAt: deleteField(),
          updatedAt: now
        });
        transaction.update(sessionRef, {
          status: 'finished',
          winnerUid: outcome.winnerUid,
          winnerNickname: winner?.nickname || '',
          totalTurns: expectedTurn,
          finishedAt: now,
          updatedAt: now
        });
      } else {
        transaction.update(roomRef, {
          round: expectedTurn + 1,
          turnNumber: expectedTurn + 1,
          cycle: nextCycle,
          currentTurnUid: outcome.nextUid,
          turnToken: newTurnToken,
          lastProcessedToken: expectedToken,
          lastEvent: event,
          roundEndsAt: Timestamp.fromMillis(Date.now() + TURN_SECONDS * 1000),
          updatedAt: now
        });
        transaction.update(sessionRef, { totalTurns: expectedTurn, updatedAt: now });
      }
    });
  } catch (error) {
    console.error('naming turn processing failed', error);
    showToast('다음 차례로 넘기지 못했습니다.');
  } finally {
    processingTurn = false;
  }
}

function updateTimer() {
  const seconds = remainingSeconds();
  const timer = document.getElementById('turn-timer');
  if (timer) {
    timer.textContent = String(seconds);
    timer.classList.toggle('is-urgent', seconds <= 5);
  }
  if (seconds <= 0) {
    document.querySelectorAll('#name-form input,#name-form button,#forfeit').forEach(element => { element.disabled = true; });
    void ensureTimeoutEntry();
  }
}

function runTimer() {
  clearInterval(timerId);
  updateTimer();
  timerId = setInterval(updateTimer, 500);
}

function archiveText() {
  const annotated = annotateEntries(entries);
  const lines = annotated.map(entry => {
    if (entry.kind === 'forfeit') return `#${entry.turn} ${entry.nickname}: 포기·탈락`;
    if (entry.kind === 'timeout') return `#${entry.turn} ${entry.nickname}: 시간초과·탈락`;
    return `#${entry.turn} ${entry.nickname}: ${entry.text}${entry.duplicate ? ' (중복·탈락)' : ''}`;
  });
  return [`[작명톡 생존전] ${room.topic}`, ...lines, `우승: ${playerByUid(room.winnerUid)?.nickname || '없음'}`].join('\n');
}

function renderFinished() {
  clearInterval(timerId);
  timerId = null;
  const ranking = rankedPlayers();
  const winner = playerByUid(room.winnerUid) || ranking[0];
  app.innerHTML = `<section class="panel naming-finished">
    <span class="kicker">NAMING ARCHIVE SAVED</span>
    <h1>🏆 ${escapeText(winner?.nickname || '작명왕')} 우승!</h1>
    <p class="lead">주제 “${escapeText(room.topic)}”에서 마지막까지 살아남았습니다.</p>
    <div class="naming-archive-summary"><strong>${entries.length}개의 작명 기록 저장 완료</strong><span>세션 ${escapeText(room.sessionId)}</span></div>
    <ol class="naming-chat naming-chat-finished">${entryMarkup()}</ol>
    <ol class="ranking">${ranking.map((player, index) => `<li class="rank-item">
      <span class="rank-number">${index + 1}</span>
      <span class="rank-name">${escapeText(player.nickname)}${player.uid === room.winnerUid ? ' 👑' : ''}</span>
      <span class="rank-score">${Number(player.score || 0)}개</span>
    </li>`).join('')}</ol>
    <div class="button-row"><button class="secondary-button" id="copy-record">작명 기록 복사</button></div>
    ${isHost() ? '<div class="button-row"><button class="primary-button" id="restart">같은 멤버로 새 주제</button></div>' : '<p class="lobby-note">방장이 새 주제를 열면 같은 방에서 다시 시작합니다.</p>'}
    <div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none">소소킹 플레이 홈</a></div>
  </section>`;
  document.getElementById('copy-record')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(archiveText()); showToast('작명 기록을 복사했습니다.'); }
    catch { showToast('기록을 복사하지 못했습니다.'); }
  });
  document.getElementById('restart')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  const now = Timestamp.now();
  const batch = writeBatch(db);
  for (const player of players) {
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: 0,
      eliminated: false,
      eliminatedAt: deleteField(),
      updatedAt: now
    });
  }
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'lobby',
    round: 0,
    roundState: 'waiting',
    phase: 'waiting',
    sessionId: '',
    currentTurnUid: '',
    turnToken: '',
    turnNumber: 0,
    cycle: 0,
    lastProcessedToken: '',
    lastEvent: {},
    winnerUid: '',
    roundEndsAt: deleteField(),
    updatedAt: now
  });
  try {
    await batch.commit();
  } catch (error) {
    console.error(error);
    showToast('새 작명판을 열지 못했습니다.');
  }
}

function renderError(message) {
  clearInterval(timerId);
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-button" href="/game/naming/" style="display:grid;place-items:center;text-decoration:none">처음 화면으로</a></div></section>`;
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
      return showToast('초대받은 작명방을 찾지 못했습니다.');
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
