import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, getRedirectResult, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, getDoc, getFirestore } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
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
const profileCache = new Map();

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
      if (!auth.currentUser) await signInAnonymously(auth);
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

export async function getMemberProfile(user = auth.currentUser, { fresh = false } = {}) {
  if (!isMemberUser(user)) return null;
  if (!fresh && profileCache.has(user.uid)) return profileCache.get(user.uid);
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  if (!snap?.exists()) return null;
  const data = snap.data() || {};
  const nickname = String(data.nickname || user.displayName || '').trim().slice(0, 12);
  if (!nickname) return null;
  const profile = {
    uid: user.uid,
    nickname,
    photoURL: String(data.photoURL || user.photoURL || '').trim(),
    email: String(data.email || user.email || '').trim(),
    displayName: String(data.displayName || user.displayName || '').trim()
  };
  profileCache.set(user.uid, profile);
  return profile;
}

export function clearMemberProfileCache(uid = auth.currentUser?.uid || '') {
  if (uid) profileCache.delete(uid);
}

function authReturnUrl() {
  return `${location.pathname}${location.search}${location.hash}`;
}

export async function requireMemberAuth() {
  await initAuth();
  const user = auth.currentUser;
  if (isMemberUser(user)) return user;
  location.assign(`/auth/?return=${encodeURIComponent(authReturnUrl())}`);
  return null;
}

export async function requireMemberProfile() {
  const user = await requireMemberAuth();
  if (!user) return null;
  const profile = await getMemberProfile(user, { fresh: true });
  if (profile) return profile;
  location.assign(`/auth/?mode=profile&return=${encodeURIComponent(authReturnUrl())}`);
  return null;
}

const ROOM_FORM_IDS = new Set([
  'create-room-form', 'join-room-form', 'invite-form', 'room-form',
  'create-form', 'join-form', 'create', 'join', 'invite-join-form'
]);

function nicknameInputs(form) {
  return [...form.querySelectorAll('input')].filter(input => {
    const key = `${input.id} ${input.name} ${input.autocomplete}`.toLowerCase();
    return key.includes('nickname') || key.includes('name') || input.autocomplete === 'nickname';
  }).filter(input => !/room|code|topic|answer|word/.test(`${input.id} ${input.name}`.toLowerCase()));
}

function installRoomAuthGate() {
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !ROOM_FORM_IDS.has(form.id)) return;
    if (form.dataset.memberAuthReady === '1') {
      delete form.dataset.memberAuthReady;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    void (async () => {
      const profile = await requireMemberProfile();
      if (!profile) return;
      const inputs = nicknameInputs(form);
      inputs.forEach(input => {
        if (!String(input.value || '').trim()) {
          input.value = profile.nickname;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      form.dataset.memberAuthReady = '1';
      form.requestSubmit();
    })().catch(error => {
      console.error('room member gate failed', error);
      location.assign(`/auth/?return=${encodeURIComponent(authReturnUrl())}`);
    });
  }, true);
}

if (typeof document !== 'undefined') installRoomAuthGate();
