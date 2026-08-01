const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { requireAccountUser, requireAppCheck, requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const BATCH_LIMIT = 450;

function cleanId(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 180);
}
function cleanCaseId(value) {
  const caseId = cleanId(value);
  return /^[A-Za-z0-9_-]{1,180}$/.test(caseId) ? caseId : '';
}
function nicknameKey(value) {
  return String(value || '').replace(/\s+/g, '').trim().slice(0, 20).toLocaleLowerCase('ko-KR');
}
async function deleteQuerySnapshot(query, counter) {
  while (true) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    counter.deleted += snap.size;
    if (snap.size < BATCH_LIMIT) break;
  }
}
async function writeAdminLog(uid, action, subjectId, detail = {}) {
  try {
    await db.collection('admin_logs').add({
      uid,
      action,
      subjectId,
      detail,
      createdAt: FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('administrator audit log failed:', {
      uid,
      action,
      subjectId,
      code: error?.code || '',
      message: error?.message || ''
    });
    return false;
  }
}

async function deleteUserProfileData(userId) {
  const userRef = db.doc(`users/${userId}`);
  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { existed: false, nicknameReleased: false };
    const profile = userSnap.data();
    const key = nicknameKey(profile.nickname);
    let nicknameReleased = false;

    if (key) {
      const nameRef = db.doc(`user_names/${key}`);
      const nameSnap = await tx.get(nameRef);
      if (nameSnap.exists && nameSnap.data().uid === userId) {
        tx.delete(nameRef);
        nicknameReleased = true;
      }
    }
    tx.delete(userRef);
    return { existed: true, nicknameReleased };
  });
}

async function acquireCourtDeletionLock(caseId, ownerUid = '') {
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  return db.runTransaction(async tx => {
    const [caseSnap, resultSnap] = await Promise.all([tx.get(caseRef), tx.get(resultRef)]);
    if (!caseSnap.exists && !resultSnap.exists) {
      throw new HttpsError('not-found', '삭제할 사건을 찾을 수 없습니다.');
    }
    const caseData = caseSnap.exists ? caseSnap.data() : {};
    if (ownerUid && caseData.userId !== ownerUid) {
      throw new HttpsError('permission-denied', '본인이 접수한 사건만 삭제할 수 있습니다.');
    }

    if (caseSnap.exists) {
      tx.set(caseRef, {
        status: 'deleting',
        courtStage: 'deleting',
        isPublic: false,
        deletionStatus: 'processing',
        deletionStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    if (resultSnap.exists) {
      tx.set(resultRef, {
        isPublic: false,
        deletionStatus: 'processing',
        deletionStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return {
      caseFound: caseSnap.exists,
      resultFound: resultSnap.exists,
      legacyIdHash: cleanId(caseData.legacyIdHash)
    };
  });
}

async function deleteCourtPostData(value, options = {}) {
  const caseId = cleanCaseId(value);
  if (!caseId) throw new HttpsError('invalid-argument', '올바른 사건 ID가 필요합니다.');

  const ownerUid = cleanId(options.ownerUid);
  const lock = await acquireCourtDeletionLock(caseId, ownerUid);
  const counter = { deleted: 0 };

  await deleteQuerySnapshot(db.collection(`result_reactions/${caseId}/votes`), counter);
  await deleteQuerySnapshot(db.collection(`court_comments/${caseId}/items`), counter);
  await deleteQuerySnapshot(db.collection(`court_comment_authors/${caseId}/items`), counter);
  await deleteQuerySnapshot(db.collection('reports').where('caseId', '==', caseId), counter);
  await deleteQuerySnapshot(db.collection('report_keys').where('caseId', '==', caseId), counter);

  const refs = [
    db.doc(`result_reactions/${caseId}`),
    db.doc(`court_comment_stats/${caseId}`),
    db.doc(`court_comments/${caseId}`),
    db.doc(`court_comment_authors/${caseId}`),
    db.doc(`results/${caseId}`),
    db.doc(`cases/${caseId}`)
  ];
  if (lock.legacyIdHash) refs.push(db.doc(`case_id_aliases/${lock.legacyIdHash}`));

  const batch = db.batch();
  refs.forEach(ref => batch.delete(ref));
  await batch.commit();
  counter.deleted += refs.length;

  return {
    caseId,
    deleted: counter.deleted,
    removedLegacyAlias: Boolean(lock.legacyIdHash),
    lockedBeforeDelete: true,
    caseFound: lock.caseFound,
    resultFound: lock.resultFound
  };
}

exports.deleteOwnCourtPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  const authenticated = requireAccountUser(request);
  requireVerifiedUser(request);
  const result = await deleteCourtPostData(request.data?.caseId, { ownerUid: authenticated.uid });
  return { success: true, ...result };
});

exports.deleteCourtPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  requireAppCheck(request);
  if (!(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 삭제할 수 있습니다.');
  }
  const result = await deleteCourtPostData(request.data?.caseId);
  const auditLogged = await writeAdminLog(request.auth.uid, 'deleteCourtPost', result.caseId, {
    deleted: result.deleted,
    removedLegacyAlias: result.removedLegacyAlias,
    lockedBeforeDelete: result.lockedBeforeDelete
  });
  return { success: true, auditLogged, ...result };
});

exports.deleteUserProfile = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  requireAppCheck(request);
  if (!(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 회원 프로필을 삭제할 수 있습니다.');
  }
  const userId = cleanId(request.data?.userId);
  if (!userId) throw new HttpsError('invalid-argument', 'userId required');

  const result = await deleteUserProfileData(userId);
  const auditLogged = await writeAdminLog(request.auth.uid, 'deleteUserProfile', userId, result);
  return { success: true, auditLogged, userId, ...result };
});

Object.defineProperties(module.exports, {
  acquireCourtDeletionLock: {
    value: acquireCourtDeletionLock,
    enumerable: false
  },
  deleteCourtPostData: {
    value: deleteCourtPostData,
    enumerable: false
  },
  deleteUserProfileData: {
    value: deleteUserProfileData,
    enumerable: false
  }
});
