'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

exports.getPublicCaseOriginal = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB'
}, async request => {
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) {
    throw new HttpsError('invalid-argument', '판결 식별자가 올바르지 않습니다.');
  }

  const [resultSnap, caseSnap] = await Promise.all([
    db.doc(`results/${caseId}`).get(),
    db.doc(`cases/${caseId}`).get()
  ]);

  if (!resultSnap.exists || resultSnap.data().isPublic !== true) {
    throw new HttpsError('permission-denied', '공개 판결기록의 접수 원문만 볼 수 있습니다.');
  }
  if (!caseSnap.exists) {
    throw new HttpsError('not-found', '접수 원문을 찾을 수 없습니다.');
  }

  const resultData = resultSnap.data() || {};
  const caseData = caseSnap.data() || {};
  const caseDescription = cleanText(caseData.caseDescription, 600);
  if (!caseDescription) {
    throw new HttpsError('not-found', '기록된 접수 원문이 없습니다.');
  }

  const safety = inspectContent(caseDescription);
  if (!safety.safe) {
    throw new HttpsError('failed-precondition', '개인정보 보호를 위해 이 접수 원문은 공개할 수 없습니다.');
  }

  return {
    caseTitle: cleanText(resultData.caseTitle || caseData.caseTitle || '생활분쟁 사건', 60),
    docketNumber: cleanText(resultData.docketNumber || caseData.docketNumber, 80),
    caseDescription
  };
});
