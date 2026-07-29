'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const CATALOG_CACHE_MS = 10 * 60 * 1000;
const GAME_EPOCH = Date.parse('2026-01-01T00:00:00+09:00');
let catalogCache = { expiresAt: 0, cases: [] };

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function previousDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() - 1);
  return kstDateKey(date);
}

function dateIndex(dateKey, size) {
  const point = Date.parse(`${dateKey}T00:00:00+09:00`);
  const days = Math.floor((point - GAME_EPOCH) / 86400000);
  return ((days % size) + size) % size;
}

function cleanCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizeStats(raw = {}, choices = []) {
  const counts = {};
  for (const choice of choices) counts[choice.id] = cleanCount(raw?.counts?.[choice.id]);
  return {
    totalVotes: cleanCount(raw.totalVotes),
    counts
  };
}

function isAccountAuth(auth) {
  if (!auth) return false;
  return auth.token?.firebase?.sign_in_provider !== 'anonymous';
}

async function loadCatalog() {
  if (catalogCache.expiresAt > Date.now() && catalogCache.cases.length) return catalogCache.cases;

  const configSnap = await db.doc('daily_court_config/catalog').get();
  const orderedCaseIds = configSnap.exists && Array.isArray(configSnap.data()?.orderedCaseIds)
    ? configSnap.data().orderedCaseIds.map(value => String(value || '').trim()).filter(Boolean).slice(0, 500)
    : [];
  if (!orderedCaseIds.length) return [];

  const refs = orderedCaseIds.map(id => db.doc(`daily_court_catalog/${id}`));
  const snapshots = await db.getAll(...refs);
  const cases = snapshots
    .filter(snapshot => snapshot.exists && snapshot.data()?.active !== false)
    .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));

  catalogCache = { expiresAt: Date.now() + CATALOG_CACHE_MS, cases };
  return cases;
}

function publicCase(gameCase) {
  return {
    id: gameCase.id,
    title: gameCase.title,
    category: gameCase.category,
    summary: gameCase.summary,
    question: gameCase.question,
    choices: Array.isArray(gameCase.choices)
      ? gameCase.choices.map(choice => ({ id: choice.id, label: choice.label }))
      : [],
    evidence: Array.isArray(gameCase.evidence) ? gameCase.evidence.slice(0, 3) : [],
    sourceNotice: '국가법령정보센터의 실제 판례를 바탕으로 게임용으로 짧게 재구성했습니다.'
  };
}

function revealCase(gameCase) {
  const correctChoice = Array.isArray(gameCase.choices)
    ? gameCase.choices.find(choice => choice.id === gameCase.correctChoiceId)
    : null;
  return {
    correctChoiceId: gameCase.correctChoiceId,
    correctChoiceLabel: correctChoice?.label || '',
    reasoning: gameCase.reasoning,
    funLine: gameCase.funLine,
    court: gameCase.court,
    caseNumber: gameCase.caseNumber,
    decidedAt: gameCase.decidedAt,
    sourceUrl: gameCase.sourceUrl,
    sourceLabel: gameCase.sourceLabel || '국가법령정보센터 판례'
  };
}

async function currentGame() {
  const cases = await loadCatalog();
  if (!cases.length) throw new HttpsError('unavailable', '오늘의 재판 판례가 아직 준비되지 않았습니다.');
  const dateKey = kstDateKey();
  const gameCase = cases[dateIndex(dateKey, cases.length)];
  return { dateKey, gameCase, catalogSize: cases.length };
}

