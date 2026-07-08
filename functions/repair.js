const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const STALE_PROCESSING_MS = 10 * 60 * 1000;

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
  return { checked: snap.size, recovered };
}

exports.recoverStaleTrials = onSchedule({ region: REGION, schedule: 'every 10 minutes', timeZone: 'Asia/Seoul', timeoutSeconds: 120, memory: '256MiB' }, async () => {
  console.log('recoverStaleTrials:', await recoverStaleProcessingCases());
});

exports.recoverStaleTrialsNow = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  return await recoverStaleProcessingCases();
});
