import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { makeRoomCode, gamePlayerName, shuffle } from '../common.js';
import { sendGameChat } from '../chat.js';

const PRESETS = {
  daily: { topic: '일상 토크', words: ['근데', '진짜', '아니', '오늘', 'ㅋㅋ', '그냥', '대박', '몰라'] },
  food: { topic: '음식 토크', words: ['맛있다', '배고파', '치킨', '라면', '먹자', '매워', '달다', '냄새'] },
  love: { topic: '연애 토크', words: ['좋아', '사랑', '연락', '데이트', '썸', '고백', '질투', '헤어짐'] },
  random: { topic: '랜덤 토크', words: ['그냥', '몰라', '대박', '왜', '나', '너', '진짜', '아니'] },
};

function pickPreset(key) {
  return PRESETS[key] || PRESETS.daily;
}

export async function createWordtrapRoom({ title, preset, maxPlayers }) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  const picked = pickPreset(preset);
  const room = {
    game: 'wordtrap',
    status: 'waiting',
    phase: 'lobby',
    title: title || '금칙어 채팅게임',
    preset: preset || 'daily',
    topic: picked.topic,
    trapWords: picked.words,
    maxPlayers: Number(maxPlayers || 6),
    code: makeRoomCode(),
    hostId: auth.currentUser.uid,
    hostName: gamePlayerName('방장'),
    round: 0,
    log: '참가자를 모은 뒤 방장이 게임을 시작하세요. 금칙어는 시작할 때 랜덤으로 배정됩니다.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'game_rooms'), room);
  await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), makeWordtrapPlayer('host'));
  return ref.id;
}

export function makeWordtrapPlayer(role = 'player') {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  return {
    uid: auth.currentUser.uid,
    name: gamePlayerName(),
    role,
    alive: true,
    caughtCount: 0,
    joinedAt: serverTimestamp(),
  };
}

export async function joinWordtrapRoom(room, currentCount) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  if (currentCount >= Number(room.maxPlayers || 0)) throw new Error('방이 가득 찼어요');
  const playerRole = auth.currentUser.uid === room.hostId ? 'host' : 'player';
  await setDoc(doc(db, 'game_rooms', room.id, 'players', auth.currentUser.uid), makeWordtrapPlayer(playerRole), { merge: true });
}

export async function startWordtrapGame(room, players) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  if (room.hostId !== uid) throw new Error('방장만 게임을 시작할 수 있습니다.');
  if (players.length < 2) throw new Error('금칙어 게임은 2명 이상이면 시작할 수 있어요.');

  const preset = pickPreset(room.preset);
  const words = Array.isArray(room.trapWords) && room.trapWords.length ? room.trapWords : preset.words;
  const shuffledWords = shuffle(words);
  const shuffledPlayers = shuffle(players);

  await Promise.all(shuffledPlayers.map((player, index) => setDoc(doc(db, 'game_rooms', room.id, 'players', player.uid), {
    alive: true,
    caughtCount: 0,
    myTrapWord: shuffledWords[index % shuffledWords.length],
  }, { merge: true })));

  await updateDoc(doc(db, 'game_rooms', room.id), {
    status: 'playing',
    phase: 'talk',
    round: Number(room.round || 0) + 1,
    log: '금칙어가 랜덤으로 배정됐어요. 내 금칙어를 피하면서 자연스럽게 채팅하세요.',
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function resetWordtrapGame(room, players) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  if (room.hostId !== uid) throw new Error('방장만 이 작업을 수행할 수 있습니다.');
  await Promise.all(players.map(player => setDoc(doc(db, 'game_rooms', room.id, 'players', player.uid), {
    alive: true,
    caughtCount: 0,
    myTrapWord: '',
  }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', room.id), {
    status: 'waiting',
    phase: 'lobby',
    log: '새 게임을 준비합니다. 방장이 다시 시작할 수 있어요.',
    updatedAt: serverTimestamp(),
  });
}

export async function sendWordtrapChat(room, me, text) {
  const message = String(text || '').trim();
  if (!me) throw new Error('먼저 참가해주세요.');
  if (me.alive === false) throw new Error('걸린 참가자는 구경만 할 수 있어요.');
  await sendGameChat(room.id, message);

  const trap = String(me.myTrapWord || '').trim();
  if (room.status === 'playing' && trap && message.replace(/\s/g, '').includes(trap.replace(/\s/g, ''))) {
    await setDoc(doc(db, 'game_rooms', room.id, 'players', me.uid), {
      alive: false,
      caughtCount: Number(me.caughtCount || 0) + 1,
      caughtWord: trap,
      caughtAt: serverTimestamp(),
    }, { merge: true });
    await addDoc(collection(db, 'game_rooms', room.id, 'chats'), {
      uid: 'system',
      name: '게임알림',
      text: `${me.name}님이 금칙어 “${trap}”을 말해서 걸렸어요!`,
      type: 'system',
      createdAt: serverTimestamp(),
    });
  }
}
