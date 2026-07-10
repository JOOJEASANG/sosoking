const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { parseJudgmentScript, scriptFingerprint } = require('./judgment-parser');

const db = getFirestore();
const REGION = 'asia-northeast3';
const STRUCTURE_VERSION = 'judgment-script-v1';
const MAX_BACKFILL_LIMIT = 400;

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
    structuredFromScriptVersion: STRUCTURE_VERSION,
    structuredScriptFingerprint: fingerprint,
    structuredFromScriptAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (parsed.closingComment) update.closingComment = parsed.closingComment;
  return { update, fingerprint };
}

async function backfillJudgmentStructures(limit = 200) {
  const safeLimit = Math.max(1, Math.min(MAX_BACKFILL_LIMIT, Number(limit) || 200));
  const snap = await db.collection('results').orderBy('createdAt', 'desc').limit(safeLimit).get();
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

  if (updated.length) await batch.commit();
  return {
    checked: snap.size,
    updatedCount: updated.length,
    skippedCount: skipped.length,
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
  return await backfillJudgmentStructures(request.data?.limit);
});
