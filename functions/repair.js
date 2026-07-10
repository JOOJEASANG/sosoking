const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { isCompleteJudgment } = require('./judgment-v2');

const db = getFirestore();
const REGION = 'asia-northeast3';
const REACTIONS = ['plaintiff', 'defendant', 'both', 'tooMuch', 'funny'];
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_COUNTER_REPAIR_LIMIT = 300;
const ADMIN_CALLABLE_OPTIONS = {
  region: REGION,
  timeoutSeconds: 180,
  memory: '256MiB',
  cors: true,
};

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function reactionCountsFromSummary(data = {}) {
  const source = data.counts && typeof data.counts === 'object' ? data.counts : {};
  return Object.fromEntries(REACTIONS.map(key => [key, numberValue(source[key])]));
}

function reactionTotalFromSummary(data = {}) {
  const counts = reactionCountsFromSummary(data);
  const countTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return countTotal || numberValue(data.total);
}

function sameReactionCounts(left = {}, right = {}) {
  return REACTIONS.every(key => numberValue(left[key]) === numberValue(right[key]));
}

async function assertAdmin(request) {
  if (!request.auth || !(await isAdminAuth(request.auth))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

function socialCounterQuery(options, limit) {
  let resultQuery = db.collection('results');
  if (options.onlyPublic) resultQuery = resultQuery.where('isPublic', '==', true);
  return resultQuery.orderBy('createdAt', 'desc').limit(limit);
}

function hasCompletedResult(data = {}) {
  if (Number(data.schemaVersion) === 2 && isCompleteJudgment(data.judgment)) return true;
  return !!(String(data.judgmentScript || '').trim() || String(data.sentence || '').trim());
}

async function recoverStaleProcessingCases() {
  const now = Date.now();
  const snap = await db.collection('cases').where('status', '==', 'processing').limit(50).get();
  const batch = db.batch();
  const recovered = [];

  for (const document of snap.docs) {
    const data = document.data() || {};
    const startedAt = data.processingStartedAt?.toMillis ? data.processingStartedAt.toMillis() : 0;
    if (!startedAt || now - startedAt < STALE_PROCESSING_MS) continue;

    const resultSnap = await db.doc(`results/${document.id}`).get().catch(() => null);
    const completed = !!(resultSnap?.exists && hasCompletedResult(resultSnap.data()));
    if (completed) {
      batch.update(document.ref, {
        status: 'completed',
        courtStage: 'sentenced',
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        errorMessage: FieldValue.delete(),
      });
    } else {
      batch.update(document.ref, {
        status: 'pending',
        courtStage: 'filed',
        recoveredFromStaleProcessingAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        errorMessage: FieldValue.delete(),
      });
    }
    recovered.push({ caseId: document.id, completed });
  }

  if (recovered.length) await batch.commit();
  return { checked: snap.size, recoveredCount: recovered.length, recovered };
}

async function repairSocialCounters(options = {}) {
  const resultLimit = Math.max(1, Math.min(MAX_COUNTER_REPAIR_LIMIT, numberValue(options.limit, 200)));
  let resultSnap;
  try {
    resultSnap = await socialCounterQuery(options, resultLimit).get();
  } catch (error) {
    console.warn('ordered social counter repair query failed, falling back:', error.message || error);
    resultSnap = await db.collection('results').limit(resultLimit).get();
  }
  const batch = db.batch();
  const repaired = [];
  const unchanged = [];

  for (const resultDocument of resultSnap.docs) {
    const caseId = resultDocument.id;
    const result = resultDocument.data() || {};
    const [reactionSnap, commentSnap] = await Promise.all([
      db.doc(`result_reactions/${caseId}`).get().catch(() => null),
      db.doc(`court_comment_stats/${caseId}`).get().catch(() => null),
    ]);

    const summary = reactionSnap?.exists ? reactionSnap.data() : {};
    const reactionCounts = reactionCountsFromSummary(summary);
    const reactionTotal = reactionSnap?.exists ? reactionTotalFromSummary(summary) : 0;
    const commentCount = commentSnap?.exists ? numberValue(commentSnap.data()?.count) : 0;
    const currentReactionTotal = numberValue(result.reactionTotal ?? result.totalVotes);
    const currentCommentCount = numberValue(result.commentCount);
    const countsMatch = sameReactionCounts(result.reactionCounts, reactionCounts);

    if (currentReactionTotal === reactionTotal && currentCommentCount === commentCount && countsMatch) {
      unchanged.push(caseId);
      continue;
    }

    batch.set(resultDocument.ref, {
      reactionCounts,
      reactionTotal,
      totalVotes: reactionTotal,
      commentCount,
      socialCounterRepairedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    repaired.push({ caseId, reactionCounts, reactionTotal, commentCount });
  }

  if (repaired.length) await batch.commit();
  return { checked: resultSnap.size, repairedCount: repaired.length, unchangedCount: unchanged.length, repaired };
}

exports.recoverStaleTrials = onSchedule({ region: REGION, schedule: 'every 10 minutes', timeZone: 'Asia/Seoul', timeoutSeconds: 120, memory: '256MiB' }, async () => {
  console.log('recoverStaleTrials:', await recoverStaleProcessingCases());
});

exports.repairSocialCounters = onSchedule({ region: REGION, schedule: '20 3 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 180, memory: '256MiB' }, async () => {
  console.log('repairSocialCounters:', await repairSocialCounters({ limit: 200, onlyPublic: false }));
});

exports.recoverStaleTrialsNow = onCall({ ...ADMIN_CALLABLE_OPTIONS, timeoutSeconds: 120 }, async request => {
  await assertAdmin(request);
  return await recoverStaleProcessingCases();
});

exports.repairSocialCountersNow = onCall(ADMIN_CALLABLE_OPTIONS, async request => {
  await assertAdmin(request);
  const resultLimit = numberValue(request.data?.limit, 200);
  const onlyPublic = request.data?.onlyPublic === true;
  return await repairSocialCounters({ limit: resultLimit, onlyPublic });
});
