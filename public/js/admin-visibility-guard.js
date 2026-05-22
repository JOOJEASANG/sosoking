import { auth, db, onAuthStateChanged } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { appState } from './state.js';
import { navigate } from './router.js';

const OWNER_EMAILS = new Set(['joojeasang@gmail.com']);
let cachedUid = '';
let cachedValue = false;
let checking = null;

async function verifyAdmin() {
  const user = auth.currentUser || appState.user;
  if (!user) return false;
  if (cachedUid === user.uid) return cachedValue;
  if (checking) return checking;

  checking = (async () => {
    const email = String(user.email || '').toLowerCase();
    let allowed = OWNER_EMAILS.has(email);

    try {
      const token = await user.getIdTokenResult?.(false);
      allowed = allowed || !!token?.claims?.admin || !!token?.claims?.owner;
    } catch {}

    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const data = userSnap.exists() ? userSnap.data() : {};
      allowed = allowed || data.isAdmin === true || data.admin === true || data.role === 'admin' || data.role === 'owner';
    } catch {}

    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      allowed = allowed || adminSnap.exists();
    } catch {}

    cachedUid = user.uid;
    cachedValue = !!allowed;
    appState.isAdmin = !!allowed;
    checking = null;
    return cachedValue;
  })();

  return checking;
}

function removeAdminButtons() {
  const selectors = [
    '[data-nav-path="/admin"]',
    '[href="#/admin"]',
    'a[href*="#/admin"]',
    '[data-admin-only]',
  ];
  document.querySelectorAll(selectors.join(',')).forEach(el => {
    const removable = el.closest('button, a, .btn, .sidebar-nav__item') || el;
    removable.remove();
  });
}

async function enforceAdminVisibility() {
  const user = auth.currentUser || appState.user;
  if (!user) return;

  const allowed = await verifyAdmin();
  document.documentElement.classList.toggle('is-verified-admin', allowed);

  if (!allowed) {
    removeAdminButtons();
    const path = window.location.hash.slice(1).split('?')[0] || '/';
    if (path === '/admin') navigate('/account');
  }
}

async function handleAdminNavClick(event) {
  const target = event.target.closest?.('[data-nav-path="/admin"], [href="#/admin"], a[href*="#/admin"], button[onclick*="/admin"], button[onclick*="admin"]');
  if (!target) return;

  const allowed = await verifyAdmin();
  if (!allowed) return;

  event.preventDefault();
  event.stopPropagation();
  navigate('/admin');
}

document.addEventListener('click', handleAdminNavClick, true);

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enforceAdminVisibility, 80);
}

onAuthStateChanged(auth, () => {
  cachedUid = '';
  cachedValue = false;
  schedule();
});
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 400);