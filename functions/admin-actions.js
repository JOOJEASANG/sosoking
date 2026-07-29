const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { requireAccountUser } = require('./security');

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
  await db.collection('admin_logs').add({
    uid,
    action,
    subjectId,
    detail,
    createdAt: FieldValue.serverTimestamp()
  }).catch(() => null);
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

async function deleteCourtPostData(value, options = {}) {
  const caseId = cleanCaseId(value);
  if (!caseId) throw new HttpsError('invalid-argument', '올바른 사건 ID가 필요합니다.');

  const caseRef = db.doc(`cases/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw new HttpsError('not-found', '삭제할 사건을 찾을 수 없습니다.');

  const caseData = caseSnap.data();
  const ownerUid = cleanId(options.ownerUid);
  if (ownerUid && caseData.userId !== ownerUid) {
    throw new HttpsError('permission-denied', '본인이 접수한 사건만 삭제할 수 있습니다.');
  }

  const counter = { deleted: 0 };
  const legacyIdHash = cleanId(caseData.legacyIdHash);

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
    caseRef
  ];
  if (legacyIdHash) refs.push(db.doc(`case_id_aliases/${legacyIdHash}`));

  const batch = db.batch();
  refs.forEach(ref => batch.delete(ref));
  await batch.commit();
  counter.deleted += refs.length;

  return {
    caseId,
    ownerUid: cleanId(caseData.userId),
    deleted: counter.deleted,
    removedLegacyAlias: Boolean(legacyIdHash)
  };
}

exports.deleteOwnCourtPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  const authenticated = requireAccountUser(request);
  const result = await deleteCourtPostData(request.data?.caseId, { ownerUid: authenticated.uid });
  return { success: true, ...result };
});

exports.deleteCourtPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 삭제할 수 있습니다.');
  }
  const result = await deleteCourtPostData(request.data?.caseId);
  await writeAdminLog(request.auth.uid, 'deleteCourtPost', result.caseId, {
    deleted: result.deleted,
    removedLegacyAlias: result.removedLegacyAlias
  });
  return { success: true, ...result };
});

exports.deleteUserProfile = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 회원 프로필을 삭제할 수 있습니다.');
  }
  const userId = cleanId(request.data?.userId);
  if (!userId) throw new HttpsError('invalid-argument', 'userId required');

  const result = await deleteUserProfileData(userId);
  await writeAdminLog(request.auth.uid, 'deleteUserProfile', userId, result);
  return { success: true, userId, ...result };
});

Object.defineProperties(module.exports, {
  deleteCourtPostData: {
    value: deleteCourtPostData,
    enumerable: false
  },
  deleteUserProfileData: {
    value: deleteUserProfileData,
    enumerable: false
  }
});
