'use strict';

const crypto = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');
const { isAdminAuth } = require('./admin-utils');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const BATCH_LIMIT = 250;
const TARGET_TYPES = new Set(['topic', 'comment']);
const MODERATION_ACTIONS = new Set(['dismiss', 'hide', 'delete']);

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanId(value) {
  const id = cleanText(value, 100);
  return /^[A-Za-z0-9_-]{8,100}$/.test(id) ? id : '';
}

function reportKey(uid, targetType, topicId, commentId = '') {
  return crypto
    .createHash('sha256')
    .update(`${uid}\u0000${targetType}\u0000${topicId}\u0000${commentId}`)
    .digest('hex');
}

async function deleteQueryInBatches(queryRef, counter) {
  while (true) {
    const snapshot = await queryRef.limit(BATCH_LIMIT).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach(document => batch.delete(document.ref));
    await batch.commit();
    counter.deleted += snapshot.size;
    if (snapshot.size < BATCH_LIMIT) break;
  }
}

async function deleteCommentLikes(topicId, commentId, counter) {
  await deleteQueryInBatches(
    db.collection(`dripso_topics/${topicId}/comments/${commentId}/likes`),
    counter
  );
}

async function refreshTopicCounters(topicId) {
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const snapshot = await topicRef.collection('comments')
    .where('status', '==', 'visible')
    .get();
  let topLikeCount = 0;
  snapshot.docs.forEach(document => {
    topLikeCount = Math.max(topLikeCount, Math.max(0, Number(document.data().likeCount) || 0));
  });
  await topicRef.set({
    commentCount: snapshot.size,
    topLikeCount,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { commentCount: snapshot.size, topLikeCount };
}

async function getTopicOwner(topicId) {
  const snapshot = await db.doc(`dripso_topic_authors/${topicId}`).get();
  return snapshot.exists ? cleanText(snapshot.data().uid, 128) : '';
}

async function getCommentOwner(topicId, commentId) {
  const snapshot = await db.doc(`dripso_comment_authors/${topicId}/items/${commentId}`).get();
  return snapshot.exists ? cleanText(snapshot.data().uid, 128) : '';
}

async function deleteDripsoCommentData(topicIdValue, commentIdValue, options = {}) {
  const topicId = cleanId(topicIdValue);
  const commentId = cleanId(commentIdValue);
  if (!topicId || !commentId) {
    throw new HttpsError('invalid-argument', '삭제할 댓글 대상이 올바르지 않습니다.');
  }

  const actorUid = cleanText(options.actorUid, 128);
  const allowAdmin = options.allowAdmin === true;
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const commentRef = topicRef.collection('comments').doc(commentId);
  const authorRef = db.doc(`dripso_comment_authors/${topicId}/items/${commentId}`);

  await db.runTransaction(async tx => {
    const [topicSnap, commentSnap, authorSnap] = await Promise.all([
      tx.get(topicRef),
      tx.get(commentRef),
      tx.get(authorRef)
    ]);
    if (!topicSnap.exists || !commentSnap.exists) {
      throw new HttpsError('not-found', '삭제할 드립 댓글을 찾을 수 없습니다.');
    }
    const ownerUid = authorSnap.exists ? cleanText(authorSnap.data().uid, 128) : '';
    if (!allowAdmin && (!actorUid || ownerUid !== actorUid)) {
      throw new HttpsError('permission-denied', '본인이 작성한 댓글만 삭제할 수 있습니다.');
    }
    tx.set(commentRef, {
      status: 'deleting',
      deletionStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const counter = { deleted: 0 };
  await deleteCommentLikes(topicId, commentId, counter);
  await deleteQueryInBatches(
    db.collection('dripso_reports')
      .where('topicId', '==', topicId)
      .where('commentId', '==', commentId),
    counter
  );
  await deleteQueryInBatches(
    db.collection('dripso_report_keys')
      .where('topicId', '==', topicId)
      .where('commentId', '==', commentId),
    counter
  );

  const batch = db.batch();
  batch.delete(authorRef);
  batch.delete(commentRef);
  await batch.commit();
  counter.deleted += 2;
  const counters = await refreshTopicCounters(topicId);

  return { topicId, commentId, deleted: counter.deleted, ...counters };
}

async function deleteDripsoTopicData(topicIdValue, options = {}) {
  const topicId = cleanId(topicIdValue);
  if (!topicId) throw new HttpsError('invalid-argument', '삭제할 주제 ID가 올바르지 않습니다.');

  const actorUid = cleanText(options.actorUid, 128);
  const allowAdmin = options.allowAdmin === true;
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const authorRef = db.doc(`dripso_topic_authors/${topicId}`);
  let imagePath = '';

  await db.runTransaction(async tx => {
    const [topicSnap, authorSnap] = await Promise.all([tx.get(topicRef), tx.get(authorRef)]);
    if (!topicSnap.exists) throw new HttpsError('not-found', '삭제할 드립 주제를 찾을 수 없습니다.');
    const ownerUid = authorSnap.exists ? cleanText(authorSnap.data().uid, 128) : '';
    if (!allowAdmin && (!actorUid || ownerUid !== actorUid)) {
      throw new HttpsError('permission-denied', '본인이 작성한 주제만 삭제할 수 있습니다.');
    }
    imagePath = cleanText(topicSnap.data().imagePath, 500);
    tx.set(topicRef, {
      status: 'deleting',
      deletionStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const counter = { deleted: 0 };
  while (true) {
    const comments = await topicRef.collection('comments').limit(100).get();
    if (comments.empty) break;
    for (const comment of comments.docs) {
      await deleteCommentLikes(topicId, comment.id, counter);
    }
    const batch = db.batch();
    comments.docs.forEach(comment => {
      batch.delete(db.doc(`dripso_comment_authors/${topicId}/items/${comment.id}`));
      batch.delete(comment.ref);
      counter.deleted += 2;
    });
    await batch.commit();
    if (comments.size < 100) break;
  }

  await deleteQueryInBatches(db.collection('dripso_reports').where('topicId', '==', topicId), counter);
  await deleteQueryInBatches(db.collection('dripso_report_keys').where('topicId', '==', topicId), counter);

  if (imagePath) {
    await getStorage().bucket().file(imagePath).delete({ ignoreNotFound: true }).catch(error => {
      console.error('Dripso image deletion failed:', { topicId, imagePath, code: error?.code || '', message: error?.message || '' });
      throw new HttpsError('unavailable', '첨부 사진 삭제에 실패했습니다. 다시 시도해 주세요.');
    });
  }

  const batch = db.batch();
  batch.delete(authorRef);
  batch.delete(topicRef);
  await batch.commit();
  counter.deleted += 2;

  return { topicId, deleted: counter.deleted, imageDeleted: Boolean(imagePath) };
}

async function submitDripsoReportData(uid, targetTypeValue, topicIdValue, commentIdValue, reasonValue) {
  const targetType = cleanText(targetTypeValue, 20);
  const topicId = cleanId(topicIdValue);
  const commentId = targetType === 'comment' ? cleanId(commentIdValue) : '';
  const reason = cleanText(reasonValue, 300);
  if (!TARGET_TYPES.has(targetType) || !topicId || (targetType === 'comment' && !commentId)) {
    throw new HttpsError('invalid-argument', '신고 대상이 올바르지 않습니다.');
  }
  if (reason.length < 5) throw new HttpsError('invalid-argument', '신고 사유를 5자 이상 입력해 주세요.');
  const safety = inspectContent(reason, { allowHighRisk: true });
  if (!safety.safe) throw new HttpsError('failed-precondition', safety.message);

  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const targetRef = targetType === 'topic'
    ? topicRef
    : topicRef.collection('comments').doc(commentId);
  const ownerRef = targetType === 'topic'
    ? db.doc(`dripso_topic_authors/${topicId}`)
    : db.doc(`dripso_comment_authors/${topicId}/items/${commentId}`);
  const keyId = reportKey(uid, targetType, topicId, commentId);
  const keyRef = db.doc(`dripso_report_keys/${keyId}`);
  const reportRef = db.collection('dripso_reports').doc();

  await db.runTransaction(async tx => {
    const [topicSnap, targetSnap, ownerSnap, keySnap] = await Promise.all([
      tx.get(topicRef),
      tx.get(targetRef),
      tx.get(ownerRef),
      tx.get(keyRef)
    ]);
    if (!topicSnap.exists || topicSnap.data().status !== 'visible'
      || !targetSnap.exists || targetSnap.data().status !== 'visible') {
      throw new HttpsError('not-found', '신고할 수 있는 공개 드립을 찾을 수 없습니다.');
    }
    if (ownerSnap.exists && ownerSnap.data().uid === uid) {
      throw new HttpsError('failed-precondition', '본인이 작성한 내용은 신고할 수 없습니다.');
    }
    if (keySnap.exists) throw new HttpsError('already-exists', '이미 신고한 내용입니다.');

    tx.set(reportRef, {
      targetType,
      topicId,
      commentId,
      reason,
      status: 'pending',
      reporterUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(keyRef, {
      targetType,
      topicId,
      commentId,
      reportId: reportRef.id,
      reporterUid: uid,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { reportId: reportRef.id, targetType, topicId, commentId };
}

async function hideDripsoTarget(report) {
  const topicId = cleanId(report.topicId);
  const commentId = report.targetType === 'comment' ? cleanId(report.commentId) : '';
  if (!topicId || (report.targetType === 'comment' && !commentId)) {
    throw new HttpsError('failed-precondition', '신고 대상 정보가 올바르지 않습니다.');
  }

  if (report.targetType === 'topic') {
    const topicRef = db.doc(`dripso_topics/${topicId}`);
    const topicSnap = await topicRef.get();
    if (topicSnap.exists) {
      await topicRef.set({
        status: 'hidden',
        moderationStatus: 'hidden-by-report',
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      const imagePath = cleanText(topicSnap.data().imagePath, 500);
      if (imagePath) {
        await getStorage().bucket().file(imagePath).delete({ ignoreNotFound: true });
        await topicRef.set({
          imageUrl: FieldValue.delete(),
          imagePath: FieldValue.delete(),
          imageWidth: FieldValue.delete(),
          imageHeight: FieldValue.delete(),
          imageByteSize: FieldValue.delete(),
          imageContentType: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
    return { topicId, commentId: '', hidden: topicSnap.exists };
  }

  const commentRef = db.doc(`dripso_topics/${topicId}/comments/${commentId}`);
  const commentSnap = await commentRef.get();
  if (commentSnap.exists) {
    await commentRef.set({
      status: 'hidden',
      moderationStatus: 'hidden-by-report',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await refreshTopicCounters(topicId);
  }
  return { topicId, commentId, hidden: commentSnap.exists };
}

async function moderateDripsoReportData(reportIdValue, actionValue, adminUid) {
  const reportId = cleanId(reportIdValue);
  const action = cleanText(actionValue, 20);
  if (!reportId || !MODERATION_ACTIONS.has(action)) {
    throw new HttpsError('invalid-argument', '신고 처리 요청이 올바르지 않습니다.');
  }

  const reportRef = db.doc(`dripso_reports/${reportId}`);
  const claim = await db.runTransaction(async tx => {
    const snapshot = await tx.get(reportRef);
    if (!snapshot.exists) throw new HttpsError('not-found', '드립소 신고를 찾을 수 없습니다.');
    const report = snapshot.data();
    if (report.status !== 'pending') {
      return { alreadyHandled: true, report };
    }
    tx.update(reportRef, {
      status: 'processing',
      processingAction: action,
      processingBy: adminUid,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { alreadyHandled: false, report };
  });

  if (claim.alreadyHandled) {
    return { alreadyHandled: true, status: claim.report.status || 'unknown' };
  }

  const report = claim.report;
  try {
    let targetResult = {};
    if (action === 'hide') targetResult = await hideDripsoTarget(report);
    if (action === 'delete') {
      targetResult = report.targetType === 'topic'
        ? await deleteDripsoTopicData(report.topicId, { allowAdmin: true, actorUid: adminUid })
        : await deleteDripsoCommentData(report.topicId, report.commentId, { allowAdmin: true, actorUid: adminUid });
    }
    const status = action === 'dismiss' ? 'dismissed' : 'resolved';
    await reportRef.set({
      status,
      resolutionAction: action,
      resolvedBy: adminUid,
      resolvedAt: FieldValue.serverTimestamp(),
      processingAction: FieldValue.delete(),
      processingBy: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection('admin_logs').add({
      uid: adminUid,
      action: 'moderateDripsoReport',
      subjectId: reportId,
      detail: { moderationAction: action, targetType: report.targetType, topicId: report.topicId, commentId: report.commentId || '', ...targetResult },
      createdAt: FieldValue.serverTimestamp()
    }).catch(error => console.error('Dripso moderation audit log failed:', error));
    return { alreadyHandled: false, status, action, ...targetResult };
  } catch (error) {
    await reportRef.set({
      status: 'pending',
      processingAction: FieldValue.delete(),
      processingBy: FieldValue.delete(),
      lastError: cleanText(error?.message, 300),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => null);
    throw error;
  }
}

exports.getDripsoOwnership = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanId(request.data?.topicId);
  const commentIds = Array.isArray(request.data?.commentIds)
    ? [...new Set(request.data.commentIds.map(cleanId).filter(Boolean))].slice(0, 100)
    : [];
  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');

  const [topicOwner, ...commentOwners] = await Promise.all([
    getTopicOwner(topicId),
    ...commentIds.map(commentId => getCommentOwner(topicId, commentId))
  ]);
  const ownedCommentIds = commentIds.filter((commentId, index) => commentOwners[index] === uid);
  return { topicOwned: topicOwner === uid, ownedCommentIds };
});

exports.deleteOwnDripsoTopic = onCall({ region: REGION, timeoutSeconds: 180, memory: '512MiB' }, async request => {
  requireVerifiedUser(request);
  const result = await deleteDripsoTopicData(request.data?.topicId, { actorUid: request.auth.uid });
  return { success: true, ...result };
});

exports.deleteOwnDripsoComment = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  const result = await deleteDripsoCommentData(request.data?.topicId, request.data?.commentId, { actorUid: request.auth.uid });
  return { success: true, ...result };
});

exports.submitDripsoReport = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  await enforceActionRateLimit(request.auth.uid, 'dripso-report', { cooldownSeconds: 20, dailyLimit: 20 });
  const result = await submitDripsoReportData(
    request.auth.uid,
    request.data?.targetType,
    request.data?.topicId,
    request.data?.commentId,
    request.data?.reason
  );
  return { success: true, ...result };
});

exports.moderateDripsoReport = onCall({ region: REGION, timeoutSeconds: 180, memory: '512MiB' }, async request => {
  requireVerifiedUser(request);
  if (!(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 드립소 신고를 처리할 수 있습니다.');
  }
  const result = await moderateDripsoReportData(request.data?.reportId, request.data?.action, request.auth.uid);
  return { success: true, reportId: cleanId(request.data?.reportId), ...result };
});

Object.defineProperties(module.exports, {
  deleteDripsoCommentData: { value: deleteDripsoCommentData, enumerable: false },
  deleteDripsoTopicData: { value: deleteDripsoTopicData, enumerable: false },
  moderateDripsoReportData: { value: moderateDripsoReportData, enumerable: false },
  submitDripsoReportData: { value: submitDripsoReportData, enumerable: false }
});
