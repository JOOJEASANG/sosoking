'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const db = getFirestore();
const REGION = 'asia-northeast3';
const CONTENT_TYPES = { material: 'materials', debate: 'debates' };
const CONTENT_STATUSES = new Set(['published', 'draft', 'hidden']);
const CONTENT_SOURCES = new Set(['ai', 'manual', 'user']);
const INBOX_COLLECTIONS = new Set(['reports', 'feedback']);
const INBOX_STATUSES = new Set(['open', 'reviewing', 'resolved']);
const CONTENT_SCAN_BATCH = 100;
const CONTENT_SCAN_MAX = 1000;

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
  return uid;
}

function cleanText(value, maximum = 300) {
  return String(value || '').replace(/[<>\u0000]/g, '').trim().slice(0, maximum);
}

function validId(value) {
  const id = cleanText(value, 160);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new HttpsError('invalid-argument', '문서 ID가 올바르지 않습니다.');
  return id;
}

function contentCollection(type) {
  const collection = CONTENT_TYPES[cleanText(type, 20)];
  if (!collection) throw new HttpsError('invalid-argument', '콘텐츠 종류가 올바르지 않습니다.');
  return collection;
}

function toMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function list(value, maximum = 8, length = 160) {
  return Array.isArray(value) ? value.map(item => cleanText(item, length)).filter(Boolean).slice(0, maximum) : [];
}

function resolvedSourceType(data = {}) {
  const explicit = cleanText(data.sourceType, 30);
  if (CONTENT_SOURCES.has(explicit)) return explicit;
  if (data.userGenerated === true) return 'user';
  if (data.aiGenerated === true) return 'ai';
  return 'manual';
}

function contentSummary(id, data = {}, type = 'material') {
  const base = {
    id,
    type,
    title: cleanText(data.title, 100),
    summary: cleanText(data.summary, 260),
    category: cleanText(data.category, 40),
    tags: list(data.tags, 8, 24),
    status: CONTENT_STATUSES.has(data.status) ? data.status : 'published',
    sourceType: resolvedSourceType(data),
    sourceName: cleanText(data.sourceName || data.authorName || '소소킹', 80),
    aiGenerated: data.aiGenerated === true,
    userGenerated: data.userGenerated === true,
    reviewStatus: cleanText(data.reviewStatus, 40),
    reviewReason: cleanText(data.reviewReason, 300),
    imageUrl: cleanText(data.imageUrl, 700),
    imagePath: cleanText(data.imagePath, 500),
    viewCount: Math.max(0, Number(data.viewCount || 0)),
    commentCount: Math.max(0, Number(data.commentCount || 0)),
    createdBy: cleanText(data.createdBy, 160),
    createdAtMs: toMs(data.createdAt),
    updatedAtMs: toMs(data.updatedAt),
  };
  if (type === 'debate') {
    base.agreeTitle = cleanText(data.agreeTitle || 'A', 60);
    base.disagreeTitle = cleanText(data.disagreeTitle || 'B', 60);
    base.agreeCount = Math.max(0, Number(data.agreeCount || 0));
    base.disagreeCount = Math.max(0, Number(data.disagreeCount || 0));
    base.totalVotes = base.agreeCount + base.disagreeCount;
  }
  return base;
}

async function countCollection(name) {
  try {
    const snapshot = await db.collection(name).count().get();
    return Number(snapshot.data().count || 0);
  } catch {
    const snapshot = await db.collection(name).limit(1000).get().catch(() => ({ size: 0 }));
    return Number(snapshot.size || 0);
  }
}

async function latestContent(type, limit = 6) {
  const collection = contentCollection(type);
  const snapshot = await db.collection(collection).orderBy('createdAt', 'desc').limit(limit).get().catch(() => ({ docs: [] }));
  return snapshot.docs.map(document => contentSummary(document.id, document.data() || {}, type));
}

async function listAdminContent({ collection, type, status, sourceType, maximum }) {
  let baseQuery = db.collection(collection);
  if (CONTENT_STATUSES.has(status)) baseQuery = baseQuery.where('status', '==', status);
  baseQuery = baseQuery.orderBy('createdAt', 'desc');

  if (!CONTENT_SOURCES.has(sourceType)) {
    const snapshot = await baseQuery.limit(maximum).get();
    return {
      items: snapshot.docs.map(document => contentSummary(document.id, document.data() || {}, type)),
      scanned: snapshot.size,
      scanLimited: false,
    };
  }

  const items = [];
  let cursor = null;
  let scanned = 0;
  while (items.length < maximum && scanned < CONTENT_SCAN_MAX) {
    const batchSize = Math.min(CONTENT_SCAN_BATCH, CONTENT_SCAN_MAX - scanned);
    let query = baseQuery.limit(batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    scanned += snapshot.size;
    for (const document of snapshot.docs) {
      const item = contentSummary(document.id, document.data() || {}, type);
      if (item.sourceType === sourceType) items.push(item);
      if (items.length >= maximum) break;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < batchSize) break;
  }

  return {
    items,
    scanned,
    scanLimited: scanned >= CONTENT_SCAN_MAX && items.length < maximum,
  };
}

async function latestGenerationRuns(limit = 12) {
  const snapshot = await db.collection('generation_runs').orderBy('updatedAt', 'desc').limit(limit).get().catch(() => ({ docs: [] }));
  return snapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      id: document.id,
      type: cleanText(data.type, 30),
      date: cleanText(data.date, 10),
      status: cleanText(data.status, 30),
      contentId: cleanText(data.contentId, 160),
      reviewStatus: cleanText(data.reviewStatus, 50),
      requestedBy: cleanText(data.requestedBy, 160),
      error: cleanText(data.error, 500),
      updatedAtMs: toMs(data.updatedAt),
    };
  });
}

