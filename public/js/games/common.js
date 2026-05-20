import { auth } from '../firebase.js';
import { appState } from '../state.js';

export function makeRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function buildGameInviteUrl(game, roomId) {
  return `${location.origin + location.pathname}#/game/${game}/${roomId}`;
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

export function gamePlayerName(fallback = '게스트') {
  return appState.nickname || auth.currentUser?.displayName || localStorage.getItem('sosoking_guest_nickname') || fallback;
}

export function findMyPlayer(players) {
  return players.find(p => p.uid === auth.currentUser?.uid) || null;
}

export function isRoomHost(room) {
  return !!room && room.hostId === auth.currentUser?.uid;
}