async function responseForUser(auth) {
  const { dateKey, gameCase, catalogSize } = await currentGame();
  const dayRef = db.doc(`daily_court_days/${dateKey}`);
  const account = isAccountAuth(auth);
  const voteRef = account ? dayRef.collection('votes').doc(auth.uid) : null;
  const playerRef = account ? db.doc(`daily_court_players/${auth.uid}`) : null;
  const refs = [dayRef, voteRef, playerRef].filter(Boolean);
  const snapshots = refs.length ? await db.getAll(...refs) : [];
  const daySnap = snapshots[0];
  const voteSnap = voteRef ? snapshots[1] : null;
  const playerSnap = playerRef ? snapshots[2] : null;
  const vote = voteSnap?.exists ? voteSnap.data() : null;

  return {
    dateKey,
    catalogSize,
    gameCase: publicCase(gameCase),
    signedIn: account,
    voted: Boolean(vote),
    vote: vote ? {
      selectedChoiceId: vote.selectedChoiceId,
      evidenceUsed: cleanCount(vote.evidenceUsed),
      score: cleanCount(vote.score),
      correct: vote.correct === true
    } : null,
    stats: normalizeStats(daySnap?.exists ? daySnap.data() : {}, gameCase.choices),
    reveal: vote ? revealCase(gameCase) : null,
    profile: playerSnap?.exists ? {
      totalPlayed: cleanCount(playerSnap.data().totalPlayed),
      totalCorrect: cleanCount(playerSnap.data().totalCorrect),
      currentStreak: cleanCount(playerSnap.data().currentStreak),
      bestStreak: cleanCount(playerSnap.data().bestStreak),
      totalScore: cleanCount(playerSnap.data().totalScore)
    } : {
      totalPlayed: 0,
      totalCorrect: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalScore: 0
    }
  };
}

exports.getDailyRealCourt = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 40
}, async request => responseForUser(request.auth));

exports.submitDailyRealCourtVerdict = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 40
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const selectedChoiceId = String(request.data?.selectedChoiceId || '').trim();
  const evidenceUsed = Math.max(0, Math.min(3, Math.floor(Number(request.data?.evidenceUsed) || 0)));
  const { dateKey, gameCase } = await currentGame();
  const choices = Array.isArray(gameCase.choices) ? gameCase.choices : [];
  if (!choices.some(choice => choice.id === selectedChoiceId)) {
    throw new HttpsError('invalid-argument', '판결 선택지가 올바르지 않습니다.');
  }

  const dayRef = db.doc(`daily_court_days/${dateKey}`);
  const voteRef = dayRef.collection('votes').doc(uid);
  const playerRef = db.doc(`daily_court_players/${uid}`);

  await db.runTransaction(async transaction => {
    const [voteSnap, daySnap, playerSnap] = await Promise.all([
      transaction.get(voteRef),
      transaction.get(dayRef),
      transaction.get(playerRef)
    ]);
    if (voteSnap.exists) return;

    const correct = selectedChoiceId === gameCase.correctChoiceId;
    const score = correct ? Math.max(55, 100 - evidenceUsed * 15) : Math.max(10, 25 - evidenceUsed * 5);
    const dayData = daySnap.exists ? daySnap.data() : {};
    const stats = normalizeStats(dayData, choices);
    stats.counts[selectedChoiceId] = cleanCount(stats.counts[selectedChoiceId]) + 1;
    stats.totalVotes += 1;

    const player = playerSnap.exists ? playerSnap.data() : {};
    const totalPlayed = cleanCount(player.totalPlayed) + 1;
    const totalCorrect = cleanCount(player.totalCorrect) + (correct ? 1 : 0);
    const lastPlayedDate = String(player.lastPlayedDate || '');
    const currentStreak = lastPlayedDate === previousDateKey(dateKey)
      ? cleanCount(player.currentStreak) + 1
      : 1;
    const bestStreak = Math.max(cleanCount(player.bestStreak), currentStreak);
    const totalScore = cleanCount(player.totalScore) + score;

    transaction.set(voteRef, {
      uid,
      dateKey,
      caseId: gameCase.id,
      selectedChoiceId,
      evidenceUsed,
      correct,
      score,
      createdAt: FieldValue.serverTimestamp()
    });
    transaction.set(dayRef, {
      dateKey,
      caseId: gameCase.id,
      totalVotes: stats.totalVotes,
      counts: stats.counts,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(playerRef, {
      uid,
      totalPlayed,
      totalCorrect,
      currentStreak,
      bestStreak,
      totalScore,
      lastPlayedDate: dateKey,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return responseForUser(request.auth);
});

exports._dailyRealCourtTest = {
  dateIndex,
  normalizeStats,
  previousDateKey,
  publicCase,
  revealCase
};
