import { auth, db, functions } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { makeRoomCode, gamePlayerName, shuffle } from '../common.js';

// ─── 단어 페어 풀 ────────────────────────────────────────────────────────────
const WORD_PAIRS = {
  food: [
    { citizen: '피자', ai: '햄버거' },
    { citizen: '라면', ai: '우동' },
    { citizen: '치킨', ai: '삼겹살' },
    { citizen: '아이스크림', ai: '젤라토' },
    { citizen: '떡볶이', ai: '순대' },
    { citizen: '초밥', ai: '회' },
    { citizen: '파스타', ai: '스파게티' },
    { citizen: '커피', ai: '녹차' },
    { citizen: '케이크', ai: '마카롱' },
    { citizen: '삼겹살', ai: '목살' },
  ],
  place: [
    { citizen: '카페', ai: '베이커리' },
    { citizen: '영화관', ai: '공연장' },
    { citizen: '공원', ai: '광장' },
    { citizen: '도서관', ai: '서점' },
    { citizen: '헬스장', ai: '수영장' },
    { citizen: '편의점', ai: '마트' },
    { citizen: '학교', ai: '학원' },
    { citizen: '병원', ai: '약국' },
    { citizen: '공항', ai: '기차역' },
    { citizen: '노래방', ai: 'PC방' },
  ],
  thing: [
    { citizen: '스마트폰', ai: '태블릿' },
    { citizen: '이어폰', ai: '헤드폰' },
    { citizen: '충전기', ai: '보조배터리' },
    { citizen: '노트북', ai: '데스크탑' },
    { citizen: '우산', ai: '비옷' },
    { citizen: '안경', ai: '렌즈' },
    { citizen: '시계', ai: '스마트워치' },
    { citizen: '지갑', ai: '카드케이스' },
    { citizen: '가방', ai: '백팩' },
    { citizen: '에어컨', ai: '선풍기' },
  ],
  animal: [
    { citizen: '고양이', ai: '강아지' },
    { citizen: '토끼', ai: '햄스터' },
    { citizen: '펭귄', ai: '북극곰' },
    { citizen: '돌고래', ai: '고래' },
    { citizen: '앵무새', ai: '까마귀' },
    { citizen: '호랑이', ai: '사자' },
    { citizen: '판다', ai: '코알라' },
    { citizen: '여우', ai: '늑대' },
    { citizen: '말', ai: '당나귀' },
    { citizen: '닭', ai: '오리' },
  ],
  job: [
    { citizen: '의사', ai: '간호사' },
    { citizen: '선생님', ai: '교수' },
    { citizen: '경찰관', ai: '소방관' },
    { citizen: '요리사', ai: '제빵사' },
    { citizen: '배우', ai: '가수' },
    { citizen: '변호사', ai: '판사' },
    { citizen: '기자', ai: '아나운서' },
    { citizen: '작가', ai: '시인' },
    { citizen: '건축가', ai: '인테리어 디자이너' },
    { citizen: '유튜버', ai: '스트리머' },
  ],
};

function pickWordPair(category) {
  const all = Object.values(WORD_PAIRS).flat();
  const pool = category === 'random' ? all : (WORD_PAIRS[category] || all);
  return pool[Math.floor(Math.random() * pool.length)] || all[0];
}

function nowPlusSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000);
}

// ─── 방 생성 ─────────────────────────────────────────────────────────────────
export async function createSpyRoom({ title, category, maxPlayers, difficulty }) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  const uid = auth.currentUser.uid;

  const room = {
    game: 'soso-spy',
    status: 'waiting',
    title: title || '소소스파이',
    category: category || 'food',
    maxPlayers: Number(maxPlayers || 6),
    difficulty: difficulty || 'normal',
    round: 0,
    totalRounds: 3,
    eliminated: [],
    winner: null,
    hostId: uid,
    hostName: gamePlayerName('방장'),
    code: makeRoomCode(),
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'game_rooms'), room);

  await setDoc(doc(db, 'game_rooms', ref.id, 'players', uid), {
    uid,
    name: gamePlayerName('방장'),
    alive: true,
    isAI: false,
    score: 0,
    joinedAt: serverTimestamp(),
  });

  return ref.id;
}

// ─── 방 참가 ─────────────────────────────────────────────────────────────────
export async function joinSpyRoom(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  const uid = auth.currentUser.uid;

  await setDoc(doc(db, 'game_rooms', roomId, 'players', uid), {
    uid,
    name: gamePlayerName(),
    alive: true,
    isAI: false,
    score: 0,
    joinedAt: serverTimestamp(),
  }, { merge: true });
}

// ─── 게임 시작 ───────────────────────────────────────────────────────────────
export async function startSpyGame(roomId) {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.');

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('방을 찾을 수 없습니다.');

  const room = { id: roomSnap.id, ...roomSnap.data() };
  if (room.hostId !== auth.currentUser.uid) throw new Error('방장만 게임을 시작할 수 있습니다.');

  const pair = pickWordPair(room.category);

  await updateDoc(roomRef, {
    status: 'hint',
    round: 1,
    keyword: pair.citizen,
    aiKeyword: pair.ai,
    hintsRevealed: false,
    timerEnd: nowPlusSeconds(35),
  });

  try {
    const generateHint = httpsCallable(functions, 'generateSpyHint');
    await generateHint({ roomId, round: 1, keyword: pair.ai, difficulty: room.difficulty || 'normal' });
  } catch (e) {
    console.warn('[soso-spy] generateSpyHint 호출 실패:', e.message);
  }
}

