import { auth, db, functions, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
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
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import {
  addDna,
  counterTrait,
  DNA_KEYS,
  DNA_TRAITS,
  dominantTrait,
  emptyDna,
  normalizeDna
} from '/game/dna-profile.js?v=20260816-dna-1';

const app = document.getElementById('game-app');
const shareButton = document.getElementById('share-room');
const toast = document.getElementById('toast');
const generateDnaBoss = httpsCallable(functions, 'generateDnaBoss', { timeout: 20000 });

const MAX_PLAYERS = 8;
const MAX_ROUNDS = 6;
const SCAN_ROUNDS = 3;
const ROUND_SECONDS = 14;

const SCAN_PROMPTS = [
  {
    title: '수상한 문이 네 개 열렸다',
    question: '설명할 시간은 없다. 가장 먼저 손이 가는 문은?',
    labels: {
      bold: ['불타는 문', '보상은 커 보이지만 무슨 일이 생길지 모른다.'],
      safe: ['철벽 문', '조금 느려도 안전장치가 확실하다.'],
      unique: ['낙서뿐인 문', '아무도 관심 없어 보여서 오히려 끌린다.'],
      reader: ['발자국 있는 문', '다른 사람의 움직임부터 읽어본다.']
    }
  },
  {
    title: '왕관이 하나 떨어졌다',
    question: '친구들이 동시에 달려든다면 나는?',
    labels: {
      bold: ['먼저 낚아챈다', '생각은 잡은 다음에 한다.'],
      safe: ['함정을 확인한다', '왕관보다 살아남는 게 먼저다.'],
      unique: ['왕관 말고 상자를 연다', '남들이 보지 않은 곳을 노린다.'],
      reader: ['누가 움직이는지 본다', '사람을 읽으면 답이 보인다.']
    }
  },
  {
    title: '마지막 선택이 남았다',
    question: '정답을 모를 때 나오는 진짜 버릇은?',
    labels: {
      bold: ['가장 강한 것', '틀려도 화끈하게 간다.'],
      safe: ['가장 무난한 것', '손해가 적은 선택을 찾는다.'],
      unique: ['아무도 안 할 것', '정답보다 겹치지 않는 게 중요하다.'],
      reader: ['친구가 고를 것', '사람을 맞히면 정답도 따라온다.']
    }
  }
];

const BATTLE_RULES = [
  { id: 'reverse', title: '버릇 반전', text: '평소 주특기의 반대 행동을 고르면 2 피해를 줍니다.' },
  { id: 'pair', title: '쌍둥이 균열', text: '반대 행동은 2 피해. 정확히 두 명만 같은 선택이면 각자 +1 피해!' },
  { id: 'solo', title: '외로운 한 방', text: '반대 행동은 2 피해. 혼자만 고른 선택이면 +1 피해!' }
];

const FALLBACK_PACKS = [
  {
    bossName: '버릇수집왕 루프', bossEmoji: '🌀',
    intro: '너희가 반복한 선택을 모아 스스로 강해지는 괴물이다. 익숙한 버릇을 깨야만 이길 수 있다.',
    roundTitles: ['버릇 반전', '쌍둥이 균열', '외로운 한 방'],
    taunts: ['또 그 선택이지? 이미 다 외웠다!', '서로 따라 하면 내 보호막만 두꺼워진다.', '마지막까지 네 버릇을 지킬 수 있을까?'],
    victory: '오늘은 버릇보다 사람이 강했다. 다음 방에서는 전혀 다른 괴물이 태어날 것이다.',
    defeat: '괴물은 살아남았지만 너희의 약점은 들켰다. 한 판 더라면 결과는 달라진다.'
  },
  {
    bossName: '선택복제왕 미러킹', bossEmoji: '🪞',
    intro: '친구들의 익숙한 선택을 그대로 복제해 앞을 막는다. 평소와 다르게 움직여 거울을 깨뜨려라.',
    roundTitles: ['거울 뒤집기', '둘만의 금', '단독 파괴'],
    taunts: ['네 다음 버튼까지 거울에 비친다!', '같은 선택은 내가 가장 좋아하는 먹이다.', '혼자 달라질 용기가 남았나?'],
    victory: '예측할 수 없는 선택 앞에서 거울이 산산조각 났다.',
    defeat: '미러킹이 너희 선택을 완전히 복사했다. 새로운 버릇으로 다시 도전하라.'
  },
  {
    bossName: '습관포식자 데자뷔', bossEmoji: '🐲',
    intro: '이미 본 장면을 계속 되풀이하게 만드는 포식자다. 반대 선택과 팀 호흡으로 반복을 끝내라.',
    roundTitles: ['반대의 첫발', '두 사람의 틈', '혼자의 반격'],
    taunts: ['이 장면, 방금 전에도 봤는데?', '예상대로 움직여줘서 고맙다!', '너희 결말도 이미 정해져 있다.'],
    victory: '반복되던 결말이 바뀌었다. 오늘의 플레이 DNA가 새로 기록됐다.',
    defeat: '데자뷔가 결말을 되돌렸다. 하지만 다음 선택까지 같을 필요는 없다.'
  }
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
let directorPending = false;

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastId);
  toastId = setTimeout(() => { toast.hidden = true; }, 2400);
}

function normalizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 12);
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function setRoomUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code); else url.searchParams.delete('room');
  history.replaceState({}, '', url);
}

function inviteUrl() {
  return `${location.origin}/game/dna/?room=${encodeURIComponent(roomId)}`;
}

async function shareRoom() {
  if (!roomId) return;
  const data = {
    title: '소소킹 DNA 초대',
    text: `친구들의 버릇으로 AI 보스를 만드는 방 ${roomId}에 들어와!`,
    url: inviteUrl()
  };
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(data.url); showToast('초대 링크를 복사했습니다.'); }
  catch { window.prompt('이 링크를 복사해서 보내주세요.', data.url); }
}

function stopSubscriptions() {
  unsubscribeRoom?.(); unsubscribePlayers?.(); unsubscribeAnswers?.();
  unsubscribeRoom = null; unsubscribePlayers = null; unsubscribeAnswers = null;
  clearInterval(timerId); timerId = null;
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

function rankedPlayers() {
  return [...players].sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0) || Number(b.score || 0) - Number(a.score || 0) || Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
}

function playerListMarkup(showScores = false) {
  const source = showScores ? rankedPlayers() : orderedPlayers();
  return source.map((player, index) => `<li class="player-item"><span class="player-name">${escapeText(player.nickname || '플레이어')}${player.uid === room?.hostUid ? '<span class="host-label">방장</span>' : ''}</span>${showScores ? `<span class="player-score">${Number(player.score || 0)}P · ⚔️${Number(player.damage || 0)}</span>` : `<span class="seat-number">${index + 1}</span>`}</li>`).join('');
}

function currentAnswers(kind) {
  return answers.filter(item => Number(item.round) === Number(room?.round || 0) && item.kind === kind);
}

function remainingSeconds() {
  const end = room?.roundEndsAt?.toMillis?.() || 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function allSubmitted(kind) {
  return players.length >= 2 && currentAnswers(kind).length >= players.length;
}

function canReveal(kind) {
  return allSubmitted(kind) || remainingSeconds() <= 0;
}

function traitMarkup(player) {
  const key = dominantTrait(player?.dna, player?.uid || '');
  const trait = DNA_TRAITS[key];
  const dna = normalizeDna(player?.dna);
  const max = Math.max(1, ...DNA_KEYS.map(item => dna[item]));
  return `<div class="dna-trait-card"><span>${trait.emoji}</span><div><strong>${escapeText(player?.nickname || '플레이어')} · ${trait.label}</strong><small>${trait.description}</small></div></div><div class="dna-bars">${DNA_KEYS.map(item => `<div class="dna-bar"><span>${DNA_TRAITS[item].emoji} ${DNA_TRAITS[item].label}</span><div class="dna-bar-track"><div class="dna-bar-fill" style="width:${Math.max(5, Math.round(dna[item] / max * 100))}%"></div></div><b>${dna[item]}</b></div>`).join('')}</div>`;
}

function renderLanding(prefilledCode = '') {
  stopSubscriptions(); room = null; players = []; answers = []; shareButton.hidden = true;
  app.innerHTML = `<section class="panel dna-panel"><span class="kicker">SOSOKING AI ORIGINAL</span><h1>🧬 소소킹 DNA</h1><p class="lead">친구들의 실제 선택 버릇을 읽고, 그날 멤버에게 맞춘 AI 보스를 함께 쓰러뜨립니다.</p><div class="dna-hero"><span class="dna-hero-icon">🧬</span><strong>습관파괴왕</strong><small>이 방의 플레이 기록에 맞춘 보스와 개인 임무를 만납니다.</small></div><div class="dna-rule-strip"><span>① 3번의 선택으로<br>플레이 DNA 스캔</span><span>② AI가 방 전체를<br>한 번만 분석</span><span>③ 평소와 반대로<br>보스 공략</span></div><div class="dna-history-note">✨ 같은 방에서 다른 게임을 먼저 했다면 금고 선택·단독 정답·친구 예측·베팅 성향도 함께 반영됩니다.</div><form id="create-room-form"><label class="field"><span>내 닉네임</span><input id="create-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="primary-button" type="submit">새 DNA방 만들기</button></div></form><div class="divider"></div><form id="join-room-form"><label class="field"><span>초대 코드</span><input id="join-code" value="${escapeText(prefilledCode)}" maxlength="6" placeholder="예: AB7K2Q" required></label><label class="field"><span>내 닉네임</span><input id="join-nickname" maxlength="12" autocomplete="nickname" placeholder="닉네임" required></label><div class="button-row"><button class="secondary-button" type="submit">초대받은 DNA방 입장</button></div></form></section>`;
  document.getElementById('create-room-form')?.addEventListener('submit', event => { event.preventDefault(); void createRoom(document.getElementById('create-nickname').value); });
  document.getElementById('join-room-form')?.addEventListener('submit', event => { event.preventDefault(); void joinRoom(document.getElementById('join-code').value, document.getElementById('join-nickname').value); });
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
      type: 'dna-boss', status: 'lobby', hostUid: currentUid, maxPlayers: MAX_PLAYERS,
      round: 0, maxRounds: MAX_ROUNDS, roundState: 'waiting', phase: 'waiting',
      bossHp: 0, bossMaxHp: 0, aiStatus: 'idle', aiMode: '', aiPack: {}, lastResults: [],
      createdAt: now, updatedAt: now
    });
    await setDoc(doc(db, 'game_rooms', code, 'players', currentUid), {
      uid: currentUid, nickname, score: 0, damage: 0, dna: emptyDna(),
      joinOrder: Date.now(), joinedAt: now, updatedAt: now
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) {
    console.error('create dna room failed', error); showToast('DNA방을 만들지 못했습니다.');
    if (button) button.disabled = false;
  }
}

