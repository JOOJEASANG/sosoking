const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const REPORT_ACTIONS = new Set(['dismiss', 'hide']);

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

async function submitReportData(uid, caseId, reason) {
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const keyRef = db.doc(`report_keys/${reportKey(uid, caseId)}`);
  const reportRef = db.collection('reports').doc();

  await db.runTransaction(async tx => {
    const [caseSnap, resultSnap, keySnap] = await Promise.all([
      tx.get(caseRef),
      tx.get(resultRef),
      tx.get(keyRef)
    ]);

    if (!resultSnap.exists || resultSnap.data().isPublic !== true) {
      throw new HttpsError('not-found', '신고할 수 있는 공개 판결문을 찾을 수 없습니다.');
    }
    if (caseSnap.exists && caseSnap.data().userId === uid) {
      throw new HttpsError('failed-precondition', '본인이 작성한 판결문은 신고할 수 없습니다.');
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

  return { reportId: reportRef.id };
}

async function moderateReportData(reportId, action, adminUid) {
  const reportRef = db.doc(`reports/${reportId}`);
  return db.runTransaction(async tx => {
    const reportSnap = await tx.get(reportRef);
    if (!reportSnap.exists) throw new HttpsError('not-found', '신고 기록을 찾을 수 없습니다.');
    const report = reportSnap.data();
    if (report.status !== 'pending') {
      return { alreadyHandled: true, status: report.status || 'unknown', caseId: cleanCaseId(report.caseId) };
    }

    const caseId = cleanCaseId(report.caseId);
    if (!caseId) throw new HttpsError('failed-precondition', '신고 대상 사건 ID가 올바르지 않습니다.');
    const caseRef = db.doc(`cases/${caseId}`);
    const resultRef = db.doc(`results/${caseId}`);
    const [caseSnap, resultSnap] = await Promise.all([tx.get(caseRef), tx.get(resultRef)]);

    if (action === 'hide') {
      if (caseSnap.exists) {
        tx.update(caseRef, {
          isPublic: false,
          moderationStatus: 'hidden-by-report',
          updatedAt: FieldValue.serverTimestamp()
        });
      }
      if (resultSnap.exists) {
        tx.update(resultRef, {
          isPublic: false,
          moderationStatus: 'hidden-by-report',
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    }

    const status = action === 'hide' ? 'resolved' : 'dismissed';
    tx.update(reportRef, {
      status,
      resolutionAction: action,
      resolvedBy: adminUid,
      resolvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return {
      alreadyHandled: false,
      status,
      caseId,
      caseFound: caseSnap.exists,
      resultFound: resultSnap.exists,
      hidden: action === 'hide'
    };
  });
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

  const result = await submitReportData(uid, caseId, reason);
  return { success: true, ...result };
});

exports.moderateReport = onCall({
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB'
}, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 신고를 처리할 수 있습니다.');
  }
  const reportId = cleanCaseId(request.data?.reportId);
  const action = cleanText(request.data?.action, 20);
  if (!reportId || !REPORT_ACTIONS.has(action)) {
    throw new HttpsError('invalid-argument', '신고 처리 요청이 올바르지 않습니다.');
  }

  const result = await moderateReportData(reportId, action, request.auth.uid);
  await db.collection('admin_logs').add({
    uid: request.auth.uid,
    action: 'moderateReport',
    subjectId: reportId,
    detail: { ...result, moderationAction: action },
    createdAt: FieldValue.serverTimestamp()
  }).catch(() => null);
  return { success: true, reportId, action, ...result };
});

Object.defineProperties(module.exports, {
  submitReportData: { value: submitReportData, enumerable: false },
  moderateReportData: { value: moderateReportData, enumerable: false }
});
