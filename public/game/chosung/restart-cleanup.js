import { auth, db, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

function roomCode() {
  return String(new URL(location.href).searchParams.get('room') || '').trim().toUpperCase();
}

async function cleanRestart(button) {
  const code = roomCode();
  if (!code) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = '새 게임 준비 중...';

  try {
    await initAuth();
    const uid = auth.currentUser?.uid || '';
    const roomRef = doc(db, 'game_rooms', code);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists() || roomSnap.data().hostUid !== uid) {
      throw new Error('host-required');
    }

    const [playersSnap, answersSnap] = await Promise.all([
      getDocs(collection(db, 'game_rooms', code, 'players')),
      getDocs(collection(db, 'game_rooms', code, 'answers'))
    ]);

    const batch = writeBatch(db);
    answersSnap.docs.forEach(answer => batch.delete(answer.ref));
    playersSnap.docs.forEach(player => batch.update(player.ref, {
      score: 0,
      updatedAt: Timestamp.now()
    }));
    batch.update(roomRef, {
      status: 'lobby',
      round: 0,
      roundState: 'waiting',
      target: '',
      usedTargets: [],
      roundMode: '',
      roundSeconds: 20,
      multiplier: 1,
      roundEndsAt: deleteField(),
      updatedAt: Timestamp.now()
    });
    await batch.commit();
  } catch (error) {
    console.error('clean restart failed', error);
    button.disabled = false;
    button.textContent = originalText;
    window.alert('새 게임을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}

document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('#restart-game') : null;
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void cleanRestart(button);
}, true);
