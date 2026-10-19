import { auth, db } from './firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

const ADMIN_PATH = '/admin/';
let authRedirectStarted = false;
let authListenerStarted = false;

function isAccountRoute() {
  const hash = location.hash || '';
  if (hash === '#/auth' || hash.startsWith('#/auth/')) return true;
  return location.pathname.replace(/\/$/, '') === '/auth';
}

export async function isAdminUser(user = auth.currentUser) {
  if (!user || user.isAnonymous) return false;

  const email = String(user.email || '').trim().toLowerCase();
  const lookups = [getDoc(doc(db, 'admins', user.uid)).catch(() => null)];
  if (email) lookups.push(getDoc(doc(db, 'admins', email)).catch(() => null));

  const snapshots = await Promise.all(lookups);
  return snapshots.some(snapshot => snapshot?.exists());
}

async function redirectSignedInAdmin(user) {
  if (authRedirectStarted || !isAccountRoute() || !user || user.isAnonymous) return false;

  const uid = user.uid;
  const allowed = await isAdminUser(user);
  if (!allowed || auth.currentUser?.uid !== uid || !isAccountRoute()) return false;

  authRedirectStarted = true;
  try {
    sessionStorage.setItem('sosoking:admin-login-redirected', String(Date.now()));
  } catch {}
  location.replace(ADMIN_PATH);
  return true;
}

export async function redirectAdminAccountRoute() {
  return redirectSignedInAdmin(auth.currentUser);
}

export function initAdminLoginRedirect() {
  if (authListenerStarted) return;
  authListenerStarted = true;
  onAuthStateChanged(auth, user => {
    redirectSignedInAdmin(user).catch(error => {
      console.warn('administrator redirect check skipped:', error?.code || error);
    });
  });
}