async function joinRoom(codeValue, nicknameValue) {
  const code = normalizeRoomCode(codeValue);
  const nickname = cleanNickname(nicknameValue);
  if (code.length !== 6) return showToast('6자리 초대 코드를 확인해주세요.');
  if (!nickname) return showToast('닉네임을 입력해주세요.');
  try {
    const roomRef = doc(db, 'game_rooms', code);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists() || roomSnap.data().type !== 'dna-boss') throw new Error('missing');
    if (roomSnap.data().status !== 'lobby') throw new Error('started');
    const playerRef = doc(db, 'game_rooms', code, 'players', currentUid);
    const [playersSnap, existing] = await Promise.all([getDocs(collection(db, 'game_rooms', code, 'players')), getDoc(playerRef)]);
    if (playersSnap.size >= MAX_PLAYERS && !existing.exists()) throw new Error('full');
    const previous = existing.exists() ? existing.data() : {};
    const now = Timestamp.now();
    await setDoc(playerRef, {
      uid: currentUid, nickname, score: 0, damage: 0, dna: normalizeDna(previous.dna),
      joinOrder: Number(previous.joinOrder || Date.now()), joinedAt: previous.joinedAt || now, updatedAt: now
    });
    sessionStorage.setItem(`sosoking-game-nickname:${code}`, nickname);
    roomId = code; setRoomUrl(code); subscribeRoom(code);
  } catch (error) {
    const message = error?.message === 'full' ? '이 방은 8명이 모두 들어왔습니다.' : error?.message === 'started' ? '이미 보스 분석이 시작된 방입니다.' : 'DNA방에 입장하지 못했습니다.';
    showToast(message);
  }
}

async function ensureMembership(code) {
  const playerSnap = await getDoc(doc(db, 'game_rooms', code, 'players', currentUid));
  if (playerSnap.exists()) return true;
  renderInvite(code, sessionStorage.getItem(`sosoking-game-nickname:${code}`) || '');
  return false;
}

function renderInvite(code, saved = '') {
  stopSubscriptions(); shareButton.hidden = true;
  app.innerHTML = `<section class="panel dna-panel"><span class="kicker">DNA방 초대</span><h1>🧬 보스가 너를 기다린다</h1><p class="lead">닉네임만 입력하면 같은 멤버들과 바로 시작합니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(code)}</strong></div><form id="invite-form"><label class="field"><span>내 닉네임</span><input id="invite-name" maxlength="12" value="${escapeText(saved)}" required></label><div class="button-row"><button class="primary-button">DNA방 입장</button></div></form></section>`;
  document.getElementById('invite-form')?.addEventListener('submit', event => { event.preventDefault(); void joinRoom(code, document.getElementById('invite-name').value); });
}

function subscribeRoom(code) {
  stopSubscriptions(); roomId = code; shareButton.hidden = false;
  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', code), snapshot => {
    if (!snapshot.exists()) { setRoomUrl(''); return renderLanding(); }
    room = { id: snapshot.id, ...snapshot.data() };
    renderCurrent();
  }, error => { console.error(error); renderError('DNA방 정보를 불러오지 못했습니다.'); });
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', code, 'players'), snapshot => {
    players = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); renderCurrent();
  });
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', code, 'answers'), snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); updateLiveStatus();
  });
}

function renderCurrent() {
  if (!room) return;
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'finished') return renderFinished();
  if (room.phase === 'scan' && room.roundState === 'open') return renderScan();
  if (room.phase === 'scan-reveal') return renderScanReveal();
  if (room.phase === 'director') return renderDirector();
  if (room.phase === 'battle' && room.roundState === 'open') return renderBattle();
  if (room.phase === 'battle-reveal') return renderBattleReveal();
  renderError('알 수 없는 DNA 게임 상태입니다.');
}

