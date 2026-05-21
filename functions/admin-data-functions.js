'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const COLLECTIONS = [
  'feeds',
  'users',
  'reports',
  'notifications',
  'admin_summaries',
  'ai_usage',
  'site_settings',
  'config',
  'game_rooms',
  'points_ledger',
  'feedback',
  'admins',
];

const FEED_SUBCOLLECTIONS = [
  'comments',
  'acrostics',
  'multi_naming',
  'multi_acrostic',
  'multi_relay',
  'multi_fill',
  'quiz_attempts',
  'secret',
  'viewers',
  'view_events',
];

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
}

function safeCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new HttpsError('invalid-argument', '허용되지 않은 컬렉션입니다.');
  return name;
}

function cleanId(value, max = 180) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function toPlain(data) {
  return JSON.parse(JSON.stringify(data || {}, (_, value) => {
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    return value;
  }));
}

function previewValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.slice(0, 80);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length}개]`;
  return '{...}';
}

function summarizeDoc(id, data) {
  const title = data.title || data.nickname || data.name || data.email || data.reason || data.status || id;
  return {
    id,
    title: String(title || id).slice(0, 120),
    preview: Object.entries(data || {}).slice(0, 8).map(([key, value]) => ({ key, value: previewValue(value) })),
    data: toPlain(data),
  };
}

async function deleteCollection(ref, batchSize = 100) {
  let deleted = 0;
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

async function deleteKnownFeedChildren(postRef) {
  let deletedChildren = 0;
  for (const name of FEED_SUBCOLLECTIONS) {
    const subRef = postRef.collection(name);
    const snap = await subRef.limit(100).get();
    for (const doc of snap.docs) {
      const nested = await doc.ref.listCollections();
      for (const nestedCollection of nested) {
        deletedChildren += await deleteCollection(nestedCollection);
      }
    }
    deletedChildren += await deleteCollection(subRef);
  }
  return deletedChildren;
}

const listAdminCollections = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return { ok: true, collections: COLLECTIONS };
});

const listAdminCollectionDocs = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const collectionName = safeCollection(request.data && request.data.collection);
  const max = Math.max(1, Math.min(100, Number(request.data && request.data.limit) || 30));
  const snap = await db.collection(collectionName).orderBy(FieldPath.documentId()).limit(max).get();
  return {
    ok: true,
    collection: collectionName,
    docs: snap.docs.map(doc => summarizeDoc(doc.id, doc.data() || {})),
  };
});

const deleteAdminDocument = onCall({ region: REGION, timeoutSeconds: 60 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const collectionName = safeCollection(request.data && request.data.collection);
  const id = String((request.data && request.data.id) || '').trim();
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', '문서 ID가 올바르지 않습니다.');
  if (collectionName === 'admins' && id === request.auth.uid) throw new HttpsError('failed-precondition', '자기 자신의 관리자 권한 문서는 삭제할 수 없습니다.');
  if (collectionName === 'feeds') {
    const postRef = db.collection(collectionName).doc(id);
    const deletedChildren = await deleteKnownFeedChildren(postRef);
    await postRef.delete();
    return { ok: true, collection: collectionName, id, deletedChildren };
  }
  await db.collection(collectionName).doc(id).delete();
  return { ok: true, collection: collectionName, id };
});

const deleteFeedPostDeep = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const postId = cleanId(request.data && request.data.postId);
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const postRef = db.doc(`feeds/${postId}`);
  const snap = await postRef.get();
  if (!snap.exists) return { ok: true, postId, deleted: false, deletedChildren: 0 };
  const deletedChildren = await deleteKnownFeedChildren(postRef);
  await postRef.delete();
  return { ok: true, postId, deleted: true, deletedChildren };
});

module.exports = { listAdminCollections, listAdminCollectionDocs, deleteAdminDocument, deleteFeedPostDeep };
