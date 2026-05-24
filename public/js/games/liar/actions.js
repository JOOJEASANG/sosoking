import { auth, db, functions } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { makeRoomCode, gamePlayerName, shuffle } from '../common.js';

const WORD_POOLS = {
  food: [
    { topic: '음식', word: '피자' }, { topic: '음식', word: '라면' }, { topic: '음식', word: '김밥' },
    { topic: '음식', word: '치킨' }, { topic: '음식', word: '떡볶이' }, { topic: '음식', word: '아이스크림' },
    { topic: '음식', word: '삼겹살' }, { topic: '음식', word: '파스타' }, { topic: '음식', word: '초밥' },
    { topic: '음식', word: '돈가스' }, { topic: '음식', word: '짜장면' }, { topic: '음식', word: '보쌈' },
  ],
  place: [
    { topic: '장소', word: '도서관' }, { topic: '장소', word: '놀이공원' }, { topic: '장소', word: '편의점' },
    { topic: '장소', word: '카페' }, { topic: '장소', word: '영화관' }, { topic: '장소', word: '학교' },
    { topic: '장소', word: '헬스장' }, { topic: '장소', word: '공항' }, { topic: '장소', word: '병원' },
    { topic: '장소', word: '수영장' }, { topic: '장소', word: '미용실' }, { topic: '장소', word: '노래방' },
  ],
  thing: [
    { topic: '물건', word: '우산' }, { topic: '물건', word: '휴대폰' }, { topic: '물건', word: '이어폰' },
    { topic: '물건', word: '가방' }, { topic: '물건', word: '시계' }, { topic: '물건', word: '안경' },
    { topic: '물건', word: '충전기' }, { topic: '물건', word: '노트북' }, { topic: '물건', word: '에어컨' },
    { topic: '물건', word: '청소기' }, { topic: '물건', word: '커피머신' }, { topic: '물건', word: '자전거' },
  ],
  animal: [
    { topic: '동물', word: '고양이' }, { topic: '동물', word: '강아지' }, { topic: '동물', word: '토끼' },
    { topic: '동물', word: '펭귄' }, { topic: '동물', word: '호랑이' }, { topic: '동물', word: '돌고래' },
    { topic: '동물', word: '앵무새' }, { topic: '동물', word: '판다' }, { topic: '동물', word: '코알라' },
    { topic: '동물', word: '곰' }, { topic: '동물', word: '여우' }, { topic: '동물', word: '오리' },
  ],
  job: [
    { topic: '직업', word: '의사' }, { topic: '직업', word: '선생님' }, { topic: '직업', word: '경찰관' },
    { topic: '직업', word: '요리사' }, { topic: '직업', word: '소방관' }, { topic: '직업', word: '배우' },
    { topic: '직업', word: '과학자' }, { topic: '직업', word: '변호사' }, { topic: '직업', word: '유튜버' },
  ],
};

function pickTopic(category) {
  const all = Object.values(WORD_POOLS).flat();
  const pool = category === 'random' ? all : (WORD_POOLS[category] || all);
  return pool[Math.floor(Math.random() * pool.length)] || all[0];
}

export async function createLiarRoom({ title, category, maxPlayers, liarCount, withAI, difficulty }) {
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
    withAI: !!withAI,
    aiDifficulty: difficulty || 'normal',
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

  let allPlayers = [...players];

  // AI 플레이어 추가 (설정된 경우)
  if (room.withAI && !room.aiPlayerUid) {
    try {
      const addAi = httpsCallable(functions, 'addAiGamePlayer');
      const result = await addAi({ roomId: room.id, difficulty: room.aiDifficulty || 'normal' });
      if (result.data?.ok) {
        allPlayers = [...players, {
          uid: result.data.aiUid,
          name: result.data.aiName,
          role: 'player',
          isAI: true,
        }];
      }
    } catch (e) {
      console.warn('[liar] AI add failed', e.message);
    }
  }

  const liarCount = Math.max(1, Math.min(Number(room.liarCount || 1), allPlayers.length - 1));
  const picked = pickTopic(room.category);

  // AI가 있으면 항상 AI가 라이어
  let liarUids;
  const aiPlayer = allPlayers.find(p => p.isAI || (room.aiPlayerUid && p.uid === room.aiPlayerUid));
  if (aiPlayer) {
    liarUids = new Set([aiPlayer.uid]);
    const humanPlayers = allPlayers.filter(p => p.uid !== aiPlayer.uid);
    shuffle(humanPlayers).slice(0, Math.max(0, liarCount - 1)).forEach(p => liarUids.add(p.uid));
  } else {
    liarUids = new Set(shuffle(allPlayers).slice(0, liarCount).map(p => p.uid));
  }

  await Promise.all(allPlayers.map(p => setDoc(doc(db, 'game_rooms', room.id, 'players', p.uid), {
    assignedRole: liarUids.has(p.uid) ? 'liar' : 'citizen',
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
    log: '제시어를 확인하고 채팅으로 설명하세요. 어색한 사람을 찾아 라이어를 잡아내세요!',
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