// ─── 힌트 제출 ───────────────────────────────────────────────────────────────
export async function submitSpyHint(roomId, text) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  await setDoc(doc(db, 'game_rooms', roomId, 'hints', auth.currentUser.uid), {
    text: String(text || '').slice(0, 40),
    submittedAt: serverTimestamp(),
  });
}

// ─── 토론 단계로 이동 ─────────────────────────────────────────────────────────
export async function advanceToDiscussion(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  await updateDoc(doc(db, 'game_rooms', roomId), {
    status: 'discussion',
    hintsRevealed: true,
    timerEnd: nowPlusSeconds(95),
  });
}

// ─── 투표 단계로 이동 ─────────────────────────────────────────────────────────
export async function advanceToVote(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  await updateDoc(doc(db, 'game_rooms', roomId), {
    status: 'vote',
    timerEnd: nowPlusSeconds(35),
  });

  try {
    const triggerVote = httpsCallable(functions, 'triggerSpyVote');
    await triggerVote({ roomId });
  } catch (e) {
    console.warn('[soso-spy] triggerSpyVote 호출 실패:', e.message);
  }
}

// ─── 투표 제출 ───────────────────────────────────────────────────────────────
export async function submitSpyVote(roomId, targetUid) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  await setDoc(doc(db, 'game_rooms', roomId, 'votes', auth.currentUser.uid), {
    targetUid,
    votedAt: serverTimestamp(),
  });
}

// ─── 투표 집계 및 결과 처리 ──────────────────────────────────────────────────
export async function resolveVote(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('방을 찾을 수 없습니다.');

  const room = roomSnap.data();

  // votes 컬렉션 집계
  const { getDocs, collection: col } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const votesSnap = await getDocs(col(db, 'game_rooms', roomId, 'votes'));

  const tally = {};
  votesSnap.forEach(voteDoc => {
    const { targetUid } = voteDoc.data();
    if (targetUid) {
      tally[targetUid] = (tally[targetUid] || 0) + 1;
    }
  });

  if (Object.keys(tally).length === 0) {
    // 투표 없음 → 무효
    await updateDoc(roomRef, {
      status: 'reveal',
      revealedUid: null,
      wasAI: false,
    });
    return;
  }

  const maxVotes = Math.max(...Object.values(tally));
  const topVoted = Object.keys(tally).filter(uid => tally[uid] === maxVotes);

  // 동점 → 무효 처리
  if (topVoted.length > 1) {
    await updateDoc(roomRef, {
      status: 'reveal',
      revealedUid: null,
      wasAI: false,
      voteTied: true,
    });
    return;
  }

  const eliminatedUid = topVoted[0];
  const wasAI = eliminatedUid === room.aiPlayerUid;

  // eliminated 배열에 추가
  const eliminated = Array.isArray(room.eliminated) ? [...room.eliminated, eliminatedUid] : [eliminatedUid];

  // 승자 판정
  let winner = null;
  if (wasAI) {
    winner = 'citizens';
  } else {
    // 살아있는 시민 수 확인 (eliminated 되지 않은 시민)
    const playersSnap = await getDocs(col(db, 'game_rooms', roomId, 'players'));
    let aliveCitizens = 0;
    playersSnap.forEach(pDoc => {
      const p = pDoc.data();
      if (!p.isAI && !eliminated.includes(p.uid)) {
        aliveCitizens++;
      }
    });
    if (aliveCitizens <= 2) {
      winner = 'ai';
    }
  }

  await updateDoc(roomRef, {
    status: 'reveal',
    eliminated,
    revealedUid: eliminatedUid,
    wasAI,
    winner,
    voteTied: false,
  });
}

// ─── 다음 라운드 진행 ─────────────────────────────────────────────────────────
export async function advanceRound(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('방을 찾을 수 없습니다.');

  const room = roomSnap.data();

  if (room.winner) {
    await updateDoc(roomRef, { status: 'done' });
    return;
  }

  const nextRound = (room.round || 1) + 1;
  const pair = pickWordPair(room.category);

  await updateDoc(roomRef, {
    status: 'hint',
    round: nextRound,
    keyword: pair.citizen,
    aiKeyword: pair.ai,
    hintsRevealed: false,
    timerEnd: nowPlusSeconds(35),
  });

  try {
    const generateHint = httpsCallable(functions, 'generateSpyHint');
    await generateHint({ roomId, round: nextRound, keyword: pair.ai, difficulty: room.difficulty || 'normal' });
  } catch (e) {
    console.warn('[soso-spy] generateSpyHint 재호출 실패:', e.message);
  }
}

// ─── AI 플레이어 추가 ─────────────────────────────────────────────────────────
export async function addSpyAiToRoom(roomId, difficulty) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');

  const addAi = httpsCallable(functions, 'addSpyAiPlayer');
  const result = await addAi({ roomId, difficulty: difficulty || 'normal' });
  return result.data;
}
