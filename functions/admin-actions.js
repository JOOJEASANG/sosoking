const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { isAdminAuth } = require('./admin-utils');
const { validDocumentId } = require('./security-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const BATCH_LIMIT = 450;
const CALLABLE_OPTIONS = {
  region: REGION,
  timeoutSeconds: 120,
  memory: '256MiB',
  cors: true,
};

function cleanNickname(value) {
  return String(value || '').replace(/\s+/g, '').trim().slice(0, 20);
}
function nicknameKey(value) {
  return cleanNickname(value).toLocaleLowerCase('ko-KR');
}
async function assertAdmin(request) {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  }
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
async function deleteStoragePrefix(prefix, counter) {
  if (!prefix) return;
  try {
    const [files] = await getStorage().bucket().getFiles({ prefix });
    await Promise.all(files.map(file => file.delete().catch(() => null)));
    counter.storageDeleted = (counter.storageDeleted || 0) + files.length;
  } catch (err) {
    counter.storageDeleteError = err.message || String(err);
  }
}
async function writeAdminLog(uid, action, targetId, detail = {}) {
  await db.collection('admin_logs').add({ uid, action, targetId, detail, createdAt: FieldValue.serverTimestamp() }).catch(() => null);
}
async function deleteCourtData(caseId, counter) {
  const [caseSnap, resultSnap] = await Promise.all([
    db.doc(`cases/${caseId}`).get().catch(() => null),
    db.doc(`results/${caseId}`).get().catch(() => null),
  ]);
  const caseData = caseSnap?.exists ? caseSnap.data() : {};
  const resultData = resultSnap?.exists ? resultSnap.data() : {};
  const ownerId = caseData.userId || resultData.userId || resultData.ownerId || '';

  await deleteQuerySnapshot(db.collection(`result_reactions/${caseId}/votes`), counter);
  await deleteQuerySnapshot(db.collection(`court_comments/${caseId}/items`), counter);
  await deleteQuerySnapshot(db.collection('reports').where('caseId', '==', caseId), counter);

  const refs = [
    db.doc(`result_reactions/${caseId}`),
    db.doc(`court_comment_stats/${caseId}`),
    db.doc(`court_comments/${caseId}`),
    db.doc(`results/${caseId}`),
    db.doc(`cases/${caseId}`),
  ];
  const batch = db.batch();
  refs.forEach(ref => batch.delete(ref));
  await batch.commit();
  counter.deleted += refs.length;

  if (ownerId) await deleteStoragePrefix(`case-images/${ownerId}/${caseId}/`, counter);
}

exports.deleteMyCase = onCall(CALLABLE_OPTIONS, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const [caseSnap, resultSnap] = await Promise.all([caseRef.get(), resultRef.get().catch(() => null)]);
  if (!caseSnap.exists && !resultSnap?.exists) {
    return { success: true, caseId, alreadyDeleted: true, deleted: 0 };
  }

  const c = caseSnap.exists ? caseSnap.data() : {};
  const r = resultSnap?.exists ? resultSnap.data() : {};
  const ownerId = c.userId || r.userId || r.ownerId || '';
  if (!ownerId || ownerId !== uid) {
    throw new HttpsError('permission-denied', '본인 사건만 삭제할 수 있습니다.');
  }

  await caseRef.set({ status: 'deleting', isPublic: false, deleteRequestedBy: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
  await resultRef.set({ isPublic: false, deleteRequestedBy: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);

  const counter = { deleted: 0 };
  await deleteCourtData(caseId, counter);
  return { success: true, caseId, ...counter };
});

exports.deleteCourtPost = onCall(CALLABLE_OPTIONS, async request => {
  await assertAdmin(request);
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');

  const counter = { deleted: 0 };
  await deleteCourtData(caseId, counter);
  await writeAdminLog(request.auth.uid, 'deleteCourtPost', caseId, counter);
  return { success: true, caseId, ...counter };
});

exports.deleteUserProfile = onCall(CALLABLE_OPTIONS, async request => {
  await assertAdmin(request);
  const uid = validDocumentId(request.data?.uid, '사용자 ID');
  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();
  const data = snap.exists ? snap.data() : {};
  const oldKey = data.nickname ? nicknameKey(data.nickname) : '';
  const counter = { deleted: 0 };

  const batch = db.batch();
  if (oldKey) batch.delete(db.doc(`user_names/${oldKey}`));
  batch.delete(userRef);
  await batch.commit();
  counter.deleted += oldKey ? 2 : 1;
  await deleteStoragePrefix(`profile-photos/${uid}/`, counter);
  await writeAdminLog(request.auth.uid, 'deleteUserProfile', uid, counter);
  return { success: true, uid, ...counter };
});
