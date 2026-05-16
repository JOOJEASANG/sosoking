const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const WELCOME_BALANCE = 10000;
const DAILY_BONUS = 1000;

function requireUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new Error('로그인 후 예측 기능을 사용할 수 있습니다.');
  return uid;
}

function todayKey(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function cleanText(value, max = 160) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function getDefaultBoards(dateKey = todayKey()) {
  return [
    {
      id: `${dateKey}-hot-issue-survive`,
      dateKey,
      status: 'open',
      category: '핫이슈 생존',
      title: '오늘 1위 이슈, 내일도 TOP5에 남을까?',
      issue: '자동 수집 예정 핫이슈 1위',
      summary: '오늘 크게 오른 이슈가 하루짜리인지, 내일까지 살아남을지 예측하는 판입니다.',
      question: '내일 오후 6시 기준, 오늘의 1위 이슈가 다시 TOP5 안에 들어올까?',
      options: [
        { id: 'survive', label: '남는다', odds: 1.7 },
        { id: 'fade', label: '사라진다', odds: 1.9 }
      ],
      closeAtText: '오늘 23:59',
      resultAtText: '내일 18:00',
      resultRule: '내일 핫이슈 점수 TOP5 기준',
      heat: 91,
      participants: 0,
      aiComment: 'AI는 수집된 이슈 데이터를 요약하고 질문을 만드는 역할만 합니다.',
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    },
    {
      id: `${dateKey}-trend-category-winner`,
      dateKey,
      status: 'open',
      category: '카테고리 예측',
      title: '내일 가장 뜨거운 카테고리는?',
      issue: '연예·스포츠·IT·날씨·콘텐츠 흐름 비교',
      summary: '내일 핫이슈 TOP5에 가장 많이 들어올 카테고리를 예측합니다.',
      question: '내일 핫이슈 TOP5 중 가장 많이 등장할 카테고리는?',
      options: [
        { id: 'entertainment', label: '연예/방송', odds: 2.1 },
        { id: 'sports', label: '스포츠', odds: 2.4 },
        { id: 'it', label: 'IT/게임', odds: 2.8 },
        { id: 'weather', label: '날씨/생활', odds: 2.2 }
      ],
      closeAtText: '오늘 23:59',
      resultAtText: '내일 18:00',
      resultRule: '자동 수집 이슈의 카테고리 분류 기준',
      heat: 76,
      participants: 0,
      aiComment: '카테고리 예측은 한 이슈보다 변수가 많아 역전 재미가 큰 판입니다.',
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    },
    {
      id: `${dateKey}-second-place-reverse`,
      dateKey,
      status: 'open',
      category: '역전 예측',
      title: '현재 2위 이슈가 내일 1위로 올라설까?',
      issue: '오늘 2위권에서 빠르게 올라오는 추격 이슈',
      summary: '지금은 2위지만 댓글량과 검색 상승률이 강한 이슈가 내일 1위를 차지할지 맞힙니다.',
      question: '내일 오후 6시 기준, 현재 2위 이슈가 1위로 역전할까?',
      options: [
        { id: 'reverse', label: '역전한다', odds: 2.6 },
        { id: 'no_reverse', label: '못 한다', odds: 1.55 }
      ],
      closeAtText: '오늘 23:59',
      resultAtText: '내일 18:00',
      resultRule: '내일 핫이슈 점수 1위 여부 기준',
      heat: 83,
      participants: 0,
      aiComment: '역전판은 소소머니를 크게 불릴 수 있지만, 그만큼 빗나갈 확률도 높습니다.',
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    }
  ];
}

function normalizeBoardForClient(id, board) {
  return { id, ...board };
}

function findDefaultBoard(boardId, dateKey = todayKey()) {
  const defaults = getDefaultBoards(dateKey);
  return defaults.find(b => b.id === boardId || b.id.endsWith(`-${boardId}`)) || defaults[0];
}

async function ensureWallet(userId) {
  const ref = db.doc(`user_wallets/${userId}`);
  const snap = await ref.get();
  if (snap.exists) return { ref, wallet: snap.data(), created: false };
  const wallet = {
    userId,
    balance: WELCOME_BALANCE,
    totalProfit: 0,
    totalPredictions: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    title: '새내기 예측러',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.set(wallet);
  return { ref, wallet, created: true };
}

async function getBoardData(boardId) {
  const safeBoardId = cleanText(boardId, 100);
  const ref = db.doc(`prediction_boards/${safeBoardId}`);
  const snap = await ref.get();
  if (snap.exists) return { ref, id: snap.id, board: snap.data(), exists: true };
  const board = findDefaultBoard(safeBoardId);
  return { ref, id: board.id, board, exists: false };
}

const getPredictionHome = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const userId = requireUser(request);
  const { wallet } = await ensureWallet(userId);
  const dateKey = todayKey();
  const snap = await db.collection('prediction_boards').where('dateKey', '==', dateKey).where('status', '==', 'open').limit(10).get();
  const boards = snap.empty ? getDefaultBoards(dateKey) : snap.docs.map(doc => normalizeBoardForClient(doc.id, doc.data()));
  return { wallet, boards, dateKey };
});

