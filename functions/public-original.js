'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');
const { enforceActionRateLimit, requireAppCheck } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const REDACTED_PUBLIC_ORIGINAL = '개인정보 보호를 위해 실제 접수 원문은 작성자에게만 공개됩니다. 공개 화면에는 익명화된 판결 기록만 제공됩니다.';

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

function selectCaseDescription({ isOwner, caseData = {}, resultData = {} } = {}) {
  if (isOwner) {
    return cleanText(caseData.caseDescription, 600);
  }

  // 공개 이용자에게는 cases/{caseId}.caseDescription을 절대로 반환하지 않는다.
  // 공개 전용 필드가 존재하고 현재 안전검사를 통과하는 경우에만 그 요약을 사용한다.
  const publicDescription = cleanText(resultData.publicCaseDescription, 600);
  if (publicDescription) {
    const safety = inspectContent(publicDescription);
    if (safety.safe) return publicDescription;
  }
  return REDACTED_PUBLIC_ORIGINAL;
}

exports.getPublicCaseOriginal = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB',
  maxInstances: 20
}, async request => {
  requireAppCheck(request);

  // 웹 앱은 비로그인 방문자도 Firebase 익명 인증으로 세션을 만든다.
  // 인증 없는 직접 호출은 rate limit을 우회하므로 거부한다.
  const requesterUid = String(request.auth?.uid || '');
  if (!requesterUid) {
    throw new HttpsError('unauthenticated', '앱에서 다시 접속해 주세요.');
  }

  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId || !/^[A-Za-z0-9_-]{1,180}$/.test(caseId)) {
    throw new HttpsError('invalid-argument', '판결 식별자가 올바르지 않습니다.');
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
    throw new HttpsError('permission-denied', '판결 소유자 또는 공개 판결기록만 접수 내용을 볼 수 있습니다.');
  }

  const caseDescription = selectCaseDescription({ isOwner, caseData, resultData });
  if (!caseDescription) {
    throw new HttpsError('not-found', '기록된 접수 원문이 없습니다.');
  }

  return {
    caseTitle: cleanText(resultData.caseTitle || caseData.caseTitle || '생활분쟁 사건', 60),
    docketNumber: cleanText(resultData.docketNumber || caseData.docketNumber, 80),
    caseDescription,
    originalVisible: isOwner
  };
});

Object.defineProperties(module.exports, {
  REDACTED_PUBLIC_ORIGINAL: { value: REDACTED_PUBLIC_ORIGINAL, enumerable: false },
  selectCaseDescription: { value: selectCaseDescription, enumerable: false }
});
