import { auth, db, initAuth } from '/js/firebase.js?v=20260821-account-room-1';
import { collection, deleteDoc, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const GAME_LABELS = {
  grid: '칸폭주 30',
  vault: '금고런',
  chosung: '초성 폭탄',
  mind: '관심법',
  naming: '작명톡 생존전'
};

let roomId = '';
let roomData = null;
let players = [];
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let observer = null;
let busy = false;

function gameId() {
  return Object.keys(GAME_LABELS).find(id => location.pathname.startsWith(`/game/${id}`)) || '';
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function currentRoomId() {
  return normalizeCode(new URL(location.href).searchParams.get('room'));
}

function roomUrl() {
  const url = new URL(location.href);
  url.searchParams.set('room', roomId);
  return url.toString();
}

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function setFeedback(message, error = false) {
  const node = document.querySelector('[data-lobby-feedback]');
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('is-error', error);
  window.clearTimeout(Number(node.dataset.timer || 0));
  const timer = window.setTimeout(() => {
    if (node.textContent === message) node.textContent = '';
  }, 2400);
  node.dataset.timer = String(timer);
}

function ownPlayer() {
  const uid = auth.currentUser?.uid || '';
  return players.find(player => player.uid === uid) || null;
}

function lobbyMarkup() {
  const uid = auth.currentUser?.uid || '';
  const isHost = Boolean(uid && roomData?.hostUid === uid);
  const maxPlayers = Number(roomData?.maxPlayers || 0);
  const countText = maxPlayers > 0 ? `${players.length}/${maxPlayers}명` : `${players.length}명`;
  const game = GAME_LABELS[gameId()] || '게임';
  return `<section class="game-lobby-tools" data-game-lobby-tools>
    <div class="game-lobby-summary">
      <div><span class="game-lobby-live"><i></i> 대기실</span><strong>${escapeText(game)}</strong><small>${countText} 참가 중${isHost ? ' · 내가 방장' : ''}</small></div>
      <div class="game-lobby-code-mini"><span>ROOM</span><b>${escapeText(roomId)}</b></div>
    </div>
    <div class="game-lobby-actions">
      <button type="button" class="game-lobby-action is-primary" data-lobby-share>↗ 초대하기</button>
      <button type="button" class="game-lobby-action" data-lobby-copy-link>🔗 링크 복사</button>
      <button type="button" class="game-lobby-action" data-lobby-copy-code>⧉ 코드 복사</button>
      ${isHost
        ? '<a class="game-lobby-action is-quiet" href="/game/">게임 목록</a>'
        : '<button type="button" class="game-lobby-action is-danger" data-lobby-leave>나가기</button>'}
    </div>
    <p class="game-lobby-feedback" data-lobby-feedback aria-live="polite"></p>
    <p class="game-lobby-tip">${isHost ? '친구가 들어오면 참가자 목록에 바로 표시됩니다. 준비되면 아래 게임 시작 버튼을 눌러주세요.' : '방장이 게임을 시작할 때까지 이 화면에서 기다리면 됩니다.'}</p>
  </section>`;
}

async function shareRoom() {
  const game = GAME_LABELS[gameId()] || '소소킹 게임';
  const url = roomUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: `${game} 초대`, text: `소소킹 ${game} 방 ${roomId}에 들어오세요!`, url });
      setFeedback('초대 공유창을 열었습니다.');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyText(url);
  setFeedback('초대 링크를 복사했습니다.');
}

async function leaveRoom() {
  if (busy || !roomId || !auth.currentUser || roomData?.hostUid === auth.currentUser.uid) return;
  if (!window.confirm('이 게임방에서 나갈까요?')) return;
  busy = true;
  const button = document.querySelector('[data-lobby-leave]');
  if (button) button.disabled = true;
  try {
    await deleteDoc(doc(db, 'game_rooms', roomId, 'players', auth.currentUser.uid));
    const url = new URL(location.href);
    url.searchParams.delete('room');
    location.assign(`${url.pathname}${url.search}${url.hash}`);
  } catch (error) {
    console.error('leave game room failed', error);
    setFeedback('방에서 나가지 못했습니다. 다시 시도해주세요.', true);
    busy = false;
    if (button) button.disabled = false;
  }
}

function bindActions(root) {
  root.querySelector('[data-lobby-share]')?.addEventListener('click', () => void shareRoom());
  root.querySelector('[data-lobby-copy-link]')?.addEventListener('click', () => {
    void copyText(roomUrl()).then(() => setFeedback('초대 링크를 복사했습니다.')).catch(() => setFeedback('링크를 복사하지 못했습니다.', true));
  });
  root.querySelector('[data-lobby-copy-code]')?.addEventListener('click', () => {
    void copyText(roomId).then(() => setFeedback(`방 코드 ${roomId}를 복사했습니다.`)).catch(() => setFeedback('코드를 복사하지 못했습니다.', true));
  });
  root.querySelector('[data-lobby-leave]')?.addEventListener('click', () => void leaveRoom());
}

function decoratePlayerRows() {
  const uid = auth.currentUser?.uid || '';
  const host = players.find(player => player.uid === roomData?.hostUid);
  const me = players.find(player => player.uid === uid);
  document.querySelectorAll('.player-item').forEach(row => {
    const name = row.querySelector('.player-name')?.textContent || '';
    row.classList.toggle('is-lobby-host', Boolean(host?.nickname && name.includes(host.nickname)));
    row.classList.toggle('is-lobby-me', Boolean(me?.nickname && name.includes(me.nickname)));
  });
}

function render() {
  const existing = document.querySelector('[data-game-lobby-tools]');
  if (!roomId || !roomData || roomData.status !== 'lobby' || !ownPlayer()) {
    existing?.remove();
    return;
  }
  const panel = document.querySelector('#game-app .panel');
  if (!panel) return;
  const signature = `${roomId}|${roomData.hostUid}|${players.length}|${players.map(player => player.uid).sort().join(',')}`;
  if (existing?.dataset.signature === signature) {
    decoratePlayerRows();
    return;
  }
  existing?.remove();
  const holder = document.createElement('div');
  holder.innerHTML = lobbyMarkup();
  const tools = holder.firstElementChild;
  tools.dataset.signature = signature;
  const anchor = panel.querySelector('.room-code');
  if (anchor) anchor.insertAdjacentElement('afterend', tools);
  else panel.insertAdjacentElement('afterbegin', tools);
  bindActions(tools);
  decoratePlayerRows();
}

async function boot() {
  roomId = currentRoomId();
  if (!roomId || !gameId()) return;
  await initAuth();
  if (!auth.currentUser) return;

  unsubscribeRoom = onSnapshot(doc(db, 'game_rooms', roomId), snap => {
    roomData = snap.exists() ? snap.data() : null;
    render();
  }, error => console.warn('lobby room watch skipped:', error?.code || error));

  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', roomId, 'players'), snap => {
    players = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    render();
  }, error => console.warn('lobby players watch skipped:', error?.code || error));

  observer = new MutationObserver(render);
  observer.observe(document.getElementById('game-app') || document.body, { childList: true, subtree: true });
}

window.addEventListener('pagehide', () => {
  unsubscribeRoom?.();
  unsubscribePlayers?.();
  observer?.disconnect();
}, { once: true });

void boot();
