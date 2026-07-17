const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  requireVerifiedUser,
  validDocumentId,
  assertNoSensitiveContent,
  publicAuthorId,
} = require('./security-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const REPORT_DAILY_LIMIT = 20;
const REPORT_COOLDOWN_SEC = 30;

function cleanReason(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

exports.reportResult = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  cors: true,
}, async request => {
  const uid = requireVerifiedUser(request, '신고는 구글 또는 인증된 이메일 로그인 후 이용할 수 있습니다.');
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');
  const reason = cleanReason(request.data?.reason);
  if (reason.length < 2) throw new HttpsError('invalid-argument', '신고 사유를 2자 이상 입력해주세요.');
  assertNoSensitiveContent(reason, '신고 사유에 포함할 수 없는 정보');

  const resultRef = db.doc(`results/${caseId}`);
  const caseRef = db.doc(`cases/${caseId}`);
  const limitRef = db.doc(`report_limits/${uid}`);
  const reporterPublicId = publicAuthorId(uid, caseId);
  const reportRef = db.doc(`reports/${caseId}_${reporterPublicId}`);
  const today = kstDateKey();
  let alreadyExists = false;

  await db.runTransaction(async transaction => {
    const [resultSnap, caseSnap, limitSnap, reportSnap] = await Promise.all([
      transaction.get(resultRef),
      transaction.get(caseRef),
      transaction.get(limitRef),
      transaction.get(reportRef),
    ]);
    if (!resultSnap.exists || resultSnap.data().isPublic !== true) {
      throw new HttpsError('failed-precondition', '공개 판결만 신고할 수 있습니다.');
    }

    const resultData = resultSnap.data() || {};
    const caseData = caseSnap.exists ? caseSnap.data() : {};
    const ownerId = caseData.userId || resultData.ownerId || resultData.userId || '';
    if (ownerId === uid) throw new HttpsError('failed-precondition', '본인 판결은 신고할 수 없습니다.');
    if (reportSnap.exists) {
      alreadyExists = true;
      return;
    }

    const current = limitSnap.exists ? limitSnap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= REPORT_DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', `오늘 신고 한도 ${REPORT_DAILY_LIMIT}회를 모두 사용했습니다.`);
    }
    if (current.lastReportedAt && current.date === today) {
      const lastMs = current.lastReportedAt.toMillis
        ? current.lastReportedAt.toMillis()
        : new Date(current.lastReportedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < REPORT_COOLDOWN_SEC) {
        throw new HttpsError('resource-exhausted', `${REPORT_COOLDOWN_SEC - diffSec}초 후에 다시 신고할 수 있습니다.`);
      }
    }

    transaction.create(reportRef, {
      caseId,
      reason,
      status: 'pending',
      reporterUid: uid,
      reporterPublicId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(limitRef, {
      date: today,
      count: count + 1,
      lastReportedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(resultRef, {
      reportCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (caseSnap.exists) {
      transaction.set(caseRef, {
        reportCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });

  return { success: true, caseId, alreadyExists };
});