function renderLobby() {
  clearInterval(timerId); timerId = null;
  const canStart = isHost() && players.length >= 2;
  const totalHistory = players.reduce((sum, player) => sum + Number(normalizeDna(player.dna).samples || 0), 0);
  app.innerHTML = `<section class="panel dna-panel"><span class="kicker">DNA LAB · 대기실</span><h2>2명 이상이면 스캔 시작</h2><p class="lead">짧은 선택 3번 뒤, 기존 게임 기록까지 더해 그날 멤버 전용 보스를 만듭니다.</p><div class="room-code"><small>초대 코드</small><strong>${escapeText(roomId)}</strong></div><div class="button-row two"><button class="secondary-button" id="invite">카톡으로 초대</button><button class="secondary-button" id="copy">코드 복사</button></div><div class="dna-history-note">🧠 현재 방에 이어진 플레이 기록 ${totalHistory}개 · 기록이 없어도 3번의 스캔으로 바로 플레이할 수 있습니다.</div><ul class="player-list">${playerListMarkup(false)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="start" ${canStart ? '' : 'disabled'}>플레이 DNA 스캔 (${players.length}/${MAX_PLAYERS})</button></div>` : '<p class="lobby-note">방장이 스캔을 시작할 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('invite')?.addEventListener('click', shareRoom);
  document.getElementById('copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(roomId); showToast('코드를 복사했습니다.'); } catch { showToast(roomId); } });
  document.getElementById('start')?.addEventListener('click', startGame);
}

async function startGame() {
  if (!isHost() || players.length < 2) return;
  const now = Timestamp.now();
  const batch = writeBatch(db);
  players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, damage: 0, dna: normalizeDna(player.dna), updatedAt: now }));
  batch.update(doc(db, 'game_rooms', roomId), {
    status: 'playing', round: 1, roundState: 'open', phase: 'scan', aiStatus: 'idle', aiMode: '', aiPack: {},
    bossHp: 0, bossMaxHp: 0, lastResults: [], roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: now
  });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('DNA 스캔을 시작하지 못했습니다.'); }
}

function scanChoiceMarkup(key, selected, prompt) {
  const [label, description] = prompt.labels[key];
  return `<button class="dna-choice ${selected === key ? 'is-selected' : ''}" type="button" data-dna-choice="${key}"><span>${DNA_TRAITS[key].emoji}</span><strong>${escapeText(label)}</strong><small>${escapeText(description)}</small>${selected === key ? '<em>선택 완료 · 공개 전 변경 가능</em>' : ''}</button>`;
}