const getAdminOverview = onCall({ region: REGION, timeoutSeconds: 60, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth?.uid);
  const [materialCount, debateCount, memberCount, reportCount, feedbackCount, materials, debates, generationRuns, aiSnap] = await Promise.all([
    countCollection('materials'),
    countCollection('debates'),
    countCollection('users'),
    countCollection('reports'),
    countCollection('feedback'),
    latestContent('material', 6),
    latestContent('debate', 6),
    latestGenerationRuns(10),
    db.doc('config/ai_king').get().catch(() => null),
  ]);
  const ai = aiSnap?.exists ? aiSnap.data() || {} : {};
  return {
    ok: true,
    counts: { materials: materialCount, debates: debateCount, members: memberCount, reports: reportCount, feedback: feedbackCount },
    latestMaterials: materials,
    latestDebates: debates,
    generationRuns,
    ai: {
      enabled: ai.enabled !== false,
      activeModel: 'gemini',
      geminiModel: cleanText(ai.geminiModel || 'gemini-2.5-flash', 100),
      dailyFreeLimit: Math.max(1, Number(ai.dailyFreeLimit || 3)),
      monthlyCap: Math.max(0, Number(ai.monthlyCap || 0)),
      updatedAtMs: toMs(ai.updatedAt),
    },
  };
});

const getAdminContentList = onCall({ region: REGION, timeoutSeconds: 60, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth?.uid);
  const type = cleanText(request.data?.type, 20);
  const collection = contentCollection(type);
  const status = cleanText(request.data?.status || 'all', 20);
  const sourceType = cleanText(request.data?.sourceType || 'all', 30);
  const maximum = Math.max(1, Math.min(100, Number(request.data?.limit) || 50));
  const result = await listAdminContent({ collection, type, status, sourceType, maximum });
  return {
    ok: true,
    type,
    status,
    sourceType,
    items: result.items,
    scanned: result.scanned,
    scanLimited: result.scanLimited,
  };
});

const setAdminContentStatus = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = await assertAdmin(request.auth?.uid);
  const collection = contentCollection(request.data?.type);
  const id = validId(request.data?.id);
  const status = cleanText(request.data?.status, 20);
  if (!CONTENT_STATUSES.has(status)) throw new HttpsError('invalid-argument', '상태 값이 올바르지 않습니다.');
  const ref = db.doc(`${collection}/${id}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError('not-found', '콘텐츠를 찾을 수 없습니다.');
  await ref.set({ status, adminUpdatedBy: uid, adminUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, id, status };
});

const deleteAdminContent = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async request => {
  const uid = await assertAdmin(request.auth?.uid);
  const collection = contentCollection(request.data?.type);
  const id = validId(request.data?.id);
  const ref = db.doc(`${collection}/${id}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { ok: true, id, deleted: false };
  const data = snapshot.data() || {};
  const imagePath = cleanText(data.imagePath, 500);
  await db.recursiveDelete(ref);
  if (imagePath) await getStorage().bucket().file(imagePath).delete({ ignoreNotFound: true }).catch(error => console.warn('[deleteAdminContent image]', error.message));
  await db.collection('deleted_posts').add({ sourceCollection: collection, sourceId: id, title: cleanText(data.title, 100), deletedBy: uid, deletedAt: FieldValue.serverTimestamp() }).catch(() => null);
  return { ok: true, id, deleted: true };
});

const getAdminGenerationRuns = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await assertAdmin(request.auth?.uid);
  const limit = Math.max(1, Math.min(60, Number(request.data?.limit) || 30));
  return { ok: true, runs: await latestGenerationRuns(limit) };
});

function inboxSummary(id, data = {}, collection) {
  return {
    id,
    collection,
    status: INBOX_STATUSES.has(data.status) ? data.status : 'open',
    reason: cleanText(data.reason || data.message || data.title, 1000),
    postId: cleanText(data.postId, 160),
    reporterId: cleanText(data.reporterId || data.uid, 160),
    reporterName: cleanText(data.reporterName || data.nickname, 80),
    aiPriority: cleanText(data.aiPriority, 20),
    aiReason: cleanText(data.aiReason, 400),
    createdAtMs: toMs(data.createdAt),
    updatedAtMs: toMs(data.updatedAt),
  };
}

const getAdminInbox = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await assertAdmin(request.auth?.uid);
  const limit = Math.max(1, Math.min(100, Number(request.data?.limit) || 40));
  const read = async collection => {
    const snapshot = await db.collection(collection).orderBy('createdAt', 'desc').limit(limit).get().catch(() => ({ docs: [] }));
    return snapshot.docs.map(document => inboxSummary(document.id, document.data() || {}, collection));
  };
  const [reports, feedback] = await Promise.all([read('reports'), read('feedback')]);
  return { ok: true, reports, feedback };
});

const updateAdminInboxStatus = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = await assertAdmin(request.auth?.uid);
  const collection = cleanText(request.data?.collection, 20);
  const id = validId(request.data?.id);
  const status = cleanText(request.data?.status, 20);
  if (!INBOX_COLLECTIONS.has(collection) || !INBOX_STATUSES.has(status)) throw new HttpsError('invalid-argument', '처리 상태가 올바르지 않습니다.');
  await db.doc(`${collection}/${id}`).set({ status, handledBy: uid, handledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, collection, id, status };
});

module.exports = {
  getAdminOverview,
  getAdminContentList,
  setAdminContentStatus,
  deleteAdminContent,
  getAdminGenerationRuns,
  getAdminInbox,
  updateAdminInboxStatus,
  resolvedSourceType,
  listAdminContent,
};
