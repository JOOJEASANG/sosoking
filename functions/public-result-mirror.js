'use strict';

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const {
  isSanitizedPublicResult,
  publicStorageProjection
} = require('./public-result-data');

const db = getFirestore();
const REGION = 'asia-northeast3';

exports.syncPublicResultMirror = onDocumentWritten({
  document: 'results/{caseId}',
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 20
}, async event => {
  const caseId = String(event.params?.caseId || '').trim();
  if (!caseId) return;

  const publicRef = db.doc(`public_results/${caseId}`);
  const after = event.data?.after;

  // Deletion, moderation hide and private transitions all remove the public mirror.
  if (!after?.exists) {
    await publicRef.delete().catch(() => null);
    return;
  }

  const raw = after.data() || {};
  if (!isSanitizedPublicResult(raw)) {
    await publicRef.delete().catch(() => null);
    return;
  }

  // Only the explicit public schema is copied. New private/internal fields in results
  // never cross into public_results unless deliberately added to publicStorageProjection.
  await publicRef.set(publicStorageProjection(raw));
});