function renderScan() {
  const prompt = SCAN_PROMPTS[Math.max(0, Number(room.round || 1) - 1)] || SCAN_PROMPTS[0];
  const mine = currentAnswers('dna-scan').find(item => item.uid === currentUid)?.text || '';
  app.innerHTML = `<section class="panel dna-panel"><div class="round-head"><span class="round-label">DNA SCAN ${Number(room.round)} / ${SCAN_ROUNDS}</span><span class="timer" id="timer">${remainingSeconds()}</span></div><span class="kicker">${escapeText(prompt.title)}</span><h2>${escapeText(prompt.question)}</h2><p class="lead">정답은 없습니다. 생각을 오래 하지 말고 평소처럼 고르세요.</p><div class="dna-choice-grid">${DNA_KEYS.map(key => scanChoiceMarkup(key, mine, prompt)).join('')}</div><div class="status-line" id="status">${currentAnswers('dna-scan').length}/${players.length}명 선택</div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal" ${canReveal('dna-scan') ? '' : 'disabled'}>${allSubmitted('dna-scan') ? '전원 선택 · DNA 공개' : '시간 종료 후 DNA 공개'}</button></div>` : ''}</section>`;
  document.querySelectorAll('[data-dna-choice]').forEach(button => button.addEventListener('click', () => void submitChoice('dna-scan', button.dataset.dnaChoice)));
  document.getElementById('reveal')?.addEventListener('click', revealScan);
  runTimer('dna-scan');
}

async function submitChoice(kind, choice) {
  if (!DNA_KEYS.includes(choice) || room?.roundState !== 'open' || remainingSeconds() <= 0) return;
  const player = playerByUid(currentUid);
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `${kind}-${room.round}-${currentUid}`), {
      uid: currentUid, nickname: player?.nickname || '플레이어', round: Number(room.round), kind, text: choice,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('선택을 저장하지 못했습니다.'); }
}

function updateLiveStatus() {
  if (!room || room.roundState !== 'open') return;
  const kind = room.phase === 'battle' ? 'dna-battle' : 'dna-scan';
  const mine = currentAnswers(kind).find(item => item.uid === currentUid)?.text || '';
  document.querySelectorAll('[data-dna-choice]').forEach(button => button.classList.toggle('is-selected', button.dataset.dnaChoice === mine));
  const status = document.getElementById('status');
  if (status) status.textContent = `${currentAnswers(kind).length}/${players.length}명 선택`;
  const reveal = document.getElementById('reveal');
  if (reveal) { reveal.disabled = !canReveal(kind); reveal.textContent = allSubmitted(kind) ? '전원 선택 · 결과 공개' : '시간 종료 후 결과 공개'; }
}

function runTimer(kind) {
  clearInterval(timerId);
  const tick = () => {
    const seconds = remainingSeconds();
    const timer = document.getElementById('timer');
    if (timer) { timer.textContent = String(seconds); timer.classList.toggle('is-urgent', seconds <= 5); }
    updateLiveStatus();
    if (seconds <= 0) {
      document.querySelectorAll('[data-dna-choice]').forEach(button => { button.disabled = true; });
      clearInterval(timerId); timerId = null;
    }
  };
  tick(); timerId = setInterval(tick, 450);
}

async function revealScan() {
  if (!isHost() || room?.phase !== 'scan' || !canReveal('dna-scan')) return;
  const selections = currentAnswers('dna-scan');
  const counts = new Map(DNA_KEYS.map(key => [key, selections.filter(item => item.text === key).length]));
  const results = players.map(player => {
    const choice = selections.find(item => item.uid === player.uid)?.text || '';
    const soloBonus = choice && counts.get(choice) === 1 ? 1 : 0;
    return {
      uid: player.uid, nickname: player.nickname || '플레이어', choice,
      label: choice ? `${DNA_TRAITS[choice].emoji} ${DNA_TRAITS[choice].label}${soloBonus ? ' · 혼자 선택 +1' : ''}` : '시간 초과',
      delta: choice ? 1 + soloBonus : 0
    };
  });
  const now = Timestamp.now();
  const batch = writeBatch(db);
  players.forEach(player => {
    const result = results.find(item => item.uid === player.uid);
    const additions = result?.choice ? { samples: 1 } : {};
    if (result?.choice) additions[result.choice] = 2;
    if (result?.delta > 1) additions.unique = Number(additions.unique || 0) + 1;
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: Number(player.score || 0) + Number(result?.delta || 0), dna: addDna(player.dna, additions), updatedAt: now
    });
  });
  batch.update(doc(db, 'game_rooms', roomId), { roundState: 'reveal', phase: 'scan-reveal', lastResults: results, updatedAt: now });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('DNA 결과를 공개하지 못했습니다.'); }
}

function renderScanReveal() {
  clearInterval(timerId); timerId = null;
  const me = playerByUid(currentUid);
  const rows = (room.lastResults || []).map(result => `<li class="result-item"><span><strong>${escapeText(result.nickname)}</strong><small>${escapeText(result.label)}</small></span><span class="result-tag good">+${Number(result.delta || 0)}P</span></li>`).join('');
  app.innerHTML = `<section class="panel dna-panel"><span class="kicker">DNA SCAN RESULT</span><h2>${Number(room.round)}차 선택 기록 완료</h2><ul class="result-list">${rows}</ul>${me ? traitMarkup(me) : ''}${isHost() ? `<div class="button-row"><button class="primary-button" id="next">${Number(room.round) >= SCAN_ROUNDS ? 'AI 디렉터에게 분석 맡기기' : '다음 DNA 스캔'}</button></div>` : '<p class="lobby-note">방장이 다음 분석을 시작할 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('next')?.addEventListener('click', nextAfterScan);
}

async function nextAfterScan() {
  if (!isHost() || room?.phase !== 'scan-reveal') return;
  const now = Timestamp.now();
  try {
    if (Number(room.round) < SCAN_ROUNDS) {
      await updateDoc(doc(db, 'game_rooms', roomId), {
        round: Number(room.round) + 1, roundState: 'open', phase: 'scan', lastResults: [],
        roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: now
      });
    } else {
      await updateDoc(doc(db, 'game_rooms', roomId), {
        roundState: 'waiting', phase: 'director', aiStatus: 'pending', lastResults: [], roundEndsAt: deleteField(), updatedAt: now
      });
    }
  } catch (error) { console.error(error); showToast('다음 단계로 넘어가지 못했습니다.'); }
}

function sanitizePack(value = {}) {
  const fallback = FALLBACK_PACKS[stableHash(roomId) % FALLBACK_PACKS.length];
  const clean = (text, limit, alternative) => String(text || alternative || '').replace(/[<>]/g, '').trim().slice(0, limit) || alternative;
  const list = (items, alternatives, limit) => alternatives.map((alternative, index) => clean(Array.isArray(items) ? items[index] : '', limit, alternative));
  const emoji = ['🌀', '🪞', '🐲', '👾', '🧟', '🦹', '🤖'].includes(value.bossEmoji) ? value.bossEmoji : fallback.bossEmoji;
  return {
    bossName: clean(value.bossName, 24, fallback.bossName), bossEmoji: emoji,
    intro: clean(value.intro, 140, fallback.intro),
    roundTitles: list(value.roundTitles, fallback.roundTitles, 28),
    taunts: list(value.taunts, fallback.taunts, 70),
    victory: clean(value.victory, 120, fallback.victory), defeat: clean(value.defeat, 120, fallback.defeat)
  };
}

