'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const JURY_REACTIONS = ['plaintiff', 'defendant', 'both'];

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function isDeletionLocked(data = {}) {
  const deletionStatus = String(data.deletionStatus || '').toLowerCase();
  const status = String(data.status || '').toLowerCase();
  const courtStage = String(data.courtStage || '').toLowerCase();
  return deletionStatus === 'processing'
    || deletionStatus === 'deleting'
    || status === 'deleting'
    || courtStage === 'deleting';
}

function isSanitizedPublicResult(data = {}) {
  return data.isPublic === true
    && Number(data.publicDataVersion || 0) === 1
    && !Object.prototype.hasOwnProperty.call(data, 'userId')
    && !Object.prototype.hasOwnProperty.call(data, 'caseDescription')
    && !Object.prototype.hasOwnProperty.call(data, 'nickname');
}

function assertJuryVoteAllowed(data = {}) {
  if (isDeletionLocked(data)) {
    throw new HttpsError('failed-precondition', '삭제 중인 판결문에는 참여할 수 없습니다.');
  }
  if (!isSanitizedPublicResult(data)) {
    throw new HttpsError('permission-denied', '공개 준비가 완료된 판결문만 참여할 수 있습니다.');
  }
}

exports.voteResult = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reaction = cleanText(request.data?.reaction, 20);
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(caseId) || !JURY_REACTIONS.includes(reaction)) {
    throw new HttpsError('invalid-argument', '원고 승, 피고 승, 쌍방 과실 중 하나를 선택해 주세요.');
  }

  await enforceActionRateLimit(uid, 'court-vote', {
    cooldownSeconds: 2,
    dailyLimit: 200
  });

  const resultRef = db.doc(`results/${caseId}`);
  const summaryRef = db.doc(`result_reactions/${caseId}`);
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);
  let savedReaction = reaction;
  let alreadyVoted = false;

  await db.runTransaction(async tx => {
    const [resultSnap, voteSnap] = await Promise.all([
      tx.get(resultRef),
      tx.get(voteRef)
    ]);
    if (!resultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
    assertJuryVoteAllowed(resultSnap.data());

    const previousRaw = voteSnap.exists ? cleanText(voteSnap.data().reaction, 20) : '';
    if (JURY_REACTIONS.includes(previousRaw)) {
      savedReaction = previousRaw;
      alreadyVoted = true;
      return;
    }

    const legacyReaction = previousRaw && !JURY_REACTIONS.includes(previousRaw) ? previousRaw : '';
    const updates = {
      updatedAt: FieldValue.serverTimestamp(),
      total: FieldValue.increment(voteSnap.exists ? 0 : 1),
      [`counts.${reaction}`]: FieldValue.increment(1)
    };
    if (legacyReaction) updates[`counts.${legacyReaction}`] = FieldValue.increment(-1);

    tx.set(summaryRef, updates, { merge: true });
    tx.set(voteRef, {
      uid,
      reaction,
      createdAt: voteSnap.exists ? (voteSnap.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    if (!voteSnap.exists) {
      tx.update(resultRef, {
        reactionTotal: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });

  return {
    success: true,
    reaction: savedReaction,
    alreadyVoted
  };
});

Object.defineProperties(module.exports, {
  JURY_REACTIONS: { value: JURY_REACTIONS, enumerable: false },
  assertJuryVoteAllowed: { value: assertJuryVoteAllowed, enumerable: false }
});
