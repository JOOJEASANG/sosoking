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
const MAX_ROUNDS = 3;
const WRITE_SECONDS = 40;
const BID_SECONDS = 24;
const INCIDENTS = [
  { id: 'cake', title: '마지막 케이크 실종 사건', text: '냉장고에 분명 마지막 케이크 한 조각이 있었는데 사라졌다. CCTV는 없다. 왜 당신이 범인이 아닌가?' },
  { id: 'group-name', title: '단톡방 이름 테러 사건', text: '새벽 사이 단톡방 이름이 “우리 이제 끝”으로 바뀌었다. 모두가 당신을 보고 있다. 변명하라.' },
  { id: 'wallpaper', title: '배경화면 교체 사건', text: '친구의 휴대폰 배경화면이 몰래 굴욕 사진으로 바뀌었다. 폰 근처에 있었던 당신의 알리바이는?' },
  { id: 'tv', title: '새벽 4시 TV 폭주 사건', text: '여행 숙소 TV가 새벽 4시에 최대 볼륨으로 켜졌다. 리모컨은 거실에 있었다. 왜 당신이 아닌가?' },
  { id: 'receipt', title: '정체불명 메뉴 7개 사건', text: '모임 계산서에 아무도 주문한 기억이 없는 메뉴 7개가 찍혔다. 주문 앱을 만졌던 당신이 의심받는다.' },
  { id: 'photo', title: '흑역사 사진 유출 사건', text: '아무도 갖고 있지 않다던 10년 전 흑역사 사진이 단톡방에 올라왔다. 당신 폰에도 그 사진이 있다.' },
  { id: 'snack', title: '차량 과자 폭발 사건', text: '차 안 전체에 과자 부스러기가 폭발하듯 흩어졌다. 마지막으로 과자를 들고 있던 사람은 당신이다.' },
  { id: 'alarm', title: '알람 17개 사건', text: '친구 폰에 오전 5시부터 2분 간격 알람 17개가 등록됐다. 전날 폰을 잠깐 빌린 사람은 당신이다.' },
  { id: 'delivery', title: '의문의 배달 5인분 사건', text: '한밤중 집 앞으로 음식 5인분이 배달됐다. 주문자 이름이 당신 별명과 똑같다.' },
  { id: 'playlist', title: '플레이리스트 침투 사건', text: '드라이브 플레이리스트 30곡이 전부 같은 노래로 바뀌었다. 블루투스를 마지막으로 연결한 건 당신이다.' }
];
const KEYWORDS = ['선풍기','고양이','택배','엘리베이터','충전기','양말','우산','영수증','라면','셀카','지하주차장','복권','치약','편의점','배달기사','비밀번호','알람','휴지','리모컨','운동화','얼음','블루투스','캡처','보조배터리','김치','드라이기','종이컵','내비게이션'];

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

