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

function isGuestLikeName(value) {
  const name = String(value || '').trim();
  return name === '익명' || name === '게스트' || /^게스트\d{3,6}$/.test(name);
}

function memberFallbackName(user) {
  return user?.displayName || user?.email?.split('@')[0] || '회원';
}

function restoreMemberState(user) {
  if (!user || user.isAnonymous) return;
  appState.user = user;
  if (!appState.nickname || isGuestLikeName(appState.nickname)) {
    appState.nickname = memberFallbackName(user);
  }
}

async function waitForAuthReady() {
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
    return auth.currentUser;
  }

  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      resolve(user || null);
    });
  });
}

function applyGuestName() {
  const user = auth.currentUser;
  if (!user) return;

  if (!user.isAnonymous) {
    restoreMemberState(user);
    return;
  }

  const nickname = safeGetGuestName();
  if (nickname && isGamePath()) {
    appState.nickname = nickname;
    appState.user = user;
  }
}

export async function ensureGameGuestAuth() {
  if (!isGamePath()) return null;

  const readyUser = await waitForAuthReady();

  // 이미 Google/이메일 등으로 로그인된 회원이면 게스트 닉네임 생성/익명 로그인을 절대 하지 않습니다.
  if (readyUser && !readyUser.isAnonymous) {
    restoreMemberState(readyUser);
    return readyUser;
  }

  let nickname = '게스트';
  try {
    nickname = getGuestName();
  } catch (error) {
    console.warn('[game guest name]', error);
    nickname = makeGuestName();
  }

  if (readyUser?.isAnonymous) {
    appState.user = readyUser;
    appState.nickname = nickname;
    return readyUser;
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

onAuthStateChanged(auth, user => {
  if (user && !user.isAnonymous) restoreMemberState(user);
  else applyGuestName();
});

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:guest-auth-ready', applyGuestName);
setTimeout(schedule, 500);