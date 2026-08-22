import { auth, getMemberProfile, isMemberUser, memberFallbackProfile } from '/js/firebase.js?v=20260821-account-room-1';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

const USER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.1c-4.4 0-8 2.4-8 5.3 0 .6.5 1 1 1h14c.6 0 1-.4 1-1 0-2.9-3.6-5.3-8-5.3Z"/></svg>`;
const LOGOUT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20H10v-2H6V6h4V4Zm6.6 3.4-1.4 1.4 2.2 2.2H9v2h8.4l-2.2 2.2 1.4 1.4 4.6-4.6-4.6-4.6Z"/></svg>`;

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function safePhoto(value) {
  const url = String(value || '').trim();
  return /^https:\/\//.test(url) ? url : '';
}

function fallbackAvatar(name = '소') {
  const mark = escapeText(String(name || '소').trim().slice(0, 1).toUpperCase() || '소');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#1b2940"/><circle cx="48" cy="48" r="42" fill="none" stroke="#ffd166" stroke-opacity=".5" stroke-width="3"/><text x="48" y="59" text-anchor="middle" font-family="Arial,sans-serif" font-size="38" font-weight="800" fill="#ffd166">${mark}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function providerPhoto(user) {
  const google = user?.providerData?.find(item => item?.providerId === 'google.com');
  return safePhoto(user?.photoURL || google?.photoURL || '');
}

async function profileFor(user) {
  if (!isMemberUser(user)) return null;
  const stored = await getMemberProfile(user).catch(() => null);
  const fallback = memberFallbackProfile(user);
  return {
    ...(fallback || {}),
    ...(stored || {}),
    photoURL: safePhoto(stored?.photoURL) || providerPhoto(user) || safePhoto(fallback?.photoURL)
  };
}

function targetContainer() {
  const existing = document.querySelector('.home-actions');
  if (existing) return existing;
  const header = document.querySelector('.game-header');
  if (!header) return null;
  let actions = header.querySelector('.account-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'account-actions';
    header.appendChild(actions);
  }
  return actions;
}

function loginMarkup() {
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return `<a class="account-login-icon" href="/auth/?return=${encodeURIComponent(returnTo)}" aria-label="로그인 또는 회원가입" title="로그인 · 회원가입">${USER_ICON}<span>로그인</span></a>`;
}

function memberMarkup(profile, user) {
  const nickname = profile?.nickname || user.displayName || '회원';
  const photo = safePhoto(profile?.photoURL) || providerPhoto(user) || fallbackAvatar(nickname);
  return `<div class="account-member" data-account-member>
    <span class="account-profile" aria-label="${escapeText(nickname)} 계정" title="내 계정">
      <img class="account-avatar" src="${escapeText(photo)}" alt="" referrerpolicy="no-referrer" data-account-avatar>
      <span>${escapeText(nickname)}</span>
    </span>
    <button class="account-logout" type="button" data-account-logout aria-label="로그아웃" title="로그아웃">${LOGOUT_ICON}</button>
  </div>`;
}

async function render(container, user) {
  if (!container) return;
  container.querySelectorAll('.account-login-icon,.account-member').forEach(node => node.remove());
  container.querySelector('.account-button')?.remove();

  if (!isMemberUser(user)) {
    container.insertAdjacentHTML('afterbegin', loginMarkup());
    return;
  }

  const profile = await profileFor(user);
  if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
  container.insertAdjacentHTML('afterbegin', memberMarkup(profile, user));
  const avatar = container.querySelector('[data-account-avatar]');
  avatar?.addEventListener('error', () => {
    const nickname = profile?.nickname || user.displayName || '회원';
    avatar.src = fallbackAvatar(nickname);
  }, { once: true });
  container.querySelector('[data-account-logout]')?.addEventListener('click', async buttonEvent => {
    const button = buttonEvent.currentTarget;
    button.disabled = true;
    try {
      await signOut(auth);
      location.assign('/');
    } catch (error) {
      console.error('logout failed', error);
      button.disabled = false;
    }
  });
}

export async function mountAccountUI() {
  const container = targetContainer();
  if (!container) return;
  await auth.authStateReady().catch(() => {});
  await render(container, auth.currentUser);
  auth.onAuthStateChanged(user => { void render(container, user); });
}
