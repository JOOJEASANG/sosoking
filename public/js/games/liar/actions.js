import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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

export async function startLiarGame(room, players) {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.');
  const uid = auth.currentUser.uid;
  if (room.hostId !== uid) throw new Error('호스트만 게임을 시작할 수 있습니다.');
  if (players.length < 3) throw new Error('라이어게임은 최소 3명이 필요합니다.');

  // 라이어 1명 무작위 선택
  const liarIdx = Math.floor(Math.random() * players.length);
  const liarUid = players[liarIdx].uid;

  // 주제/단어 풀 (간단한 내장 목록으로 구현)
  const topics = [
    { topic: '음식', word: '피자' },
    { topic: '음식', word: '라면' },
    { topic: '동물', word: '고양이' },
    { topic: '동물', word: '강아지' },
    { topic: '장소', word: '도서관' },
    { topic: '장소', word: '놀이공원' },
    { topic: '직업', word: '소방관' },
    { topic: '직업', word: '요리사' },
    { topic: '스포츠', word: '축구' },
    { topic: '스포츠', word: '수영' },
  ];
  const picked = topics[Math.floor(Math.random() * topics.length)];

  const roomRef = doc(db, 'liarRooms', room.id);
  await updateDoc(roomRef, {
    status: 'playing',
    phase: 'describe',
    liarUid,
    topic: picked.topic,
    word: picked.word,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}