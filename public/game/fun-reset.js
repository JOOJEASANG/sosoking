import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const GAME_IDS = {
  '/game/vault/': 'vault',
  '/game/caught/': 'caught',
  '/game/chosung/': 'chosung'
};
const gameId = Object.entries(GAME_IDS).find(([path]) => location.pathname.startsWith(path))?.[1] || '';
const roomId = String(new URL(location.href).searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
let unsubscribe = null;

function clearRoundPowers(uid) {
  if (!gameId || !roomId || !uid) return;
  const prefix = `sosoking-fun-power:${gameId}:${roomId}:${uid}:`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index) || '';
    if (key.startsWith(prefix)) localStorage.removeItem(key);
  }
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index) || '';
    if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  }
}

async function boot() {
  if (!gameId || !roomId) return;
  try {
    await initAuth();
    const uid = auth.currentUser?.uid || '';
    if (!uid) return;
    unsubscribe = onSnapshot(doc(db, 'game_rooms', roomId), snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.status === 'lobby') clearRoundPowers(uid);
    }, () => {});
  } catch {}
}

window.addEventListener('pagehide', () => unsubscribe?.(), { once: true });
void boot();
