import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const WALLET_KEY = 'sosoking_predict_wallet';
const PREDICTIONS_KEY = 'sosoking_predict_predictions';
const COMMENTS_KEY = 'sosoking_predict_comments';
const DAILY_KEY = 'sosoking_predict_daily_bonus';
const SERVER_BOARDS_KEY = 'sosoking_predict_server_boards';
const SERVER_SYNC_KEY = 'sosoking_predict_server_sync';

const WELCOME_BALANCE = 10000;
const DAILY_BONUS = 1000;

const BOARDS = [
  {
    id: 'hot-issue-survive',
    status: 'open',
    category: '핫이슈 생존',
    title: '오늘 1위 이슈, 내일도 TOP5에 남을까?',
    issue: '오늘 여러 채널에서 반복 등장한 급상승 이슈',
    summary: '오늘 크게 오른 이슈가 하루짜리인지, 내일까지 살아남을지 예측하는 판입니다.',
    question: '내일 오후 6시 기준, 오늘의 1위 이슈가 다시 TOP5 안에 들어올까?',
    options: [
      { id: 'survive', label: '남는다', odds: 1.7 },
      { id: 'fade', label: '사라진다', odds: 1.9 }
    ],
    closeAt: '오늘 23:59',
    resultAt: '내일 18:00',
    resultRule: '자동 수집된 내일 핫이슈 점수 TOP5 기준',
    heat: 91,
    participants: 1284,
    aiComment: 'AI는 이슈의 기사량, 반복 키워드, 검색 상승률을 기준으로 생존 가능성을 계산합니다.'
  },
  {
    id: 'trend-category-winner',
    status: 'open',
    category: '카테고리 예측',
    title: '내일 가장 뜨거운 카테고리는?',
    issue: '연예·스포츠·IT·날씨·콘텐츠 흐름 비교',
    summary: '하루 동안 가장 많이 움직인 카테고리가 내일도 이어질지 보는 예측판입니다.',
    question: '내일 핫이슈 TOP5 중 가장 많이 등장할 카테고리는?',
    options: [
      { id: 'entertainment', label: '연예/방송', odds: 2.1 },
      { id: 'sports', label: '스포츠', odds: 2.4 },
      { id: 'it', label: 'IT/게임', odds: 2.8 },
      { id: 'weather', label: '날씨/생활', odds: 2.2 }
    ],
    closeAt: '오늘 23:59',
    resultAt: '내일 18:00',
    resultRule: '자동 수집 이슈의 카테고리 분류 기준',
    heat: 76,
    participants: 842,
    aiComment: '카테고리 예측은 한 이슈보다 변수가 많아서 역전 재미가 큰 판입니다.'
  },
  {
    id: 'second-place-reverse',
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
    closeAt: '오늘 23:59',
    resultAt: '내일 18:00',
    resultRule: '내일 핫이슈 점수 1위 여부 기준',
    heat: 83,
    participants: 653,
    aiComment: '역전판은 소소머니를 크게 불릴 수 있지만, 그만큼 빗나갈 확률도 높습니다.'
  }
];

export function getBoards() {
  const serverBoards = readJson(SERVER_BOARDS_KEY, []);
  return Array.isArray(serverBoards) && serverBoards.length ? normalizeBoards(serverBoards) : BOARDS;
}

export function getBoard(boardId) {
  const boards = getBoards();
  return boards.find(board => board.id === boardId) || BOARDS.find(board => board.id === boardId) || boards[0] || BOARDS[0];
}

export function getWallet() {
  let wallet = readJson(WALLET_KEY, null);
  if (!wallet) {
    wallet = {
      balance: WELCOME_BALANCE,
      totalProfit: 0,
      winRate: 0,
      streak: 0,
      joinedAt: Date.now(),
      title: '새내기 예측러'
    };
    writeJson(WALLET_KEY, wallet);
  }
  return wallet;
}

