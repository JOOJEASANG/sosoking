import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, getRedirectResult, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app-check.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
if (firebaseConfig.appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');

let redirectResultPromise = null;
let authInitPromise = null;

export function getInitialRedirectResult() {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth).catch(error => {
      redirectResultPromise = null;
      throw error;
    });
  }
  return redirectResultPromise;
}

export async function initAuth() {
  if (!authInitPromise) {
    const currentAttempt = (async () => {
      const redirectResult = await getInitialRedirectResult().catch(error => {
        console.warn('initial redirect login result failed:', error?.code || error);
        return null;
      });
      if (redirectResult?.user) return redirectResult.user;

      await auth.authStateReady();
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      return auth.currentUser;
    })();

    let trackedAttempt;
    trackedAttempt = currentAttempt.catch(error => {
      if (authInitPromise === trackedAttempt) authInitPromise = null;
      throw error;
    });
    authInitPromise = trackedAttempt;
  }
  return authInitPromise;
}

export function isMemberUser(user = auth.currentUser) {
  return Boolean(user && !user.isAnonymous);
}

export async function requireMemberAuth() {
  await initAuth();
  const user = auth.currentUser;
  if (isMemberUser(user)) return user;

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  location.assign(`/auth/?return=${encodeURIComponent(returnTo)}`);
  return null;
}

// 방 생성/입장 폼은 익명 UID로 방을 만들지 않도록 회원 인증을 먼저 요구한다.
// 게임 내부의 답안 입력 등 다른 폼에는 영향을 주지 않는다.
function installRoomAuthGate() {
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!/^create-room-form$|^join-room-form$|^invite-form$|^room-form$/.test(form.id || '')) return;
    if (isMemberUser()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void requireMemberAuth();
  }, true);
}

if (typeof document !== 'undefined') installRoomAuthGate();
