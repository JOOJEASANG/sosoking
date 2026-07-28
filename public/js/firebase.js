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
    redirectResultPromise = getRedirectResult(auth);
  }
  return redirectResultPromise;
}

export async function initAuth() {
  if (!authInitPromise) {
    authInitPromise = (async () => {
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
  }
  return authInitPromise;
}
