import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { normalizeDna } from '/game/dna-profile.js?v=20260816-dna-1';

const GAMES = [
  {
    id: 'dna', type: 'dna-boss', path: '/game/dna/', emoji: '🧬', label: '소소킹 DNA', people: '2~8명',
    summary: '친구들의 플레이 버릇으로 AI 보스를 만드는 오리지널', maxRounds: 6,
    initial: { phase: 'waiting', bossHp: 0, bossMaxHp: 0, aiStatus: 'idle', aiMode: '', aiPack: {}, lastResults: [] }
  },
  {
    id: 'vault', type: 'vault-run', path: '/game/vault/', emoji: '💰', label: '금고런', people: '2~8명',
    summary: '겹치지 않는 금고를 고르는 눈치전', maxRounds: 9,
    initial: { roundSeconds: 12, vaults: [], lastResults: [] }
  },
  {
    id: 'chosung', type: 'chosung-bomb', path: '/game/chosung/', emoji: '💣', label: '초성 폭탄', people: '2~8명',
    summary: '남과 다른 초성 단어를 만드는 순발력전', maxRounds: 7,
    initial: { target: '', usedTargets: [], roundMode: '', roundSeconds: 25, multiplier: 1 }
  },
  {
    id: 'mind', type: 'mind-reader', path: '/game/mind/', emoji: '🧠', label: '관심법', people: '3~8명',
    summary: '친구의 선택을 맞히는 관계 심리전', maxRounds: 8,
    initial: { promptId: '', targetUid: '', usedPrompts: [] }
  },
  {
    id: 'alibi', type: 'alibi-market', path: '/game/alibi/', emoji: '🧾', label: '변명거래소', people: '3~8명',
    summary: '황당한 변명을 사고파는 창작 게임', maxRounds: 3,
    initial: { phase: 'waiting', promptId: '', usedPrompts: [] }
  }
];

const GAME_BY_TYPE = Object.fromEntries(GAMES.map(game => [game.type, game]));
const currentGame = GAMES.find(game => location.pathname.startsWith(game.path)) || null;
const app = document.getElementById('game-app');
const roomId = String(new URL(location.href).searchParams.get('room') || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);

let currentUid = '';
let room = null;
let switching = false;
let unsubscribeRoom = null;
let observer = null;
let carryBannerShown = false;

window.sosokingGameNight = { version: '20260816-dna-1', games: GAMES.map(({ id, type, path }) => ({ id, type, path })) };

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function targetUrl(game) {
  const url = new URL(game.path, location.origin);
  url.searchParams.set('room', roomId);
  url.searchParams.set('continued', '1');
  return url.href;
}

function followSelectedGame(data) {
  const selected = GAME_BY_TYPE[data?.type];
  if (!selected || selected.type === currentGame?.type) return false;
  location.replace(targetUrl(selected));
  return true;
}

function showCarryBanner() {
  if (carryBannerShown || new URL(location.href).searchParams.get('continued') !== '1' || !app) return;
  if (!app.querySelector('.panel')) return;
  carryBannerShown = true;
  const banner = document.createElement('div');
  banner.className = 'game-night-carry-banner';
  banner.innerHTML = `<strong>🎉 멤버 그대로 이어졌어요</strong><span>방 코드 ${escapeText(roomId)} · 초대 없이 다음 게임을 시작하세요.</span>`;
  app.prepend(banner);
  window.setTimeout(() => banner.classList.add('is-ready'), 20);
  window.setTimeout(() => banner.remove(), 5200);
}

function gameCard(game) {
  return `<button class="game-night-choice ${game.id === 'dna' ? 'is-dna' : ''}" type="button" data-next-game="${game.id}">
    <span class="game-night-emoji">${game.emoji}</span>
    <span><strong>${escapeText(game.label)}</strong><small>${escapeText(game.summary)}</small></span>
    <em>${escapeText(game.people)}</em>
  </button>`;
}

function pickerMarkup() {
  const host = room?.hostUid === currentUid;
  if (!host) {
    return `<section class="game-night-picker waiting" data-game-night-picker>
      <span class="game-night-kicker">SAME ROOM · NEXT GAME</span>
      <h2>🎮 방장이 다음 게임을 고르는 중</h2>
      <p>게임이 정해지면 이 화면에서 같은 멤버 그대로 자동 이동합니다.</p>
      <div class="game-night-waiting-dots" aria-label="기다리는 중"><i></i><i></i><i></i></div>
    </section>`;
  }
  return `<section class="game-night-picker" data-game-night-picker>
    <span class="game-night-kicker">SAME ROOM · NEXT GAME</span>
    <h2>🎮 다음엔 뭐 할까?</h2>
    <p>원하는 게임을 고르면 <b>방 코드와 멤버는 그대로</b>, 점수만 새로 시작합니다. 모두 자동으로 이동해요.</p>
    <button class="game-night-replay" type="button" data-next-game="${currentGame.id}"><span>🔁</span><strong>현재 게임 한 판 더</strong><small>${escapeText(currentGame.label)} · 같은 멤버로 바로 다시 시작</small></button>
    <div class="game-night-other-title">또는 다른 게임 고르기</div>
    <div class="game-night-grid">${GAMES.filter(game => game.type !== currentGame.type).map(gameCard).join('')}</div>
    <small class="game-night-footnote">🧬 게임을 이어갈수록 플레이 DNA는 남고, 일반 점수만 새로 시작합니다.</small>
  </section>`;
}

