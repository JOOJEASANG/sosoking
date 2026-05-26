import { auth, db, functions } from '../../firebase.js';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, getDoc, getDocs, arrayUnion, arrayRemove, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { makeRoomCode, gamePlayerName } from '../common.js';

export const CARD_TYPES = ['금', '은', '식량', '목재', '철', '보석'];
export const CARD_EMOJI = { 금: '💰', 은: '🥈', 식량: '🌾', 목재: '🪵', 철: '⚙️', 보석: '💎' };
const CARD_COUNTS = { 금: 4, 은: 6, 식량: 10, 목재: 10, 철: 6, 보석: 4 };

export function calcSetPoints(count) {
  if (count >= 5) return 6;
  if (count === 4) return 3;
  if (count === 3) return 1;
  return 0;
}

export function countCards(hand) {
  const counts = {};
  (hand || []).forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  return counts;
}

// ── 덱 생성 & 셔플 ────────────────────────────────────────────────────────────
function buildShuffledDeck() {
  const deck = [];
  for (const [type, count] of Object.entries(CARD_COUNTS)) {
    for (let i = 0; i < count; i++) deck.push(type);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ── 방 생성 ───────────────────────────────────────────────────────────────────
export async function createDealRoom({ title, maxPlayers, difficulty }) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const ref = await addDoc(collection(db, 'game_rooms'), {
    game: 'soso-deal',
    status: 'waiting',
    title: title || '소소딜',
    maxPlayers: Number(maxPlayers || 4),
    difficulty: difficulty || 'normal',
    round: 0,
    maxRounds: 6,
    market: [],
    deck: [],
    currentTurnUid: null,
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
    isAI: false,
    score: 0,
    hand: [],
    setsCompleted: [],
    joinedAt: serverTimestamp(),
  });

  return ref.id;
}

// ── 방 참가 ───────────────────────────────────────────────────────────────────
export async function joinDealRoom(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;
  await setDoc(doc(db, 'game_rooms', roomId, 'players', uid), {
    uid,
    name: gamePlayerName(),
    isAI: false,
    score: 0,
    hand: [],
    setsCompleted: [],
    joinedAt: serverTimestamp(),
  }, { merge: true });
}

// ── 게임 시작 ─────────────────────────────────────────────────────────────────
export async function startDealGame(roomId) {
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

  let deck = buildShuffledDeck();

  // 각 플레이어에게 5장 배분
  const updates = [];
  const turnOrder = [];
  for (const p of players) {
    const hand = deck.splice(0, 5);
    updates.push(updateDoc(doc(db, 'game_rooms', roomId, 'players', p.uid), {
      hand, score: 0, setsCompleted: [],
    }));
    turnOrder.push(p.uid);
  }
  await Promise.all(updates);

  // 시장 3장
  const market = deck.splice(0, 3);
  const firstTurnUid = turnOrder[0];

  await updateDoc(roomRef, {
    status: 'playing',
    round: 1,
    deck,
    market,
    turnOrder,
    currentTurnUid: firstTurnUid,
    timerEnd: new Date(Date.now() + 55 * 1000),
  });
}

// ── 시장 교환 ─────────────────────────────────────────────────────────────────
export async function marketSwap(roomId, offerCard, takeCard) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurnUid !== uid) throw new Error('내 차례가 아닙니다');

  const market = room.market || [];
  if (!market.includes(takeCard)) throw new Error('시장에 없는 카드입니다');

  const playerRef = doc(db, 'game_rooms', roomId, 'players', uid);
  const playerSnap = await getDoc(playerRef);
  const hand = playerSnap.data()?.hand || [];
  if (!hand.includes(offerCard)) throw new Error('내 손에 없는 카드입니다');

  const newHand = [...hand];
  newHand.splice(newHand.indexOf(offerCard), 1);
  newHand.push(takeCard);

  const newMarket = market.map(c => c === takeCard ? offerCard : c);

  await Promise.all([
    updateDoc(playerRef, { hand: newHand }),
    updateDoc(roomRef, { market: newMarket }),
    addDoc(collection(db, 'game_rooms', roomId, 'actions'), {
      type: 'market_swap',
      actorId: uid,
      actorName: gamePlayerName(),
      offer: offerCard,
      take: takeCard,
      round: room.round || 1,
      createdAt: serverTimestamp(),
    }),
  ]);
}

