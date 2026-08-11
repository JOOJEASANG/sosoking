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

const GAME_ORDER = ['vault', 'greed', 'caught', 'chosung'];
const GAMES = {
  vault: { id: 'vault', type: 'vault-run', label: '금고런', emoji: '💰', path: '/game/vault/' },
  greed: { id: 'greed', type: 'greed-stairs', label: '욕심계단', emoji: '🧨', path: '/game/greed/' },
  caught: { id: 'caught', type: 'unique-low', label: '딱걸렸어', emoji: '🎯', path: '/game/caught/' },
  chosung: { id: 'chosung', type: 'chosung-bomb', label: '초성 폭탄', emoji: '💣', path: '/game/chosung/' }
};
const GAME_BY_TYPE = Object.fromEntries(Object.values(GAMES).map(game => [game.type, game]));
const HOME = /^\/game\/(?:index\.html)?$/.test(location.pathname);
const currentGame = Object.values(GAMES).find(game => location.pathname.startsWith(game.path)) || null;
const app = document.getElementById('game-app');

let currentUid = '';
let roomId = '';
let room = null;
let players = [];
let answers = [];
let seriesId = normalizeCode(new URL(location.href).searchParams.get('series'));
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let unsubscribeAnswers = null;
let lastStateKey = '';
let applyingBonus = false;
let applyingRule = false;
let toastTimer = null;
let audioContext = null;
let observer = null;

const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VOWELS = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const SIMPLE_VOWELS = ['ㅏ','ㅓ','ㅗ','ㅜ','ㅡ','ㅣ'];
const MISSION_MAP = {
  vault: [
    { id: 'safe3', title: '💼 조용한 털이범', text: '충돌 없이 금고 성공 3번', done: s => s.successes >= 3 },
    { id: 'special', title: '✨ 특수금고 사냥꾼', text: '특수 금고에서 한 번 이상 이득 보기', done: s => s.specials >= 1 },
    { id: 'combo3', title: '🔥 불타는 손', text: '3콤보 이상 만들기', done: s => s.maxCombo >= 3 }
  ],
  greed: [
    { id: 'cash3', title: '💰 계산된 욕심', text: '3층 이상에서 안전하게 챙기기', done: s => s.cashAt3 >= 1 },
    { id: 'top', title: '🧗 끝을 보는 사람', text: '5층 정상 한 번 정복하기', done: s => s.topWins >= 1 },
    { id: 'survive3', title: '🧨 간 큰 사람', text: '한 칸 더 생존을 3번 성공하기', done: s => s.climbSurvives >= 3 }
  ],
  caught: [
    { id: 'wins2', title: '🎯 숫자 독심술', text: '라운드 승리 2번', done: s => s.wins >= 2 },
    { id: 'bonus', title: '✨ 보너스 포착', text: '보너스 숫자 단독 성공 1번', done: s => s.bonusHits >= 1 },
    { id: 'small', title: '🐜 작은 숫자 장인', text: '1~3 숫자로 라운드 승리하기', done: s => s.smallWins >= 1 }
  ],
  chosung: [
    { id: 'unique3', title: '💣 폭탄 해체반', text: '단독 정답 3번', done: s => s.uniques >= 3 },
    { id: 'double', title: '💥 더블킬', text: '2배 라운드에서 단독 정답 성공', done: s => s.doubleUnique >= 1 },
    { id: 'long', title: '🧠 장문 천재', text: '4글자 초성에서 단독 정답 성공', done: s => s.longUnique >= 1 }
  ]
};

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicPick(list, seed) {
  return list[hashText(seed) % list.length];
}

function randomSeriesCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

function soundEnabled() {
  return localStorage.getItem('sosoking-game-sound') !== 'off';
}

function unlockAudio() {
  if (!soundEnabled()) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch {}
}

function beep(frequency, duration = .08, delay = 0, gain = .035, type = 'sine') {
  if (!soundEnabled()) return;
  unlockAudio();
  if (!audioContext || audioContext.state !== 'running') return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + .012);
  volume.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}

function playSound(name) {
  if (!soundEnabled()) return;
  if (name === 'click') beep(410, .045, 0, .018, 'square');
  if (name === 'start') { beep(420, .07); beep(620, .08, .08); }
  if (name === 'good') { beep(520, .08); beep(720, .09, .08); beep(940, .12, .17); }
  if (name === 'bad') { beep(240, .11, 0, .04, 'sawtooth'); beep(150, .15, .1, .03, 'sawtooth'); }
  if (name === 'mission') { beep(660, .08); beep(880, .08, .08); beep(1100, .14, .16); }
  if (name === 'finish') { beep(520, .1); beep(660, .1, .1); beep(820, .12, .2); beep(1040, .18, .32); }
}

function vibrate(pattern) {
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch {}
}

function funToast(message) {
  let node = document.querySelector('.fun-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'fun-toast';
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2300);
}

function flash(kind = 'good') {
  const node = document.createElement('div');
  node.className = `fun-flash ${kind}`;
  document.body.append(node);
  setTimeout(() => node.remove(), 650);
}

function particles(emoji = '✨', count = 18) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let index = 0; index < count; index += 1) {
    const node = document.createElement('span');
    node.className = 'fun-particle';
    node.textContent = emoji;
    node.style.left = `${45 + Math.random() * 10}%`;
    node.style.top = `${36 + Math.random() * 14}%`;
    node.style.setProperty('--dx', `${(Math.random() - .5) * 320}px`);
    node.style.setProperty('--dy', `${-60 - Math.random() * 250}px`);
    node.style.setProperty('--rot', `${(Math.random() - .5) * 480}deg`);
    document.body.append(node);
    setTimeout(() => node.remove(), 1200);
  }
}

