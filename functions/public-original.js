'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');
const { enforceActionRateLimit, requireAppCheck } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const PUBLIC_PRIVACY_NOTICE = '개인정보 보호를 위해 실제 접수 원문은 작성자에게만 공개됩니다. 공개 화면에는 안전하게 정리된 사건 기록과 AI 판결만 제공됩니다.';

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

function safePublicDescription(resultData = {}) {
  const candidate = cleanText(resultData.publicCaseDescription, 600);
  if (!candidate) return PUBLIC_PRIVACY_NOTICE;
  const safety = inspectContent(candidate);
  return safety.safe ? candidate : PUBLIC_PRIVACY_NOTICE;
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
  if (!requesterUid) {
    throw new HttpsError('unauthenticated', '정상적인 앱 세션에서 다시 시도해 주세요.');
  }
  await enforceActionRateLimit(requesterUid, 'public-original', {
    cooldownSeconds: 1,
    dailyLimit: 120
  });

  const [resultSnap, caseSnap] = await Promise.all([
    db.doc(`results/${caseId}`).get(),
    db.doc(`cases/${caseId}`).get()
  ]);

  if (!caseSnap.exists) {
    throw new HttpsError('not-found', '접수 기록을 찾을 수 없습니다.');
  }

  const resultData = resultSnap.exists ? (resultSnap.data() || {}) : {};
  const caseData = caseSnap.data() || {};
  if (isDeletionLocked(caseData, resultData)) {
    throw new HttpsError('not-found', '삭제 중인 접수 기록입니다.');
  }

  const ownerUid = String(caseData.userId || '');
  const isOwner = Boolean(ownerUid && requesterUid === ownerUid);
  const isPublic = Boolean(resultSnap.exists && isSanitizedPublicResult(resultData));
  if (!isOwner && !isPublic) {
    throw new HttpsError('permission-denied', '작성자 또는 공개 판결기록에서만 확인할 수 있습니다.');
  }

  const title = cleanText(resultData.caseTitle || caseData.caseTitle || '생활분쟁 사건', 60);
  const docketNumber = cleanText(resultData.docketNumber || caseData.docketNumber, 80);

  if (isOwner) {
    const original = cleanText(caseData.caseDescription, 600);
    if (!original) throw new HttpsError('not-found', '기록된 접수 원문이 없습니다.');
    return {
      caseTitle: title,
      docketNumber,
      caseDescription: original,
      originalVisible: true
    };
  }

  return {
    caseTitle: title,
    docketNumber,
    caseDescription: safePublicDescription(resultData),
    originalVisible: false
  };
});

Object.defineProperties(module.exports, {
  safePublicDescription: { value: safePublicDescription, enumerable: false },
  PUBLIC_PRIVACY_NOTICE: { value: PUBLIC_PRIVACY_NOTICE, enumerable: false }
});
