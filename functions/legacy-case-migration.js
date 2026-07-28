'use strict';

const crypto = require('crypto');
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const WRITE_BATCH_LIMIT = 400;
const PAGE_SIZE = 100;

function cleanCaseId(value) {
  const caseId = String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 180);
  return /^[A-Za-z0-9_-]{1,180}$/.test(caseId) ? caseId : '';
}

function legacyIdHash(caseId) {
  return crypto.createHash('sha256').update(String(caseId || '')).digest('hex');
}

function reportKey(uid, caseId) {
  return crypto.createHash('sha256').update(`${uid}\u0000${caseId}`).digest('hex');
}

function isLegacyUidCase(caseId, data = {}) {
  const uid = String(data.userId || '');
  return Boolean(
    uid
    && uid !== 'system-daily-ai'
    && data.status === 'completed'
    && caseId.startsWith(`${uid}_`)
    && caseId.length > uid.length + 10
  );
}

async function reserveAlias(caseId) {
  const aliasRef = db.doc(`case_id_aliases/${legacyIdHash(caseId)}`);
  return db.runTransaction(async tx => {
    const aliasSnap = await tx.get(aliasRef);
    if (aliasSnap.exists && aliasSnap.data().targetCaseId) {
      return {
        aliasRef,
        targetCaseId: aliasSnap.data().targetCaseId,
        aliasStatus: aliasSnap.data().status || 'processing',
        reused: true
      };
    }

    const targetRef = db.collection('cases').doc();
    tx.set(aliasRef, {
      targetCaseId: targetRef.id,
      status: 'processing',
      sourceType: 'legacy-uid-case-id',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { aliasRef, targetCaseId: targetRef.id, aliasStatus: 'processing', reused: false };
  });
}

async function flushWrites(writes) {
  for (let index = 0; index < writes.length; index += WRITE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const write of writes.slice(index, index + WRITE_BATCH_LIMIT)) write(batch);
    await batch.commit();
  }
}

async function copyCollection(sourcePath, targetPath, transform = data => data) {
  let cursor = null;
  let copied = 0;

  while (true) {
    let query = db.collection(sourcePath).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;

    const writes = snap.docs.map(document => batch => {
      batch.set(db.doc(`${targetPath}/${document.id}`), transform(document.data(), document.id), { merge: false });
    });
    await flushWrites(writes);
    copied += snap.size;
    cursor = snap.docs[snap.docs.length - 1].id;
    if (snap.size < PAGE_SIZE) break;
  }

  return copied;
}

async function deleteCollection(path) {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(path).limit(WRITE_BATCH_LIMIT).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(document => batch.delete(document.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < WRITE_BATCH_LIMIT) break;
  }
  return deleted;
}

async function migrateReports(oldCaseId, newCaseId) {
  const [reportsSnap, keysSnap] = await Promise.all([
    db.collection('reports').where('caseId', '==', oldCaseId).get(),
    db.collection('report_keys').where('caseId', '==', oldCaseId).get()
  ]);

  const writes = [];
  reportsSnap.docs.forEach(document => {
    writes.push(batch => batch.update(document.ref, {
      caseId: newCaseId,
      updatedAt: FieldValue.serverTimestamp()
    }));
  });
  keysSnap.docs.forEach(document => {
    const data = document.data();
    const uid = String(data.userId || '');
    if (!uid) return;
    const nextRef = db.doc(`report_keys/${reportKey(uid, newCaseId)}`);
    writes.push(batch => batch.set(nextRef, {
      ...data,
      caseId: newCaseId,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }));
    writes.push(batch => batch.delete(document.ref));
  });
  await flushWrites(writes);
  return { reports: reportsSnap.size, reportKeys: keysSnap.size };
}

async function copyPrimaryDocuments(oldCaseId, newCaseId, hash) {
  const refs = {
    oldCase: db.doc(`cases/${oldCaseId}`),
    oldResult: db.doc(`results/${oldCaseId}`),
    oldReactions: db.doc(`result_reactions/${oldCaseId}`),
    oldCommentStats: db.doc(`court_comment_stats/${oldCaseId}`),
    newCase: db.doc(`cases/${newCaseId}`),
    newResult: db.doc(`results/${newCaseId}`),
    newReactions: db.doc(`result_reactions/${newCaseId}`),
    newCommentStats: db.doc(`court_comment_stats/${newCaseId}`)
  };
  const [caseSnap, resultSnap, reactionsSnap, commentStatsSnap] = await Promise.all([
    refs.oldCase.get(),
    refs.oldResult.get(),
    refs.oldReactions.get(),
    refs.oldCommentStats.get()
  ]);

  if (!caseSnap.exists) throw new Error(`Legacy case not found: ${oldCaseId}`);
  if (!resultSnap.exists) throw new Error(`Legacy result not found: ${oldCaseId}`);

  const caseData = caseSnap.data();
  if (!isLegacyUidCase(oldCaseId, caseData)) {
    throw new Error(`Case is not an eligible completed legacy UID case: ${oldCaseId}`);
  }

  const resultData = { ...resultSnap.data() };
  delete resultData.userId;

  const batch = db.batch();
  batch.set(refs.newCase, {
    ...caseData,
    idVersion: 2,
    legacyIdHash: hash,
    migratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: false });
  batch.set(refs.newResult, {
    ...resultData,
    idVersion: 2,
    migratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: false });
  if (reactionsSnap.exists) batch.set(refs.newReactions, reactionsSnap.data(), { merge: false });
  if (commentStatsSnap.exists) batch.set(refs.newCommentStats, commentStatsSnap.data(), { merge: false });
  await batch.commit();

  return { caseData, resultData };
}

async function removeLegacyDocuments(oldCaseId) {
  const deleted = {
    votes: await deleteCollection(`result_reactions/${oldCaseId}/votes`),
    comments: await deleteCollection(`court_comments/${oldCaseId}/items`),
    commentAuthors: await deleteCollection(`court_comment_authors/${oldCaseId}/items`)
  };

  const batch = db.batch();
  [
    `result_reactions/${oldCaseId}`,
    `court_comment_stats/${oldCaseId}`,
    `court_comments/${oldCaseId}`,
    `court_comment_authors/${oldCaseId}`,
    `results/${oldCaseId}`,
    `cases/${oldCaseId}`
  ].forEach(path => batch.delete(db.doc(path)));
  await batch.commit();
  return deleted;
}

async function migrateLegacyCase(caseId, { dryRun = true } = {}) {
  const oldCaseId = cleanCaseId(caseId);
  if (!oldCaseId) throw new Error('Invalid legacy case ID');
  const oldCaseSnap = await db.doc(`cases/${oldCaseId}`).get();
  const oldResultSnap = await db.doc(`results/${oldCaseId}`).get();
  if (!oldCaseSnap.exists || !oldResultSnap.exists) {
    return { legacyIdHash: legacyIdHash(oldCaseId), eligible: false, reason: 'missing-case-or-result' };
  }
  if (!isLegacyUidCase(oldCaseId, oldCaseSnap.data())) {
    return { legacyIdHash: legacyIdHash(oldCaseId), eligible: false, reason: 'not-completed-legacy-uid-id' };
  }
  if (dryRun) {
    return {
      legacyIdHash: legacyIdHash(oldCaseId),
      eligible: true,
      isPublic: oldResultSnap.data().isPublic === true,
      createdAt: oldCaseSnap.data().createdAt || null
    };
  }

  const hash = legacyIdHash(oldCaseId);
  const { aliasRef, targetCaseId, aliasStatus, reused } = await reserveAlias(oldCaseId);
  if (aliasStatus === 'completed') {
    const deleted = await removeLegacyDocuments(oldCaseId);
    return {
      legacyIdHash: hash,
      targetCaseId,
      migrated: true,
      resumedCleanup: true,
      deleted
    };
  }

  await copyPrimaryDocuments(oldCaseId, targetCaseId, hash);
  const [votes, comments, commentAuthors, reportCounts] = await Promise.all([
    copyCollection(`result_reactions/${oldCaseId}/votes`, `result_reactions/${targetCaseId}/votes`),
    copyCollection(`court_comments/${oldCaseId}/items`, `court_comments/${targetCaseId}/items`),
    copyCollection(
      `court_comment_authors/${oldCaseId}/items`,
      `court_comment_authors/${targetCaseId}/items`,
      data => ({ ...data, caseId: targetCaseId })
    ),
    migrateReports(oldCaseId, targetCaseId)
  ]);

  await aliasRef.set({
    targetCaseId,
    status: 'completed',
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const deleted = await removeLegacyDocuments(oldCaseId);
  return {
    legacyIdHash: hash,
    targetCaseId,
    migrated: true,
    reusedTarget: reused,
    copied: { votes, comments, commentAuthors, ...reportCounts },
    deleted
  };
}

async function scanLegacyCases({ limit = 20, cursor = '' } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  let query = db.collection('cases').orderBy(FieldPath.documentId()).limit(safeLimit);
  if (cursor) query = query.startAfter(String(cursor));
  const snap = await query.get();
  const candidates = snap.docs
    .filter(document => isLegacyUidCase(document.id, document.data()))
    .map(document => ({
      caseId: document.id,
      legacyIdHash: legacyIdHash(document.id),
      isPublic: document.data().isPublic === true
    }));
  return {
    candidates,
    scanned: snap.size,
    nextCursor: snap.empty ? '' : snap.docs[snap.docs.length - 1].id,
    done: snap.size < safeLimit
  };
}

async function resolveAlias(caseId) {
  const clean = cleanCaseId(caseId);
  if (!clean) return '';
  const snap = await db.doc(`case_id_aliases/${legacyIdHash(clean)}`).get();
  if (!snap.exists || snap.data().status !== 'completed') return '';
  return cleanCaseId(snap.data().targetCaseId);
}

module.exports = {
  cleanCaseId,
  legacyIdHash,
  isLegacyUidCase,
  migrateLegacyCase,
  scanLegacyCases,
  resolveAlias
};
