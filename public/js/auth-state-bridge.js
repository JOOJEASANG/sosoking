import { auth } from './firebase.js';

function isSignedIn(user) {
  return Boolean(user && !user.isAnonymous);
}

function syncHeaderUserButton(user = auth.currentUser) {
  window.firebaseAuthUser = user || null;
  const avatar = document.querySelector('.soso-dashboard-header .soso-top-avatar');
  if (!avatar) return;
  const signedIn = isSignedIn(user);
  const route = location.hash || '#/';
  const state = `${signedIn ? 'in' : 'out'}:${route}`;
  if (avatar.dataset.authBridgeState === state) return;
  avatar.dataset.authBridgeState = state;
  avatar.classList.toggle('is-active', route === '#/account');
  avatar.setAttribute('aria-label', signedIn ? '내 정보로 이동' : '로그인으로 이동');
  avatar.innerHTML = `<i>${signedIn ? '🧑' : '🔐'}</i><small>${signedIn ? '내정보' : '로그인'}</small><span>⌄</span>`;
  if (avatar.dataset.authBridgeClick !== '1') {
    avatar.dataset.authBridgeClick = '1';
    avatar.addEventListener('click', () => {
      location.hash = isSignedIn(auth.currentUser) ? '#/account' : '#/login';
    });
  }
}

auth.onAuthStateChanged?.(user => {
  syncHeaderUserButton(user);
  document.dispatchEvent(new CustomEvent('soso-auth-state', { detail: { signedIn: isSignedIn(user) } }));
});

window.addEventListener('hashchange', () => setTimeout(() => syncHeaderUserButton(auth.currentUser), 0));
setTimeout(() => syncHeaderUserButton(auth.currentUser), 0);
setTimeout(() => syncHeaderUserButton(auth.currentUser), 500);
setTimeout(() => syncHeaderUserButton(auth.currentUser), 1200);
