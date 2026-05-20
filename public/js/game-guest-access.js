import { auth, signInAnonymously } from './firebase.js';
import { appState } from './state.js';
import { toast } from './components/toast.js';

const STORAGE_KEY = 'sosoking_guest_nickname';

function isGamePath() {
  return (window.location.hash || '').startsWith('#/game/');
}

function cleanName(value) {
  return String(value || '').replace(/[^가-힣a-zA-Z0-9_\s]/g, '').trim().slice(0, 12);
}

function getGuestName() {
  let name = cleanName(localStorage.getItem(STORAGE_KEY) || '');
  if (name) return name;
  name = cleanName(window.prompt('게임에서 사용할 닉네임을 입력해주세요.', '게스트'));
  if (!name) name = '게스트' + Math.floor(1000 + Math.random() * 9000);
  localStorage.setItem(STORAGE_KEY, name);
  return name;
}

export async function ensureGameGuestAuth() {
  if (!isGamePath()) return null;
  const nickname = getGuestName();
  appState.nickname = appState.nickname || nickname;

  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    appState.user = cred.user;
    appState.nickname = nickname;
    toast.success(`${nickname}님으로 게임에 참가할 수 있어요`);
    window.dispatchEvent(new Event('sosoking:guest-auth-ready'));
    return cred.user;
  } catch (error) {
    console.error('[game guest auth]', error);
    toast.error('게스트 접속에 실패했어요. 잠시 후 다시 시도해주세요.');
    return null;
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureGameGuestAuth, 120);
}

window.addEventListener('hashchange', schedule);
setTimeout(schedule, 500);
