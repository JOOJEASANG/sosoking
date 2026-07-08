const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_COUNTER_REPAIR_LIMIT = 300;

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
function reactionTotalFromSummary(data = {}) {
  const explicitTotal = numberValue(data.total, -1);
  if (explicitTotal >= 0) return explicitTotal;
  const counts = data.counts && typeof data.counts === 'object' ? data.counts : {};
  return Object.values(counts).reduce((sum, value) => sum + numberValue(value), 0);
}
async function assertAdmin(request) {
  if (!request.auth || !(await isAdminAuth(request.auth))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

async function recoverStaleProcessingCases() {
  const now = Date.now();
  const snap = await db.collection('cases').where('status', '==', 'processing').limit(50).get();
  const batch = db.batch();
  const recovered = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const startedAt = data.processingStartedAt?.toMillis ? data.processingStartedAt.toMillis() : 0;
    if (!startedAt || now - startedAt < STALE_PROCESSING_MS) continue;

    const resultSnap = await db.doc(`results/${doc.id}`).get().catch(() => null);
    const hasCompletedResult = !!(resultSnap?.exists && resultSnap.data()?.sentence);

    if (hasCompletedResult) {
      batch.update(doc.ref, {
        status: 'completed',
        courtStage: 'sentenced',
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        errorMessage: FieldValue.delete()
      });
    } else {
      batch.update(doc.ref, {
        status: 'pending',
        courtStage: 'filed',
        recoveredFromStaleProcessingAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        errorMessage: FieldValue.delete()
      });
    }
    recovered.push({ caseId: doc.id, completed: hasCompletedResult });
  }

  if (recovered.length) await batch.commit();
  return { checked: snap.size, recoveredCount: recovered.length, recovered };
}

async function repairSocialCounters(options = {}) {
  const limit = Math.max(1, Math.min(MAX_COUNTER_REPAIR_LIMIT, numberValue(options.limit, 200)));
  let query = db.collection('results').limit(limit);
  if (options.onlyPublic) query = db.collection('results').where('isPublic', '==', true).limit(limit);

  const resultSnap = await query.get();
  const batch = db.batch();
  const repaired = [];
  const unchanged = [];

  for (const resultDoc of resultSnap.docs) {
    const caseId = resultDoc.id;
    const result = resultDoc.data() || {};
    const [reactionSnap, commentSnap] = await Promise.all([
      db.doc(`result_reactions/${caseId}`).get().catch(() => null),
      db.doc(`court_comment_stats/${caseId}`).get().catch(() => null)
    ]);

    const reactionTotal = reactionSnap?.exists ? reactionTotalFromSummary(reactionSnap.data()) : 0;
    const commentCount = commentSnap?.exists ? numberValue(commentSnap.data()?.count) : 0;
    const currentReactionTotal = numberValue(result.reactionTotal ?? result.totalVotes);
    const currentCommentCount = numberValue(result.commentCount);

    if (currentReactionTotal === reactionTotal && currentCommentCount === commentCount) {
      unchanged.push(caseId);
      continue;
    }

    batch.set(resultDoc.ref, {
      reactionTotal,
      totalVotes: reactionTotal,
      commentCount,
      socialCounterRepairedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    repaired.push({ caseId, reactionTotal, commentCount });
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

exports.recoverStaleTrialsNow = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  await assertAdmin(request);
  return await recoverStaleProcessingCases();
});

exports.repairSocialCountersNow = onCall({ region: REGION, timeoutSeconds: 180, memory: '256MiB' }, async request => {
  await assertAdmin(request);
  const limit = numberValue(request.data?.limit, 200);
  const onlyPublic = request.data?.onlyPublic === true;
  return await repairSocialCounters({ limit, onlyPublic });
});
