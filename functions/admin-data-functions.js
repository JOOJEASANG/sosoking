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

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
}

function safeCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new HttpsError('invalid-argument', '허용되지 않은 컬렉션입니다.');
  return name;
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
  await db.collection(collectionName).doc(id).delete();
  return { ok: true, collection: collectionName, id };
});

module.exports = { listAdminCollections, listAdminCollectionDocs, deleteAdminDocument };
