const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { isAdminAuth } = require('./admin-utils');
const { isCompleteJudgment } = require('./judgment-v2');

const db = getFirestore();
const REGION = 'asia-northeast3';
const REACTIONS = ['plaintiff', 'defendant', 'both', 'tooMuch', 'funny'];
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const STALE_RESERVATION_MS = 15 * 60 * 1000;
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

async function deleteOrphanCaseImages(uid, caseId) {
  if (!uid || !caseId) return 0;
  try {
    const [files] = await getStorage().bucket().getFiles({ prefix: `case-images/${uid}/${caseId}/` });
    await Promise.all(files.map(file => file.delete().catch(() => null)));
    return files.length;
  } catch (error) {
    console.error('stale reservation image cleanup failed:', error.message || error);
    return 0;
  }
}

async function refundStaleReservation(document, reservationCollection, limitCollection, cutoffMs) {
  const reservationRef = document.ref;
  const reservation = document.data() || {};
  const uid = String(reservation.uid || '').trim();
  const date = String(reservation.date || '').trim();
  const caseId = String(reservation.caseId || '').trim();
  if (!uid || !date) {
    await reservationRef.delete().catch(() => null);
    return { reservationId: document.id, refunded: false, malformed: true };
  }

  const limitRef = db.doc(`${limitCollection}/${uid}`);
  const caseRef = reservationCollection === 'submit_reservations' && caseId
    ? db.doc(`cases/${caseId}`)
    : null;
  const resultRef = reservationCollection === 'appeal_reservations' && caseId
    ? db.doc(`results/${caseId}`)
    : null;
  let refunded = false;
  let completed = false;
  let fresh = false;

  await db.runTransaction(async transaction => {
    const reads = [transaction.get(reservationRef), transaction.get(limitRef)];
    if (caseRef) reads.push(transaction.get(caseRef));
    if (resultRef) reads.push(transaction.get(resultRef));
    const snapshots = await Promise.all(reads);
    const freshReservation = snapshots[0];
    const limitSnap = snapshots[1];
    const caseSnap = caseRef ? snapshots[2] : null;
    const resultSnap = resultRef ? snapshots[caseRef ? 3 : 2] : null;
    if (!freshReservation.exists) return;

    const currentReservation = freshReservation.data() || {};
    const createdMs = currentReservation.createdAt?.toMillis ? currentReservation.createdAt.toMillis() : 0;
    if (createdMs && createdMs >= cutoffMs) {
      fresh = true;
      return;
    }

    if (caseSnap?.exists) {
      completed = true;
      transaction.delete(reservationRef);
      return;
    }

    if (resultSnap?.exists && resultSnap.data()?.appeal?.verdict) {
      completed = true;
      transaction.delete(reservationRef);
      return;
    }

    const current = limitSnap.exists ? limitSnap.data() : {};
    if (current.date === date && numberValue(current.count) > 0) {
      transaction.set(limitRef, {
        count: Math.max(0, numberValue(current.count) - 1),
        staleReservationRefundedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      refunded = true;
    }

    if (resultRef && resultSnap?.exists) {
      const resultData = resultSnap.data() || {};
      if (
        resultData.appeal?.status === 'processing'
        && (!currentReservation.attemptId || resultData.appeal?.attemptId === currentReservation.attemptId)
      ) {
        transaction.set(resultRef, {
          appeal: {
            status: 'error',
            reason: resultData.appeal?.reason || '',
            recoveredAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
    transaction.delete(reservationRef);
  });

  const storageDeleted = reservationCollection === 'submit_reservations' && !completed && !fresh
    ? await deleteOrphanCaseImages(uid, caseId)
    : 0;
  return { reservationId: document.id, uid, caseId, refunded, completed, fresh, storageDeleted };
}

async function recoverStaleReservations() {
  const cutoffMs = Date.now() - STALE_RESERVATION_MS;
  const cutoff = Timestamp.fromMillis(cutoffMs);
  const configs = [
    ['submit_reservations', 'rate_limits'],
    ['title_suggestion_reservations', 'title_suggestion_limits'],
    ['appeal_reservations', 'appeal_limits'],
  ];
  const recovered = [];

  for (const [reservationCollection, limitCollection] of configs) {
    const snapshot = await db.collection(reservationCollection)
      .where('createdAt', '<', cutoff)
      .limit(50)
      .get();
    for (const document of snapshot.docs) {
      const result = await refundStaleReservation(document, reservationCollection, limitCollection, cutoffMs);
      recovered.push({ type: reservationCollection, ...result });
    }
  }

  return {
    recoveredCount: recovered.filter(item => !item.fresh).length,
    refundedCount: recovered.filter(item => item.refunded).length,
    completedReservationCount: recovered.filter(item => item.completed).length,
    storageDeleted: recovered.reduce((sum, item) => sum + numberValue(item.storageDeleted), 0),
    recovered,
  };
}

async function scrubPublicResultIdentifiers() {
  const resultSnap = await db.collection('results').where('isPublic', '==', true).get();
  const fields = [
    'userId',
    'ownerId',
    'visibilityUpdatedBy',
    'imageAttachment',
    'imageAttachmentMeta',
    'imageStoragePath',
  ];
  const targets = resultSnap.docs.filter(document => {
    const data = document.data() || {};
    return fields.some(field => data[field] !== undefined);
  });

  let scrubbed = 0;
  for (let offset = 0; offset < targets.length; offset += 400) {
    const batch = db.batch();
    for (const document of targets.slice(offset, offset + 400)) {
      batch.set(document.ref, {
        userId: FieldValue.delete(),
        ownerId: FieldValue.delete(),
        visibilityUpdatedBy: FieldValue.delete(),
        imageAttachment: FieldValue.delete(),
        imageAttachmentMeta: FieldValue.delete(),
        imageStoragePath: FieldValue.delete(),
        publicIdentifiersScrubbedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      scrubbed += 1;
    }
    await batch.commit();
  }
  return { checked: resultSnap.size, scrubbed };
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
  const [trials, reservations] = await Promise.all([
    recoverStaleProcessingCases(),
    recoverStaleReservations(),
  ]);
  console.log('recoverStaleTrials:', { trials, reservations });
});

exports.repairSocialCounters = onSchedule({ region: REGION, schedule: '20 3 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 180, memory: '256MiB' }, async () => {
  console.log('repairSocialCounters:', await repairSocialCounters({ limit: 200, onlyPublic: false }));
});

exports.scrubPublicResultIdentifiers = onSchedule({ region: REGION, schedule: '40 3 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 300, memory: '256MiB' }, async () => {
  console.log('scrubPublicResultIdentifiers:', await scrubPublicResultIdentifiers());
});

exports.recoverStaleTrialsNow = onCall({ ...ADMIN_CALLABLE_OPTIONS, timeoutSeconds: 120 }, async request => {
  await assertAdmin(request);
  const [trials, reservations] = await Promise.all([
    recoverStaleProcessingCases(),
    recoverStaleReservations(),
  ]);
  return { trials, reservations };
});

exports.repairSocialCountersNow = onCall(ADMIN_CALLABLE_OPTIONS, async request => {
  await assertAdmin(request);
  const resultLimit = numberValue(request.data?.limit, 200);
  const onlyPublic = request.data?.onlyPublic === true;
  return await repairSocialCounters({ limit: resultLimit, onlyPublic });
});

exports.scrubPublicResultIdentifiersNow = onCall({ ...ADMIN_CALLABLE_OPTIONS, timeoutSeconds: 300 }, async request => {
  await assertAdmin(request);
  return await scrubPublicResultIdentifiers();
});