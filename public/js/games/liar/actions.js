import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { makeRoomCode, gamePlayerName } from '../common.js';

export async function createLiarRoom({ title, category, maxPlayers, liarCount }) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

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

  try {
    await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), makeLiarPlayer('host'));
  } catch (error) {
    console.warn('[liar] host player create failed', error);
  }

  return ref.id;
}

export function makeLiarPlayer(role = 'player') {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  return {
    uid: auth.currentUser.uid,
    name: gamePlayerName(),
    role,
    joinedAt: serverTimestamp(),
  };
}

export async function joinLiarRoom(room) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  const playerRole = auth.currentUser.uid === room.hostId ? 'host' : 'player';
  await setDoc(doc(db, 'game_rooms', room.id, 'players', auth.currentUser.uid), makeLiarPlayer(playerRole), { merge: true });
}