function mountSoundToggle() {
  if (document.querySelector('.fun-sound-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fun-sound-toggle';
  button.setAttribute('aria-label', '게임 효과음 켜기 또는 끄기');
  const sync = () => {
    button.textContent = soundEnabled() ? '🔊' : '🔇';
    button.title = soundEnabled() ? '효과음 끄기' : '효과음 켜기';
  };
  button.addEventListener('click', () => {
    localStorage.setItem('sosoking-game-sound', soundEnabled() ? 'off' : 'on');
    sync();
    if (soundEnabled()) { unlockAudio(); playSound('good'); }
  });
  sync();
  document.body.append(button);
}

function statsKey() {
  return currentGame && roomId && currentUid ? `sosoking-fun-stats:${currentGame.id}:${roomId}:${currentUid}` : '';
}

function loadStats() {
  const key = statsKey();
  if (!key) return { processed: [] };
  try { return { processed: [], ...JSON.parse(sessionStorage.getItem(key) || '{}') }; }
  catch { return { processed: [] }; }
}

function saveStats(stats) {
  const key = statsKey();
  if (!key) return;
  sessionStorage.setItem(key, JSON.stringify({ ...stats, processed: (stats.processed || []).slice(-30) }));
}

function missionForCurrentPlayer() {
  if (!currentGame || !roomId || !currentUid) return null;
  const list = MISSION_MAP[currentGame.id] || [];
  return list.length ? list[hashText(`${roomId}:${currentUid}:${currentGame.id}:mission`) % list.length] : null;
}

function updateMissionCelebration(statsBefore, statsAfter) {
  const mission = missionForCurrentPlayer();
  if (!mission) return;
  const wasDone = mission.done(statsBefore || {});
  const isDone = mission.done(statsAfter || {});
  if (!wasDone && isDone) {
    playSound('mission');
    vibrate([40, 40, 80]);
    particles('⭐', 16);
    funToast(`비밀미션 성공! ${mission.title}`);
  }
}

function missionMarkup() {
  const mission = missionForCurrentPlayer();
  if (!mission) return '';
  const stats = loadStats();
  const done = mission.done(stats);
  return `<div class="fun-card mission ${done ? 'done' : ''}" data-fun-slot="mission"><strong>${done ? '✅' : '🤫'} 비밀미션 · ${escapeText(mission.title)}</strong><small>${escapeText(mission.text)}${done ? ' · 성공!' : ' · 다른 사람 화면에는 보이지 않아요.'}</small></div>`;
}

function getInitials(value) {
  return Array.from(String(value || '')).map(char => {
    if (INITIALS.includes(char)) return char;
    const offset = char.charCodeAt(0) - 0xac00;
    return offset >= 0 && offset <= 11171 ? INITIALS[Math.floor(offset / 588)] : '';
  }).join('');
}

function getVowels(value) {
  return Array.from(String(value || '')).map(char => {
    const offset = char.charCodeAt(0) - 0xac00;
    if (offset < 0 || offset > 11171) return '';
    return VOWELS[Math.floor((offset % 588) / 28)] || '';
  }).filter(Boolean);
}

function normalizedAnswer(value) {
  return String(value || '').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

function ownPlayer() {
  return players.find(player => player.uid === currentUid);
}

function isHost() {
  return Boolean(room && currentUid && room.hostUid === currentUid);
}

function currentGameAnswers() {
  if (!room) return [];
  if (currentGame?.id === 'vault') return answers.filter(item => item.kind === 'vault' && Number(item.round) === Number(room.round));
  if (currentGame?.id === 'greed') return answers.filter(item => item.kind === 'greed' && Number(item.round) === Number(room.round) && Number(item.stage) === Number(room.stage));
  if (currentGame?.id === 'caught') return answers.filter(item => item.kind === 'number' && Number(item.round) === Number(room.round));
  if (currentGame?.id === 'chosung') return answers.filter(item => !item.kind && Number(item.round) === Number(room.round));
  return [];
}

function ownCurrentAnswer() {
  return currentGameAnswers().find(item => item.uid === currentUid);
}

function currentRevealKey() {
  if (!room || !currentGame) return '';
  const stage = currentGame.id === 'greed' ? `:${Number(room.stage || 0)}` : '';
  return `${currentGame.id}:${Number(room.round || 0)}${stage}`;
}

function powerStorageKey(power) {
  return `sosoking-fun-power:${currentGame?.id || 'game'}:${roomId}:${currentUid}:${power}`;
}

function powerRoundKey(power) {
  return `${powerStorageKey(power)}:round`;
}

function powerUsed(power) {
  return localStorage.getItem(powerStorageKey(power)) === 'used';
}

function powerAttachedThisRound(power) {
  return sessionStorage.getItem(powerRoundKey(power)) === currentRevealKey();
}

function armPower(power) {
  if (powerUsed(power) && !powerAttachedThisRound(power)) return;
  localStorage.setItem(powerStorageKey(power), 'used');
  sessionStorage.setItem(powerRoundKey(power), currentRevealKey());
  void attachArmedPower();
  enhanceUi();
}

async function attachArmedPower() {
  if (!room || room.roundState !== 'open') return;
  const own = ownCurrentAnswer();
  if (!own?.id) return;
  let desired = '';
  if (currentGame.id === 'vault' && powerAttachedThisRound('insurance')) desired = 'insurance';
  if (currentGame.id === 'caught' && powerAttachedThisRound('ghost')) desired = 'ghost';
  if (currentGame.id === 'chosung' && powerAttachedThisRound('shield')) desired = 'shield';
  if (!desired || own.power === desired) return;
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', own.id), { power: desired, updatedAt: Timestamp.now() }, { merge: true });
  } catch (error) {
    console.warn('fun power attach skipped', error);
  }
}

function seriesStorageKey(id = seriesId) {
  return id ? `sosoking-game-series:${id}` : '';
}

function readSeries(id = seriesId) {
  if (!id) return null;
  try { return { id, games: {}, board: {}, ...JSON.parse(localStorage.getItem(seriesStorageKey(id)) || '{}') }; }
  catch { return { id, games: {}, board: {} }; }
}

function writeSeries(data) {
  if (!data?.id) return;
  localStorage.setItem(seriesStorageKey(data.id), JSON.stringify(data));
  localStorage.setItem('sosoking-active-series', data.id);
}

function recordSeriesResult(id = seriesId) {
  if (!id || !currentGame || room?.status !== 'finished' || !players.length) return;
  const data = readSeries(id);
  if (data.games?.[currentGame.id]) return;
  const ranking = [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.joinOrder || 0) - Number(b.joinOrder || 0));
  const rankPoints = [5, 3, 2, 1, 1, 1, 1, 1];
  data.games[currentGame.id] = {
    label: currentGame.label,
    completedAt: Date.now(),
    ranking: ranking.map((player, index) => ({ uid: player.uid, nickname: player.nickname || '플레이어', rank: index + 1, points: rankPoints[index] || 0 }))
  };
  data.board ||= {};
  ranking.forEach((player, index) => {
    const previous = data.board[player.uid] || { uid: player.uid, nickname: player.nickname || '플레이어', points: 0, wins: 0 };
    data.board[player.uid] = {
      ...previous,
      nickname: player.nickname || previous.nickname,
      points: Number(previous.points || 0) + Number(rankPoints[index] || 0),
      wins: Number(previous.wins || 0) + (index === 0 ? 1 : 0)
    };
  });
  writeSeries(data);
}

function sortedSeriesBoard(id = seriesId) {
  const data = readSeries(id);
  if (!data) return [];
  return Object.values(data.board || {}).sort((a, b) => Number(b.points || 0) - Number(a.points || 0) || Number(b.wins || 0) - Number(a.wins || 0) || String(a.nickname).localeCompare(String(b.nickname), 'ko'));
}

function seriesBoardMarkup(id = seriesId) {
  if (!id) return '';
  const data = readSeries(id);
  const board = sortedSeriesBoard(id);
  if (!data || !board.length) return '';
  const completed = Object.keys(data.games || {}).length;
  const champion = completed >= GAME_ORDER.length ? board[0] : null;
  return `<div class="fun-series-board" data-fun-slot="series-board"><h3>${champion ? `👑 오늘의 소소킹 · ${escapeText(champion.nickname)}` : `🎪 통합전 ${completed}/${GAME_ORDER.length}게임`}</h3>${board.map((player, index) => `<div class="fun-series-row"><span>${index === 0 ? '👑' : index + 1}</span><b>${escapeText(player.nickname)}</b><span>${Number(player.points || 0)}P</span></div>`).join('')}</div>`;
}

function nextGameAfterCurrent() {
  if (!currentGame) return null;
  const index = GAME_ORDER.indexOf(currentGame.id);
  return index >= 0 && index < GAME_ORDER.length - 1 ? GAMES[GAME_ORDER[index + 1]] : null;
}

function seriesInviteUrl() {
  if (!currentGame || !roomId || !seriesId) return '';
  const url = new URL(currentGame.path, location.origin);
  url.searchParams.set('room', roomId);
  url.searchParams.set('series', seriesId);
  return url.href;
}

async function shareSeriesInvite() {
  const url = seriesInviteUrl();
  if (!url) return;
  const data = { title: `소소킹 ${currentGame.label} 통합전 초대`, text: `🎪 오늘의 소소킹 통합전 · ${currentGame.label} 방 ${roomId}`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); funToast('통합전 초대 링크를 복사했습니다.'); }
  catch { window.prompt('이 링크를 복사해서 보내주세요.', url); }
}

