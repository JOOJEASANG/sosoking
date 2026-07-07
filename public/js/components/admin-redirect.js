import { auth, db } from '../firebase.js?v=20260630-3';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

let started = false;

function onAuthPage() {
  return location.hash === '#/auth' || location.pathname === '/auth';
}
async function isAdmin(user) {
  if (!user || user.isAnonymous) return false;
  const uidDoc = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  if (uidDoc?.exists()) return true;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return false;
  const emailDoc = await getDoc(doc(db, 'admins', email)).catch(() => null);
  return !!emailDoc?.exists();
}

export function initAdminRedirect() {
  if (started) return;
  started = true;
  onAuthStateChanged(auth, async user => {
    if (!user || user.isAnonymous) return;
    if (!onAuthPage()) return;
    if (!(await isAdmin(user))) return;
    location.href = '/admin';
  });
}
