const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanId(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 180);
}

exports.setAdminResultVisibility = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 공개 상태를 변경할 수 있습니다.');
  }

  const caseId = cleanId(request.data?.caseId);
  const isPublic = request.data?.isPublic;
  if (!caseId || typeof isPublic !== 'boolean') {
    throw new HttpsError('invalid-argument', '공개 상태 요청이 올바르지 않습니다.');
  }

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);

  await db.runTransaction(async tx => {
    const [caseSnap, resultSnap] = await Promise.all([
      tx.get(caseRef),
      tx.get(resultRef)
    ]);

    if (!caseSnap.exists && !resultSnap.exists) {
      throw new HttpsError('not-found', '사건 또는 판결문을 찾을 수 없습니다.');
    }

    if (caseSnap.exists) {
      tx.update(caseRef, {
        isPublic,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    if (resultSnap.exists) {
      tx.update(resultRef, {
        isPublic,
        userId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });

  await db.collection('admin_logs').add({
    uid: request.auth.uid,
    action: 'setAdminResultVisibility',
    caseId,
    detail: { isPublic },
    createdAt: FieldValue.serverTimestamp()
  }).catch(() => null);

  return { success: true, caseId, isPublic };
});
