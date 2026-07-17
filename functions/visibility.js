const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const {
  requireVerifiedUser,
  validDocumentId,
  assertNoSensitiveContent,
} = require('./security-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';

function publicText(caseData = {}, resultData = {}) {
  const judgment = resultData.judgment && typeof resultData.judgment === 'object'
    ? resultData.judgment
    : {};
  const appeal = resultData.appeal && typeof resultData.appeal === 'object'
    ? resultData.appeal
    : {};
  return [
    caseData.caseTitle,
    caseData.caseDescription,
    caseData.desiredVerdict,
    resultData.caseTitle,
    resultData.caseDescription,
    resultData.desiredVerdict,
    judgment.headline,
    judgment.breakingNews,
    judgment.emergencyBriefing,
    judgment.impactAssessment,
    judgment.summary,
    judgment.facts,
    judgment.investigation,
    judgment.plaintiffClaim,
    judgment.defendantClaim,
    judgment.prosecution,
    judgment.defense,
    judgment.opinion,
    ...(Array.isArray(judgment.orders) ? judgment.orders.map(order => order?.text || order) : []),
    judgment.closingComment,
    appeal.reason,
    appeal.verdict,
  ].filter(Boolean).join('\n');
}

exports.setCaseVisibility = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  cors: true,
}, async request => {
  const uid = requireVerifiedUser(request, '판결 공개 설정은 로그인 후 이용할 수 있습니다.');
  const admin = await isAdminAuth(request.auth).catch(() => false);
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');
  const isPublic = request.data?.isPublic;
  if (typeof isPublic !== 'boolean') throw new HttpsError('invalid-argument', '공개 상태가 올바르지 않습니다.');

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);

  await db.runTransaction(async transaction => {
    const [caseSnap, resultSnap] = await Promise.all([
      transaction.get(caseRef),
      transaction.get(resultRef),
    ]);
    if (!caseSnap.exists || !resultSnap.exists) {
      throw new HttpsError('not-found', '사건 또는 판결문을 찾을 수 없습니다.');
    }

    const caseData = caseSnap.data() || {};
    const resultData = resultSnap.data() || {};
    const ownerId = caseData.userId || resultData.ownerId || resultData.userId || '';
    if (!admin && ownerId !== uid) throw new HttpsError('permission-denied', '본인 사건만 공개 상태를 변경할 수 있습니다.');

    if (isPublic) {
      assertNoSensitiveContent(
        publicText(caseData, resultData),
        '공개할 수 없는 개인정보 또는 특정 가능한 정보',
      );
    }

    const commonUpdate = {
      isPublic,
      visibilityUpdatedAt: FieldValue.serverTimestamp(),
      visibilityActor: admin ? 'admin' : 'owner',
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.update(caseRef, commonUpdate);

    const resultUpdate = { ...commonUpdate };
    if (isPublic) {
      resultUpdate.userId = FieldValue.delete();
      resultUpdate.ownerId = FieldValue.delete();
      resultUpdate.visibilityUpdatedBy = FieldValue.delete();
      resultUpdate.imageAttachment = FieldValue.delete();
      resultUpdate.imageAttachmentMeta = FieldValue.delete();
      resultUpdate.imageStoragePath = FieldValue.delete();
    }
    transaction.update(resultRef, resultUpdate);
  });

  return { success: true, caseId, isPublic, admin };
});