import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const WALLET_KEY = 'sosoking_predict_wallet';
const PREDICTIONS_KEY = 'sosoking_predict_predictions';
const COMMENTS_KEY = 'sosoking_predict_comments';
const DAILY_KEY = 'sosoking_predict_daily_bonus';
const SERVER_BOARDS_KEY = 'sosoking_predict_server_boards';
const SERVER_SYNC_KEY = 'sosoking_predict_server_sync';
const SERVER_COMMENTS_KEY = 'sosoking_predict_server_comments';
const SERVER_RANKINGS_KEY = 'sosoking_predict_server_rankings';

const WELCOME_BALANCE = 10000;
const DAILY_BONUS = 1000;
const BOARDS = [];

export function getBoards() {
  const serverBoards = readJson(SERVER_BOARDS_KEY, []);
  return Array.isArray(serverBoards) ? normalizeBoards(serverBoards) : [];
}
export function getBoard(boardId) {
  const boards = getBoards();
  return boards.find(board => board.id === boardId) || boards[0] || null;
}
export function getWallet() {
  let wallet = readJson(WALLET_KEY, null);
  if (!wallet) {
    wallet = { balance: WELCOME_BALANCE, totalProfit: 0, winRate: 0, streak: 0, joinedAt: Date.now(), title: '새내기 예측러' };
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
    if (Array.isArray(data.boards)) writeJson(SERVER_BOARDS_KEY, normalizeBoards(data.boards));
    localStorage.setItem(SERVER_SYNC_KEY, String(Date.now()));
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error };
  }
}
export async function syncPredictionDetailFromServer(boardId) {
  try {
    const fn = httpsCallable(functions, 'getPredictionDetail');
    const res = await fn({ boardId });
    const data = res.data || {};
    if (data.board) upsertServerBoard(data.board);
    if (data.prediction) rememberPrediction({ ...data.prediction, boardId: data.board?.id || boardId, source: 'server' });
    if (Array.isArray(data.comments)) writeServerComments(data.board?.id || boardId, data.comments);
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
export function getPredictions() { return readJson(PREDICTIONS_KEY, []); }
export function getPrediction(boardId) { return getPredictions().find(p => p.boardId === boardId) || null; }

export function placePrediction({ boardId, optionId, amount, comment }) {
  const board = getBoard(boardId);
  if (!board) throw new Error('예측판을 찾을 수 없습니다.');
  const option = board.options.find(o => o.id === optionId);
  if (!option) throw new Error('예측 항목을 선택해주세요.');
  const bet = Math.max(100, Math.min(5000, Number(amount || 0)));
  const wallet = getWallet();
  if (getPrediction(boardId)) throw new Error('이미 이 예측판에 참여했습니다.');
  if (wallet.balance < bet) throw new Error('소소머니가 부족합니다.');
  wallet.balance -= bet;
  writeJson(WALLET_KEY, wallet);
  const prediction = { id: `${boardId}-${Date.now()}`, boardId, optionId, optionLabel: option.label, odds: option.odds, amount: bet, comment: String(comment || '').trim().slice(0, 120), settled: false, createdAt: Date.now(), source: 'local' };
  writeJson(PREDICTIONS_KEY, [prediction, ...getPredictions()]);
  if (prediction.comment) addComment(boardId, prediction.comment, option.label, true);
  return { wallet, prediction };
}

export async function placePredictionAsync({ boardId, optionId, amount, comment }) {
  const board = getBoard(boardId);
  if (!board) throw new Error('예측판을 찾을 수 없습니다.');
  const option = board.options?.find(o => o.id === optionId);
  if (!option) throw new Error('예측 항목을 선택해주세요.');
  try {
    const fn = httpsCallable(functions, 'placePrediction');
    const cleanComment = String(comment || '').trim();
    const res = await fn({ boardId, optionId, amount: Number(amount || 0), comment: cleanComment });
    const data = res.data || {};
    if (data.wallet) writeJson(WALLET_KEY, normalizeWallet(data.wallet));
    rememberPrediction({ boardId: data.boardId || boardId, optionId, optionLabel: option.label, odds: option.odds, amount, comment: cleanComment, source: 'server' });
    return { ok: true, wallet: getWallet() };
  } catch (error) {
    const local = placePrediction({ boardId, optionId, amount, comment });
    return { ok: false, fallback: true, error, ...local };
  }
}

function rememberPrediction(raw) {
  const boardId = raw.boardId;
  const predictions = getPredictions().filter(p => p.boardId !== boardId);
  predictions.unshift({ id: raw.id || `${boardId}-${Date.now()}`, boardId, optionId: raw.optionId, optionLabel: raw.optionLabel || raw.side || '선택 완료', odds: raw.odds || 1, amount: Math.max(0, Number(raw.amount || 0)), comment: String(raw.comment || '').trim().slice(0, 120), settled: Boolean(raw.settled), won: raw.won, payout: raw.payout, profit: raw.profit, createdAt: raw.createdAtMs || raw.createdAt || Date.now(), source: raw.source || 'server' });
  writeJson(PREDICTIONS_KEY, predictions);
}

export function addComment(boardId, text, side = '근거', mine = false) {
  const comments = getComments(boardId, true);
  const item = { id: `${boardId}-comment-${Date.now()}`, boardId, text: String(text || '').trim().slice(0, 160), side, mine, likes: 0, createdAt: Date.now() };
  if (!item.text) return null;
  comments.unshift(item);
  writeAllComments(dedupeComments(comments));
  return item;
}
export async function addCommentAsync(boardId, text, side = '내 의견') {
  try {
    const fn = httpsCallable(functions, 'addPredictionComment');
    await fn({ boardId, text, side });
    return { ok: true, comment: null };
  } catch (error) {
    return { ok: false, error, comment: addComment(boardId, text, side, true) };
  }
}

export function getComments(boardId, all = false) {
  const stored = readJson(COMMENTS_KEY, []);
  const server = readJson(SERVER_COMMENTS_KEY, []).filter(c => c.boardId === boardId);
  const merged = dedupeComments([...stored, ...server]);
  return all ? merged : merged.filter(comment => comment.boardId === boardId).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0, 12);
}

export function getRankings() {
  const server = readJson(SERVER_RANKINGS_KEY, []);
  return Array.isArray(server) ? server : [];
}
export async function syncRankingsFromServer() {
  try {
    const fn = httpsCallable(functions, 'getPredictionRankings');
    const res = await fn({});
    const data = res.data || {};
    if (data.wallet) writeJson(WALLET_KEY, normalizeWallet(data.wallet));
    if (Array.isArray(data.rankings)) writeJson(SERVER_RANKINGS_KEY, data.rankings.map(r => ({ name: r.name, balance: Number(r.balance || 0), streak: Number(r.streak || 0), title: r.title || '예측러' })));
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error };
  }
}
export function getMySummary() {
  const wallet = getWallet();
  const predictions = getPredictions();
  return { wallet, predictions, openCount: predictions.filter(p => !p.settled).length, totalPredictions: predictions.length, lastSync: Number(localStorage.getItem(SERVER_SYNC_KEY) || 0) };
}

