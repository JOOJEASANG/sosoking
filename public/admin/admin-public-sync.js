import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let syncing = false;

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function isAdmin(user) {
  if (!user || user.isAnonymous) return false;
  const uidSnap = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  if (uidSnap?.exists()) return true;
  const email = cleanEmail(user.email);
  if (!email || user.emailVerified !== true) return false;
  const emailSnap = await getDoc(doc(db, 'admins', email)).catch(() => null);
  return !!emailSnap?.exists();
}

async function syncPublicSettings() {
  if (syncing || !(await isAdmin(auth.currentUser))) return;
  syncing = true;
  try {
    const source = await getDoc(doc(db, 'site_settings', 'config'));
    if (!source.exists()) return;
    const data = source.data() || {};
    await setDoc(doc(db, 'public_settings', 'config'), {
      dailyLimit: Math.max(1, Math.min(20, Number(data.dailyLimit || 3))),
      cooldownSec: Math.max(0, Math.min(300, Number(data.cooldownSec || 45))),
      businessInfo: data.businessInfo || {},
      publicNotice: String(data.publicNotice || '').slice(0, 1000),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('public settings sync skipped:', err.message || err);
  } finally {
    syncing = false;
  }
}

onAuthStateChanged(auth, user => {
  if (user && !user.isAnonymous) setTimeout(syncPublicSettings, 300);
});

document.addEventListener('submit', event => {
  if (event.target?.id === 'site-form' || event.target?.id === 'biz-form') {
    setTimeout(syncPublicSettings, 700);
  }
}, true);

window.syncSosokingPublicSettings = syncPublicSettings;