function cleanAlibi(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function privateKeyword(uid = currentUid) {
  return KEYWORDS[stableHash(`${uid}|${room?.promptId || ''}|${room?.round || 0}`) % KEYWORDS.length];
}

function incidentById(id) {
  return INCIDENTS.find(item => item.id === id) || INCIDENTS[0];
}

function currentIncident() {
  return incidentById(room?.promptId || INCIDENTS[0].id);
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
  return `${location.origin}/game/alibi/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const data = { title: '소소킹 변명거래소 초대', text: `누가 제일 그럴듯하게 빠져나가는지 보자. 방 ${roomId}`, url: inviteUrl() };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(data.url); showToast('초대 링크를 복사했습니다.'); }
  catch { window.prompt('이 링크를 카카오톡으로 보내주세요.', data.url); }
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

function currentRoundAnswers(kind = '') {
  const round = Number(room?.round || 0);
  return answers.filter(item => Number(item.round) === round && (!kind || item.kind === kind));
}

function playerListMarkup(showScores = false) {
  const source = showScores ? rankedPlayers() : orderedPlayers();
  return source.map(player => `<li class="player-item"><span class="player-name">${escapeText(player.nickname)}${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}</span>${showScores ? `<span class="player-score">${Number(player.score || 0)}점</span>` : ''}</li>`).join('');
}

function renderLanding(prefilled = '') {
  stopSubscriptions();
  room = null;
  players = [];
  answers = [];
  shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">SOSOKING ORIGINAL</span><h1>🧾 변명거래소</h1><p class="lead">황당한 사건의 용의자가 되어 사람마다 다른 비밀 키워드를 변명 속에 자연스럽게 숨기세요. 변명은 익명으로 거래되고, 친구들은 신뢰칩 1~3개를 걸어 가장 믿을 만한 변명에 베팅합니다.</p><form id="create"><label class="field"><span>내 닉네임</span><input id="cn" maxlength="12" placeholder="예: 재구" required></label><div class="button-row"><button class="primary-button">거래소 열기</button></div></form><div class="divider"></div><form id="join"><label class="field"><span>초대 코드</span><input id="jc" maxlength="6" value="${escapeText(prefilled)}" required></label><label class="field"><span>내 닉네임</span><input id="jn" maxlength="12" placeholder="예: 친구1" required></label><div class="button-row"><button class="secondary-button">초대받은 거래소 입장</button></div></form></section>`;
  document.getElementById('create').addEventListener('submit', event => { event.preventDefault(); void createRoom(document.getElementById('cn').value); });
  document.getElementById('join').addEventListener('submit', event => { event.preventDefault(); void joinRoom(document.getElementById('jc').value, document.getElementById('jn').value); });
}

async function createRoom(nicknameValue) {
  const nickname = cleanNickname(nicknameValue);
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode();
      if (!(await getDoc(doc(db, 'game_rooms', candidate))).exists()) { code = candidate; break; }
    }
    if (!code) throw new Error('room-code');
    await setDoc(doc(db, 'game_rooms', code), {
      type: 'alibi-market', status: 'lobby', hostUid: currentUid, maxPlayers: MAX_PLAYERS,
      round: 0, maxRounds: MAX_ROUNDS, roundState: 'waiting', phase: 'waiting', promptId: '', usedPrompts: [],
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid, nickname, score: 0, dna: emptyDna(), joinOrder: Date.now(), joinedAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) { console.error(error); showToast('거래소를 열지 못했습니다.'); }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== 'alibi-market') throw new Error('room');
    if (roomSnap.data().status !== 'lobby') throw new Error('started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [playersSnap, existing] = await Promise.all([getDocs(collection(db, 'game_rooms', code, 'players')), getDoc(playerRef)]);
    if (playersSnap.size >= MAX_PLAYERS && !existing.exists()) throw new Error('full');
    await setDoc(playerRef, {
      uid: currentUid, nickname, score: 0, dna: normalizeDna(existing.exists() ? existing.data().dna : {}),
      joinOrder: existing.exists() ? Number(existing.data().joinOrder || Date.now()) : Date.now(),
      joinedAt: existing.exists() ? existing.data().joinedAt || Timestamp.now() : Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) {
    showToast(error?.message === 'full' ? '이 방은 8명이 모두 들어왔습니다.' : error?.message === 'started' ? '이미 거래가 시작된 방입니다.' : '게임방에 입장하지 못했습니다.');
  }
}

async function ensureMembership(code) {
  const snap = await getDoc(doc(db, 'game_rooms', code, 'players', currentUid));
  if (snap.exists()) return true;
  renderInvite(code, sessionStorage.getItem(`sosoking-game-nickname:${code}`) || '');
  return false;
}

function renderInvite(code, saved = '') {
  stopSubscriptions(); shareButton.hidden = true;
  app.innerHTML = `<section class="panel"><span class="kicker">거래소 초대</span><h1>🧾 변명거래소에 초대됐어요</h1><div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div><form id="invite-form"><label class="field"><span>내 닉네임</span><input id="invite-name" maxlength="12" value="${escapeText(saved)}" required></label><div class="button-row"><button class="primary-button">입장하기</button></div></form></section>`;
  document.getElementById('invite-form').addEventListener('submit', event => { event.preventDefault(); void joinRoom(code, document.getElementById('invite-name').value); });
}

function subscribeRoom(code) {
  stopSubscriptions(); roomId = code; shareButton.hidden = false;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snapshot => {
    if (!snapshot.exists()) return renderLanding();
    room = { id: snapshot.id, ...snapshot.data() }; renderCurrent();
  }, error => { console.error(error); renderError('거래소 정보를 불러오지 못했습니다.'); });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateLiveStatus(); else renderCurrent();
  });
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (room?.status === 'playing' && room?.roundState === 'open') updateLiveStatus(); else renderCurrent();
  });
}