function normalizeBoards(boards) {
  return boards.map(board => ({ id: board.id, status: board.status || 'open', category: board.category || '예측판', title: board.title || '오늘의 예측판', issue: board.issue || '', summary: board.summary || '', question: board.question || board.title || '내일 어떻게 될까요?', options: Array.isArray(board.options) ? board.options : [], closeAt: board.closeAtText || board.closeAt || '오늘 23:59', resultAt: board.resultAtText || board.resultAt || '내일 18:00', resultRule: board.resultRule || '자동 정산 기준', heat: Number(board.heat || 50), participants: Number(board.participants || 0), aiComment: board.aiComment || 'AI가 수집 데이터를 바탕으로 예측 질문을 정리했습니다.', resultLine: board.resultLine || '', winningOptionLabel: board.winningOptionLabel || '' })).filter(board => board.id && board.options.length);
}
function normalizeWallet(wallet) { return { balance: Number(wallet.balance ?? WELCOME_BALANCE), totalProfit: Number(wallet.totalProfit || 0), winRate: Number(wallet.winRate || 0), streak: Number(wallet.streak || 0), joinedAt: wallet.joinedAt || Date.now(), title: wallet.title || '새내기 예측러' }; }
function upsertServerBoard(board) {
  const boards = normalizeBoards([board]);
  if (!boards.length) return;
  const current = getBoards().filter(b => b.id !== boards[0].id);
  writeJson(SERVER_BOARDS_KEY, [boards[0], ...current]);
}
function writeServerComments(boardId, comments) {
  const current = readJson(SERVER_COMMENTS_KEY, []).filter(c => c.boardId !== boardId);
  const mapped = comments.map(c => ({ id: c.id, boardId, text: c.text || '', side: c.side || '의견', likes: Number(c.likes || 0), createdAt: Number(c.createdAtMs || c.createdAt || Date.now()), mine: false }));
  writeJson(SERVER_COMMENTS_KEY, dedupeComments([...mapped, ...current]));
}
function dedupeComments(comments) {
  const seen = new Set();
  return comments.filter(c => {
    const key = `${c.boardId}|${String(c.text || '').trim()}|${String(c.side || '').trim()}`;
    if (!c.text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function writeAllComments(comments) {
  const mineAndStored = dedupeComments(comments).filter(c => c.mine || String(c.id).startsWith('custom-') || String(c.id).includes('comment-'));
  writeJson(COMMENTS_KEY, mineAndStored);
}
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
