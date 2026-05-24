import { auth } from '../firebase.js';
import { appState } from '../state.js';

export function makeRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function buildGameInviteUrl(game, roomId) {
  return `${location.origin}/#/game/${game}/${roomId}`;
}

export function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cleanStoredName(value) {
  return String(value || '').replace(/[^가-힣a-zA-Z0-9_\s]/g, '').trim().slice(0, 12);
}

function storedGuestName() {
  try {
    return cleanStoredName(localStorage.getItem('sosoking_guest_nickname') || '');
  } catch {
    return '';
  }
}

function isGuestLikeName(value) {
  const name = String(value || '').trim();
  return name === '익명' || name === '게스트' || /^게스트\d{3,6}$/.test(name);
}

function memberName(user) {
  const appName = appState.nickname && !isGuestLikeName(appState.nickname) ? appState.nickname : '';
  return appName || user?.displayName || user?.email?.split('@')[0] || '';
}

export function gamePlayerName(fallback = '게스트') {
  const user = auth.currentUser;

  if (user && !user.isAnonymous) {
    return memberName(user) || '회원';
  }

  if (user?.isAnonymous) {
    return storedGuestName() || appState.nickname || fallback;
  }

  return memberName(user) || fallback;
}

export function findMyPlayer(players) {
  return players.find(p => p.uid === auth.currentUser?.uid) || null;
}

export function isRoomHost(room) {
  return !!room && room.hostId === auth.currentUser?.uid;
}
