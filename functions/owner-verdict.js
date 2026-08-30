'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const OWNER_VERDICT_REACTIONS = ['plaintiff', 'defendant', 'both'];

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
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

function assertOwnerVerdictVoteAllowed(caseData = {}, resultData = {}, uid = '') {
  if (!uid || caseData.userId !== uid) {
    throw new HttpsError('permission-denied', '본인 사건만 먼저 판정할 수 있습니다.');
  }
  if (isDeletionLocked(caseData, resultData)) {
    throw new HttpsError('failed-precondition', '삭제 중인 사건에는 판정할 수 없습니다.');
  }
  if (!String(resultData.verdict || '').trim()) {
    throw new HttpsError('failed-precondition', 'AI 판결이 완료된 뒤 판정할 수 있습니다.');
  }
}

exports.voteOwnVerdict = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reaction = cleanText(request.data?.reaction, 20);
  if (!caseId || !OWNER_VERDICT_REACTIONS.includes(reaction)) {
    throw new HttpsError('invalid-argument', '원고 승, 피고 승, 쌍방 과실 중 하나를 선택해 주세요.');
  }

  await enforceActionRateLimit(uid, 'owner-verdict-vote', {
    cooldownSeconds: 2,
    dailyLimit: 50
  });

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  let savedReaction = '';
  let alreadyVoted = false;

  await db.runTransaction(async tx => {
    const [caseSnap, resultSnap] = await Promise.all([
      tx.get(caseRef),
      tx.get(resultRef)
    ]);
    if (!caseSnap.exists || !resultSnap.exists) {
      throw new HttpsError('not-found', '사건 또는 판결문을 찾을 수 없습니다.');
    }

    const caseData = caseSnap.data();
    const resultData = resultSnap.data();
    assertOwnerVerdictVoteAllowed(caseData, resultData, uid);

    const previous = cleanText(caseData.ownerVerdictVote, 20);
    if (OWNER_VERDICT_REACTIONS.includes(previous)) {
      savedReaction = previous;
      alreadyVoted = true;
      return;
    }

    savedReaction = reaction;
    tx.update(caseRef, {
      ownerVerdictVote: reaction,
      ownerVerdictVotedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return {
    success: true,
    reaction: savedReaction,
    alreadyVoted
  };
});

Object.defineProperty(module.exports, 'assertOwnerVerdictVoteAllowed', {
  value: assertOwnerVerdictVoteAllowed,
  enumerable: false
});
