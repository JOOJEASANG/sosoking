'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const CATALOG_CACHE_MS = 10 * 60 * 1000;
const GAME_EPOCH = Date.parse('2026-01-01T00:00:00+09:00');
const DAILY_CASE_COUNT = 3;
const MAX_CATALOG_SIZE = 1000;
const RANKING_LIMIT = 10;
const RANKING_QUERY_LIMIT = 60;
let catalogCache = { expiresAt: 0, cases: [] };

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return kstDateKey(date);
}

function previousDateKey(dateKey) {
  return shiftDateKey(dateKey, -1);
}

function weekStartKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return kstDateKey(date);
}

function dayOffset(dateKey) {
  const point = Date.parse(`${dateKey}T00:00:00+09:00`);
  return Math.floor((point - GAME_EPOCH) / 86400000);
}

function dateIndex(dateKey, size) {
  if (!size) return 0;
  return ((dayOffset(dateKey) % size) + size) % size;
}

function dailyCaseIndexes(dateKey, size, count = DAILY_CASE_COUNT) {
  if (!size || count < 1) return [];
  const wanted = Math.min(Math.floor(count), size);
  const start = ((dayOffset(dateKey) * wanted) % size + size) % size;
  return Array.from({ length: wanted }, (_, index) => (start + index) % size);
}

function cleanCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function cleanScore(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function cleanNickname(value) {
  const nickname = String(value || '').replace(/\s+/g, '').trim().slice(0, 20);
  return /^[가-힣a-zA-Z0-9_]{2,20}$/.test(nickname) ? nickname : '익명판사';
}

function timestampMillis(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
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
    ? configSnap.data().orderedCaseIds.map(value => String(value || '').trim()).filter(Boolean).slice(0, MAX_CATALOG_SIZE)
    : [];
  if (!orderedCaseIds.length) return [];

  const snapshotsById = new Map();
  const refs = orderedCaseIds.map(id => db.doc(`daily_court_catalog/${id}`));
  for (let offset = 0; offset < refs.length; offset += 100) {
    const snapshots = await db.getAll(...refs.slice(offset, offset + 100));
    snapshots.forEach(snapshot => snapshotsById.set(snapshot.id, snapshot));
  }
  const cases = orderedCaseIds
    .map(id => snapshotsById.get(id))
    .filter(snapshot => snapshot?.exists && snapshot.data()?.active !== false)
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
  if (cases.length < DAILY_CASE_COUNT) {
    throw new HttpsError('unavailable', `오늘의 재판에는 최소 ${DAILY_CASE_COUNT}건의 판례가 필요합니다.`);
  }
  const dateKey = kstDateKey();
  const indexes = dailyCaseIndexes(dateKey, cases.length, DAILY_CASE_COUNT);
  const gameCases = indexes.map(index => cases[index]);
  return {
    dateKey,
    weekKey: weekStartKey(dateKey),
    gameCases,
    catalogSize: cases.length
  };
}

function legacyVoteForCase(summary = {}, caseId = '') {
  if (!summary || String(summary.caseId || '') !== caseId || !summary.selectedChoiceId) return null;
  return {
    caseId,
    selectedChoiceId: String(summary.selectedChoiceId || ''),
    evidenceUsed: cleanCount(summary.evidenceUsed),
    score: cleanScore(summary.score),
    correct: summary.correct === true,
    createdAt: summary.createdAt || null
  };
}

function normalizeDailySummary(raw = {}, gameCases = []) {
  const legacyCaseId = String(raw.caseId || '');
  const hasLegacyVote = Boolean(legacyCaseId && raw.selectedChoiceId);
  const played = cleanCount(raw.played) || (hasLegacyVote ? 1 : 0);
  const correct = cleanCount(raw.correctCount ?? raw.correct) || (hasLegacyVote && raw.correct === true ? 1 : 0);
  const score = cleanScore(raw.score);
  const evidenceUsed = cleanCount(raw.evidenceUsedTotal ?? raw.evidenceUsed);
  return {
    played: Math.min(played, gameCases.length),
    correct: Math.min(correct, gameCases.length),
    score,
    evidenceUsed,
    completed: raw.completed === true || played >= gameCases.length,
    completedAt: raw.completedAt || null
  };
}

function profilePayload(raw = {}, today = {}, week = {}) {
  return {
    totalPlayed: cleanCount(raw.totalPlayed),
    totalCorrect: cleanCount(raw.totalCorrect),
    daysPlayed: cleanCount(raw.daysPlayed),
    currentStreak: cleanCount(raw.currentStreak),
    bestStreak: cleanCount(raw.bestStreak),
    totalScore: cleanScore(raw.totalScore),
    todayPlayed: cleanCount(today.played),
    todayCorrect: cleanCount(today.correct),
    todayScore: cleanScore(today.score),
    todayCompleted: today.completed === true,
    weeklyPlayed: cleanCount(week.played),
    weeklyCorrect: cleanCount(week.correct),
    weeklyScore: cleanScore(week.score)
  };
}

function rankingEntry(data = {}, scoreField, currentUid, type) {
  const played = type === 'all'
    ? cleanCount(data.totalPlayed)
    : cleanCount(data.played);
  const correct = type === 'all'
    ? cleanCount(data.totalCorrect)
    : cleanCount(data.correct);
  const score = cleanScore(data[scoreField]);
  return {
    nickname: cleanNickname(data.nickname),
    score,
    played,
    correct,
    accuracy: played ? Math.round((correct / played) * 100) : 0,
    evidenceUsed: cleanCount(data.evidenceUsed),
    daysPlayed: cleanCount(data.daysPlayed),
    bestStreak: cleanCount(data.bestStreak),
    isMe: Boolean(currentUid && data.uid === currentUid),
    completedAt: data.completedAt || data.updatedAt || null
  };
}

function sortRanking(entries) {
  return [...entries].sort((a, b) => (
    b.score - a.score
    || b.correct - a.correct
    || a.evidenceUsed - b.evidenceUsed
    || timestampMillis(a.completedAt) - timestampMillis(b.completedAt)
    || a.nickname.localeCompare(b.nickname, 'ko-KR')
  ));
}

async function loadRanking(collectionRef, scoreField, currentUid, type, completedOnly = false) {
  const rankingQuery = completedOnly
    ? collectionRef.where('completed', '==', true).orderBy(scoreField, 'desc')
    : collectionRef.orderBy(scoreField, 'desc');
  const snapshot = await rankingQuery.limit(RANKING_QUERY_LIMIT).get();
  const entries = snapshot.docs
    .map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }))
    .map(data => rankingEntry(data, scoreField, currentUid, type));
  return sortRanking(entries)
    .slice(0, RANKING_LIMIT)
    .map((entry, index) => ({ ...entry, rank: index + 1, completedAt: undefined }));
}

