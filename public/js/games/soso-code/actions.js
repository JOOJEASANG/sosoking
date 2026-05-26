import { auth, db, functions } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { makeRoomCode, gamePlayerName } from '../common.js';

// ── 코드 생성 ─────────────────────────────────────────────────────────────────
export function generateRandomCode(length = 4) {
  return Array.from({ length }, () => Math.floor(Math.random() * 6) + 1);
}

// ── Hit/Blow 계산 ─────────────────────────────────────────────────────────────
export function calcHitBlow(secret, guess) {
  let hits = 0;
  let blows = 0;
  const secretCopy = [...secret];
  const guessCopy = [...guess];

  for (let i = 0; i < 4; i++) {
    if (secret[i] === guess[i]) { hits++; secretCopy[i] = null; guessCopy[i] = null; }
  }
  for (let i = 0; i < 4; i++) {
    if (guessCopy[i] === null) continue;
    const j = secretCopy.indexOf(guessCopy[i]);
    if (j !== -1) { blows++; secretCopy[j] = null; }
  }
  return { hits, blows };
}

// ── 방 생성 ───────────────────────────────────────────────────────────────────
export async function createCodeRoom({ title, maxPlayers, difficulty }) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const ref = await addDoc(collection(db, 'game_rooms'), {
    game: 'soso-code',
    status: 'waiting',
    title: title || '소소코드',
    maxPlayers: Number(maxPlayers || 4),
    difficulty: difficulty || 'normal',
    round: 0,
    maxRounds: 8,
    currentTurnIdx: 0,
    turnOrder: [],
    winner: null,
    hostId: uid,
    hostName: gamePlayerName('방장'),
    code: makeRoomCode(),
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'game_rooms', ref.id, 'players', uid), {
    uid,
    name: gamePlayerName('방장'),
    alive: true,
    isAI: false,
    isHacker: false,
    score: 0,
    codeDigits: [],
    revealedPositions: [false, false, false, false],
    joinedAt: serverTimestamp(),
  });

  return ref.id;
}

// ── 방 참가 ───────────────────────────────────────────────────────────────────
export async function joinCodeRoom(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  await setDoc(doc(db, 'game_rooms', roomId, 'players', uid), {
    uid,
    name: gamePlayerName(),
    alive: true,
    isAI: false,
    isHacker: false,
    score: 0,
    codeDigits: [],
    revealedPositions: [false, false, false, false],
    joinedAt: serverTimestamp(),
  }, { merge: true });
}

// ── 게임 시작 ─────────────────────────────────────────────────────────────────
export async function startCodeGame(roomId) {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다');

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('방을 찾을 수 없습니다');

  const room = roomSnap.data();
  if (room.hostId !== auth.currentUser.uid) throw new Error('방장만 게임을 시작할 수 있습니다');

  const playersSnap = await getDocs(collection(db, 'game_rooms', roomId, 'players'));
  const players = playersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const humans = players.filter(p => !p.isAI);

  if (humans.length < 2) throw new Error('최소 2명이 필요합니다');

  // 각 플레이어에게 랜덤 코드 배정
  const batch = [];
  const turnOrder = [];

  for (const p of players) {
    if (p.isAI) continue;
    const codeDigits = generateRandomCode();
    batch.push(updateDoc(doc(db, 'game_rooms', roomId, 'players', p.uid), {
      codeDigits,
      revealedPositions: [false, false, false, false],
      alive: true,
      score: 0,
    }));
    turnOrder.push(p.uid);
  }

  await Promise.all(batch);

  await updateDoc(roomRef, {
    status: 'playing',
    round: 1,
    currentTurnIdx: 0,
    turnOrder,
    winner: null,
  });
}

// ── 질문 제출 ─────────────────────────────────────────────────────────────────
export async function submitCodeQuestion(roomId, targetUid, guess) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  // 대상 코드 읽기 (클라이언트 계산 - 파티 게임 honor system)
  const targetSnap = await getDoc(doc(db, 'game_rooms', roomId, 'players', targetUid));
  if (!targetSnap.exists()) throw new Error('대상 플레이어를 찾을 수 없습니다');
  const targetData = targetSnap.data();
  const secret = targetData.codeDigits || [];

  const { hits, blows } = calcHitBlow(secret, guess);

  const roomSnap = await getDoc(doc(db, 'game_rooms', roomId));
  const room = roomSnap.data();

  await addDoc(collection(db, 'game_rooms', roomId, 'actions'), {
    type: 'question',
    actorId: uid,
    actorName: gamePlayerName(),
    targetId: targetUid,
    targetName: targetData.name || '?',
    guess,
    hits,
    blows,
    round: room?.round || 1,
    createdAt: serverTimestamp(),
  });

  // 턴 진행
  await advanceCodeTurn(roomId);
}

