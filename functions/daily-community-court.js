'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MODE = 'community-v1';
const DAILY_COUNT = 3;
const RANK_LIMIT = 10;
const EPOCH = Date.parse('2026-01-01T00:00:00+09:00');
const CHOICES = [
  { id: 'plaintiff', label: '원고의 억울함이 더 크다' },
  { id: 'defendant', label: '피고의 해명도 받아들일 만하다' },
  { id: 'both', label: '쌍방 책임으로 화해가 필요하다' }
];
const SEEDS = [
  {
    id: 'seed-pudding', title: '이름 없는 푸딩 무단섭취 사건', category: '가족·음식',
    summary: '냉장고에 넣어둔 푸딩을 가족이 먹고는 이름이 적혀 있지 않아 공용인 줄 알았다고 주장했다.',
    question: '이 사건에서 더 설득력 있는 판단은 무엇일까요?',
    plaintiffArg: '남이 사 온 간식이라면 먹기 전에 먼저 물어봤어야 한다는 주장입니다.',
    defendantArg: '공용 냉장고에 이름 표시 없이 보관돼 개인 소유인지 알기 어려웠다는 주장입니다.',
    aiChoiceId: 'plaintiff', judgeType: '현실주의형',
    reasoning: '표시가 없었다는 사정은 참작되지만, 다른 사람이 사 온 간식을 확인 없이 먹은 책임까지 없어지지는 않습니다.',
    funLine: '피고는 같은 푸딩 두 개를 지급하고 냉장고 문보다 양심을 먼저 열어볼 것을 명합니다.'
  },
  {
    id: 'seed-cake', title: '생일 케이크 취향 독점 사건', category: '연애·가족',
    summary: '생일 당사자가 좋아하지 않는 맛의 케이크를 상대방이 본인 취향대로 사 오고 함께 먹는 것이니 문제없다고 했다.',
    question: '생일 케이크의 선택권은 누구에게 더 있을까요?',
    plaintiffArg: '생일의 주인공이 좋아하는 맛을 우선해야 선물의 의미가 있다는 주장입니다.',
    defendantArg: '함께 먹는 음식이므로 구매자의 취향도 반영될 수 있다는 주장입니다.',
    aiChoiceId: 'plaintiff', judgeType: '감성형',
    reasoning: '함께 먹더라도 생일을 축하하기 위한 음식이라면 생일 당사자의 선호를 먼저 확인하는 것이 합리적입니다.',
    funLine: '다음 생일까지 피고의 단독 케이크 입법권을 정지합니다.'
  },
  {
    id: 'seed-remote', title: '리모컨 마지막 사용자의 책임 사건', category: '가족·생활',
    summary: '거실 리모컨이 사라지자 마지막으로 사용한 사람이 자신은 제자리에 뒀다며 수색 책임을 거부했다.',
    question: '리모컨을 찾을 책임은 누구에게 더 있을까요?',
    plaintiffArg: '마지막 사용자가 우선 수색해야 한다는 주장입니다.',
    defendantArg: '공용 물건이므로 가족 모두가 함께 찾아야 한다는 주장입니다.',
    aiChoiceId: 'both', judgeType: '논리집착형',
    reasoning: '마지막 사용자가 먼저 확인할 책임은 있지만 공용 공간의 물건인 만큼 다른 가족도 최소한 협조해야 합니다.',
    funLine: '소파 틈을 제1수색구역으로 지정하고 전 가족에게 5분간 합동수색을 명합니다.'
  }
];