async function loadRankings(dateKey, weekKey, currentUid = '') {
  const [daily, weekly, allTime] = await Promise.all([
    loadRanking(db.collection(`daily_court_days/${dateKey}/votes`), 'score', currentUid, 'daily', true),
    loadRanking(db.collection(`daily_court_weeks/${weekKey}/users`), 'score', currentUid, 'weekly'),
    loadRanking(db.collection('daily_court_players'), 'totalScore', currentUid, 'all')
  ]);
  return { daily, weekly, allTime };
}

async function responseForUser(auth) {
  const { dateKey, weekKey, gameCases, catalogSize } = await currentGame();
  const dayRef = db.doc(`daily_court_days/${dateKey}`);
  const account = isAccountAuth(auth);
  const uid = account ? auth.uid : '';
  const voteSummaryRef = account ? dayRef.collection('votes').doc(uid) : null;
  const playerRef = account ? db.doc(`daily_court_players/${uid}`) : null;
  const weekUserRef = account ? db.doc(`daily_court_weeks/${weekKey}/users/${uid}`) : null;

  const [
    daySnap,
    caseStatsSnaps,
    voteSummarySnap,
    caseVoteSnaps,
    playerSnap,
    weekUserSnap,
    rankings
  ] = await Promise.all([
    dayRef.get(),
    Promise.all(gameCases.map(gameCase => dayRef.collection('cases').doc(gameCase.id).get())),
    voteSummaryRef ? voteSummaryRef.get() : Promise.resolve(null),
    voteSummaryRef
      ? Promise.all(gameCases.map(gameCase => voteSummaryRef.collection('cases').doc(gameCase.id).get()))
      : Promise.resolve([]),
    playerRef ? playerRef.get() : Promise.resolve(null),
    weekUserRef ? weekUserRef.get() : Promise.resolve(null),
    loadRankings(dateKey, weekKey, uid)
  ]);

  const summaryData = voteSummarySnap?.exists ? voteSummarySnap.data() : {};
  const votes = {};
  const reveals = {};
  const stats = {};

  gameCases.forEach((gameCase, index) => {
    const caseVoteSnap = caseVoteSnaps[index];
    const vote = caseVoteSnap?.exists
      ? caseVoteSnap.data()
      : legacyVoteForCase(summaryData, gameCase.id);
    if (vote) {
      votes[gameCase.id] = {
        selectedChoiceId: String(vote.selectedChoiceId || ''),
        evidenceUsed: cleanCount(vote.evidenceUsed),
        score: cleanScore(vote.score),
        correct: vote.correct === true
      };
      reveals[gameCase.id] = revealCase(gameCase);
    }

    const caseStatsSnap = caseStatsSnaps[index];
    const statsData = caseStatsSnap?.exists
      ? caseStatsSnap.data()
      : (daySnap.exists && daySnap.data()?.caseId === gameCase.id ? daySnap.data() : {});
    stats[gameCase.id] = normalizeStats(statsData, gameCase.choices);
  });

  const today = normalizeDailySummary(summaryData, gameCases);
  const weekData = weekUserSnap?.exists ? weekUserSnap.data() : {};
  const profileData = playerSnap?.exists ? playerSnap.data() : {};

  return {
    dateKey,
    weekKey,
    catalogSize,
    dailyCaseCount: gameCases.length,
    gameCases: gameCases.map(publicCase),
    signedIn: account,
    votes,
    reveals,
    stats,
    today: {
      ...today,
      maxScore: gameCases.length * 100
    },
    profile: profilePayload(profileData, today, weekData),
    rankings
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
  const caseId = String(request.data?.caseId || '').trim();
  const selectedChoiceId = String(request.data?.selectedChoiceId || '').trim();
  const evidenceUsed = Math.max(0, Math.min(3, Math.floor(Number(request.data?.evidenceUsed) || 0)));
  const { dateKey, weekKey, gameCases, catalogSize } = await currentGame();
  const gameCase = gameCases.find(item => item.id === caseId);
  if (!gameCase) throw new HttpsError('invalid-argument', '오늘 출제된 판례가 아닙니다.');

  const choices = Array.isArray(gameCase.choices) ? gameCase.choices : [];
  if (!choices.some(choice => choice.id === selectedChoiceId)) {
    throw new HttpsError('invalid-argument', '판결 선택지가 올바르지 않습니다.');
  }

  const dayRef = db.doc(`daily_court_days/${dateKey}`);
  const caseStatsRef = dayRef.collection('cases').doc(gameCase.id);
  const voteSummaryRef = dayRef.collection('votes').doc(uid);
  const caseVoteRef = voteSummaryRef.collection('cases').doc(gameCase.id);
  const weekRef = db.doc(`daily_court_weeks/${weekKey}`);
  const weekUserRef = weekRef.collection('users').doc(uid);
  const playerRef = db.doc(`daily_court_players/${uid}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async transaction => {
    const [
      caseVoteSnap,
      voteSummarySnap,
      caseStatsSnap,
      weekUserSnap,
      playerSnap,
      userSnap
    ] = await Promise.all([
      transaction.get(caseVoteRef),
      transaction.get(voteSummaryRef),
      transaction.get(caseStatsRef),
      transaction.get(weekUserRef),
      transaction.get(playerRef),
      transaction.get(userRef)
    ]);

    const summaryRaw = voteSummarySnap.exists ? voteSummarySnap.data() : {};
    if (caseVoteSnap.exists || legacyVoteForCase(summaryRaw, gameCase.id)) return;

    const correct = selectedChoiceId === gameCase.correctChoiceId;
    const score = correct ? Math.max(55, 100 - evidenceUsed * 15) : Math.max(10, 25 - evidenceUsed * 5);
    const stats = normalizeStats(caseStatsSnap.exists ? caseStatsSnap.data() : {}, choices);
    stats.counts[selectedChoiceId] = cleanCount(stats.counts[selectedChoiceId]) + 1;
    stats.totalVotes += 1;

    const nickname = cleanNickname(userSnap.exists ? userSnap.data().nickname : '');
    const daily = normalizeDailySummary(summaryRaw, gameCases);
    const nextDailyPlayed = daily.played + 1;
    const nextDailyCorrect = daily.correct + (correct ? 1 : 0);
    const nextDailyScore = daily.score + score;
    const nextDailyEvidence = daily.evidenceUsed + evidenceUsed;
    const completed = nextDailyPlayed >= gameCases.length;
    const firstPlayToday = daily.played === 0;

    const week = weekUserSnap.exists ? weekUserSnap.data() : {};
    const nextWeekPlayed = cleanCount(week.played) + 1;
    const nextWeekCorrect = cleanCount(week.correct) + (correct ? 1 : 0);
    const nextWeekScore = cleanScore(week.score) + score;
    const nextWeekEvidence = cleanCount(week.evidenceUsed) + evidenceUsed;
    const nextWeekDays = cleanCount(week.daysPlayed) + (firstPlayToday ? 1 : 0);

    const player = playerSnap.exists ? playerSnap.data() : {};
    const totalPlayed = cleanCount(player.totalPlayed) + 1;
    const totalCorrect = cleanCount(player.totalCorrect) + (correct ? 1 : 0);
    const totalScore = cleanScore(player.totalScore) + score;
    const lastPlayedDate = String(player.lastPlayedDate || '');
    const sameDay = lastPlayedDate === dateKey;
    const currentStreak = sameDay
      ? cleanCount(player.currentStreak)
      : (lastPlayedDate === previousDateKey(dateKey) ? cleanCount(player.currentStreak) + 1 : 1);
    const bestStreak = Math.max(cleanCount(player.bestStreak), currentStreak);
    const daysPlayed = cleanCount(player.daysPlayed) + (sameDay ? 0 : 1);

    transaction.set(caseVoteRef, {
      uid,
      dateKey,
      caseId: gameCase.id,
      selectedChoiceId,
      evidenceUsed,
      correct,
      score,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(caseStatsRef, {
      dateKey,
      caseId: gameCase.id,
      totalVotes: stats.totalVotes,
      counts: stats.counts,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const summaryUpdate = {
      uid,
      nickname,
      dateKey,
      caseIds: gameCases.map(item => item.id),
      played: nextDailyPlayed,
      correct: nextDailyCorrect,
      score: nextDailyScore,
      evidenceUsed: nextDailyEvidence,
      completed,
      updatedAt: FieldValue.serverTimestamp()
    };
    if (completed && !daily.completed) summaryUpdate.completedAt = FieldValue.serverTimestamp();

    transaction.set(voteSummaryRef, summaryUpdate, { merge: true });

    transaction.set(dayRef, {
      dateKey,
      caseIds: gameCases.map(item => item.id),
      dailyCaseCount: gameCases.length,
      catalogSize,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(weekUserRef, {
      uid,
      nickname,
      weekKey,
      played: nextWeekPlayed,
      correct: nextWeekCorrect,
      score: nextWeekScore,
      evidenceUsed: nextWeekEvidence,
      daysPlayed: nextWeekDays,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(weekRef, {
      weekKey,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(playerRef, {
      uid,
      nickname,
      totalPlayed,
      totalCorrect,
      daysPlayed,
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
  DAILY_CASE_COUNT,
  MAX_CATALOG_SIZE,
  dateIndex,
  dailyCaseIndexes,
  normalizeStats,
  previousDateKey,
  weekStartKey,
  publicCase,
  revealCase
};
