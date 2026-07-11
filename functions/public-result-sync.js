const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { buildPublicResult, shouldPublish } = require('./public-result-projection');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const REGION = 'asia-northeast3';
const ADMIN_EMAILS = new Set(['joojeasang@gmail.com']);

function requireAdmin(request) {
  const token = request.auth?.token || {};
  const email = String(token.email || '').toLowerCase();
  if (!request.auth?.uid || (token.admin !== true && !ADMIN_EMAILS.has(email))) {
    throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
  }
  return request.auth;
}

exports.syncPublicResult = onDocumentWritten({
  region: REGION,
  document: 'results/{caseId}',
}, async event => {
  const caseId = event.params.caseId;
  const publicRef = db.collection('public_results').doc(caseId);
  const after = event.data?.after;
  if (!after?.exists) {
    await publicRef.delete().catch(() => null);
    return;
  }
  const source = after.data();
  if (!shouldPublish(source)) {
    await publicRef.delete().catch(() => null);
    return;
  }
  await publicRef.set(buildPublicResult(source));
});

exports.backfillPublicResults = onCall({ region: REGION, cors: true, timeoutSeconds: 120 }, async request => {
  requireAdmin(request);
  const snapshot = await db.collection('results').where('isPublic', '==', true).limit(500).get();
  let batch = db.batch();
  let writes = 0;
  let synced = 0;

  for (const item of snapshot.docs) {
    const source = item.data();
    if (!shouldPublish(source)) continue;
    batch.set(db.collection('public_results').doc(item.id), buildPublicResult(source));
    writes += 1;
    synced += 1;
    if (writes >= 400) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }
  if (writes > 0) await batch.commit();

  logger.info('Public result backfill completed', { synced, requestedBy: request.auth.uid });
  return { synced, scanned: snapshot.size };
});