// ── 덱에서 드로우 ─────────────────────────────────────────────────────────────
export async function drawCard(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurnUid !== uid) throw new Error('내 차례가 아닙니다');

  const deck = [...(room.deck || [])];
  if (deck.length === 0) throw new Error('덱이 비었습니다');

  const drawn = deck.pop();
  const playerRef = doc(db, 'game_rooms', roomId, 'players', uid);
  const playerSnap = await getDoc(playerRef);
  const hand = playerSnap.data()?.hand || [];
  if (hand.length >= 8) throw new Error('손패가 가득 찼습니다 (최대 8장)');

  await Promise.all([
    updateDoc(playerRef, { hand: [...hand, drawn] }),
    updateDoc(roomRef, { deck }),
    addDoc(collection(db, 'game_rooms', roomId, 'actions'), {
      type: 'draw',
      actorId: uid,
      actorName: gamePlayerName(),
      card: drawn,
      round: room.round || 1,
      createdAt: serverTimestamp(),
    }),
  ]);
}

// ── 세트 제출 ─────────────────────────────────────────────────────────────────
export async function cashInSet(roomId, cardType, count) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;
  if (count < 3) throw new Error('최소 3장이 필요합니다');

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurnUid !== uid) throw new Error('내 차례가 아닙니다');

  const playerRef = doc(db, 'game_rooms', roomId, 'players', uid);
  const playerSnap = await getDoc(playerRef);
  const hand = playerSnap.data()?.hand || [];

  const available = hand.filter(c => c === cardType).length;
  if (available < count) throw new Error(`${cardType} 카드가 부족합니다`);

  const submitCount = Math.min(count, 5);
  const points = calcSetPoints(submitCount);
  const newHand = [...hand];
  let removed = 0;
  for (let i = newHand.length - 1; i >= 0 && removed < submitCount; i--) {
    if (newHand[i] === cardType) { newHand.splice(i, 1); removed++; }
  }

  await Promise.all([
    updateDoc(playerRef, {
      hand: newHand,
      score: increment(points),
      setsCompleted: arrayUnion({ type: cardType, count: submitCount, points }),
    }),
    addDoc(collection(db, 'game_rooms', roomId, 'actions'), {
      type: 'cash_in',
      actorId: uid,
      actorName: gamePlayerName(),
      cardType,
      count: submitCount,
      points,
      round: room.round || 1,
      createdAt: serverTimestamp(),
    }),
  ]);
}

// ── 거래 제안 ─────────────────────────────────────────────────────────────────
export async function proposeTrade(roomId, toUid, toName, offerCards, requestCards) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const roomSnap = await getDoc(doc(db, 'game_rooms', roomId));
  const room = roomSnap.data();
  if (room.currentTurnUid !== uid) throw new Error('내 차례에만 제안할 수 있습니다');

  await addDoc(collection(db, 'game_rooms', roomId, 'proposals'), {
    fromUid: uid,
    fromName: gamePlayerName(),
    toUid,
    toName,
    offerCards,
    requestCards,
    status: 'pending',
    round: room.round || 1,
    createdAt: serverTimestamp(),
  });
}

