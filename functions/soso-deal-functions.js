'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const CARD_TYPES = ['금', '은', '식량', '목재', '철', '보석'];
const CARD_COUNTS = { 금: 4, 은: 6, 식량: 10, 목재: 10, 철: 6, 보석: 4 };
const CARD_POINTS = { 3: 1, 4: 3, 5: 6 };

const AI_BROKER_NAMES = [
  '딜마스터', '거래왕', '흥정꾼', '중개인', '브로커킹',
  '협상귀', '거래신', '달인', '중개자', '딜러',
];

function randomBrokerName() {
  const base = AI_BROKER_NAMES[Math.floor(Math.random() * AI_BROKER_NAMES.length)];
  return `${base}${Math.floor(Math.random() * 900 + 100)}`;
}

function buildDeck() {
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

function calcSetPoints(count) {
  if (count >= 5) return CARD_POINTS[5] || 6;
  return CARD_POINTS[count] || 0;
}

async function getAiKey() {
  try {
    const snap = await db.doc('config/ai').get();
    const key = snap.data()?.apiKey;
    if (key && key.length > 10) return key.trim();
  } catch {}
  try { return geminiKey.value().trim(); } catch { return null; }
}

// ── 1. AI 브로커 추가 ────────────────────────────────────────────────────────
const addDealAiPlayer = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 15 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId, difficulty } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomRef = db.doc(`game_rooms/${roomId}`);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw new HttpsError('not-found', '방을 찾을 수 없어요');
  const room = roomSnap.data();

  if (room.hostId !== uid) throw new HttpsError('permission-denied', '방장만 AI를 추가할 수 있어요');
  if (room.aiPlayerUid) return { ok: true, aiUid: room.aiPlayerUid, aiName: room.aiPlayerName };

  const aiUid = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const aiName = randomBrokerName();

  await db.doc(`game_rooms/${roomId}/players/${aiUid}`).set({
    uid: aiUid,
    name: aiName,
    alive: true,
    isAI: true,
    score: 0,
    hand: [],
    setsCompleted: [],
    joinedAt: FieldValue.serverTimestamp(),
  });

  await roomRef.update({
    aiPlayerUid: aiUid,
    aiPlayerName: aiName,
    aiDifficulty: difficulty || 'normal',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, aiUid, aiName };
});

