const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { parseJudgmentScript, scriptFingerprint } = require('./judgment-parser');

const db = getFirestore();
const REGION = 'asia-northeast3';
const STRUCTURE_VERSION = 'judgment-script-v2';
const MAX_BACKFILL_LIMIT = 400;
const BACKFILL_STATE_PATH = 'maintenance_state/judgment_structure_backfill';

function structureUpdate(data = {}) {
  const judgmentScript = String(data.judgmentScript || '').trim();
  if (!judgmentScript) return null;

  const fingerprint = scriptFingerprint(judgmentScript);
  if (
    data.structuredFromScriptVersion === STRUCTURE_VERSION &&
    data.structuredScriptFingerprint === fingerprint
  ) {
    return null;
  }

  const parsed = parseJudgmentScript(judgmentScript);
  if (!parsed) return null;

  const update = {
    expandedCase: parsed.facts,
    reception: parsed.facts,
    caseTimeline: parsed.investigation,
    forensicReport: parsed.investigation,
    investigation: parsed.investigation,
    plaintiffArg: parsed.plaintiff,
    defendantArg: parsed.defendant,
    courtOpinion: parsed.opinion,
    verdict: parsed.opinion,
    sentence: parsed.sentence,
    quickVerdict: parsed.quickVerdict,
    primarySentence: parsed.primarySentence,
    closingComment: parsed.closingComment || FieldValue.delete(),
    structuredFromScriptVersion: STRUCTURE_VERSION,
    structuredScriptFingerprint: fingerprint,
    structuredFromScriptAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  return { update, fingerprint };
}

async function resetBackfillCursor(stateRef, reason) {
  await stateRef.set({
    lastDocumentId: FieldValue.delete(),
    cursorResetAt: FieldValue.serverTimestamp(),
    cursorResetReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function backfillJudgmentStructures(limit = 200, options = {}) {
  const safeLimit = Math.max(1, Math.min(MAX_BACKFILL_LIMIT, Number(limit) || 200));
  const stateRef = db.doc(BACKFILL_STATE_PATH);

  if (options.resetCursor === true) {
    await resetBackfillCursor(stateRef, 'manual');
  }

  const stateSnap = await stateRef.get().catch(() => null);
  const cursorId = options.resetCursor === true
    ? ''
    : String(stateSnap?.data()?.lastDocumentId || '').trim();

  let query = db.collection('results')
    .orderBy(FieldPath.documentId(), 'asc')
    .limit(safeLimit);
  if (cursorId) query = query.startAfter(cursorId);

  const snap = await query.get();
  if (snap.empty) {
    if (cursorId) await resetBackfillCursor(stateRef, 'end-of-collection');
    return {
      checked: 0,
      updatedCount: 0,
      skippedCount: 0,
      cycleCompleted: !!cursorId,
      previousCursor: cursorId || null,
      nextCursor: null,
      updated: [],
    };
  }

  const batch = db.batch();
  const updated = [];
  const skipped = [];

  for (const resultDoc of snap.docs) {
    const structured = structureUpdate(resultDoc.data() || {});
    if (!structured) {
      skipped.push(resultDoc.id);
      continue;
    }
    batch.set(resultDoc.ref, structured.update, { merge: true });
    updated.push({ caseId: resultDoc.id, fingerprint: structured.fingerprint });
  }

  const lastDocumentId = snap.docs[snap.docs.length - 1].id;
  const cycleCompleted = snap.size < safeLimit;
  batch.set(stateRef, {
    lastDocumentId: cycleCompleted ? FieldValue.delete() : lastDocumentId,
    lastCheckedCount: snap.size,
    lastUpdatedCount: updated.length,
    lastSkippedCount: skipped.length,
    lastRunAt: FieldValue.serverTimestamp(),
    totalUpdated: FieldValue.increment(updated.length),
    completedCycles: cycleCompleted ? FieldValue.increment(1) : FieldValue.increment(0),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();
  return {
    checked: snap.size,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    cycleCompleted,
    previousCursor: cursorId || null,
    nextCursor: cycleCompleted ? null : lastDocumentId,
    updated,
  };
}

exports.syncJudgmentStructure = onDocumentWritten({
  document: 'results/{caseId}',
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  retry: false,
}, async event => {
  const after = event.data?.after;
  if (!after?.exists) return;

  const structured = structureUpdate(after.data() || {});
  if (!structured) return;

  await after.ref.set(structured.update, { merge: true });
  console.log('judgment structure synchronized', {
    caseId: event.params.caseId,
    fingerprint: structured.fingerprint,
    version: STRUCTURE_VERSION,
  });
});

exports.backfillJudgmentStructures = onSchedule({
  region: REGION,
  schedule: '40 3 * * *',
  timeZone: 'Asia/Seoul',
  timeoutSeconds: 180,
  memory: '256MiB',
}, async () => {
  console.log('backfillJudgmentStructures:', await backfillJudgmentStructures(200));
});

exports.backfillJudgmentStructuresNow = onCall({
  region: REGION,
  timeoutSeconds: 180,
  memory: '256MiB',
  cors: true,
}, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  }
  return await backfillJudgmentStructures(request.data?.limit, {
    resetCursor: request.data?.resetCursor === true,
  });
});
