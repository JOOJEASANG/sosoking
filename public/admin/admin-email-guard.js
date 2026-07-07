import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL = ['sosoday1976', 'gmail.com'].join('@');

async function hasAdminAccess(user) {
  if (!user) return false;
  const uidDoc = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  if (uidDoc?.exists()) return true;
  const email = String(user.email || '').trim().toLowerCase();
  if (email !== ADMIN_EMAIL) return false;
  return true;
}

onAuthStateChanged(auth, async user => {
  if (!user) return;
  const ok = await hasAdminAccess(user);
  if (!ok) return;
  setTimeout(() => {
    const noAccess = document.getElementById('admin-content')?.textContent || '';
    if (noAccess.includes('관리자 권한 없음')) location.reload();
  }, 700);
});
