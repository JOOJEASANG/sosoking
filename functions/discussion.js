const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const DISCUSSION_STANCES = ['plaintiff', 'defendant', 'both'];

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

function isModerationHidden(data = {}) {
  return String(data.moderationStatus || '').toLowerCase().startsWith('hidden');
}

function isSanitizedPublicResult(data = {}) {
  return data.isPublic === true
    && Number(data.publicDataVersion || 0) === 1
    && !Object.prototype.hasOwnProperty.call(data, 'userId')
    && !Object.prototype.hasOwnProperty.call(data, 'caseDescription')
    && !Object.prototype.hasOwnProperty.call(data, 'nickname');
}

function assertDiscussionWritable(data = {}) {
  if (isDeletionLocked(data)) {
    throw new HttpsError('failed-precondition', '삭제 중인 판결문에는 토론을 작성할 수 없습니다.');
  }
  if (isModerationHidden(data)) {
    throw new HttpsError('failed-precondition', '현재 숨김 처리된 판결문에는 토론을 작성할 수 없습니다.');
  }
  if (!isSanitizedPublicResult(data)) {
    throw new HttpsError('permission-denied', '공개 판결기록에서만 토론할 수 있습니다.');
  }
}

async function assertPublicResult(caseId) {
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await resultRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
  assertDiscussionWritable(snap.data());
  return resultRef;
}

async function loadNickname(uid) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists
    ? cleanText(snap.data().nickname, 20) || '익명 토론자'
    : '익명 토론자';
}

exports.addDiscussionComment = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const stance = cleanText(request.data?.stance, 20);
  const text = cleanText(request.data?.text, 600);

  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  if (!DISCUSSION_STANCES.includes(stance)) {
    throw new HttpsError('invalid-argument', '원고측, 피고측, 쌍방 중 하나를 선택해주세요.');
  }
  if (text.length < 2) {
    throw new HttpsError('invalid-argument', '토론 의견을 2자 이상 입력해주세요.');
  }

  const safety = inspectContent(text);
  if (!safety.safe || /(욕설|시발|씨발|병신|개새끼|죽어|실명|전화번호)/i.test(text)) {
    throw new HttpsError('failed-precondition', '부적절한 표현이 포함되어 있습니다.');
  }

  const resultRef = await assertPublicResult(caseId);
  await enforceActionRateLimit(uid, 'court-discussion-comment', {
    cooldownSeconds: 15,
    dailyLimit: 30
  });

  const nickname = await loadNickname(uid);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();
  const authorRef = db.doc(`court_comment_authors/${caseId}/items/${commentRef.id}`);
  const statsRef = db.doc(`court_comment_stats/${caseId}`);

  await db.runTransaction(async tx => {
    const latestResultSnap = await tx.get(resultRef);
    if (!latestResultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
    assertDiscussionWritable(latestResultSnap.data());

    tx.set(commentRef, {
      nickname,
      text,
      stance,
      kind: 'discussion',
      discussionVersion: 1,
      status: 'visible',
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(authorRef, {
      uid,
      caseId,
      commentId: commentRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(statsRef, {
      count: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.update(resultRef, {
      commentCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { success: true, stance };
});

Object.defineProperties(module.exports, {
  isDeletionLocked: { value: isDeletionLocked, enumerable: false },
  isModerationHidden: { value: isModerationHidden, enumerable: false },
  assertDiscussionWritable: { value: assertDiscussionWritable, enumerable: false }
});