async function ensureAiBoss() {
  const requestedAt = Number(room?.aiRequestedAt?.toMillis?.() || 0);
  const generationIsFresh = room?.aiStatus === 'generating' && Date.now() - requestedAt < 30000;
  if (!isHost() || room?.phase !== 'director' || Object.keys(room.aiPack || {}).length || directorPending || generationIsFresh) return;
  directorPending = true;
  try {
    await generateDnaBoss({ roomId });
  } catch (error) {
    console.warn('AI director fallback activated', error?.code || error);
    const pack = sanitizePack(FALLBACK_PACKS[stableHash(roomId) % FALLBACK_PACKS.length]);
    try {
      await updateDoc(doc(db, 'game_rooms', roomId), { aiPack: pack, aiStatus: 'ready', aiMode: 'local-fallback', updatedAt: Timestamp.now() });
    } catch (writeError) { console.error(writeError); showToast('보스 데이터를 준비하지 못했습니다.'); }
  } finally {
    directorPending = false;
  }
}

function renderDirector() {
  clearInterval(timerId); timerId = null;
  const hasPack = Object.keys(room.aiPack || {}).length > 0;
  if (!hasPack) {
    app.innerHTML = `<section class="panel dna-panel"><div class="dna-director"><div class="dna-director-orb">🧠</div><span class="dna-ai-badge">방 전체 기준 AI 1회 호출</span><h2>친구들의 플레이 버릇 분석 중</h2><p class="lead">닉네임과 게임 안의 선택 수치만 사용합니다. 대화·사진·개인정보는 보내지 않습니다.</p><div class="dna-director-dots"><i></i><i></i><i></i></div><small class="dna-mode-note">AI가 응답하지 않아도 준비된 오리지널 보스로 즉시 이어집니다.</small></div></section>`;
    if (isHost()) void ensureAiBoss();
    return;
  }
  const pack = sanitizePack(room.aiPack);
  app.innerHTML = `<section class="panel dna-panel"><span class="kicker">AI BOSS CREATED</span><div class="dna-boss-card"><span class="dna-boss-emoji">${pack.bossEmoji}</span><h1>${escapeText(pack.bossName)}</h1><p>${escapeText(pack.intro)}</p></div><div class="dna-history-note">🎯 각자 평소 주특기의 <b>반대 행동</b>을 골라야 공격이 성공합니다. 친구별 임무는 서로 다릅니다.</div>${isHost() ? '<div class="button-row"><button class="primary-button" id="start-battle">맞춤 보스전 시작</button></div>' : '<p class="lobby-note">방장이 보스전을 시작할 때까지 기다려주세요.</p>'}<small class="dna-mode-note">${room.aiMode === 'gemini' ? '✨ AI 맞춤 스토리 적용 · 방당 1회 생성' : '⚡ 비용 없는 오리지널 폴백 보스 적용'}</small></section>`;
  document.getElementById('start-battle')?.addEventListener('click', startBattle);
}

async function startBattle() {
  if (!isHost() || room?.phase !== 'director' || !Object.keys(room.aiPack || {}).length) return;
  const maxHp = Math.max(10, players.length * 5);
  try {
    await updateDoc(doc(db, 'game_rooms', roomId), {
      round: SCAN_ROUNDS + 1, roundState: 'open', phase: 'battle', bossMaxHp: maxHp, bossHp: maxHp, lastResults: [],
      roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now()
    });
  } catch (error) { console.error(error); showToast('보스전을 시작하지 못했습니다.'); }
}

function bossHpMarkup() {
  const max = Math.max(1, Number(room.bossMaxHp || 1));
  const hp = Math.max(0, Number(room.bossHp || 0));
  return `<div class="dna-hp"><div class="dna-hp-top"><span>BOSS HP</span><b>${hp} / ${max}</b></div><div class="dna-hp-track"><div class="dna-hp-fill" style="width:${Math.round(hp / max * 100)}%"></div></div></div>`;
}