// ── 거래 수락 ─────────────────────────────────────────────────────────────────
export async function acceptTrade(roomId, proposalId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const proposalRef = doc(db, 'game_rooms', roomId, 'proposals', proposalId);
  const proposalSnap = await getDoc(proposalRef);
  if (!proposalSnap.exists()) throw new Error('제안을 찾을 수 없습니다');
  const p = proposalSnap.data();

  if (p.toUid !== uid) throw new Error('나에게 온 제안이 아닙니다');
  if (p.status !== 'pending') throw new Error('이미 처리된 제안입니다');

  const fromRef = doc(db, 'game_rooms', roomId, 'players', p.fromUid);
  const toRef = doc(db, 'game_rooms', roomId, 'players', uid);
  const [fromSnap, toSnap] = await Promise.all([getDoc(fromRef), getDoc(toRef)]);

  const fromHand = [...(fromSnap.data()?.hand || [])];
  const toHand = [...(toSnap.data()?.hand || [])];

  // 상대 손패에서 offer 제거, request 추가
  for (const card of p.offerCards) {
    const idx = fromHand.indexOf(card);
    if (idx === -1) throw new Error('제안자 손패에 카드가 없습니다');
    fromHand.splice(idx, 1);
  }
  for (const card of p.requestCards) fromHand.push(card);

  // 내 손패에서 request 제거, offer 추가
  for (const card of p.requestCards) {
    const idx = toHand.indexOf(card);
    if (idx === -1) throw new Error('내 손패에 카드가 없습니다');
    toHand.splice(idx, 1);
  }
  for (const card of p.offerCards) toHand.push(card);

  const roomSnap = await getDoc(doc(db, 'game_rooms', roomId));
  const room = roomSnap.data();

  await Promise.all([
    updateDoc(fromRef, { hand: fromHand }),
    updateDoc(toRef, { hand: toHand }),
    updateDoc(proposalRef, { status: 'accepted' }),
    addDoc(collection(db, 'game_rooms', roomId, 'actions'), {
      type: 'trade',
      actorId: p.fromUid, actorName: p.fromName,
      targetId: uid, targetName: p.toName,
      offerCards: p.offerCards, requestCards: p.requestCards,
      round: room?.round || 1,
      createdAt: serverTimestamp(),
    }),
  ]);
}

// ── 거래 거절 ─────────────────────────────────────────────────────────────────
export async function rejectTrade(roomId, proposalId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  await updateDoc(doc(db, 'game_rooms', roomId, 'proposals', proposalId), { status: 'rejected' });
}

// ── 턴 종료 ───────────────────────────────────────────────────────────────────
export async function endDealTurn(roomId) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const uid = auth.currentUser.uid;

  const roomRef = doc(db, 'game_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurnUid !== uid) throw new Error('내 차례가 아닙니다');

  const turnOrder = room.turnOrder || [];
  const currentIdx = turnOrder.indexOf(uid);
  const nextIdx = (currentIdx + 1) % turnOrder.length;
  const isNewRound = nextIdx <= currentIdx;
  const newRound = isNewRound ? (room.round || 1) + 1 : (room.round || 1);

  if (newRound > (room.maxRounds || 6)) {
    // 게임 종료 처리
    const playersSnap = await getDocs(collection(db, 'game_rooms', roomId, 'players'));
    const humans = playersSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(p => !p.isAI);
    humans.sort((a, b) => (b.score || 0) - (a.score || 0));
    await updateDoc(roomRef, { status: 'done', winner: humans[0]?.uid || null });
    return;
  }

  // 미해결 제안들 만료 처리
  const pendingSnap = await getDocs(
    collection(db, 'game_rooms', roomId, 'proposals')
  );
  const expireUpdates = pendingSnap.docs
    .filter(d => d.data().status === 'pending')
    .map(d => updateDoc(d.ref, { status: 'expired' }));
  await Promise.all(expireUpdates);

  await updateDoc(roomRef, {
    currentTurnUid: turnOrder[nextIdx],
    round: newRound,
    timerEnd: new Date(Date.now() + 55 * 1000),
  });
}

// ── AI 플레이어 추가 ──────────────────────────────────────────────────────────
export async function addDealAiToRoom(roomId, difficulty) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요');
  const fn = httpsCallable(functions, 'addDealAiPlayer');
  const result = await fn({ roomId, difficulty: difficulty || 'normal' });
  return result.data;
}

// ── AI 턴 실행 트리거 ─────────────────────────────────────────────────────────
export async function triggerAiDealTurn(roomId) {
  try {
    const fn = httpsCallable(functions, 'takeDealAiTurn');
    await fn({ roomId });
  } catch (e) {
    console.warn('[soso-deal] takeDealAiTurn 실패:', e.message);
  }
}