function renderCurrent() {
  if (!room) return;
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'playing' && room.roundState === 'open' && room.phase === 'write') return renderWrite();
  if (room.status === 'playing' && room.roundState === 'open' && room.phase === 'bid') return renderBid();
  if (room.status === 'playing' && room.roundState === 'reveal') return renderReveal();
  if (room.status === 'finished') return renderFinished();
  renderError('알 수 없는 거래 상태입니다.');
}

function renderLobby() {
  clearInterval(timerId); timerId = null;
  const canStart = isHost() && players.length >= 3;
  app.innerHTML = `<section class="panel"><span class="kicker">거래소 대기실</span><h2>3명 이상 모이면 개장</h2><p class="lead">한 판은 3개 사건입니다. 변명 작성 → 익명 공개 → 신뢰칩 베팅 → 작성자 공개 순서로 진행됩니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div><div class="button-row two"><button class="secondary-button" id="invite">카톡으로 초대</button><button class="secondary-button" id="copy">코드 복사</button></div><ul class="player-list">${playerListMarkup(false)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="start" ${canStart ? '' : 'disabled'}>거래 시작 (${players.length}/${MAX_PLAYERS})</button></div>` : '<p class="lobby-note">방장이 거래소를 열 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(roomId); showToast('코드를 복사했습니다.'); } catch { showToast(roomId); } });
  document.getElementById('start')?.addEventListener('click', startGame);
}

function pickIncident(used = []) {
  const available = INCIDENTS.filter(item => !used.includes(item.id));
  const pool = available.length ? available : INCIDENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function startGame() {
  if (!isHost() || players.length < 3) return;
  const incident = pickIncident([]);
  const batch = writeBatch(db);
  for (const player of players) batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() });
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing', round: 1, roundState: 'open', phase: 'write', promptId: incident.id, usedPrompts: [incident.id],
    roundEndsAt: Timestamp.fromMillis(Date.now() + WRITE_SECONDS * 1000), updatedAt: Timestamp.now()
  });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('거래를 시작하지 못했습니다.'); }
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function myAlibi() { return currentRoundAnswers('alibi').find(item => item.uid === currentUid); }
function myVote() { return currentRoundAnswers('vote').find(item => item.uid === currentUid); }
function allAlibis() { return players.length >= 3 && currentRoundAnswers('alibi').length >= players.length; }
function allVotes() { return players.length >= 3 && currentRoundAnswers('vote').length >= players.length; }