function installSeriesShareCapture() {
  document.addEventListener('click', event => {
    if (!seriesId || !roomId) return;
    const target = event.target.closest?.('#share-room,#invite,#copy-invite,#invite-button');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void shareSeriesInvite();
  }, true);
}

function mountHomeSeriesCard() {
  if (!HOME || document.querySelector('[data-fun-home-series]')) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const card = document.createElement('section');
  card.className = 'fun-series-card';
  card.dataset.funHomeSeries = '1';
  card.innerHTML = `<span class="eyebrow">4 GAME CHALLENGE</span><h2>👑 오늘의 소소킹</h2><p>금고런 → 욕심계단 → 딱걸렸어 → 초성 폭탄을 차례로 플레이하고 순위 포인트를 합산합니다. 매 게임 방은 새로 만들지만 통합전 점수는 이어집니다.</p><div class="fun-series-games"><span>💰 금고런</span><span>🧨 욕심계단</span><span>🎯 딱걸렸어</span><span>💣 초성 폭탄</span></div><button class="fun-series-start" type="button">4게임 통합전 시작</button>`;
  card.querySelector('button').addEventListener('click', () => {
    const id = randomSeriesCode();
    writeSeries({ id, games: {}, board: {}, createdAt: Date.now() });
    location.href = `${GAMES.vault.path}?series=${encodeURIComponent(id)}`;
  });
  hero.insertAdjacentElement('afterend', card);
}

function funEventMarkup() {
  if (!room || room.roundState !== 'open') return '';
  if (currentGame.id === 'greed' && room.funEvent) {
    const meta = {
      gold: ['gold', '🌟 황금계단', '이번 층 보상이 1.5배로 커졌습니다.'],
      crack: ['danger', '🕳️ 균열계단', '이번 층 붕괴 위험이 15%p 올라갑니다.'],
      safe: ['safe', '🛡️ 안전계단', '이번 층은 붕괴 위험 0%. 올라갈 절호의 기회!'],
      thief: ['', '🥷 도둑계단', '이번 층에서 한 칸 더에 성공하면 +100C 보너스.']
    }[room.funEvent];
    if (meta) return `<div class="fun-event ${meta[0]}" data-fun-slot="event"><b>${meta[1]}</b>${meta[2]}</div>`;
  }
  if (currentGame.id === 'caught' && room.funRule) {
    const meta = {
      odd: ['', '🟣 홀수 데이', '단독 홀수 선택은 +90점 추가 보너스.'],
      even: ['', '🔵 짝수 데이', '단독 짝수 선택은 +90점 추가 보너스.'],
      decoy: ['gold', '🎭 가짜 보너스', '보너스 후보 둘 중 진짜는 하나뿐. 결과 때 공개됩니다.'],
      jackpot: ['gold', '💎 잭팟 라운드', '이번 라운드 승자는 +250점 추가 보너스.']
    }[room.funRule];
    if (meta) return `<div class="fun-event ${meta[0]}" data-fun-slot="event"><b>${meta[1]}</b>${meta[2]}</div>`;
  }
  if (currentGame.id === 'chosung' && room.funRule) {
    const vowel = room.funVowel ? ` · 금지 모음 ${escapeText(room.funVowel)}` : '';
    const meta = {
      sniper: ['', '🎯 스나이퍼', '가장 빨리 낸 단독 정답에 +2점.'],
      novowel: ['danger', '🚫 금지모음', `정답에 지정 모음이 들어가면 점수 무효${vowel}.`],
      ultra: ['danger', '⚡ 초고속 폭탄', '제한시간이 8초로 줄어듭니다.'],
      jackpot: ['gold', '💎 잭팟 폭탄', '단독 정답마다 +1점 추가 보너스.']
    }[room.funRule];
    if (meta) return `<div class="fun-event ${meta[0]}" data-fun-slot="event"><b>${meta[1]}</b>${meta[2]}</div>`;
  }
  return '';
}

