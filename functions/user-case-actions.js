const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const REGION = 'asia-northeast3';

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인 후 이용해 주세요.');
  return request.auth;
}

function cleanId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) throw new HttpsError('invalid-argument', '올바른 사건 번호가 아닙니다.');
  return id;
}

exports.updateCaseVisibility = onCall({ region: REGION, cors: true }, async request => {
  const auth = requireUser(request);
  const caseId = cleanId(request.data?.caseId);
  const isPublic = request.data?.isPublic === true;
  const caseRef = db.collection('cases').doc(caseId);
  const resultRef = db.collection('results').doc(caseId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async transaction => {
    const [caseSnap, resultSnap] = await Promise.all([transaction.get(caseRef), transaction.get(resultRef)]);
    if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    if (caseSnap.data().userId !== auth.uid) throw new HttpsError('permission-denied', '본인 사건만 변경할 수 있습니다.');
    const moderationStatus = resultSnap.exists
      ? resultSnap.data().moderationStatus || caseSnap.data().moderationStatus
      : caseSnap.data().moderationStatus;
    if (isPublic && moderationStatus === 'hidden') {
      throw new HttpsError('failed-precondition', '운영 검토로 숨김 처리된 사건은 다시 공개할 수 없습니다.');
    }
    transaction.update(caseRef, { isPublic, updatedAt: now });
    if (resultSnap.exists) transaction.update(resultRef, { isPublic, updatedAt: now });
  });

  logger.info('Case visibility updated', { caseId, userId: auth.uid, isPublic });
  return { caseId, isPublic };
});

exports.deleteMyCase = onCall({ region: REGION, cors: true }, async request => {
  const auth = requireUser(request);
  const caseId = cleanId(request.data?.caseId);
  const caseRef = db.collection('cases').doc(caseId);
  const resultRef = db.collection('results').doc(caseId);
  const reactionRef = db.collection('result_reactions').doc(caseId);

  await db.runTransaction(async transaction => {
    const caseSnap = await transaction.get(caseRef);
    if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    if (caseSnap.data().userId !== auth.uid) throw new HttpsError('permission-denied', '본인 사건만 삭제할 수 있습니다.');
    transaction.delete(reactionRef);
    transaction.delete(resultRef);
    transaction.delete(caseRef);
  });

  logger.info('User case deleted', { caseId, userId: auth.uid });
  return { caseId, deleted: true };
});
