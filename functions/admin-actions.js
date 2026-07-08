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
async function deleteCourtData(caseId, counter) {
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
}
async function writeAdminLog(uid, action, caseId, detail = {}) {
  await db.collection('admin_logs').add({ uid, action, caseId, detail, createdAt: FieldValue.serverTimestamp() }).catch(() => null);
}

exports.deleteMyCase = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanId(request.data?.caseId);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');

  const caseRef = db.doc(`cases/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) return { success: true, caseId, alreadyDeleted: true, deleted: 0 };

  const c = caseSnap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 삭제할 수 있습니다.');
  if (c.status === 'processing') {
    throw new HttpsError('failed-precondition', '재판이 진행 중인 사건은 판결 완료 후 삭제할 수 있습니다.');
  }

  await caseRef.set({ status: 'deleting', isPublic: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`results/${caseId}`).set({ isPublic: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);

  const counter = { deleted: 0 };
  await deleteCourtData(caseId, counter);
  return { success: true, caseId, deleted: counter.deleted };
});

exports.deleteCourtPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 삭제할 수 있습니다.');
  }
  const caseId = cleanId(request.data?.caseId);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');

  const counter = { deleted: 0 };
  await deleteCourtData(caseId, counter);

  await writeAdminLog(request.auth.uid, 'deleteCourtPost', caseId, counter);
  return { success: true, caseId, deleted: counter.deleted };
});
