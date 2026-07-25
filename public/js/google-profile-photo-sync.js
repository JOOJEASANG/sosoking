import { appState } from './state.js';
import { escHtml } from './utils/helpers.js';

let observer = null;
let scheduled = false;

function googlePhoto() {
  const user = appState.user;
  if (!user?.photoURL) return '';
  const providers = Array.isArray(user.providerData) ? user.providerData : [];
  const signedInWithGoogle = providers.some(item => item?.providerId === 'google.com');
  return signedInWithGoogle ? String(user.photoURL) : '';
}

function photoMarkup(url, className) {
  return `<img class="${className}" src="${escHtml(url)}" alt="" referrerpolicy="no-referrer" aria-hidden="true">`;
}

function syncGooglePhoto() {
  scheduled = false;
  const url = googlePhoto();
  if (!url) return;

  document.querySelectorAll('.site-header__avatar').forEach(avatar => {
    if (avatar.dataset.googlePhotoApplied === url) return;
    avatar.dataset.googlePhotoApplied = url;
    avatar.classList.add('site-header__avatar--icon', 'site-header__avatar--google');
    avatar.innerHTML = photoMarkup(url, 'site-header__avatar-img');
  });

  document.querySelectorAll('.sidebar__user-avatar').forEach(avatar => {
    if (avatar.dataset.googlePhotoApplied === url) return;
    avatar.dataset.googlePhotoApplied = url;
    avatar.innerHTML = photoMarkup(url, 'sidebar__google-avatar-img');
  });

  document.querySelectorAll('.admin-profile-card__avatar').forEach(avatar => {
    if (avatar.dataset.googlePhotoApplied === url) return;
    avatar.dataset.googlePhotoApplied = url;
    avatar.innerHTML = photoMarkup(url, 'admin-profile-card__avatar-img');
  });
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(syncGooglePhoto);
}

scheduleSync();
window.addEventListener('hashchange', scheduleSync);
window.addEventListener('sosoking:extensions-ready', scheduleSync);
window.addEventListener('themechange', scheduleSync);

if (!observer && document.body) {
  observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
}
