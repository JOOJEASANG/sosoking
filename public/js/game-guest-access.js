import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { appState } from './state.js';
import { toast } from './components/toast.js';

const STORAGE_KEY = 'sosoking_guest_nickname';

function isGamePath() {
  return (window.location.hash || '').startsWith('#/game/');
}

function cleanName(value) {
  return String(value || '').replace(/[^가-힣a-zA-Z0-9_\s]/g, '').trim().slice(0, 12);
}

function makeGuestName() {
  return '게스트' + Math.floor(1000 + Math.random() * 9000);
}

function safeGetGuestName() {
  try {
    return cleanName(localStorage.getItem(STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

function safeSetGuestName(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // 일부 브라우저/앱 내장 웹뷰에서는 localStorage가 막힐 수 있습니다.
  }
}

function getGuestName() {
  let name = safeGetGuestName();
  if (name) return name;

  try {
    name = cleanName(window.prompt('게임에서 사용할 닉네임을 입력해주세요.', '게스트'));
  } catch {
    name = '';
  }

  if (!name) name = makeGuestName();
  safeSetGuestName(name);
  return name;
}

function applyGuestName() {
  const nickname = safeGetGuestName();
  if (nickname && auth.currentUser?.isAnonymous && isGamePath()) {
    appState.nickname = nickname;
    appState.user = auth.currentUser;
  }
}

export async function ensureGameGuestAuth() {
  if (!isGamePath()) return null;

  let nickname = '게스트';
  try {
    nickname = getGuestName();
    appState.nickname = nickname;
  } catch (error) {
    console.warn('[game guest name]', error);
    nickname = makeGuestName();
    appState.nickname = nickname;
  }

  if (auth.currentUser) {
    applyGuestName();
    return auth.currentUser;
  }

  try {
    const cred = await signInAnonymously(auth);
    appState.user = cred.user;
    appState.nickname = nickname;
    toast.success(`${nickname}님으로 게임에 참가할 수 있어요`);
    window.dispatchEvent(new Event('sosoking:guest-auth-ready'));
    return cred.user;
  } catch (error) {
    console.error('[game guest auth]', error);
    toast.error('게스트 접속에 실패했어요. Firebase 인증 설정을 확인해주세요.');
    return null;
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    ensureGameGuestAuth().catch(error => console.warn('[game guest schedule]', error));
  }, 120);
}

onAuthStateChanged(auth, () => {
  applyGuestName();
});

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:guest-auth-ready', applyGuestName);
setTimeout(schedule, 500);