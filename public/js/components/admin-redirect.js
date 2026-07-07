import { auth } from '../firebase.js?v=20260630-3';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

const ADMIN_EMAIL = ['sosoday1976', 'gmail.com'].join('@');
let started = false;

function onAuthPage() {
  return location.hash === '#/auth' || location.pathname === '/auth';
}
function isAdmin(user) {
  return String(user?.email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

export function initAdminRedirect() {
  if (started) return;
  started = true;
  onAuthStateChanged(auth, user => {
    if (!user || user.isAnonymous) return;
    if (!onAuthPage()) return;
    if (!isAdmin(user)) return;
    location.href = '/admin';
  });
}
