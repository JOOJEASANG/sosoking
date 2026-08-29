'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');
const { enforceActionRateLimit, requireAppCheck } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function isSanitizedPublicResult(data = {}) {
  return data.isPublic === true
    && Number(data.publicDataVersion || 0) === 1
    && !Object.prototype.hasOwnProperty.call(data, 'userId')
    && !Object.prototype.hasOwnProperty.call(data, 'caseDescription')
    && !Object.prototype.hasOwnProperty.call(data, 'nickname');
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

exports.getPublicCaseOriginal = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB',
  maxInstances: 20
}, async request => {
  requireAppCheck(request);

  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId || !/^[A-Za-z0-9_-]{1,180}$/.test(caseId)) {
    throw new HttpsError('invalid-argument', '판결 식별자가 올바르지 않습니다.');
  }

  const requesterUid = String(request.auth?.uid || '');
  if (requesterUid) {
    await enforceActionRateLimit(requesterUid, 'public-original', {
      cooldownSeconds: 1,
      dailyLimit: 120
    });
  }

  const [resultSnap, caseSnap] = await Promise.all([
    db.doc(`results/${caseId}`).get(),
    db.doc(`cases/${caseId}`).get()
  ]);

  if (!caseSnap.exists) {
    throw new HttpsError('not-found', '접수 원문을 찾을 수 없습니다.');
  }

  const resultData = resultSnap.exists ? (resultSnap.data() || {}) : {};
  const caseData = caseSnap.data() || {};
  if (isDeletionLocked(caseData, resultData)) {
    throw new HttpsError('not-found', '삭제 중인 접수 원문입니다.');
  }

  const ownerUid = String(caseData.userId || '');
  const isOwner = Boolean(requesterUid && ownerUid && requesterUid === ownerUid);
  const isPublic = Boolean(resultSnap.exists && isSanitizedPublicResult(resultData));

  if (!isOwner && !isPublic) {
    throw new HttpsError('permission-denied', '판결 소유자 또는 공개 판결기록만 접수 원문을 볼 수 있습니다.');
  }

  const caseDescription = cleanText(caseData.caseDescription, 600);
  if (!caseDescription) {
    throw new HttpsError('not-found', '기록된 접수 원문이 없습니다.');
  }

  if (!isOwner) {
    const safety = inspectContent(caseDescription);
    if (!safety.safe) {
      throw new HttpsError('failed-precondition', '개인정보 보호를 위해 이 접수 원문은 공개할 수 없습니다.');
    }
  }

  return {
    caseTitle: cleanText(resultData.caseTitle || caseData.caseTitle || '생활분쟁 사건', 60),
    docketNumber: cleanText(resultData.docketNumber || caseData.docketNumber, 80),
    caseDescription
  };
});