function renderWrite() {
  const incident = currentIncident();
  const keyword = privateKeyword();
  const mine = myAlibi();
  app.innerHTML = `<section class="panel"><div class="round-head"><span class="round-label">CASE ${Number(room.round)} / ${MAX_ROUNDS}</span><span class="timer" id="timer">${remainingSeconds()}</span></div><div class="question-box"><small>${escapeText(incident.title)}</small><strong>${escapeText(incident.text)}</strong></div><div class="score-banner">🔐 내 비밀 키워드: <strong>${escapeText(keyword)}</strong><br>이 단어를 그대로 한 번 넣어야 변명이 등록됩니다.</div><form id="alibi-form"><label class="field"><span>내 변명 · 12~100자</span><input id="alibi-input" maxlength="100" value="${escapeText(mine?.text || '')}" placeholder="최대한 자연스럽게 빠져나가세요" required></label><div class="button-row"><button class="primary-button" id="submit">${mine ? '변명 수정하기' : '변명 등록하기'}</button></div></form><div class="status-line" id="status"></div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="market" ${allAlibis() || remainingSeconds() <= 0 ? '' : 'disabled'}>${allAlibis() ? '전원 등록 · 익명시장 열기' : '시간 종료 후 시장 열기'}</button></div>` : ''}</section>`;
  document.getElementById('alibi-form').addEventListener('submit', submitAlibi);
  document.getElementById('market')?.addEventListener('click', openBidMarket);
  runTimer(); updateLiveStatus();
}

async function submitAlibi(event) {
  event.preventDefault();
  if (room?.phase !== 'write' || remainingSeconds() <= 0) return;
  const value = cleanAlibi(document.getElementById('alibi-input')?.value);
  const keyword = privateKeyword();
  if (value.length < 12) return showToast('변명을 12자 이상 적어주세요.');
  if (!value.includes(keyword)) return showToast(`비밀 키워드 “${keyword}”를 그대로 넣어주세요.`);
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `alibi-${room.round}-${currentUid}`), {
      uid: currentUid, nickname: playerByUid(currentUid)?.nickname || '플레이어', round: Number(room.round), kind: 'alibi', text: value,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    showToast('변명이 익명 거래소에 등록됐습니다.');
  } catch (error) { console.error(error); showToast('변명을 등록하지 못했습니다.'); }
}

async function openBidMarket() {
  if (!isHost() || room?.phase !== 'write' || (!allAlibis() && remainingSeconds() > 0)) return;
  try {
    await updateDoc(doc(db, 'game_rooms', roomId), { phase: 'bid', roundEndsAt: Timestamp.fromMillis(Date.now() + BID_SECONDS * 1000), updatedAt: Timestamp.now() });
  } catch (error) { console.error(error); showToast('시장을 열지 못했습니다.'); }
}

function shuffledAlibis() {
  return [...currentRoundAnswers('alibi')].sort((a, b) => stableHash(`${room.promptId}|${a.uid}`) - stableHash(`${room.promptId}|${b.uid}`));
}

function renderBid() {
  const vote = myVote();
  const entries = shuffledAlibis();
  app.innerHTML = `<section class="panel"><div class="round-head"><span class="round-label">익명 신뢰시장</span><span class="timer" id="timer">${remainingSeconds()}</span></div><h2>누구 변명인지 모른 채 베팅</h2><p class="lead">내 변명을 제외하고 가장 믿을 만한 변명 하나에 신뢰칩 1~3개를 거세요. 맞히면 건 칩만큼 +점수, 실패하면 그만큼 -점수입니다.</p><ul class="result-list">${entries.map((entry, index) => {
    const mine = entry.uid === currentUid;
    const selected = vote?.targetUid === entry.uid ? Number(vote.stake || 0) : 0;
    return `<li class="result-item" style="display:block"><strong>변명 ${String.fromCharCode(65 + index)} ${mine ? '(내 변명)' : ''}</strong><small style="display:block;margin-top:6px;line-height:1.55">${escapeText(entry.text)}</small>${mine ? '<div class="status-line">자기 변명에는 베팅할 수 없습니다.</div>' : `<div class="choice-grid" style="grid-template-columns:repeat(3,1fr)"><button class="choice-button ${selected === 1 ? 'is-selected' : ''}" data-target="${escapeText(entry.uid)}" data-stake="1">1칩</button><button class="choice-button ${selected === 2 ? 'is-selected' : ''}" data-target="${escapeText(entry.uid)}" data-stake="2">2칩</button><button class="choice-button ${selected === 3 ? 'is-selected' : ''}" data-target="${escapeText(entry.uid)}" data-stake="3">3칩</button></div>`}</li>`;
  }).join('')}</ul><div class="status-line" id="status"></div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal" ${allVotes() || remainingSeconds() <= 0 ? '' : 'disabled'}>${allVotes() ? '전원 베팅 · 작성자 공개' : '시간 종료 후 공개'}</button></div>` : ''}</section>`;
  document.querySelectorAll('.choice-button[data-target]').forEach(button => button.addEventListener('click', () => void submitVote(button.dataset.target || '', Number(button.dataset.stake || 1))));
  document.getElementById('reveal')?.addEventListener('click', revealRound);
  runTimer(); updateLiveStatus();
}

async function submitVote(targetUid, stake) {
  if (!targetUid || targetUid === currentUid || room?.phase !== 'bid' || remainingSeconds() <= 0) return;
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `vote-${room.round}-${currentUid}`), {
      uid: currentUid, nickname: playerByUid(currentUid)?.nickname || '플레이어', round: Number(room.round), kind: 'vote', text: 'trust-bid', targetUid, stake: Math.max(1, Math.min(3, Number(stake))),
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    showToast(`${stake}칩 베팅 완료`);
  } catch (error) { console.error(error); showToast('베팅을 저장하지 못했습니다.'); }
}