function renderBattle() {
  const battleIndex = Math.max(0, Number(room.round || 4) - SCAN_ROUNDS - 1);
  const rule = BATTLE_RULES[battleIndex] || BATTLE_RULES[0];
  const pack = sanitizePack(room.aiPack);
  const me = playerByUid(currentUid);
  const myDominant = dominantTrait(me?.dna, currentUid);
  const myCounter = counterTrait(me?.dna, currentUid);
  const mine = currentAnswers('dna-battle').find(item => item.uid === currentUid)?.text || '';
  app.innerHTML = `<section class="panel dna-panel"><div class="round-head"><span class="round-label">BOSS ${battleIndex + 1} / 3 · ${escapeText(pack.roundTitles[battleIndex])}</span><span class="timer" id="timer">${remainingSeconds()}</span></div><div class="dna-boss-card"><span class="dna-boss-emoji">${pack.bossEmoji}</span><h2>${escapeText(pack.bossName)}</h2><p>“${escapeText(pack.taunts[battleIndex])}”</p></div>${bossHpMarkup()}<div class="dna-mission"><strong>내 임무 · ${DNA_TRAITS[myDominant].emoji} ${DNA_TRAITS[myDominant].label} 버릇 깨기</strong><small>이번에는 반대로 <b>${DNA_TRAITS[myCounter].emoji} ${DNA_TRAITS[myCounter].label}</b>을 고르면 기본 2 피해! · ${escapeText(rule.text)}</small></div><div class="dna-choice-grid">${DNA_KEYS.map(key => `<button class="dna-choice ${mine === key ? 'is-selected' : ''}" data-dna-choice="${key}" type="button"><span>${DNA_TRAITS[key].emoji}</span><strong>${DNA_TRAITS[key].label}</strong><small>${DNA_TRAITS[key].short}</small>${mine === key ? '<em>공격 선택 완료</em>' : ''}</button>`).join('')}</div><div class="status-line" id="status">${currentAnswers('dna-battle').length}/${players.length}명 선택</div>${isHost() ? `<div class="button-row"><button class="secondary-button" id="reveal" ${canReveal('dna-battle') ? '' : 'disabled'}>${allSubmitted('dna-battle') ? '전원 선택 · 보스 공격' : '시간 종료 후 보스 공격'}</button></div>` : ''}</section>`;
  document.querySelectorAll('[data-dna-choice]').forEach(button => button.addEventListener('click', () => void submitChoice('dna-battle', button.dataset.dnaChoice)));
  document.getElementById('reveal')?.addEventListener('click', revealBattle);
  runTimer('dna-battle');
}

async function revealBattle() {
  if (!isHost() || room?.phase !== 'battle' || !canReveal('dna-battle')) return;
  const selections = currentAnswers('dna-battle');
  const counts = new Map(DNA_KEYS.map(key => [key, selections.filter(item => item.text === key).length]));
  const battleIndex = Math.max(0, Number(room.round || 4) - SCAN_ROUNDS - 1);
  const rule = BATTLE_RULES[battleIndex] || BATTLE_RULES[0];
  const results = players.map(player => {
    const choice = selections.find(item => item.uid === player.uid)?.text || '';
    const required = counterTrait(player.dna, player.uid);
    const base = choice === required ? 2 : 0;
    const bonus = choice && ((rule.id === 'pair' && counts.get(choice) === 2) || (rule.id === 'solo' && counts.get(choice) === 1)) ? 1 : 0;
    const damage = base + bonus;
    const label = !choice ? '시간 초과' : base ? `${DNA_TRAITS[choice].emoji} 버릇 파괴 성공${bonus ? ` · ${rule.id === 'pair' ? '둘만 일치' : '단독'} 보너스` : ''}` : `${DNA_TRAITS[choice].emoji} 익숙한 버릇에 붙잡힘${bonus ? ' · 팀 보너스로 만회' : ''}`;
    return { uid: player.uid, nickname: player.nickname || '플레이어', choice, required, label, delta: damage };
  });
  const totalDamage = results.reduce((sum, result) => sum + Number(result.delta || 0), 0);
  const nextHp = Math.max(0, Number(room.bossHp || 0) - totalDamage);
  const now = Timestamp.now();
  const batch = writeBatch(db);
  players.forEach(player => {
    const result = results.find(item => item.uid === player.uid);
    const damage = Number(result?.delta || 0);
    const additions = result?.choice ? { [result.choice]: 1, samples: 1 } : {};
    if (result?.choice && counts.get(result.choice) === 1) additions.unique = Number(additions.unique || 0) + 1;
    batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), {
      score: Number(player.score || 0) + damage,
      damage: Number(player.damage || 0) + damage,
      dna: addDna(player.dna, additions),
      updatedAt: now
    });
  });
  batch.update(doc(db, 'game_rooms', roomId), { bossHp: nextHp, roundState: 'reveal', phase: 'battle-reveal', lastResults: results, updatedAt: now });
  try { await batch.commit(); } catch (error) { console.error(error); showToast('공격 결과를 계산하지 못했습니다.'); }
}

function renderBattleReveal() {
  clearInterval(timerId); timerId = null;
  const rows = (room.lastResults || []).map(result => `<li class="result-item"><span><strong>${escapeText(result.nickname)}</strong><small>${escapeText(result.label)}</small></span><span class="result-tag ${Number(result.delta || 0) ? 'good' : 'bad'} dna-result-damage">${Number(result.delta || 0) ? `-${Number(result.delta)} HP` : 'MISS'}</span></li>`).join('');
  const finished = Number(room.bossHp || 0) <= 0 || Number(room.round || 0) >= MAX_ROUNDS;
  app.innerHTML = `<section class="panel dna-panel"><span class="kicker">BOSS DAMAGE</span><h2>${Number(room.bossHp || 0) <= 0 ? '💥 보스의 습관 고리가 끊어졌다!' : '⚔️ 공격 결과'}</h2>${bossHpMarkup()}<ul class="result-list">${rows}</ul><div class="divider"></div><ul class="player-list">${playerListMarkup(true)}</ul>${isHost() ? `<div class="button-row"><button class="primary-button" id="next">${finished ? '최종 DNA 기록 보기' : '다음 보스 패턴'}</button></div>` : '<p class="lobby-note">방장이 다음 패턴을 열 때까지 기다려주세요.</p>'}</section>`;
  document.getElementById('next')?.addEventListener('click', nextAfterBattle);
}

