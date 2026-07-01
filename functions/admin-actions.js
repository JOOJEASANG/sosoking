const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const BATCH_LIMIT = 450;

function cleanId(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 180);
}
async function deleteQuerySnapshot(query, counter) {
  while (true) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    counter.deleted += snap.size;
    if (snap.size < BATCH_LIMIT) break;
  }
}
async function writeAdminLog(uid, action, caseId, detail = {}) {
  await db.collection('admin_logs').add({ uid, action, caseId, detail, createdAt: FieldValue.serverTimestamp() }).catch(() => null);
}

exports.deleteCourtPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 삭제할 수 있습니다.');
  }
  const caseId = cleanId(request.data?.caseId);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');

  const counter = { deleted: 0 };

  await deleteQuerySnapshot(db.collection(`result_reactions/${caseId}/votes`), counter);
  await deleteQuerySnapshot(db.collection(`court_comments/${caseId}/items`), counter);
  await deleteQuerySnapshot(db.collection('reports').where('caseId', '==', caseId), counter);

  const refs = [
    db.doc(`result_reactions/${caseId}`),
    db.doc(`court_comment_stats/${caseId}`),
    db.doc(`court_comments/${caseId}`),
    db.doc(`results/${caseId}`),
    db.doc(`cases/${caseId}`),
  ];
  const batch = db.batch();
  refs.forEach(ref => batch.delete(ref));
  await batch.commit();
  counter.deleted += refs.length;

  await writeAdminLog(request.auth.uid, 'deleteCourtPost', caseId, counter);
  return { success: true, caseId, deleted: counter.deleted };
});
