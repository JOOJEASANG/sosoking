const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanCaseId(value) {
  const caseId = cleanText(value, 180);
  return /^[A-Za-z0-9_-]{1,180}$/.test(caseId) ? caseId : '';
}

function reportKey(uid, caseId) {
  return crypto.createHash('sha256').update(`${uid}\u0000${caseId}`).digest('hex');
}

exports.submitReport = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const caseId = cleanCaseId(request.data?.caseId);
  const reason = cleanText(request.data?.reason, 300);
  if (!caseId) throw new HttpsError('invalid-argument', '신고 대상이 올바르지 않습니다.');
  if (reason.length < 5) throw new HttpsError('invalid-argument', '신고 사유를 5자 이상 입력해 주세요.');

  const reasonSafety = inspectContent(reason, { allowHighRisk: true });
  if (!reasonSafety.safe) {
    throw new HttpsError('failed-precondition', reasonSafety.message);
  }

  await enforceActionRateLimit(uid, 'result-report', {
    cooldownSeconds: 30,
    dailyLimit: 10
  });

  const resultRef = db.doc(`results/${caseId}`);
  const keyRef = db.doc(`report_keys/${reportKey(uid, caseId)}`);
  const reportRef = db.collection('reports').doc();

  await db.runTransaction(async tx => {
    const [resultSnap, keySnap] = await Promise.all([
      tx.get(resultRef),
      tx.get(keyRef)
    ]);

    if (!resultSnap.exists || resultSnap.data().isPublic !== true) {
      throw new HttpsError('not-found', '신고할 수 있는 공개 판결문을 찾을 수 없습니다.');
    }
    if (keySnap.exists) {
      throw new HttpsError('already-exists', '이미 신고한 판결문입니다.');
    }

    tx.set(reportRef, {
      caseId,
      reason,
      status: 'pending',
      userId: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(keyRef, {
      caseId,
      userId: uid,
      reportId: reportRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.update(resultRef, {
      reportCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { success: true, reportId: reportRef.id };
});