function text(value, max = 1200) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
function score(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function nickname(value) {
  const name = String(value || '').replace(/\s+/g, '').trim().slice(0, 20);
  return /^[가-힣a-zA-Z0-9_]{2,20}$/.test(name) ? name : '익명판사';
}
function millis(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function shiftDate(key, days) {
  const date = new Date(`${key}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}
function weekKey(key) {
  const date = new Date(`${key}T12:00:00+09:00`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return dateKey(date);
}
function dayOffset(key) {
  return Math.floor((Date.parse(`${key}T00:00:00+09:00`) - EPOCH) / 86400000);
}
function accountAuth(auth) {
  return Boolean(auth && auth.token?.firebase?.sign_in_provider !== 'anonymous');
}
function stats(raw = {}) {
  const counts = {};
  CHOICES.forEach(choice => { counts[choice.id] = count(raw?.counts?.[choice.id]); });
  return { totalVotes: count(raw.totalVotes), counts };
}
function safePublic(data = {}) {
  return data.isPublic === true
    && Number(data.publicDataVersion || 0) === 1
    && data.source === 'user'
    && !Object.hasOwn(data, 'userId')
    && !Object.hasOwn(data, 'caseDescription')
    && !Object.hasOwn(data, 'nickname');
}
function argument(value, fallback) {
  return text(value, 420)
    .replace(/^(청구취지|주장요지|피해 및 요구사항|답변취지|항변요지|피고측 최종의견)\s*/g, '') || fallback;
}
function aiChoice(data = {}) {
  const body = text(`${data.verdict || ''} ${data.sentence || ''}`, 5000);
  const grievance = Number(data.grievanceIndex || 0);
  if (/(쌍방|양 당사자|서로|각자 부담|화해|공동 책임)/.test(body)) return 'both';
  if (/(청구를 기각|원고.*과장|피고.*책임이 없다|피고.*면책)/.test(body) || (grievance > 0 && grievance <= 3)) return 'defendant';
  if (/(피고는|피고에게|배상|사과|이행을 명|재발 방지)/.test(body) || grievance >= 7) return 'plaintiff';
  return 'both';
}
function fromResult(snapshot) {
  const data = snapshot.data();
  if (!safePublic(data)) return null;
  return {
    id: `user-${snapshot.id}`,
    sourceKind: 'user',
    sourceCaseId: snapshot.id,
    title: text(data.caseTitle, 80) || '익명 생활분쟁 사건',
    category: '유저 접수 사건',
    summary: text(data.publicCaseDescription || data.reception, 760) || '접수자가 공개를 허용한 익명 생활사건입니다.',
    question: '이 사건에서 가장 설득력 있는 판단은 무엇일까요?',
    arguments: [
      { label: '원고 주장', text: argument(data.plaintiffArg, '원고는 자신의 억울함과 상대방의 책임을 주장합니다.') },
      { label: '피고 주장', text: argument(data.defendantArg, '피고는 고의가 아니거나 사정이 있었다고 항변합니다.') }
    ],
    aiChoiceId: aiChoice(data),
    judgeType: text(data.judgeType, 30) || 'AI',
    reasoning: text(data.verdict || data.sentence, 1800) || 'AI 판결문에 따라 생활형 책임과 화해 필요성을 판단했습니다.',
    funLine: text(data.sentence, 360) || `${text(data.judgeType, 30) || 'AI'} 판사는 생활형 후속조치가 필요하다고 판단했습니다.`,
    resultUrl: `/result/${encodeURIComponent(snapshot.id)}`,
    sourceNotice: '접수자가 결과 확인 후 공개를 허용한 익명 생활사건입니다.'
  };
}
function seedCase(seed) {
  return {
    ...seed,
    sourceKind: 'seed',
    sourceCaseId: '',
    arguments: [
      { label: '원고 주장', text: seed.plaintiffArg },
      { label: '피고 주장', text: seed.defendantArg }
    ],
    resultUrl: '',
    sourceNotice: '초기 운영을 위해 만든 가상 생활사건이며 실제 인물이나 사건과 관련이 없습니다.'
  };
}
async function publicPool() {
  const snapshot = await db.collection('results')
    .where('isPublic', '==', true)
    .where('publicDataVersion', '==', 1)
    .orderBy('createdAt', 'desc')
    .limit(120)
    .get();
  return snapshot.docs.map(fromResult).filter(Boolean);
}
async function resolveIds(ids) {
  const seeds = new Map(SEEDS.map(item => [item.id, seedCase(item)]));
  const map = new Map();
  const refs = [];
  const keys = [];
  ids.forEach(id => {
    if (seeds.has(id)) map.set(id, seeds.get(id));
    else if (id.startsWith('user-')) {
      refs.push(db.doc(`results/${id.slice(5)}`));
      keys.push(id);
    }
  });
  if (refs.length) {
    const snapshots = await db.getAll(...refs);
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;
      const item = fromResult(snapshot);
      if (item) map.set(keys[index], item);
    });
  }
  return ids.map(id => map.get(id)).filter(Boolean);
}
function selectCases(key, pool) {
  const selected = [];
  const source = pool.length ? pool : SEEDS.map(seedCase);
  const start = ((dayOffset(key) * DAILY_COUNT) % source.length + source.length) % source.length;
  for (let i = 0; selected.length < DAILY_COUNT && i < source.length; i += 1) {
    const item = source[(start + i) % source.length];
    if (!selected.some(existing => existing.id === item.id)) selected.push(item);
  }
  for (const seed of SEEDS.map(seedCase)) {
    if (selected.length >= DAILY_COUNT) break;
    if (!selected.some(existing => existing.id === seed.id)) selected.push(seed);
  }
  return selected;
}
async function game() {
  const today = dateKey();
  const week = weekKey(today);
  const dayRef = db.doc(`daily_court_days/${today}`);
  const daySnap = await dayRef.get();
  const day = daySnap.exists ? daySnap.data() : {};
  const storedIds = day.mode === MODE && Array.isArray(day.caseIds) ? day.caseIds.slice(0, DAILY_COUNT).map(id => text(id, 180)) : [];
  if (storedIds.length === DAILY_COUNT) {
    const storedCases = await resolveIds(storedIds);
    if (storedCases.length === DAILY_COUNT) return { today, week, cases: storedCases, poolSize: count(day.poolSize) || DAILY_COUNT };
  }
  const pool = await publicPool();
  const cases = selectCases(today, pool);
  if (cases.length < DAILY_COUNT) throw new HttpsError('unavailable', '오늘의 생활재판 사건을 준비하고 있습니다.');
  const poolSize = pool.length || SEEDS.length;
  await dayRef.set({
    dateKey: today,
    mode: MODE,
    caseIds: cases.map(item => item.id),
    dailyCaseCount: DAILY_COUNT,
    poolSize,
    source: pool.length >= DAILY_COUNT ? 'public-user-results' : 'public-user-results-with-seeds',
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { today, week, cases, poolSize };
}
function publicCase(item) {
  return {
    id: item.id,
    sourceKind: item.sourceKind,
    title: item.title,
    category: item.category,
    summary: item.summary,
    question: item.question,
    choices: CHOICES,
    arguments: item.arguments,
    sourceNotice: item.sourceNotice
  };
}
function reveal(item) {
  const choice = CHOICES.find(option => option.id === item.aiChoiceId);
  return {
    aiChoiceId: item.aiChoiceId,
    aiChoiceLabel: choice?.label || '',
    judgeType: item.judgeType,
    reasoning: item.reasoning,
    funLine: item.funLine,
    resultUrl: item.resultUrl,
    sourceKind: item.sourceKind
  };
}
function dailySummary(raw = {}, cases = []) {
  const data = raw.mode === MODE ? raw : {};
  return {
    played: Math.min(count(data.played), cases.length),
    aligned: Math.min(count(data.aligned ?? data.correct), cases.length),
    score: score(data.score),
    completed: data.completed === true || count(data.played) >= cases.length,
    completedAt: data.completedAt || null
  };
}
function rankEntry(data, field, uid, type) {
  const played = type === 'all' ? count(data.totalPlayed) : count(data.played);
  const aligned = type === 'all' ? count(data.totalAligned ?? data.totalCorrect) : count(data.aligned ?? data.correct);
  return {
    nickname: nickname(data.nickname),
    score: score(data[field]),
    played,
    aligned,
    accuracy: played ? Math.round(aligned / played * 100) : 0,
    daysPlayed: count(data.daysPlayed),
    bestStreak: count(data.bestStreak),
    isMe: Boolean(uid && data.uid === uid),
    completedAt: data.completedAt || data.updatedAt || null
  };
}
async function rank(ref, field, uid, type, completedOnly = false) {
  const query = completedOnly ? ref.where('completed', '==', true).orderBy(field, 'desc') : ref.orderBy(field, 'desc');
  const snapshot = await query.limit(200).get();
  return snapshot.docs
    .map(doc => ({ uid: doc.id, ...doc.data() }))
    .filter(data => data.mode === MODE)
    .map(data => rankEntry(data, field, uid, type))
    .sort((a, b) => b.score - a.score || b.aligned - a.aligned || millis(a.completedAt) - millis(b.completedAt))
    .slice(0, RANK_LIMIT)
    .map((entry, index) => ({ ...entry, rank: index + 1, completedAt: undefined }));
}
async function rankings(today, week, uid) {
  const [daily, weekly, allTime] = await Promise.all([
    rank(db.collection(`daily_court_days/${today}/votes`), 'score', uid, 'daily', true),
    rank(db.collection(`daily_court_weeks/${week}/users`), 'score', uid, 'weekly'),
    rank(db.collection('daily_court_players'), 'totalScore', uid, 'all')
  ]);
  return { daily, weekly, allTime };
}
async function response(auth) {
  const { today, week, cases, poolSize } = await game();
  const dayRef = db.doc(`daily_court_days/${today}`);
  const signedIn = accountAuth(auth);
  const uid = signedIn ? auth.uid : '';
  const summaryRef = signedIn ? dayRef.collection('votes').doc(uid) : null;
  const playerRef = signedIn ? db.doc(`daily_court_players/${uid}`) : null;
  const weekUserRef = signedIn ? db.doc(`daily_court_weeks/${week}/users/${uid}`) : null;
  const [caseStats, summarySnap, voteSnaps, playerSnap, weekSnap, rankData] = await Promise.all([
    Promise.all(cases.map(item => dayRef.collection('cases').doc(item.id).get())),
    summaryRef ? summaryRef.get() : Promise.resolve(null),
    summaryRef ? Promise.all(cases.map(item => summaryRef.collection('cases').doc(item.id).get())) : Promise.resolve([]),
    playerRef ? playerRef.get() : Promise.resolve(null),
    weekUserRef ? weekUserRef.get() : Promise.resolve(null),
    rankings(today, week, uid)
  ]);
  const votes = {};
  const reveals = {};
  const statsMap = {};
  cases.forEach((item, index) => {
    const voteSnap = voteSnaps[index];
    if (voteSnap?.exists) {
      const vote = voteSnap.data();
      votes[item.id] = { selectedChoiceId: text(vote.selectedChoiceId, 30), score: score(vote.score), aligned: vote.aligned === true || vote.correct === true };
      reveals[item.id] = reveal(item);
    }
    statsMap[item.id] = stats(caseStats[index]?.exists ? caseStats[index].data() : {});
  });
  const todayData = dailySummary(summarySnap?.exists ? summarySnap.data() : {}, cases);
  const player = playerSnap?.exists && playerSnap.data()?.mode === MODE ? playerSnap.data() : {};
  const weekData = weekSnap?.exists && weekSnap.data()?.mode === MODE ? weekSnap.data() : {};
  return {
    mode: MODE,
    dateKey: today,
    weekKey: week,
    poolSize,
    dailyCaseCount: DAILY_COUNT,
    gameCases: cases.map(publicCase),
    signedIn,
    votes,
    reveals,
    stats: statsMap,
    today: { ...todayData, maxScore: DAILY_COUNT * 100 },
    profile: {
      totalPlayed: count(player.totalPlayed),
      totalAligned: count(player.totalAligned ?? player.totalCorrect),
      currentStreak: count(player.currentStreak),
      bestStreak: count(player.bestStreak),
      totalScore: score(player.totalScore),
      weeklyPlayed: count(weekData.played),
      weeklyAligned: count(weekData.aligned ?? weekData.correct),
      weeklyScore: score(weekData.score)
    },
    rankings: rankData
  };
}

exports.getDailyRealCourt = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB', maxInstances: 40 }, request => response(request.auth));

exports.submitDailyRealCourtVerdict = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB', maxInstances: 40 }, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const caseId = text(request.data?.caseId, 180);
  const selectedChoiceId = text(request.data?.selectedChoiceId, 30);
  const { today, week, cases, poolSize } = await game();
  const item = cases.find(gameCase => gameCase.id === caseId);
  if (!item) throw new HttpsError('invalid-argument', '오늘 출제된 생활사건이 아닙니다.');
  if (!CHOICES.some(choice => choice.id === selectedChoiceId)) throw new HttpsError('invalid-argument', '판결 선택지가 올바르지 않습니다.');

  const dayRef = db.doc(`daily_court_days/${today}`);
  const summaryRef = dayRef.collection('votes').doc(uid);
  const voteRef = summaryRef.collection('cases').doc(item.id);
  const statsRef = dayRef.collection('cases').doc(item.id);
  const weekRef = db.doc(`daily_court_weeks/${week}`);
  const weekUserRef = weekRef.collection('users').doc(uid);
  const playerRef = db.doc(`daily_court_players/${uid}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async tx => {
    const [voteSnap, summarySnap, statsSnap, weekSnap, playerSnap, userSnap] = await Promise.all([
      tx.get(voteRef), tx.get(summaryRef), tx.get(statsRef), tx.get(weekUserRef), tx.get(playerRef), tx.get(userRef)
    ]);
    if (voteSnap.exists) return;
    const aligned = selectedChoiceId === item.aiChoiceId;
    const earned = aligned ? 100 : 70;
    const currentStats = stats(statsSnap.exists ? statsSnap.data() : {});
    currentStats.totalVotes += 1;
    currentStats.counts[selectedChoiceId] += 1;
    const name = nickname(userSnap.exists ? userSnap.data().nickname : '');
    const daily = dailySummary(summarySnap.exists ? summarySnap.data() : {}, cases);
    const played = daily.played + 1;
    const alignedCount = daily.aligned + (aligned ? 1 : 0);
    const dailyScore = daily.score + earned;
    const completed = played >= DAILY_COUNT;
    const firstToday = daily.played === 0;
    const weekData = weekSnap.exists && weekSnap.data()?.mode === MODE ? weekSnap.data() : {};
    const player = playerSnap.exists && playerSnap.data()?.mode === MODE ? playerSnap.data() : {};
    const lastDate = text(player.lastPlayedDate, 20);
    const sameDay = lastDate === today;
    const streak = sameDay ? count(player.currentStreak) : (lastDate === shiftDate(today, -1) ? count(player.currentStreak) + 1 : 1);
    const totalAligned = count(player.totalAligned ?? player.totalCorrect) + (aligned ? 1 : 0);

    tx.set(voteRef, { uid, dateKey: today, caseId: item.id, selectedChoiceId, aligned, correct: aligned, score: earned, createdAt: FieldValue.serverTimestamp() });
    tx.set(statsRef, { dateKey: today, caseId: item.id, ...currentStats, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const summaryUpdate = { uid, nickname: name, dateKey: today, mode: MODE, caseIds: cases.map(gameCase => gameCase.id), played, aligned: alignedCount, correct: alignedCount, score: dailyScore, completed, updatedAt: FieldValue.serverTimestamp() };
    if (completed && !daily.completed) summaryUpdate.completedAt = FieldValue.serverTimestamp();
    tx.set(summaryRef, summaryUpdate, { merge: true });
    tx.set(dayRef, { dateKey: today, mode: MODE, caseIds: cases.map(gameCase => gameCase.id), dailyCaseCount: DAILY_COUNT, poolSize, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(weekUserRef, {
      uid, nickname: name, weekKey: week, mode: MODE,
      played: count(weekData.played) + 1,
      aligned: count(weekData.aligned ?? weekData.correct) + (aligned ? 1 : 0),
      correct: count(weekData.aligned ?? weekData.correct) + (aligned ? 1 : 0),
      score: score(weekData.score) + earned,
      daysPlayed: count(weekData.daysPlayed) + (firstToday ? 1 : 0),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(weekRef, { weekKey: week, mode: MODE, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(playerRef, {
      uid, nickname: name, mode: MODE,
      totalPlayed: count(player.totalPlayed) + 1,
      totalAligned, totalCorrect: totalAligned,
      daysPlayed: count(player.daysPlayed) + (sameDay ? 0 : 1),
      currentStreak: streak,
      bestStreak: Math.max(count(player.bestStreak), streak),
      totalScore: score(player.totalScore) + earned,
      lastPlayedDate: today,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return response(request.auth);
});

exports._dailyCommunityCourtTest = { MODE, DAILY_COUNT, CHOICES, aiChoice, selectCases, stats };
