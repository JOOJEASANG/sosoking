const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

function todayKey(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

async function getResultIssues() {
  const snap = await db.doc(`daily_issues/${todayKey()}`).get();
  return snap.exists ? (snap.data().issues || []) : [];
}

function fallbackOption(board) {
  const options = Array.isArray(board.options) ? board.options : [];
  if (!options.length) return null;
  const seed = String(board.id || board.title || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return options[seed % options.length];
}

function pickOption(board, issues) {
  const options = Array.isArray(board.options) ? board.options : [];
  if (!options.length) return null;
  const topFive = Array.isArray(issues) ? issues.slice(0, 5) : [];
  const keyword = board.issueKeyword || board.issue || '';

  if (board.id.includes('hot-issue-survive')) {
    const ok = keyword && topFive.some(issue => issue.keyword === keyword || String(issue.title || '').includes(keyword));
    return options.find(option => option.id === (ok ? 'survive' : 'fade')) || options[0];
  }
  if (board.id.includes('second-place-reverse')) {
    const top = topFive[0];
    const ok = keyword && top && (top.keyword === keyword || String(top.title || '').includes(keyword));
    return options.find(option => option.id === (ok ? 'reverse' : 'no_reverse')) || options[0];
  }
  if (board.id.includes('trend-category-winner')) {
    const counts = new Map();
    topFive.forEach(issue => counts.set(issue.category, (counts.get(issue.category) || 0) + 1));
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return options.find(option => option.label === best) || options[0];
  }
  return fallbackOption(board);
}

async function settleBoard(doc, issues) {
  const board = { id: doc.id, ...doc.data() };
  if (board.status === 'settled') return { boardId: doc.id, skipped: true, reason: 'settled' };
  if (!board.dateKey || board.dateKey >= todayKey()) return { boardId: doc.id, skipped: true, reason: 'not_due' };
  const winner = pickOption(board, issues);
  if (!winner) return { boardId: doc.id, skipped: true, reason: 'no_option' };

  const predictions = await db.collection('predictions').where('boardId', '==', doc.id).where('settled', '==', false).limit(300).get();
  const batch = db.batch();
  let correct = 0;
  let wrong = 0;

  predictions.docs.forEach(predDoc => {
    const pred = predDoc.data();
    const hit = pred.optionId === winner.id;
    const amount = Number(pred.amount || 0);
    const odds = Number(pred.odds || 1);
    const payout = hit ? Math.floor(amount * odds) : 0;
    const scoreDelta = hit ? payout - amount : -amount;
    batch.set(predDoc.ref, {
      settled: true,
      won: hit,
      payout,
      profit: scoreDelta,
      winningOptionId: winner.id,
      settledAt: FieldValue.serverTimestamp(),
      settledAtMs: Date.now()
    }, { merge: true });
    batch.set(db.doc(`user_wallets/${pred.userId}`), {
      balance: FieldValue.increment(payout),
      totalProfit: FieldValue.increment(scoreDelta),
      wins: FieldValue.increment(hit ? 1 : 0),
      losses: FieldValue.increment(hit ? 0 : 1),
      streak: hit ? FieldValue.increment(1) : 0,
      title: hit ? '촉 좋은 예측러' : '다음엔 맞힐 예측러',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    if (hit) correct += 1; else wrong += 1;
  });

  batch.set(doc.ref, {
    status: 'settled',
    winningOptionId: winner.id,
    winningOptionLabel: winner.label,
    resultLine: `정답은 “${winner.label}”입니다.`,
    winners: correct,
    losers: wrong,
    settledAt: FieldValue.serverTimestamp(),
    settledAtMs: Date.now()
  }, { merge: true });

  await batch.commit();
  return { boardId: doc.id, winner: winner.label, correct, wrong };
}

const settlePredictionBoards = onCall({ region: 'asia-northeast3', timeoutSeconds: 90 }, async () => {
  const issues = await getResultIssues();
  const snap = await db.collection('prediction_boards').where('status', '==', 'open').limit(60).get();
  const results = [];
  for (const doc of snap.docs) results.push(await settleBoard(doc, issues));
  return { ok: true, results };
});

const scheduledSettlePredictionBoards = onSchedule({ region: 'asia-northeast3', schedule: 'every day 18:00', timeZone: 'Asia/Seoul', timeoutSeconds: 300 }, async () => {
  const issues = await getResultIssues();
  const snap = await db.collection('prediction_boards').where('status', '==', 'open').limit(60).get();
  for (const doc of snap.docs) await settleBoard(doc, issues);
  return null;
});

module.exports = { settlePredictionBoards, scheduledSettlePredictionBoards };
