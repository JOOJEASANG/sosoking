const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { FieldValue } = require('firebase-admin/firestore');
const { parseJudgmentScript, scriptFingerprint } = require('./judgment-parser');

const REGION = 'asia-northeast3';
const STRUCTURE_VERSION = 'judgment-script-v1';

exports.syncJudgmentStructure = onDocumentWritten({
  document: 'results/{caseId}',
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  retry: false,
}, async event => {
  const after = event.data?.after;
  if (!after?.exists) return;

  const data = after.data() || {};
  const judgmentScript = String(data.judgmentScript || '').trim();
  if (!judgmentScript) return;

  const fingerprint = scriptFingerprint(judgmentScript);
  if (
    data.structuredFromScriptVersion === STRUCTURE_VERSION &&
    data.structuredScriptFingerprint === fingerprint
  ) {
    return;
  }

  const parsed = parseJudgmentScript(judgmentScript);
  if (!parsed) {
    console.warn('judgment structure sync skipped: invalid script', {
      caseId: event.params.caseId,
      fingerprint,
    });
    return;
  }

  const updates = {
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

  if (parsed.closingComment) updates.closingComment = parsed.closingComment;

  await after.ref.set(updates, { merge: true });
  console.log('judgment structure synchronized', {
    caseId: event.params.caseId,
    fingerprint,
  });
});
