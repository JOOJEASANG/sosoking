import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app-check.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

if (firebaseConfig.appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}