// ── 최종 추측 제출 ────────────────────────────────────────────────────────────
export async function submitCodeFinalGuess(roomId, targetUid, guess) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const targetSnap = await getDoc(doc(db, 'game_rooms', roomId, 'players', targetUid));
  if (!targetSnap.exists()) throw new Error('대상 플레이어를 찾을 수 없습니다');
  const targetData = targetSnap.data();
  const secret = targetData.codeDigits || [];

  const correct = secret.every((d, i) => d === guess[i]);

  const roomSnap = await getDoc(doc(db, 'game_rooms', roomId));
  const room = roomSnap.data();

  const actionDoc = {
    type: 'final_guess',
    actorId: uid,
    actorName: gamePlayerName(),
    targetId: targetUid,
    targetName: targetData.name || '?',
    guess,
    correct,
    round: room?.round || 1,
    createdAt: serverTimestamp(),
  };

  if (correct) {
    // 상대 탈락 처리
    actionDoc.revealedCode = secret;
    await addDoc(collection(db, 'game_rooms', roomId, 'actions'), actionDoc);

    await updateDoc(doc(db, 'game_rooms', roomId, 'players', targetUid), {
      alive: false,
      eliminatedBy: uid,
      revealedPositions: [true, true, true, true],
    });
    await updateDoc(doc(db, 'game_rooms', roomId, 'players', uid), {
      score: (await getDoc(doc(db, 'game_rooms', roomId, 'players', uid))).data()?.score + 3 || 3,
    });

    await checkWinCondition(roomId);
  } else {
    // 내 코드 1자리 공개
    const mySnap = await getDoc(doc(db, 'game_rooms', roomId, 'players', uid));
    const myData = mySnap.data() || {};
    const revealed = [...(myData.revealedPositions || [false, false, false, false])];
    const hiddenPositions = revealed.map((r, i) => r ? null : i).filter(i => i !== null);
    const exposeIdx = hiddenPositions[Math.floor(Math.random() * hiddenPositions.length)];
    if (exposeIdx !== undefined) revealed[exposeIdx] = true;
    actionDoc.exposedPosition = exposeIdx;

    await addDoc(collection(db, 'game_rooms', roomId, 'actions'), actionDoc);
    await updateDoc(doc(db, 'game_rooms', roomId, 'players', uid), {
      revealedPositions: revealed,
      score: Math.max(0, (myData.score || 0) - 1),
    });

    // 4자리가 모두 공개되면 탈락
    if (revealed.every(Boolean)) {
      await updateDoc(doc(db, 'game_rooms', roomId, 'players', uid), { alive: false });
      await checkWinCondition(roomId);
    }
  }

  // 턴 진행
  await advanceCodeTurn(roomId);
}

// ── 턴 진행 ───────────────────────────────────────────────────────────────────
export async function advanceCodeTurn(roomId) {
  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;
  const room = roomSnap.data();
  if (room.status !== 'playing') return;

  const playersSnap = await getDocs(collection(db, 'game_rooms', roomId, 'players'));
  const alivePlayers = playersSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => !p.isAI && p.alive !== false);

  if (alivePlayers.length <= 1) return; // win condition already handled

  const turnOrder = room.turnOrder || [];
  const aliveUids = new Set(alivePlayers.map(p => p.uid));

  // 살아있는 플레이어 중 다음 턴 탐색
  let nextIdx = (room.currentTurnIdx || 0) + 1;
  let looped = 0;
  while (looped < turnOrder.length) {
    const uid = turnOrder[nextIdx % turnOrder.length];
    if (aliveUids.has(uid)) {
      break;
    }
    nextIdx++;
    looped++;
  }

  const isNewRound = nextIdx % turnOrder.length <= (room.currentTurnIdx || 0) % turnOrder.length;
  const newRound = isNewRound ? (room.round || 1) + 1 : room.round;

  // 최대 라운드 초과 → 게임 종료
  if (newRound > (room.maxRounds || 8)) {
    await endByMaxRounds(roomId);
    return;
  }

  await updateDoc(roomRef, {
    currentTurnIdx: nextIdx % turnOrder.length,
    round: newRound,
  });
}

// ── 라운드 종료 후 AI 인텔 트리거 (방장 클라이언트가 호출) ───────────────────
export async function triggerAiIntel(roomId) {
  try {
    const fn = httpsCallable(functions, 'generateCodeIntel');
    await fn({ roomId });
  } catch (e) {
    console.warn('[soso-code] generateCodeIntel 실패:', e.message);
  }
}

// ── AI 플레이어 추가 ──────────────────────────────────────────────────────────
export async function addCodeAiToRoom(roomId, difficulty) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const fn = httpsCallable(functions, 'addCodeAiPlayer');
  const result = await fn({ roomId, difficulty: difficulty || 'normal' });
  return result.data;
}

// ── 승리 조건 확인 ────────────────────────────────────────────────────────────
async function checkWinCondition(roomId) {
  const playersSnap = await getDocs(collection(db, 'game_rooms', roomId, 'players'));
  const humans = playersSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => !p.isAI);
  const alive = humans.filter(p => p.alive !== false);

  if (alive.length <= 1) {
    const winner = alive[0]?.uid || null;
    await updateDoc(doc(db, 'game_rooms', roomId), {
      status: 'done',
      winner,
    });
  }
}

// ── 최대 라운드 도달 시 종료 ─────────────────────────────────────────────────
async function endByMaxRounds(roomId) {
  const playersSnap = await getDocs(collection(db, 'game_rooms', roomId, 'players'));
  const humans = playersSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => !p.isAI && p.alive !== false);

  // 최고 점수 플레이어가 승리
  humans.sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = humans[0]?.uid || null;

  await updateDoc(doc(db, 'game_rooms', roomId), {
    status: 'done',
    winner,
    endReason: 'max_rounds',
  });
}
