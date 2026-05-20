import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { makeRoomCode, gamePlayerName } from '../common.js';

export async function createLiarRoom({ title, category, maxPlayers, liarCount }) {
  const room = {
    game: 'liar',
    status: 'waiting',
    title: title || '라이어게임',
    category: category || 'food',
    maxPlayers: Number(maxPlayers || 6),
    liarCount: Number(liarCount || 1),
    code: makeRoomCode(),
    hostId: auth.currentUser.uid,
    hostName: gamePlayerName('방장'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'game_rooms'), room);
  await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), makeLiarPlayer('host'));
  return ref.id;
}

export function makeLiarPlayer(role = 'player') {
  return {
    uid: auth.currentUser.uid,
    name: gamePlayerName(),
    role,
    joinedAt: serverTimestamp(),
  };
}

export async function joinLiarRoom(room) {
  const playerRole = auth.currentUser.uid === room.hostId ? 'host' : 'player';
  await setDoc(doc(db, 'game_rooms', room.id, 'players', auth.currentUser.uid), makeLiarPlayer(playerRole), { merge: true });
}