function updateLiveStatus() {
  if (!room || room.roundState !== 'open') return;
  const status = document.getElementById('status');
  if (status) status.textContent = room.phase === 'write' ? `변명 등록 ${currentRoundAnswers('alibi').length}/${players.length}` : `베팅 완료 ${currentRoundAnswers('vote').length}/${players.length}`;
  const button = document.getElementById(room.phase === 'write' ? 'market' : 'reveal');
  const ready = room.phase === 'write' ? allAlibis() : allVotes();
  if (button) {
    button.disabled = !(ready || remainingSeconds() <= 0);
    button.textContent = ready ? (room.phase === 'write' ? '전원 등록 · 익명시장 열기' : '전원 베팅 · 작성자 공개') : (room.phase === 'write' ? '시간 종료 후 시장 열기' : '시간 종료 후 공개');
  }
}

function runTimer() {
  clearInterval(timerId);
  const tick = () => {
    const seconds = remainingSeconds();
    const timer = document.getElementById('timer');
    if (timer) { timer.textContent = String(seconds); timer.classList.toggle('is-urgent', seconds <= 5); }
    updateLiveStatus();
    if (seconds <= 0) {
      document.querySelectorAll('input, .choice-button').forEach(element => { element.disabled = true; });
      clearInterval(timerId); timerId = null;
    }
  };
  tick(); timerId = setInterval(tick, 500);
}

function marketEvaluation() {
  const entries = currentRoundAnswers('alibi');
  const votes = currentRoundAnswers('vote');
  const totals = new Map(entries.map(entry => [entry.uid, 0]));
  for (const vote of votes) totals.set(vote.targetUid, Number(totals.get(vote.targetUid) || 0) + Number(vote.stake || 0));
  const maxTrust = Math.max(0, ...totals.values());
  const winners = [...totals.entries()].filter(([, value]) => value === maxTrust && maxTrust > 0).map(([uid]) => uid);
  const deltas = new Map(players.map(player => [player.uid, 0]));
  for (const winnerUid of winners) deltas.set(winnerUid, Number(deltas.get(winnerUid) || 0) + Number(totals.get(winnerUid) || 0));
  for (const vote of votes) {
    const stake = Number(vote.stake || 0);
    deltas.set(vote.uid, Number(deltas.get(vote.uid) || 0) + (winners.includes(vote.targetUid) ? stake : -stake));
  }
  return { entries, votes, totals, winners, deltas, maxTrust };
}

async function revealRound() {
  if (!isHost() || room?.phase !== 'bid' || (!allVotes() && remainingSeconds() > 0)) return;
  const { deltas, entries, votes, winners } = marketEvaluation();
  const batch = writeBatch(db);
  for (const player of players) {
    const vote = votes.find(item => item.uid === player.uid);
    const stake = Number(vote?.stake || 0);
    const dna = entries.some(item => item.uid === player.uid) ? addDna(player.dna, {
      bold: stake >= 3 ? 1 : 0,
      safe: stake === 1 ? 1 : 0,
      unique: winners.includes(player.uid) ? 2 : 0,
      reader: vote && winners.includes(vote.targetUid) ? 1 : 0,
      samples: 1
    }) : normalizeDna(player.dna);
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: Number(player.score || 0) + Number(deltas.get(player.uid) || 0), dna, updatedAt: Timestamp.now()
    });
  }
  batch.update(doc(db, 'game_rooms', roomId), { roundState: 'reveal', phase: 'reveal', updatedAt: Timestamp.now() });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('거래 결과를 공개하지 못했습니다.'); }
}

