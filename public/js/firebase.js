import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');

let readyPromise;

export function waitForAuthReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await setPersistence(auth, browserLocalPersistence);
      await new Promise(resolve => {
        const unsubscribe = onAuthStateChanged(auth, () => {
          unsubscribe();
          resolve();
        });
      });
      return auth.currentUser;
    })();
  }
  return readyPromise;
}