function mountPicker() {
  if (!app || room?.status !== 'finished') return;
  app.querySelectorAll('#restart-game,#restart').forEach(button => {
    button.hidden = true;
    button.closest('.button-row')?.classList.add('game-night-native-restart');
  });
  if (app.querySelector('[data-game-night-picker]')) return;
  const panel = app.querySelector('.panel');
  if (!panel) return;
  const homeRow = [...panel.querySelectorAll('.button-row')].find(row => row.querySelector('a[href="/game/"],a[href="/"]'));
  const wrapper = document.createElement('div');
  wrapper.innerHTML = pickerMarkup();
  const picker = wrapper.firstElementChild;
  if (homeRow) homeRow.before(picker); else panel.append(picker);
  picker.querySelectorAll('[data-next-game]').forEach(button => {
    button.addEventListener('click', () => void switchGame(button.dataset.nextGame));
  });
}

function roomPayload(game, latestRoom, now) {
  return {
    type: game.type,
    status: 'lobby',
    hostUid: latestRoom.hostUid,
    maxPlayers: 8,
    round: 0,
    maxRounds: game.maxRounds,
    roundState: 'waiting',
    ...game.initial,
    previousGameType: latestRoom.type || '',
    nextGameId: game.id,
    gameNightRound: Number(latestRoom.gameNightRound || 0) + 1,
    createdAt: latestRoom.createdAt || now,
    updatedAt: now
  };
}

async function switchGame(gameId) {
  const game = GAMES.find(item => item.id === gameId);
  if (!game || switching || !roomId) return;
  switching = true;
  const picker = app?.querySelector('[data-game-night-picker]');
  picker?.classList.add('is-switching');
  picker?.querySelectorAll('button').forEach(button => { button.disabled = true; });
  const selected = picker?.querySelector(`[data-next-game="${gameId}"]`);
  if (selected) selected.querySelector('small').textContent = '게임방 옮기는 중…';

  try {
    const roomRef = doc(db, 'game_rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) throw new Error('room-not-found');
    const latestRoom = roomSnap.data();
    if (latestRoom.hostUid !== currentUid || latestRoom.status !== 'finished') throw new Error('host-finished-required');

    const [playersSnap, answersSnap] = await Promise.all([
      getDocs(collection(db, 'game_rooms', roomId, 'players')),
      getDocs(collection(db, 'game_rooms', roomId, 'answers'))
    ]);
    if (playersSnap.size < 2) throw new Error('players-missing');

    const now = Timestamp.now();
    const batch = writeBatch(db);
    answersSnap.docs.forEach(item => batch.delete(item.ref));
    playersSnap.docs.forEach(item => {
      const player = item.data();
      batch.set(item.ref, {
        uid: player.uid || item.id,
        nickname: String(player.nickname || '플레이어').slice(0, 12),
        score: 0,
        combo: 0,
        position: 0,
        laps: 0,
        damage: 0,
        runState: 'waiting',
        dna: normalizeDna(player.dna),
        joinOrder: Number(player.joinOrder || Date.now()),
        joinedAt: player.joinedAt || now,
        updatedAt: now
      });
    });
    batch.set(roomRef, roomPayload(game, latestRoom, now));
    await batch.commit();
  } catch (error) {
    console.error('same-room game switch failed', error);
    switching = false;
    picker?.classList.remove('is-switching');
    picker?.querySelectorAll('button').forEach(button => { button.disabled = false; });
    if (selected) selected.querySelector('small').textContent = '전환 실패 · 다시 눌러주세요';
  }
}

async function boot() {
  if (!currentGame || !app || roomId.length !== 6) return;
  try {
    await initAuth();
    currentUid = auth.currentUser?.uid || '';
    if (!currentUid) return;
    unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', roomId), snapshot => {
      if (!snapshot.exists()) return;
      room = { id: snapshot.id, ...snapshot.data() };
      if (followSelectedGame(room)) return;
      showCarryBanner();
      window.setTimeout(mountPicker, 0);
    }, error => console.warn('game night room watch skipped', error));
    observer = new MutationObserver(() => window.setTimeout(() => {
      showCarryBanner();
      mountPicker();
    }, 0));
    observer.observe(app, { childList: true, subtree: true });
  } catch (error) {
    console.warn('game night boot skipped', error);
  }
}

window.addEventListener('pagehide', () => {
  unsubscribeRoom?.();
  observer?.disconnect();
}, { once: true });

void boot();