async function nextAfterBattle() {
  if (!isHost() || room?.phase !== 'battle-reveal') return;
  try {
    if (Number(room.bossHp || 0) <= 0 || Number(room.round || 0) >= MAX_ROUNDS) {
      await updateDoc(doc(db, 'game_rooms', roomId), {
        status: 'finished', roundState: 'finished', phase: 'finished', victory: Number(room.bossHp || 0) <= 0,
        roundEndsAt: deleteField(), updatedAt: Timestamp.now()
      });
    } else {
      await updateDoc(doc(db, 'game_rooms', roomId), {
        round: Number(room.round) + 1, roundState: 'open', phase: 'battle', lastResults: [],
        roundEndsAt: Timestamp.fromMillis(Date.now() + ROUND_SECONDS * 1000), updatedAt: Timestamp.now()
      });
    }
  } catch (error) { console.error(error); showToast('다음 보스 패턴을 열지 못했습니다.'); }
}

function renderFinished() {
  clearInterval(timerId); timerId = null;
  const pack = sanitizePack(room.aiPack);
  const ranking = rankedPlayers();
  const victory = room.victory === true;
  const me = playerByUid(currentUid);
  app.innerHTML = `<section class="panel dna-panel"><div class="dna-finale"><div class="dna-finale-mark">${victory ? '🏆' : '🧬'}</div><span class="kicker">DNA FINALE</span><h1>${victory ? `${escapeText(pack.bossName)} 격파!` : '보스가 버릇을 지켜냈다'}</h1><div class="dna-finale-quote">${escapeText(victory ? pack.victory : pack.defeat)}</div></div><ol class="ranking">${ranking.map((player, index) => `<li class="rank-item"><span class="rank-number">${index === 0 ? '👑' : index + 1}</span><span class="rank-name">${escapeText(player.nickname)}<small style="display:block;color:var(--muted);font-size:8px;margin-top:3px">${DNA_TRAITS[dominantTrait(player.dna, player.uid)].emoji} ${DNA_TRAITS[dominantTrait(player.dna, player.uid)].label}</small></span><span class="rank-score">⚔️ ${Number(player.damage || 0)}</span></li>`).join('')}</ol>${me ? traitMarkup(me) : ''}${isHost() ? '<div class="button-row"><button class="primary-button" id="restart">현재 게임 한 판 더</button></div>' : '<p class="lobby-note">방장이 다음 게임을 고를 때까지 기다려주세요.</p>'}<div class="button-row"><a class="secondary-button" href="/game/" style="display:grid;place-items:center;text-decoration:none">소소킹 플레이 홈</a></div></section>`;
  document.getElementById('restart')?.addEventListener('click', restartGame);
}

async function restartGame() {
  if (!isHost()) return;
  try {
    const answerSnap = await getDocs(collection(db, 'game_rooms', roomId, 'answers'));
    const batch = writeBatch(db);
    answerSnap.docs.forEach(item => batch.delete(item.ref));
    const now = Timestamp.now();
    players.forEach(player => batch.update(doc(db, 'game_rooms', roomId, 'players', player.uid), { score: 0, damage: 0, updatedAt: now }));
    batch.update(doc(db, 'game_rooms', roomId), {
      status: 'lobby', round: 0, roundState: 'waiting', phase: 'waiting', bossHp: 0, bossMaxHp: 0,
      aiStatus: 'idle', aiMode: '', aiPack: {}, lastResults: [], victory: deleteField(), roundEndsAt: deleteField(), updatedAt: now
    });
    await batch.commit();
  } catch (error) { console.error(error); showToast('DNA 게임을 다시 준비하지 못했습니다.'); }
}

function renderError(message) {
  clearInterval(timerId);
  app.innerHTML = `<section class="panel"><div class="error-box">${escapeText(message)}</div><div class="button-row"><a class="secondary-button" href="/game/dna/" style="display:grid;place-items:center;text-decoration:none">처음 화면으로</a></div></section>`;
}

async function boot() {
  try {
    await initAuth(); currentUid = auth.currentUser?.uid || ''; if (!currentUid) throw new Error('auth');
    const code = normalizeRoomCode(new URL(location.href).searchParams.get('room'));
    if (!code) return renderLanding();
    const roomSnap = await getDoc(doc(db, 'game_rooms', code));
    if (!roomSnap.exists() || roomSnap.data().type !== 'dna-boss') { renderLanding(code); return showToast('초대받은 DNA방을 찾지 못했습니다.'); }
    roomId = code; if (await ensureMembership(code)) subscribeRoom(code);
  } catch (error) { console.error(error); renderError('DNA 게임을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.'); }
}

shareButton.addEventListener('click', shareRoom);
window.addEventListener('pagehide', stopSubscriptions);
void boot();
