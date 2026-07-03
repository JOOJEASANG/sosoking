import { auth, db, onAuthStateChanged } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { appState } from './state.js';
import { navigate } from './router.js';

let cachedUid = '';
let cachedValue = false;
let checking = null;

async function verifyAdmin() {
  const user = auth.currentUser || appState.user;
  if (!user) return false;
  if (cachedUid === user.uid) return cachedValue;
  if (checking) return checking;

  checking = (async () => {
    let allowed = false;

    try {
      const token = await user.getIdTokenResult?.(false);
      allowed = !!token?.claims?.admin || !!token?.claims?.owner;
    } catch {}

    // 일반 회원 문서(users/{uid})의 isAdmin/admin/role 값과 이메일 주소는 관리자 판정에 사용하지 않습니다.
    // 관리자 권한은 커스텀 클레임 또는 admins/{uid} 문서로만 인정합니다.
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
  if (!user) {
    appState.isAdmin = false;
    document.documentElement.classList.remove('is-verified-admin');
    removeAdminButtons();
    return;
  }

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
  if (!allowed) {
    event.preventDefault();
    event.stopPropagation();
    removeAdminButtons();
    navigate('/account');
    return;
  }

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
  checking = null;
  appState.isAdmin = false;
  schedule();
});
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 120);