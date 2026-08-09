const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { inspectContent } = require('./content-safety');
const { requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanId(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 180);
}

function isDeletionLocked(...records) {
  return records.some(data => {
    const deletionStatus = String(data?.deletionStatus || '').toLowerCase();
    const status = String(data?.status || '').toLowerCase();
    const courtStage = String(data?.courtStage || '').toLowerCase();
    return deletionStatus === 'processing'
      || deletionStatus === 'deleting'
      || status === 'deleting'
      || courtStage === 'deleting';
  });
}

function publicResultText(caseData = {}, resultData = {}) {
  return [
    caseData.caseTitle,
    caseData.caseDescription,
    resultData.caseTitle,
    resultData.caseDescription,
    resultData.reception,
    resultData.investigation,
    resultData.plaintiffArg,
    resultData.defendantArg,
    resultData.verdict,
    resultData.sentence,
    resultData.appeal?.reason,
    resultData.appeal?.verdict
  ].filter(Boolean).join('\n');
}

async function writeVisibilityLog(uid, caseId, isPublic) {
  try {
    await db.collection('admin_logs').add({
      uid,
      action: 'setAdminResultVisibility',
      caseId,
      detail: { isPublic, contentSafetyChecked: isPublic },
      createdAt: FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('administrator visibility audit log failed:', {
      uid,
      caseId,
      isPublic,
      code: error?.code || '',
      message: error?.message || ''
    });
    return false;
  }
}

exports.setAdminResultVisibility = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  if (!(await isAdminAuth(request.auth))) {
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
    if (isPublic && !resultSnap.exists) {
      throw new HttpsError('failed-precondition', '완성된 판결문이 있어야 공개할 수 있습니다.');
    }

    const caseData = caseSnap.exists ? caseSnap.data() : {};
    const resultData = resultSnap.exists ? resultSnap.data() : {};
    if (isDeletionLocked(caseData, resultData)) {
      throw new HttpsError('failed-precondition', '삭제 중인 사건은 공개 상태를 변경할 수 없습니다.');
    }

    if (isPublic) {
      const safety = inspectContent(publicResultText(caseData, resultData));
      if (!safety.safe) {
        throw new HttpsError(
          'failed-precondition',
          '공개할 수 없는 개인정보 또는 고위험 내용이 포함되어 있습니다.'
        );
      }
    }

    if (caseSnap.exists) {
      tx.update(caseRef, {
        isPublic,
        moderationStatus: isPublic ? FieldValue.delete() : (caseData.moderationStatus || FieldValue.delete()),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    if (resultSnap.exists) {
      tx.update(resultRef, {
        isPublic,
        userId: FieldValue.delete(),
        caseDescription: FieldValue.delete(),
        nickname: FieldValue.delete(),
        publicCaseDescription: resultData.publicCaseDescription || '',
        publicNickname: resultData.publicNickname || '익명 원고',
        publicDataVersion: 1,
        moderationStatus: isPublic ? FieldValue.delete() : (resultData.moderationStatus || FieldValue.delete()),
        contentSafetyStatus: isPublic ? 'passed' : (resultData.contentSafetyStatus || 'not-public'),
        contentSafetyCheckedAt: isPublic
          ? FieldValue.serverTimestamp()
          : (resultData.contentSafetyCheckedAt || FieldValue.delete()),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });

  const auditLogged = await writeVisibilityLog(request.auth.uid, caseId, isPublic);
  return { success: true, auditLogged, caseId, isPublic };
});