const getPredictionDetail = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const userId = requireUser(request);
  const boardId = cleanText(request.data?.boardId, 100);
  if (!boardId) throw new Error('예측판 정보가 없습니다.');
  const { id, board } = await getBoardData(boardId);
  const predictionSnap = await db.doc(`predictions/${userId}_${id}`).get();
  const altPredictionSnap = id === boardId ? null : await db.doc(`predictions/${userId}_${boardId}`).get();
  const commentsSnap = await db.collection('prediction_comments').where('boardId', '==', id).limit(30).get();
  const comments = commentsSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    .slice(0, 20);
  return {
    board: normalizeBoardForClient(id, board),
    prediction: predictionSnap.exists ? predictionSnap.data() : (altPredictionSnap?.exists ? altPredictionSnap.data() : null),
    comments
  };
});

const claimPredictionDailyBonus = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const userId = requireUser(request);
  const dateKey = todayKey();
  const { ref, wallet } = await ensureWallet(userId);
  if (wallet.lastDailyBonus === dateKey) return { claimed: false, wallet };
  await ref.set({
    balance: FieldValue.increment(DAILY_BONUS),
    lastDailyBonus: dateKey,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  const updated = await ref.get();
  return { claimed: true, amount: DAILY_BONUS, wallet: updated.data() };
});

const placePrediction = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const userId = requireUser(request);
  const boardId = cleanText(request.data?.boardId, 100);
  const optionId = cleanText(request.data?.optionId, 80);
  const comment = cleanText(request.data?.comment, 160);
  const amount = Math.max(100, Math.min(5000, Number(request.data?.amount || 0)));
  if (!boardId || !optionId) throw new Error('예측판과 선택지가 필요합니다.');

  const { id, board, ref: boardRef, exists } = await getBoardData(boardId);
  const option = (board.options || []).find(o => o.id === optionId);
  if (!option) throw new Error('선택지를 찾을 수 없습니다.');
  if (board.status && board.status !== 'open') throw new Error('이미 마감된 예측판입니다.');

  if (!exists) {
    const { id: defaultId, ...boardData } = board;
    await boardRef.set(boardData, { merge: true });
  }

  const predictionRef = db.doc(`predictions/${userId}_${id}`);
  const existing = await predictionRef.get();
  if (existing.exists) throw new Error('이미 참여한 예측판입니다.');

  const { ref: walletRef, wallet } = await ensureWallet(userId);
  if (Number(wallet.balance || 0) < amount) throw new Error('소소머니가 부족합니다.');

  await predictionRef.set({
    userId, boardId: id, optionId, optionLabel: option.label, odds: option.odds, amount, comment,
    settled: false, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now()
  });
  await walletRef.set({ balance: FieldValue.increment(-amount), totalPredictions: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await boardRef.set({ participants: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (comment) {
    await db.collection('prediction_comments').add({ userId, boardId: id, text: comment, side: option.label, likes: 0, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
  }
  const updatedWallet = await walletRef.get();
  return { ok: true, wallet: updatedWallet.data(), boardId: id };
});

const addPredictionComment = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const userId = requireUser(request);
  const boardId = cleanText(request.data?.boardId, 100);
  const text = cleanText(request.data?.text, 160);
  const side = cleanText(request.data?.side || '내 의견', 40);
  if (!boardId || !text) throw new Error('댓글 내용이 필요합니다.');
  const { id } = await getBoardData(boardId);
  const ref = await db.collection('prediction_comments').add({
    userId, boardId: id, text, side, likes: 0,
    createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now()
  });
  return { ok: true, commentId: ref.id };
});

const getPredictionRankings = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const userId = requireUser(request);
  const { wallet } = await ensureWallet(userId);
  const snap = await db.collection('user_wallets').orderBy('balance', 'desc').limit(20).get();
  const rankings = snap.docs.map((doc, index) => {
    const data = doc.data();
    return {
      rank: index + 1,
      userId: doc.id,
      name: doc.id === userId ? '나' : `예측러 ${String(index + 1).padStart(2, '0')}`,
      balance: Number(data.balance || 0),
      streak: Number(data.streak || 0),
      title: data.title || '예측러'
    };
  });
  if (!rankings.some(r => r.userId === userId)) {
    rankings.push({ rank: rankings.length + 1, userId, name: '나', balance: Number(wallet.balance || 0), streak: Number(wallet.streak || 0), title: wallet.title || '새내기 예측러' });
  }
  return { rankings, wallet };
});

const seedDailyPredictionBoards = onSchedule({ region: 'asia-northeast3', schedule: 'every day 21:00', timeZone: 'Asia/Seoul' }, async () => {
  const dateKey = todayKey();
  const boards = getDefaultBoards(dateKey);
  const batch = db.batch();
  boards.forEach(board => {
    const { id, ...data } = board;
    batch.set(db.doc(`prediction_boards/${id}`), data, { merge: true });
  });
  await batch.commit();
  return null;
});

module.exports = {
  getPredictionHome,
  getPredictionDetail,
  claimPredictionDailyBonus,
  placePrediction,
  addPredictionComment,
  getPredictionRankings,
  seedDailyPredictionBoards
};