// ── 2. AI 브로커 턴 실행 ──────────────────────────────────────────────────────
const takeDealAiTurn = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 20 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomRef = db.doc(`game_rooms/${roomId}`);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) return { ok: false, reason: 'room_not_found' };
  const room = roomSnap.data();

  if (room.status !== 'playing') return { ok: false, reason: 'wrong_phase' };
  if (!room.aiPlayerUid) return { ok: false, reason: 'no_ai' };
  if (room.currentTurnUid !== room.aiPlayerUid) return { ok: false, reason: 'not_ai_turn' };

  const aiSnap = await db.doc(`game_rooms/${roomId}/players/${room.aiPlayerUid}`).get();
  if (!aiSnap.exists) return { ok: false };
  const ai = aiSnap.data();
  const hand = ai.hand || [];

  const difficulty = room.aiDifficulty || 'normal';
  const market = room.market || [];
  let actionDone = false;
  let comment = '';

  // 1. 세트 제출 가능 여부 확인 (3장 이상 같은 카드)
  const counts = {};
  hand.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  const bestSet = Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => calcSetPoints(b[1]) - calcSetPoints(a[1]))[0];

  if (bestSet) {
    const [type, count] = bestSet;
    const submitCount = Math.min(count, 5);
    const points = calcSetPoints(submitCount);
    const newHand = [...hand];
    let removed = 0;
    for (let i = newHand.length - 1; i >= 0 && removed < submitCount; i--) {
      if (newHand[i] === type) { newHand.splice(i, 1); removed++; }
    }

    await db.doc(`game_rooms/${roomId}/players/${room.aiPlayerUid}`).update({
      hand: newHand,
      score: FieldValue.increment(points),
      setsCompleted: FieldValue.arrayUnion({ type, count: submitCount, points }),
    });

    comment = `${type} ${submitCount}장 세트 제출! +${points}점`;
    actionDone = true;
  }

  // 2. 시장 교환 (유리한 카드가 있으면)
  if (!actionDone && market.length > 0 && hand.length > 0) {
    let bestMarketCard = null;
    let worstHandCard = null;
    let bestGain = -1;

    for (const marketCard of market) {
      const marketCount = counts[marketCard] || 0;
      const gainScore = difficulty === 'hard'
        ? (marketCount + 1 >= 3 ? calcSetPoints(marketCount + 1) - calcSetPoints(marketCount) : 0)
        : marketCount;

      if (gainScore > bestGain) {
        bestGain = gainScore;
        bestMarketCard = marketCard;
      }
    }

    // 손에서 가장 적은 카드 하나 버리기
    const leastCommon = Object.entries(counts)
      .sort((a, b) => a[1] - b[1])[0];

    if (bestMarketCard && leastCommon && leastCommon[0] !== bestMarketCard) {
      const discardType = leastCommon[0];
      const newHand = [...hand];
      const idx = newHand.lastIndexOf(discardType);
      if (idx !== -1) {
        newHand.splice(idx, 1);
        newHand.push(bestMarketCard);
        const newMarket = market.map(c => c === bestMarketCard ? discardType : c);

        await db.doc(`game_rooms/${roomId}/players/${room.aiPlayerUid}`).update({ hand: newHand });
        await roomRef.update({ market: newMarket });
        comment = `시장에서 ${bestMarketCard} 획득, ${discardType} 반납`;
        actionDone = true;
      }
    }
  }

  // 3. 덱에서 카드 드로우
  if (!actionDone && (room.deck || []).length > 0) {
    const deck = [...room.deck];
    const drawn = deck.pop();
    const newHand = [...hand, drawn];
    await db.doc(`game_rooms/${roomId}/players/${room.aiPlayerUid}`).update({ hand: newHand });
    await roomRef.update({ deck });
    comment = '덱에서 카드 드로우';
    actionDone = true;
  }

  // 4. AI 코멘트 생성
  let aiMessage = comment;
  const apiKey = await getAiKey();
  if (apiKey && comment) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 40 },
      });
      const prompt = `소소딜 게임의 AI 브로커입니다. 방금 "${comment}" 행동을 했습니다. 상인 캐릭터답게 짧고 재치있는 한 마디(20자 이내, 한국어)를 따옴표 없이 출력하세요.`;
      const result = await model.generateContent(prompt);
      aiMessage = result.response.text().trim().slice(0, 25) || comment;
    } catch {}
  }

  // 5. 액션 로그 기록
  await db.collection(`game_rooms/${roomId}/actions`).add({
    type: 'ai_turn',
    actorId: room.aiPlayerUid,
    actorName: room.aiPlayerName,
    message: aiMessage,
    round: room.round || 1,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 6. 턴 진행
  await advanceDealTurn(roomRef, room);

  return { ok: true, message: aiMessage };
});

async function advanceDealTurn(roomRef, room) {
  const snap = await roomRef.get();
  const r = snap.data();
  const turnOrder = r.turnOrder || [];
  const currentIdx = turnOrder.indexOf(r.currentTurnUid);
  const nextIdx = (currentIdx + 1) % turnOrder.length;
  const isNewRound = nextIdx <= currentIdx;
  const newRound = isNewRound ? (r.round || 1) + 1 : (r.round || 1);

  if (newRound > (r.maxRounds || 6)) {
    // 최고 점수자 승리
    const playersSnap = await roomRef.collection ? null : db.collection(`game_rooms/${roomRef.path.split('/')[1]}/players`).get();
    await roomRef.update({ status: 'done' });
    return;
  }

  await roomRef.update({
    currentTurnUid: turnOrder[nextIdx],
    round: newRound,
    timerEnd: new Date(Date.now() + 55 * 1000),
  });
}

module.exports = { addDealAiPlayer, takeDealAiTurn };
