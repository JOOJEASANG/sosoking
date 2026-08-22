import { auth, db, initAuth, isMemberUser } from '/js/firebase.js?v=20260821-account-room-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const GAME_ROUTES = {
  'grid-rush': '/game/grid/',
  'vault-run': '/game/vault/',
  'chosung-bomb': '/game/chosung/',
  'mind-reader': '/game/mind/',
  'naming-survival': '/game/naming/'
};
const RANDOM_ROUTES = Object.values(GAME_ROUTES);

function normalizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function setStatus(message, tone = '') {
  const node = document.getElementById('quick-join-status');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

async function joinByCode(event) {
  event.preventDefault();
  const input = document.getElementById('quick-room-code');
  const button = document.getElementById('quick-join-button');
  const code = normalizeRoomCode(input?.value);
  if (input) input.value = code;
  if (code.length !== 6) return setStatus('6자리 초대 코드를 입력해주세요.', 'error');

  if (button) button.disabled = true;
  setStatus('방을 확인하는 중입니다…');
  try {
    await initAuth();
    const snap = await getDoc(doc(db, 'game_rooms', code));
    if (!snap.exists()) throw new Error('not-found');
    const room = snap.data() || {};
    const route = GAME_ROUTES[room.type];
    if (!route) throw new Error('unsupported');
    location.assign(`${route}?room=${encodeURIComponent(code)}`);
  } catch (error) {
    console.error('quick room join failed', error);
    setStatus('방을 찾지 못했거나 이미 입장할 수 없는 방입니다.', 'error');
    if (button) button.disabled = false;
  }
}

function randomGame() {
  const route = RANDOM_ROUTES[Math.floor(Math.random() * RANDOM_ROUTES.length)];
  if (route) location.assign(route);
}

function syncAuthHint() {
  const hint = document.getElementById('quick-auth-hint');
  if (!hint) return;
  const member = isMemberUser(auth.currentUser);
  hint.textContent = member
    ? '로그인된 프로필로 바로 방을 만들거나 입장할 수 있습니다.'
    : '방 만들기·입장 시 로그인 후 현재 화면으로 자동 복귀합니다.';
}

const roomInput = document.getElementById('quick-room-code');
roomInput?.addEventListener('input', event => {
  const normalized = normalizeRoomCode(event.currentTarget.value);
  if (event.currentTarget.value !== normalized) event.currentTarget.value = normalized;
  setStatus('');
});
document.getElementById('quick-join-form')?.addEventListener('submit', joinByCode);
document.getElementById('random-game-button')?.addEventListener('click', randomGame);
document.getElementById('browse-games-button')?.addEventListener('click', () => {
  document.getElementById('quick-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

void auth.authStateReady().then(syncAuthHint).catch(syncAuthHint);
auth.onAuthStateChanged(syncAuthHint);
