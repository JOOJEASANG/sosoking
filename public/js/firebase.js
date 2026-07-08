import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, signInAnonymously, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');
export const storage = getStorage(app);

let authReadyPromise = null;

export async function waitForAuthReady() {
  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      await setPersistence(auth, browserLocalPersistence).catch(err => console.warn('auth persistence skipped', err));
      await new Promise(resolve => {
        const unsub = onAuthStateChanged(auth, () => {
          unsub();
          resolve();
        });
      });
    })();
  }
  return authReadyPromise;
}

export async function initAuth() {
  await waitForAuthReady();
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}