function renderReveal() {
  clearInterval(timerId); timerId = null;
  const { entries, totals, winners, deltas } = marketEvaluation();
  const incident = currentIncident();
  app.innerHTML = `<section class="panel"><span class="kicker">거래 체결</span><h2>${escapeText(incident.title)} 결과</h2><p class="lead">익명 변명의 작성자와 신뢰칩 흐름이 공개됩니다.</p><ul class="result-list">${entries.sort((a,b)=>Number(totals.get(b.uid)||0)-Number(totals.get(a.uid)||0)).map(entry => `<li class="result-item"><span><strong>${escapeText(entry.text)}</strong><small>작성자: ${escapeText(playerByUid(entry.uid)?.nickname || '플레이어')} · 신뢰 ${Number(totals.get(entry.uid)||0)}칩</small></span><span class="result-tag ${winners.includes(entry.uid) ? 'good' : 'bad'}">${winners.includes(entry.uid) ? '시장 선택' : '미체결'}</span></li>`).join('')}</ul><div class="score-banner">이번 라운드 점수 변화<br>${orderedPlayers().map(player=>`${escapeText(player.nickname)} ${Number(deltas.get(player.uid)||0)>=0?'+':''}${Number(deltas.get(player.uid)||0)}`).join(' · ')}</div><div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="next">${Number(room.round) >= MAX_ROUNDS ? '최종 거래장부 보기' : '다음 사건 열기'}</button></div>` : '<p class="lobby-note">방장이 다음 사건을 열 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('next')?.addEventListener('click', nextRound);
}

async function nextRound() {
  if (!isHost() || room?.roundState !== 'reveal') return;
  if (Number(room.round) >= MAX_ROUNDS) {
    try { await updateDoc(doc(db, 'game_rooms', roomId), { status: 'finished', updatedAt: Timestamp.now() }); } catch (error) { console.error(error); }
    return;
  }
  const used = Array.isArray(room.usedPrompts) ? room.usedPrompts : [];
  const incident = pickIncident(used);
  try {
    await updateDoc(doc(db, 'game_rooms', roomId), {
      round: Number(room.round) + 1, roundState: 'open', phase: 'write', promptId: incident.id, usedPrompts: [...used, incident.id],
      roundEndsAt: Timestamp.fromMillis(Date.now() + WRITE_SECONDS * 1000), updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('다음 사건을 열지 못했습니다.'); }
}

function renderFinished() {
  const ranking = rankedPlayers();
  app.innerHTML = `<section class="panel"><span class="kicker">MARKET CLOSED</span><h1>🏆 최종 거래장부</h1><p class="lead">오늘 가장 믿음을 사고 판 사람은 <strong>${escapeText(ranking[0]?.nickname || '플레이어')}</strong>!</p><ol class="ranking">${ranking.map((player,index)=>`<li class="rank-item"><span class="rank-number">${index+1}</span><span class="rank-name">${escapeText(player.nickname)}</span><span class="rank-score">${Number(player.score||0)}점</span></li>`).join('')}</ol>${isHost()?'<div class="button-row"><button class="primary-button" id="restart">같은 멤버로 다시 거래</button></div>':'<p class="lobby-note">방장이 다시 열면 같은 방에서 계속할 수 있습니다.</p>'}<div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none">소소킹 플레이 홈</a></div></section>`;
  document.getElementById('restart')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  try {
    const answerSnap = await getDocs(collection(db, 'game_rooms', roomId, 'answers'));
    const batch = writeBatch(db);
    answerSnap.docs.forEach(item => batch.delete(item.ref));
    for (const player of players) batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, updatedAt: Timestamp.now() });
    batch.update(doc(db, 'game_rooms', roomId), { status: 'lobby', round: 0, roundState: 'waiting', phase: 'waiting', promptId: '', usedPrompts: [], roundEndsAt: deleteField(), updatedAt: Timestamp.now() });
    await batch.commit();
  } catch (error) { console.error(error); showToast('거래소를 다시 열지 못했습니다.'); }
}

function renderError(message) {
  clearInterval(timerId);
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-button" href="/game/alibi/" style="display:grid;place-items:center;text-decoration:none">처음 화면으로</a></div></section>`;
}

async function boot() {
  try {
    await initAuth(); currentUid = auth.currentUser?.uid || ''; if (!currentUid) throw new Error('auth');
    const code = normalizeCode(new URL(location.href).searchParams.get('room'));
    if (!code) return renderLanding();
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== 'alibi-market') { renderLanding(code); return showToast('초대받은 변명거래소 방을 찾지 못했습니다.'); }
    roomId = code; if (await ensureMembership(code)) subscribeRoom(code);
  } catch (error) { console.error(error); renderError('게임을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.'); }
}

shareButton.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
void boot();
