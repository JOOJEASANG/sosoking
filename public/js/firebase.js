import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { getAnalytics, isSupported, logEvent, setUserId } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');

let _analytics = null;
isSupported().then(ok => { if (ok) _analytics = getAnalytics(app); }).catch(() => {});

export function trackEvent(name, params = {}) {
  try { if (_analytics) logEvent(_analytics, name, params); } catch {}
}

export function trackUser(uid) {
  try { if (_analytics && uid) setUserId(_analytics, uid); } catch {}
}

const googleProvider = new GoogleAuthProvider();

export async function initAuth() {
  await new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
  });
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch (err) {
      console.warn('익명 로그인 실패 (일부 기능 제한):', err.code);
    }
  }
  return auth.currentUser;
}

export async function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signupWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
  try { await signInAnonymously(auth); } catch {}
}