function vaultPowerMarkup() {
  const insuranceUsed = powerUsed('insurance') && !powerAttachedThisRound('insurance');
  const insuranceActive = powerAttachedThisRound('insurance');
  const radarUsed = powerUsed('radar');
  return `<div class="fun-power-row" data-fun-slot="powers"><button class="fun-power ${insuranceActive ? 'is-armed' : ''}" id="fun-insurance" type="button" ${insuranceUsed ? 'disabled' : ''}>🎟 보험권<small>${insuranceUsed ? '사용 완료' : insuranceActive ? '이번 선택에 적용됨' : '충돌해도 금고 가치 절반 보상 · 1회'}</small></button><button class="fun-power" id="fun-radar" type="button" ${radarUsed ? 'disabled' : ''}>📡 레이더<small>${radarUsed ? '사용 완료' : '현재 금고별 선택 인원 힌트 · 1회'}</small></button></div>`;
}

function caughtPowerMarkup() {
  const used = powerUsed('ghost') && !powerAttachedThisRound('ghost');
  const active = powerAttachedThisRound('ghost');
  return `<div class="fun-power-row" data-fun-slot="powers"><button class="fun-power ${active ? 'is-armed' : ''}" id="fun-ghost" type="button" ${used ? 'disabled' : ''}>👻 유령카드<small>${used ? '사용 완료' : active ? '이번 숫자에 적용됨' : '중복이어도 +150점 구출 · 게임당 1회'}</small></button></div>`;
}

function chosungPowerMarkup() {
  const used = powerUsed('shield') && !powerAttachedThisRound('shield');
  const active = powerAttachedThisRound('shield');
  return `<div class="fun-power-row" data-fun-slot="powers"><button class="fun-power ${active ? 'is-armed' : ''}" id="fun-shield" type="button" ${used ? 'disabled' : ''}>🛡️ 중복방패<small>${used ? '사용 완료' : active ? '이번 답에 적용됨' : '중복 답이어도 기본점수 절반 획득 · 1회'}</small></button></div>`;
}

function currentBet() {
  return answers.find(item => item.kind === 'fun-bet' && item.uid === currentUid && Number(item.round) === Number(room?.round) && Number(item.stage) === Number(room?.stage));
}

function greedBetMarkup() {
  const me = ownPlayer();
  if (!me || me.runState === 'active') return '';
  const bet = currentBet();
  const candidates = players.filter(player => player.runState === 'active');
  if (!candidates.length) return '';
  return `<div class="fun-card" data-fun-slot="bet"><strong>🎲 구경만 하지 말고 생존자 베팅</strong><small>이번 층에서 ‘한 칸 더’를 골라 살아남을 사람을 맞히면 +80C.</small><div class="fun-bet-grid">${candidates.map(player => `<button class="fun-bet ${bet?.text === player.uid ? 'is-selected' : ''}" data-fun-bet="${escapeText(player.uid)}" type="button">${escapeText(player.nickname || '플레이어')}</button>`).join('')}</div></div>`;
}

function funResultsMarkup() {
  const key = currentRevealKey();
  const list = Array.isArray(room?.funResults) && room?.funBonusAppliedKey === key ? room.funResults : [];
  if (!list.length) return '';
  return `<div data-fun-slot="bonus"><div class="fun-event safe"><b>🎁 추가 재미 보너스</b>특수능력·라운드 이벤트가 점수에 반영됐습니다.</div><ul class="fun-bonus-list">${list.map(item => `<li><span>${escapeText(item.nickname || '플레이어')} · ${escapeText(item.label || '')}</span><b>${Number(item.delta) > 0 ? '+' : ''}${Number(item.delta || 0)}${currentGame.id === 'vault' || currentGame.id === 'greed' ? 'C' : '점'}</b></li>`).join('')}</ul></div>`;
}

function caughtAnalysisMarkup() {
  if (currentGame?.id !== 'caught' || room?.roundState !== 'reveal') return '';
  const results = Array.isArray(room.lastResults) ? room.lastResults : [];
  const counts = new Map();
  results.filter(item => Number(item.number) > 0).forEach(item => counts.set(Number(item.number), (counts.get(Number(item.number)) || 0) + 1));
  const crowd = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const winner = results.find(item => item.uid === room.winnerUid);
  const lines = [];
  if (crowd?.[1] >= 2) lines.push(`<b>${crowd[0]}번에 ${crowd[1]}명 몰림</b> · 서로 생각이 너무 비슷했습니다.`);
  if (winner) lines.push(`<b>${escapeText(winner.nickname)}의 ${Number(winner.number)}번</b> · 겹치지 않은 가장 작은 숫자를 정확히 찔렀습니다.`);
  return lines.length ? `<div class="fun-analysis" data-fun-slot="analysis">${lines.join('<br>')}</div>` : '';
}