export async function syncPredictionHomeFromServer() {
  try {
    const fn = httpsCallable(functions, 'getPredictionHome');
    const res = await fn({});
    const data = res.data || {};
    if (data.wallet) writeJson(WALLET_KEY, normalizeWallet(data.wallet));
    if (Array.isArray(data.boards) && data.boards.length) writeJson(SERVER_BOARDS_KEY, normalizeBoards(data.boards));
    localStorage.setItem(SERVER_SYNC_KEY, String(Date.now()));
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function claimDailyBonusAsync() {
  try {
    const fn = httpsCallable(functions, 'claimPredictionDailyBonus');
    const res = await fn({});
    const data = res.data || {};
    if (data.wallet) writeJson(WALLET_KEY, normalizeWallet(data.wallet));
    return { ok: true, ...data };
  } catch {
    return { ok: false, ...claimDailyBonus() };
  }
}

export function claimDailyBonus() {
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(DAILY_KEY);
  const wallet = getWallet();
  if (last === today) return { claimed: false, wallet };
  wallet.balance += DAILY_BONUS;
  localStorage.setItem(DAILY_KEY, today);
  writeJson(WALLET_KEY, wallet);
  return { claimed: true, wallet, amount: DAILY_BONUS };
}

export function getPredictions() {
  return readJson(PREDICTIONS_KEY, []);
}

export function getPrediction(boardId) {
  return getPredictions().find(p => p.boardId === boardId) || null;
}

export function placePrediction({ boardId, optionId, amount, comment }) {
  const board = getBoard(boardId);
  const option = board.options.find(o => o.id === optionId);
  if (!board || !option) throw new Error('예측 항목을 선택해주세요.');
  const bet = Math.max(100, Math.min(5000, Number(amount || 0)));
  const wallet = getWallet();
  const existing = getPrediction(boardId);
  if (existing) throw new Error('이미 이 예측판에 참여했습니다.');
  if (wallet.balance < bet) throw new Error('소소머니가 부족합니다.');

  wallet.balance -= bet;
  writeJson(WALLET_KEY, wallet);

  const predictions = getPredictions();
  const prediction = {
    id: `${boardId}-${Date.now()}`,
    boardId,
    optionId,
    optionLabel: option.label,
    odds: option.odds,
    amount: bet,
    comment: String(comment || '').trim().slice(0, 120),
    settled: false,
    createdAt: Date.now(),
    source: 'local'
  };
  predictions.unshift(prediction);
  writeJson(PREDICTIONS_KEY, predictions);

  if (prediction.comment) addComment(boardId, prediction.comment, option.label, true);
  return { wallet, prediction };
}

export async function placePredictionAsync({ boardId, optionId, amount, comment }) {
  const board = getBoard(boardId);
  const option = board.options?.find(o => o.id === optionId);
  if (!board || !option) throw new Error('예측 항목을 선택해주세요.');
  try {
    const fn = httpsCallable(functions, 'placePrediction');
    const res = await fn({ boardId, optionId, amount: Number(amount || 0), comment: String(comment || '').trim() });
    const data = res.data || {};
    if (data.wallet) writeJson(WALLET_KEY, normalizeWallet(data.wallet));
    rememberPrediction({ boardId, optionId, optionLabel: option.label, odds: option.odds, amount, comment, source: 'server' });
    if (comment) addComment(boardId, comment, option.label, true);
    return { ok: true, wallet: getWallet() };
  } catch (error) {
    const local = placePrediction({ boardId, optionId, amount, comment });
    return { ok: false, fallback: true, error, ...local };
  }
}

function rememberPrediction({ boardId, optionId, optionLabel, odds, amount, comment, source }) {
  const predictions = getPredictions().filter(p => p.boardId !== boardId);
  predictions.unshift({
    id: `${boardId}-${Date.now()}`,
    boardId,
    optionId,
    optionLabel,
    odds,
    amount: Math.max(100, Math.min(5000, Number(amount || 0))),
    comment: String(comment || '').trim().slice(0, 120),
    settled: false,
    createdAt: Date.now(),
    source
  });
  writeJson(PREDICTIONS_KEY, predictions);
}

export function addComment(boardId, text, side = '근거', mine = false) {
  const comments = getComments(boardId, true);
  const item = {
    id: `${boardId}-comment-${Date.now()}`,
    boardId,
    text: String(text || '').trim().slice(0, 160),
    side,
    mine,
    likes: 0,
    createdAt: Date.now()
  };
  if (!item.text) return null;
  comments.unshift(item);
  writeAllComments(comments);
  return item;
}

export function getComments(boardId, all = false) {
  const stored = readJson(COMMENTS_KEY, []);
  const seeded = seedComments();
  const merged = [...stored, ...seeded.filter(s => !stored.some(x => x.id === s.id))];
  return all ? merged : merged.filter(comment => comment.boardId === boardId).slice(0, 12);
}

export function getRankings() {
  const wallet = getWallet();
  return [
    { name: '촉좋은문어', balance: 84200, streak: 7, title: '이번 주 소소킹' },
    { name: '내일은내편', balance: 71600, streak: 5, title: '역배 감별사' },
    { name: '성지순례중', balance: 58300, streak: 4, title: '댓글 성지왕' },
    { name: '나', balance: wallet.balance, streak: wallet.streak, title: wallet.title }
  ].sort((a, b) => b.balance - a.balance);
}

export function getMySummary() {
  const wallet = getWallet();
  const predictions = getPredictions();
  return {
    wallet,
    predictions,
    openCount: predictions.filter(p => !p.settled).length,
    totalPredictions: predictions.length,
    lastSync: Number(localStorage.getItem(SERVER_SYNC_KEY) || 0)
  };
}

function normalizeBoards(boards) {
  return boards.map(board => ({
    id: board.id,
    status: board.status || 'open',
    category: board.category || '예측판',
    title: board.title || '오늘의 예측판',
    issue: board.issue || '',
    summary: board.summary || '',
    question: board.question || board.title || '내일 어떻게 될까요?',
    options: Array.isArray(board.options) ? board.options : [],
    closeAt: board.closeAtText || board.closeAt || '오늘 23:59',
    resultAt: board.resultAtText || board.resultAt || '내일 18:00',
    resultRule: board.resultRule || '자동 정산 기준',
    heat: Number(board.heat || 50),
    participants: Number(board.participants || 0),
    aiComment: board.aiComment || 'AI가 수집 데이터를 바탕으로 예측 질문을 정리했습니다.'
  })).filter(board => board.id && board.options.length);
}

function normalizeWallet(wallet) {
  return {
    balance: Number(wallet.balance ?? WELCOME_BALANCE),
    totalProfit: Number(wallet.totalProfit || 0),
    winRate: Number(wallet.winRate || 0),
    streak: Number(wallet.streak || 0),
    joinedAt: wallet.joinedAt || Date.now(),
    title: wallet.title || '새내기 예측러'
  };
}

function seedComments() {
  return [
    { id: 'seed-1', boardId: 'hot-issue-survive', text: '오늘 기사량이 너무 많아서 내일까지는 갈 듯. 하루짜리 느낌은 아님.', side: '남는다', likes: 28, createdAt: Date.now() - 500000 },
    { id: 'seed-2', boardId: 'hot-issue-survive', text: '오히려 오늘 너무 불탔으면 내일은 식을 가능성 있음.', side: '사라진다', likes: 19, createdAt: Date.now() - 420000 },
    { id: 'seed-3', boardId: 'trend-category-winner', text: '주말 전에는 콘텐츠 쪽이 강해지는 경우가 많음.', side: '연예/방송', likes: 16, createdAt: Date.now() - 330000 },
    { id: 'seed-4', boardId: 'second-place-reverse', text: '2위 이슈가 댓글량은 더 많아서 역전 가능성 있음.', side: '역전한다', likes: 22, createdAt: Date.now() - 260000 }
  ];
}

function writeAllComments(comments) {
  const mineAndStored = comments.filter(c => c.mine || String(c.id).startsWith('custom-') || String(c.id).includes('comment-'));
  writeJson(COMMENTS_KEY, mineAndStored);
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
