'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireAppCheck } = require('./security');
const {
  isSanitizedPublicResult,
  publicClientProjection,
  publicStorageProjection,
  timestampMillis
} = require('./public-result-data');

const db = getFirestore();
const REGION = 'asia-northeast3';
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function cleanCaseId(value) {
  const caseId = String(value || '').trim().slice(0, 180);
  return /^[A-Za-z0-9_-]{1,180}$/.test(caseId) ? caseId : '';
}

function isMissingIndexError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('failed-precondition')
    || code === '9'
    || message.includes('requires an index')
    || message.includes('index is currently building');
}

async function persistPublicCopy(caseId, raw) {
  const data = publicStorageProjection(raw);
  await db.doc(`public_results/${caseId}`).set(data);
  return data;
}

async function loadInternalFallback(maxRows) {
  const base = db.collection('results')
    .where('isPublic', '==', true)
    .where('publicDataVersion', '==', 1);

  let documents;
  try {
    const snapshot = await base.orderBy('createdAt', 'desc').limit(maxRows).get();
    documents = snapshot.docs;
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
    const snapshot = await base.limit(Math.min(MAX_LIMIT * 2, Math.max(maxRows, 100))).get();
    documents = snapshot.docs
      .sort((left, right) => timestampMillis(right.data()?.createdAt) - timestampMillis(left.data()?.createdAt))
      .slice(0, maxRows);
  }

  const safeDocuments = documents.filter(document => isSanitizedPublicResult(document.data() || {}));
  await Promise.all(safeDocuments.map(document => persistPublicCopy(document.id, document.data() || {})));
  return safeDocuments.map(document => ({ id: document.id, data: publicClientProjection(document.data() || {}) }));
}

async function loadRows(maxRows) {
  // Public consumers use only the isolated mirror. Internal results are touched solely as a
  // server-side recovery path for a missing mirror during migration or transient trigger delay.
  let documents;
  try {
    const snapshot = await db.collection('public_results')
      .orderBy('createdAt', 'desc')
      .limit(maxRows)
      .get();
    documents = snapshot.docs;
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
    const snapshot = await db.collection('public_results').limit(Math.min(MAX_LIMIT * 2, Math.max(maxRows, 100))).get();
    documents = snapshot.docs
      .sort((left, right) => timestampMillis(right.data()?.createdAt) - timestampMillis(left.data()?.createdAt))
      .slice(0, maxRows);
  }

  const safeDocuments = documents.filter(document => isSanitizedPublicResult(document.data() || {}));
  if (!safeDocuments.length) return loadInternalFallback(maxRows);

  return safeDocuments.map(document => ({
    id: document.id,
    data: publicClientProjection(document.data() || {})
  }));
}

exports.listPublicResults = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB',
  maxInstances: 20
}, async request => {
  requireAppCheck(request);
  const requesterUid = String(request.auth?.uid || '');
  if (!requesterUid) {
    throw new HttpsError('unauthenticated', '앱에서 다시 접속해 주세요.');
  }
  await enforceActionRateLimit(requesterUid, 'public-list', {
    cooldownSeconds: 1,
    dailyLimit: 500
  });

  const maxRows = clampLimit(request.data?.maxRows);
  return { rows: await loadRows(maxRows) };
});

exports.getPublicResult = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB',
  maxInstances: 20
}, async request => {
  requireAppCheck(request);
  const requesterUid = String(request.auth?.uid || '');
  if (!requesterUid) {
    throw new HttpsError('unauthenticated', '앱에서 다시 접속해 주세요.');
  }

  const caseId = cleanCaseId(request.data?.caseId);
  if (!caseId) throw new HttpsError('invalid-argument', '판결 식별자가 올바르지 않습니다.');

  await enforceActionRateLimit(requesterUid, 'public-result-get', {
    cooldownSeconds: 0,
    dailyLimit: 500
  });

  const publicSnapshot = await db.doc(`public_results/${caseId}`).get();
  if (publicSnapshot.exists && isSanitizedPublicResult(publicSnapshot.data() || {})) {
    return { caseId, result: publicClientProjection(publicSnapshot.data() || {}) };
  }

  // Migration/trigger-lag recovery only. The internal document is never returned directly.
  const internalSnapshot = await db.doc(`results/${caseId}`).get();
  if (!internalSnapshot.exists || !isSanitizedPublicResult(internalSnapshot.data() || {})) {
    await db.doc(`public_results/${caseId}`).delete().catch(() => null);
    throw new HttpsError('not-found', '공개 판결문을 찾을 수 없습니다.');
  }

  const raw = internalSnapshot.data() || {};
  const stored = await persistPublicCopy(caseId, raw);
  return { caseId, result: publicClientProjection(stored) };
});

Object.defineProperties(module.exports, {
  loadRows: { value: loadRows, enumerable: false },
  persistPublicCopy: { value: persistPublicCopy, enumerable: false }
});
