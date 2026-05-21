import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { makeRoomCode, gamePlayerName, shuffle } from '../common.js';

const WORD_POOLS = {
  food: [
    { topic: '음식', word: '피자' }, { topic: '음식', word: '라면' }, { topic: '음식', word: '김밥' },
    { topic: '음식', word: '치킨' }, { topic: '음식', word: '떡볶이' }, { topic: '음식', word: '아이스크림' },
  ],
  place: [
    { topic: '장소', word: '도서관' }, { topic: '장소', word: '놀이공원' }, { topic: '장소', word: '편의점' },
    { topic: '장소', word: '카페' }, { topic: '장소', word: '영화관' }, { topic: '장소', word: '학교' },
  ],
  thing: [
    { topic: '물건', word: '우산' }, { topic: '물건', word: '휴대폰' }, { topic: '물건', word: '이어폰' },
    { topic: '물건', word: '가방' }, { topic: '물건', word: '시계' }, { topic: '물건', word: '안경' },
  ],
  animal: [
    { topic: '동물', word: '고양이' }, { topic: '동물', word: '강아지' }, { topic: '동물', word: '토끼' },
    { topic: '동물', word: '펭귄' }, { topic: '동물', word: '호랑이' }, { topic: '동물', word: '돌고래' },
  ],
};

function pickTopic(category) {
  const all = Object.values(WORD_POOLS).flat();
  const pool = category === 'random' ? all : (WORD_POOLS[category] || all);
  return pool[Math.floor(Math.random() * pool.length)] || all[0];
}

export async function createLiarRoom({ title, category, maxPlayers, liarCount }) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  const room = {
    game: 'liar',
    status: 'waiting',
    phase: 'lobby',
    title: title || '라이어게임',
    category: category || 'food',
    maxPlayers: Number(maxPlayers || 6),
    liarCount: Number(liarCount || 1),
    code: makeRoomCode(),
    hostId: auth.currentUser.uid,
    hostName: gamePlayerName('방장'),
    round: 0,
    log: '참가자를 모은 뒤 방장이 게임을 시작하세요.',
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
    assignedRole: '',
    wordSeen: false,
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
  if (room.hostId !== uid) throw new Error('방장만 게임을 시작할 수 있습니다.');
  if (players.length < 3) throw new Error('라이어게임은 최소 3명이 필요합니다.');

  const liarCount = Math.max(1, Math.min(Number(room.liarCount || 1), players.length - 1));
  const picked = pickTopic(room.category);
  const shuffled = shuffle(players);
  const liarUids = new Set(shuffled.slice(0, liarCount).map(player => player.uid));

  await Promise.all(players.map(player => setDoc(doc(db, 'game_rooms', room.id, 'players', player.uid), {
    assignedRole: liarUids.has(player.uid) ? 'liar' : 'citizen',
    wordSeen: false,
    votedFor: '',
  }, { merge: true })));

  await updateDoc(doc(db, 'game_rooms', room.id), {
    status: 'playing',
    phase: 'talk',
    round: Number(room.round || 0) + 1,
    liarUids: [...liarUids],
    topic: picked.topic,
    word: picked.word,
    log: '제시어를 확인한 뒤 채팅으로 자연스럽게 설명하고 질문하세요.',
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