function awardsForCurrentPlayer() {
  const stats = loadStats();
  const awards = [];
  const ranking = [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  if (ranking[0]?.uid === currentUid) awards.push(`👑 ${currentGame.label} 왕`);
  if (currentGame.id === 'vault') {
    if (stats.maxCombo >= 3) awards.push('🔥 콤보 장인');
    if (stats.collisions >= 3) awards.push('💥 폭발 수집가');
    if (stats.specials >= 2) awards.push('✨ 특수금고 사냥꾼');
  }
  if (currentGame.id === 'greed') {
    if (stats.topWins >= 1) awards.push('🧗 정상 정복자');
    if (stats.busts >= 2) awards.push('🪂 낙하산 전문가');
    if (stats.cashAt3 >= 2) awards.push('💰 계산왕');
  }
  if (currentGame.id === 'caught') {
    if (stats.wins >= 3) awards.push('🎯 독심술사');
    if (stats.bonusHits >= 2) awards.push('✨ 보너스 수집가');
    if (stats.smallWins >= 1) awards.push('🐜 소수의 지배자');
  }
  if (currentGame.id === 'chosung') {
    if (stats.uniques >= 4) awards.push('🧠 단어 제조기');
    if (stats.duplicates >= 2) awards.push('💣 텔레파시 과다');
    if (stats.longUnique >= 1) awards.push('📚 4글자 장인');
  }
  const mission = missionForCurrentPlayer();
  if (mission?.done(stats)) awards.push(`⭐ 미션 완료 · ${mission.title.replace(/^\S+\s*/, '')}`);
  return [...new Set(awards)].slice(0, 4);
}

function awardsMarkup() {
  const awards = awardsForCurrentPlayer();
  return awards.length ? `<div class="fun-awards" data-fun-slot="awards"><h3>🏅 오늘 내 칭호</h3>${awards.map(award => `<span class="fun-award-chip">${escapeText(award)}</span>`).join('')}</div>` : '';
}

function mountSlot(panel, slot, html, position = 'afterbegin') {
  if (!html || panel.querySelector(`[data-fun-slot="${slot}"]`)) return;
  panel.insertAdjacentHTML(position, html);
}

function enhanceDecoyUi() {
  if (currentGame?.id !== 'caught' || room?.roundState !== 'open' || room.funRule !== 'decoy' || !room.funDecoyNumber) return;
  const flags = app?.querySelector('.round-flags');
  if (!flags || flags.dataset.funDecoy === '1') return;
  flags.dataset.funDecoy = '1';
  const values = [Number(room.bonusNumber), Number(room.funDecoyNumber)].sort((a, b) => a - b);
  flags.innerHTML = `<div class="flag-card bad">🚫 금지 숫자<strong>${Number(room.bannedNumber)}</strong></div><div class="flag-card good">🎭 보너스 후보<strong>${values.join(' / ')}</strong></div>`;
}

function enhanceUi() {
  if (!currentGame || !app || !room) return;
  const panel = app.querySelector('.panel');
  if (!panel) return;
  if (room.status === 'lobby' || (room.status === 'playing' && room.roundState === 'open')) mountSlot(panel, 'mission', missionMarkup(), 'afterbegin');
  if (room.status === 'playing' && room.roundState === 'open') {
    mountSlot(panel, 'event', funEventMarkup(), 'afterbegin');
    if (currentGame.id === 'vault') mountSlot(panel, 'powers', vaultPowerMarkup(), 'beforeend');
    if (currentGame.id === 'caught') mountSlot(panel, 'powers', caughtPowerMarkup(), 'beforeend');
    if (currentGame.id === 'chosung') mountSlot(panel, 'powers', chosungPowerMarkup(), 'beforeend');
    if (currentGame.id === 'greed') mountSlot(panel, 'bet', greedBetMarkup(), 'beforeend');
    enhanceDecoyUi();
  }
  if (room.status === 'playing' && room.roundState === 'reveal') {
    mountSlot(panel, 'bonus', funResultsMarkup(), 'beforeend');
    mountSlot(panel, 'analysis', caughtAnalysisMarkup(), 'afterbegin');
  }
  if (room.status === 'finished') {
    recordSeriesResult();
    mountSlot(panel, 'awards', awardsMarkup(), 'beforeend');
    mountSlot(panel, 'series-board', seriesBoardMarkup(), 'beforeend');
    mountSeriesNext(panel);
  }
  wireFunButtons();
}

function wireFunButtons() {
  document.getElementById('fun-insurance')?.addEventListener('click', () => {
    if (powerUsed('insurance') && !powerAttachedThisRound('insurance')) return;
    armPower('insurance');
    funToast('🎟 보험권 장착! 이번에 고르는 금고에 적용됩니다.');
    playSound('click');
  }, { once: true });
  document.getElementById('fun-radar')?.addEventListener('click', () => {
    if (powerUsed('radar')) return;
    localStorage.setItem(powerStorageKey('radar'), 'used');
    const counts = new Map();
    currentGameAnswers().forEach(answer => counts.set(answer.text, (counts.get(answer.text) || 0) + 1));
    const vaults = Array.isArray(room?.vaults) ? room.vaults : [];
    const grid = `<div class="fun-radar">${vaults.map(vault => `<span>${escapeText(vault.emoji || '💼')}<b>${counts.get(vault.id) || 0}</b>명</span>`).join('')}</div>`;
    funToast('📡 레이더 스캔 완료');
    document.querySelector('[data-fun-slot="powers"]')?.insertAdjacentHTML('afterend', `<div class="fun-card" data-fun-slot="radar"><strong>📡 현재 선택 신호</strong><small>지금 이 순간 기준이라 마감 전에는 바뀔 수 있습니다.</small>${grid}</div>`);
    vibrate(35); playSound('good');
    enhanceUi();
  }, { once: true });
  document.getElementById('fun-ghost')?.addEventListener('click', () => {
    if (powerUsed('ghost') && !powerAttachedThisRound('ghost')) return;
    armPower('ghost');
    funToast('👻 유령카드 장착! 이번 숫자 선택에 적용됩니다.');
    playSound('click');
  }, { once: true });
  document.getElementById('fun-shield')?.addEventListener('click', () => {
    if (powerUsed('shield') && !powerAttachedThisRound('shield')) return;
    armPower('shield');
    funToast('🛡️ 중복방패 장착! 이번 답에 적용됩니다.');
    playSound('click');
  }, { once: true });
  document.querySelectorAll('[data-fun-bet]').forEach(button => button.addEventListener('click', () => void submitBet(button.dataset.funBet)));
}

async function submitBet(targetUid) {
  if (!room || currentGame?.id !== 'greed' || room.roundState !== 'open' || !players.some(player => player.uid === targetUid && player.runState === 'active')) return;
  try {
    await setDoc(doc(db, 'game_rooms', roomId, 'answers', `funbet-${room.round}-${room.stage}-${currentUid}`), {
      uid: currentUid,
      nickname: ownPlayer()?.nickname || '플레이어',
      kind: 'fun-bet',
      round: Number(room.round),
      stage: Number(room.stage),
      text: targetUid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    funToast('🎲 생존자 베팅 완료');
    playSound('click');
  } catch (error) { console.warn('fun bet failed', error); }
}

function mountSeriesNext(panel) {
  if (panel.querySelector('[data-fun-slot="series-next"]')) return;
  const container = document.createElement('div');
  container.dataset.funSlot = 'series-next';
  if (!seriesId) {
    if (!isHost()) return;
    container.innerHTML = `<div class="fun-series-card"><span class="eyebrow">KEEP PLAYING</span><h2>🎪 이 결과부터 통합전 시작</h2><p>지금 끝난 게임을 1차전으로 기록하고 다음 게임부터 순위 포인트를 이어갈 수 있습니다.</p><button class="fun-series-start" type="button">통합전으로 이어가기</button></div>`;
    container.querySelector('button').addEventListener('click', () => {
      seriesId = randomSeriesCode();
      const url = new URL(location.href); url.searchParams.set('series', seriesId); history.replaceState({}, '', url);
      writeSeries({ id: seriesId, games: {}, board: {}, createdAt: Date.now() });
      recordSeriesResult(seriesId);
      enhanceUi();
      const next = nextGameAfterCurrent();
      if (next) location.href = `${next.path}?series=${encodeURIComponent(seriesId)}`;
    });
    panel.append(container);
    return;
  }
  const next = nextGameAfterCurrent();
  if (next && isHost()) {
    container.innerHTML = `<a class="fun-next-game" href="${next.path}?series=${encodeURIComponent(seriesId)}">다음 게임 · ${next.emoji} ${escapeText(next.label)}</a>`;
  } else if (next) {
    container.innerHTML = `<div class="fun-card"><strong>📨 다음 게임 초대를 기다려주세요</strong><small>방장이 ${escapeText(next.label)} 방을 만들면 통합전 링크가 이어집니다.</small></div>`;
  } else {
    const champion = sortedSeriesBoard(seriesId)[0];
    container.innerHTML = `<div class="fun-series-card"><span class="eyebrow">CHALLENGE COMPLETE</span><h2>👑 오늘의 소소킹 ${escapeText(champion?.nickname || '')}</h2><p>4개 게임 통합전이 끝났습니다. 새 통합전을 시작하면 점수판은 새로 만들어집니다.</p><button class="fun-series-start" type="button">새 통합전 시작</button></div>`;
    container.querySelector('button')?.addEventListener('click', () => {
      const id = randomSeriesCode(); writeSeries({ id, games: {}, board: {}, createdAt: Date.now() }); location.href = `${GAMES.vault.path}?series=${id}`;
    });
  }
  panel.append(container);
}

async function maybeAssignFunRule() {
  if (!isHost() || !room || room.status !== 'playing' || room.roundState !== 'open' || applyingRule) return;
  const key = currentRevealKey();
  applyingRule = true;
  try {
    const roomRef = doc(db, 'game_rooms', roomId);
    if (currentGame.id === 'greed' && room.funEventKey !== key) {
      const event = deterministicPick(['gold', 'crack', 'safe', 'thief'], `${roomId}:${key}:event`);
      const baseReward = Number(room.reward || 0); const baseRisk = Number(room.risk || 0);
      const patch = { funEventKey: key, funEvent: event, funBaseReward: baseReward, funBaseRisk: baseRisk, funResults: [], updatedAt: Timestamp.now() };
      if (event === 'gold') patch.reward = Math.round(baseReward * 1.5);
      if (event === 'crack') patch.risk = Math.min(90, baseRisk + 15);
      if (event === 'safe') patch.risk = 0;
      await updateDoc(roomRef, patch);
    }
    if (currentGame.id === 'caught' && room.funRuleKey !== key) {
      const rule = deterministicPick(['odd', 'even', 'decoy', 'jackpot'], `${roomId}:${key}:rule`);
      let decoy = 0;
      if (rule === 'decoy') {
        const pool = Array.from({ length: 12 }, (_, index) => index + 1).filter(number => number !== Number(room.bonusNumber) && number !== Number(room.bannedNumber));
        decoy = deterministicPick(pool, `${roomId}:${key}:decoy`);
      }
      await updateDoc(roomRef, { funRuleKey: key, funRule: rule, funDecoyNumber: decoy, funResults: [], updatedAt: Timestamp.now() });
    }
    if (currentGame.id === 'chosung' && room.funRuleKey !== key) {
      const rule = deterministicPick(['sniper', 'novowel', 'ultra', 'jackpot'], `${roomId}:${key}:rule`);
      const patch = { funRuleKey: key, funRule: rule, funVowel: rule === 'novowel' ? deterministicPick(SIMPLE_VOWELS, `${roomId}:${key}:vowel`) : '', funResults: [], updatedAt: Timestamp.now() };
      if (rule === 'ultra') {
        const currentEnd = room.roundEndsAt?.toMillis?.() || 0;
        const fastEnd = Date.now() + 8000;
        if (!currentEnd || currentEnd > fastEnd) patch.roundEndsAt = Timestamp.fromMillis(fastEnd);
      }
      await updateDoc(roomRef, patch);
    }
  } catch (error) {
    console.warn('fun rule assignment skipped', error);
  } finally { applyingRule = false; }
}

function addBonus(map, uid, delta, label) {
  if (!uid || !delta) return;
  const entry = map.get(uid) || { delta: 0, labels: [] };
  entry.delta += delta; entry.labels.push(label); map.set(uid, entry);
}

async function latestGameData() {
  const [playerSnap, answerSnap] = await Promise.all([
    getDocs(collection(db, 'game_rooms', roomId, 'players')),
    getDocs(collection(db, 'game_rooms', roomId, 'answers'))
  ]);
  return {
    livePlayers: playerSnap.docs.map(item => ({ id: item.id, ...item.data() })),
    liveAnswers: answerSnap.docs.map(item => ({ id: item.id, ...item.data() }))
  };
}

async function applyVaultBonuses(livePlayers, liveAnswers, key) {
  const roundAnswers = liveAnswers.filter(item => item.kind === 'vault' && Number(item.round) === Number(room.round));
  const groups = new Map();
  roundAnswers.forEach(answer => { const list = groups.get(answer.text) || []; list.push(answer); groups.set(answer.text, list); });
  const bonuses = new Map();
  const multiplier = Number(room.round) >= Number(room.maxRounds || 9) ? 2 : 1;
  const vaults = Array.isArray(room.vaults) ? room.vaults : [];
  const leader = [...livePlayers].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  for (const answer of roundAnswers) {
    const group = groups.get(answer.text) || [];
    if (group.length > 1 && answer.power === 'insurance') {
      const vault = vaults.find(item => item.id === answer.text);
      const value = Math.max(120, Math.abs(Number(vault?.value || 240)));
      addBonus(bonuses, answer.uid, Math.max(60, Math.floor(value * multiplier / 2)), '🎟 충돌 보험금');
    }
  }
  if (Number(room.round) >= 7 && leader) {
    for (const group of groups.values()) {
      if (group.length > 1 && group.some(answer => answer.uid === leader.uid)) {
        group.filter(answer => answer.uid !== leader.uid).forEach(answer => addBonus(bonuses, answer.uid, 90, '🎯 1등 현상금 견제'));
      }
    }
  }
  await commitBonuses(livePlayers, bonuses, key, true);
}

async function applyGreedBonuses(livePlayers, liveAnswers, key) {
  const bonuses = new Map();
  const results = Array.isArray(room.lastResults) ? room.lastResults : [];
  const survived = new Set(results.filter(item => item.choice === 'climb' && !room.collapsed).map(item => item.uid));
  const bets = liveAnswers.filter(item => item.kind === 'fun-bet' && Number(item.round) === Number(room.round) && Number(item.stage) === Number(room.stage));
  bets.forEach(bet => { if (survived.has(bet.text)) addBonus(bonuses, bet.uid, 80, '🎲 생존자 베팅 적중'); });
  if (room.funEvent === 'thief') survived.forEach(uid => addBonus(bonuses, uid, 100, '🥷 도둑계단 생존 보너스'));
  await commitBonuses(livePlayers, bonuses, key, true);
}

async function applyCaughtBonuses(livePlayers, liveAnswers, key) {
  const bonuses = new Map();
  const roundAnswers = liveAnswers.filter(item => item.kind === 'number' && Number(item.round) === Number(room.round));
  const counts = new Map(); roundAnswers.forEach(answer => counts.set(Number(answer.number), (counts.get(Number(answer.number)) || 0) + 1));
  roundAnswers.forEach(answer => {
    const number = Number(answer.number); const unique = (counts.get(number) || 0) === 1;
    if (answer.power === 'ghost' && !unique && number !== Number(room.bannedNumber)) addBonus(bonuses, answer.uid, 150, '👻 유령카드 중복 구출');
    if (unique && room.funRule === 'odd' && number % 2 === 1) addBonus(bonuses, answer.uid, 90, '🟣 홀수 데이 보너스');
    if (unique && room.funRule === 'even' && number % 2 === 0) addBonus(bonuses, answer.uid, 90, '🔵 짝수 데이 보너스');
  });
  if (room.funRule === 'jackpot' && room.winnerUid) addBonus(bonuses, room.winnerUid, 250, '💎 잭팟 승리 보너스');
  await commitBonuses(livePlayers, bonuses, key, true);
}

async function applyChosungBonuses(livePlayers, liveAnswers, key) {
  const bonuses = new Map();
  const roundAnswers = liveAnswers.filter(item => !item.kind && Number(item.round) === Number(room.round));
  const valid = answer => getInitials(answer.text || '') === String(room.target || '');
  const counts = new Map();
  roundAnswers.filter(valid).forEach(answer => counts.set(normalizedAnswer(answer.text), (counts.get(normalizedAnswer(answer.text)) || 0) + 1));
  const point = Math.max(2, Array.from(String(room.target || '')).length) * Math.max(1, Number(room.multiplier || 1));
  const validUnique = roundAnswers.filter(answer => valid(answer) && (counts.get(normalizedAnswer(answer.text)) || 0) === 1);
  for (const answer of roundAnswers) {
    if (!valid(answer)) continue;
    const duplicate = (counts.get(normalizedAnswer(answer.text)) || 0) > 1;
    const forbidden = room.funRule === 'novowel' && room.funVowel && getVowels(answer.text).includes(room.funVowel);
    if (forbidden && !duplicate) addBonus(bonuses, answer.uid, -point, `🚫 금지모음 ${room.funVowel} 포함 · 기본점수 무효`);
    if (answer.power === 'shield' && duplicate && !forbidden) addBonus(bonuses, answer.uid, Math.max(1, Math.ceil(point / 2)), '🛡️ 중복방패 구출');
  }
  if (room.funRule === 'sniper' && validUnique.length) {
    const fastest = [...validUnique].sort((a, b) => Number(a.createdAt?.toMillis?.() || 9e15) - Number(b.createdAt?.toMillis?.() || 9e15))[0];
    if (fastest) addBonus(bonuses, fastest.uid, 2, '🎯 스나이퍼 최속 단독 정답');
  }
  if (room.funRule === 'jackpot') validUnique.forEach(answer => addBonus(bonuses, answer.uid, 1, '💎 잭팟 단독 정답'));
  await commitBonuses(livePlayers, bonuses, key, false);
}

async function commitBonuses(livePlayers, bonuses, key, updateLastResults) {
  const batch = writeBatch(db);
  const funResults = [];
  for (const [uid, bonus] of bonuses) {
    const player = livePlayers.find(item => item.uid === uid);
    if (!player) continue;
    const next = Math.max(0, Number(player.score || 0) + Number(bonus.delta || 0));
    batch.update(doc(db, 'game_rooms', roomId, 'players', uid), { score: next, updatedAt: Timestamp.now() });
    funResults.push({ uid, nickname: player.nickname || '플레이어', delta: Number(bonus.delta || 0), label: bonus.labels.join(' · ') });
  }
  const patch = { funBonusAppliedKey: key, funResults, updatedAt: Timestamp.now() };
  if (updateLastResults && Array.isArray(room.lastResults) && bonuses.size) {
    patch.lastResults = room.lastResults.map(result => {
      const bonus = bonuses.get(result.uid);
      return bonus ? { ...result, delta: Number(result.delta || 0) + Number(bonus.delta || 0), label: `${result.label || ''} · ${bonus.labels.join(' · ')}` } : result;
    });
  }
  batch.update(doc(db, 'game_rooms', roomId), patch);
  await batch.commit();
}

async function maybeApplyRevealBonuses() {
  if (!isHost() || !room || room.roundState !== 'reveal' || applyingBonus) return;
  const key = currentRevealKey();
  if (room.funBonusAppliedKey === key) return;
  applyingBonus = true;
  try {
    const { livePlayers, liveAnswers } = await latestGameData();
    if (currentGame.id === 'vault') await applyVaultBonuses(livePlayers, liveAnswers, key);
    if (currentGame.id === 'greed') await applyGreedBonuses(livePlayers, liveAnswers, key);
    if (currentGame.id === 'caught') await applyCaughtBonuses(livePlayers, liveAnswers, key);
    if (currentGame.id === 'chosung') await applyChosungBonuses(livePlayers, liveAnswers, key);
  } catch (error) {
    console.warn('fun bonus settlement skipped', error);
  } finally { applyingBonus = false; }
}

function processRevealStats() {
  if (!room || room.roundState !== 'reveal') return;
  const key = currentRevealKey(); const before = loadStats();
  if ((before.processed || []).includes(key)) return;
  const stats = { ...before, processed: [...(before.processed || []), key] };
  if (currentGame.id === 'vault') {
    const result = (room.lastResults || []).find(item => item.uid === currentUid);
    const answer = currentGameAnswers().find(item => item.uid === currentUid);
    const vault = (room.vaults || []).find(item => item.id === answer?.text);
    stats.successes = Number(stats.successes || 0) + (Number(result?.delta || 0) > 0 && result?.status !== 'collision' ? 1 : 0);
    stats.collisions = Number(stats.collisions || 0) + (result?.status === 'collision' ? 1 : 0);
    stats.specials = Number(stats.specials || 0) + (vault && vault.kind !== 'cash' && Number(result?.delta || 0) > 0 ? 1 : 0);
    stats.maxCombo = Math.max(Number(stats.maxCombo || 0), Number(ownPlayer()?.combo || result?.combo || 0));
  }
  if (currentGame.id === 'greed') {
    const result = (room.lastResults || []).find(item => item.uid === currentUid);
    if (result?.choice === 'cash' && Number(room.stage) >= 3 && Number(result.delta) > 0) stats.cashAt3 = Number(stats.cashAt3 || 0) + 1;
    if (result?.choice === 'climb' && !room.collapsed) stats.climbSurvives = Number(stats.climbSurvives || 0) + 1;
    if (String(result?.label || '').includes('정상 정복')) stats.topWins = Number(stats.topWins || 0) + 1;
    if (String(result?.label || '').includes('붕괴') || result?.choice === 'timeout') stats.busts = Number(stats.busts || 0) + 1;
  }
  if (currentGame.id === 'caught') {
    const result = (room.lastResults || []).find(item => item.uid === currentUid);
    if (String(result?.label || '').includes('이번 라운드 승리')) {
      stats.wins = Number(stats.wins || 0) + 1;
      if (Number(result?.number) <= 3) stats.smallWins = Number(stats.smallWins || 0) + 1;
    }
    if (String(result?.label || '').includes('보너스 숫자')) stats.bonusHits = Number(stats.bonusHits || 0) + 1;
  }
  if (currentGame.id === 'chosung') {
    const roundAnswers = currentGameAnswers(); const mine = roundAnswers.find(item => item.uid === currentUid);
    const valid = mine && getInitials(mine.text || '') === String(room.target || '');
    const same = mine ? roundAnswers.filter(item => getInitials(item.text || '') === String(room.target || '') && normalizedAnswer(item.text) === normalizedAnswer(mine.text)).length : 0;
    if (valid && same === 1) {
      stats.uniques = Number(stats.uniques || 0) + 1;
      if (Number(room.multiplier || 1) >= 2) stats.doubleUnique = Number(stats.doubleUnique || 0) + 1;
      if (Array.from(String(room.target || '')).length >= 4) stats.longUnique = Number(stats.longUnique || 0) + 1;
    }
    if (valid && same > 1) stats.duplicates = Number(stats.duplicates || 0) + 1;
  }
  saveStats(stats);
  updateMissionCelebration(before, stats);
}

function ownRoundPositive() {
  if (currentGame.id === 'vault' || currentGame.id === 'greed' || currentGame.id === 'caught') {
    const result = (room.lastResults || []).find(item => item.uid === currentUid);
    return Number(result?.delta || 0) > 0;
  }
  if (currentGame.id === 'chosung') {
    const mine = currentGameAnswers().find(item => item.uid === currentUid);
    if (!mine || getInitials(mine.text || '') !== String(room.target || '')) return false;
    return currentGameAnswers().filter(item => normalizedAnswer(item.text) === normalizedAnswer(mine.text)).length === 1;
  }
  return false;
}

function handleStateTransition() {
  if (!room || !currentGame) return;
  const key = `${room.status}:${room.roundState || ''}:${room.round || 0}:${room.stage || 0}`;
  if (key === lastStateKey) return;
  const previous = lastStateKey; lastStateKey = key;
  if (room.status === 'playing' && room.roundState === 'open') {
    playSound('start'); vibrate(25);
  }
  if (room.status === 'playing' && room.roundState === 'reveal') {
    processRevealStats();
    const good = ownRoundPositive();
    playSound(good ? 'good' : 'bad');
    vibrate(good ? [35, 35, 55] : [90]);
    flash(good ? 'good' : 'bad');
    if (good) particles(currentGame.emoji, 12);
  }
  if (room.status === 'finished' && !previous.startsWith('finished')) {
    recordSeriesResult(); playSound('finish'); vibrate([40, 35, 70, 35, 110]); particles('🏆', 22); flash('good');
  }
}

function processRoom() {
  handleStateTransition();
  if (room?.status === 'playing' && room.roundState === 'open') void maybeAssignFunRule();
  if (room?.status === 'playing' && room.roundState === 'reveal') void maybeApplyRevealBonuses();
  setTimeout(enhanceUi, 0);
}

function subscribeAnswersWhenMember() {
  if (unsubscribeAnswers || !players.some(player => player.uid === currentUid)) return;
  unsubscribeAnswers = onSnapshot(collection(db, 'game_rooms', roomId, 'answers'), snapshot => {
    answers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    void attachArmedPower();
    processRevealStats();
    setTimeout(enhanceUi, 0);
  }, error => console.warn('fun answers subscription skipped', error));
}

async function bootGameFun() {
  if (!currentGame) return;
  installSeriesShareCapture();
  try {
    await initAuth(); currentUid = auth.currentUser?.uid || '';
    roomId = normalizeCode(new URL(location.href).searchParams.get('room'));
    if (!currentUid || !roomId) { enhanceUi(); return; }
    unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', roomId), snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.type !== currentGame.type) return;
      room = { id: snapshot.id, ...data }; processRoom();
    }, error => console.warn('fun room subscription skipped', error));
    unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', roomId, 'players'), snapshot => {
      players = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      subscribeAnswersWhenMember(); setTimeout(enhanceUi, 0);
    }, error => console.warn('fun players subscription skipped', error));
  } catch (error) { console.warn('game fun pack boot skipped', error); }
}

function stop() {
  unsubscribeRoom?.(); unsubscribePlayers?.(); unsubscribeAnswers?.(); observer?.disconnect();
}

document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('click', event => {
  if (event.target.closest?.('button,a')) playSound('click');
}, { passive: true });

mountSoundToggle();
if (HOME) mountHomeSeriesCard();
if (app) {
  observer = new MutationObserver(() => setTimeout(enhanceUi, 0));
  observer.observe(app, { childList: true, subtree: true });
}
window.addEventListener('pagehide', stop, { once: true });
void bootGameFun();
