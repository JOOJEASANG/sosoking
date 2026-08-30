'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  isSanitizedPublicResult,
  publicStorageProjection
} = require('./public-result-data');

if (!getApps().length) initializeApp();
const db = getFirestore();
const BATCH_LIMIT = 400;

async function commitWrites(rows) {
  for (let offset = 0; offset < rows.length; offset += BATCH_LIMIT) {
    const batch = db.batch();
    for (const row of rows.slice(offset, offset + BATCH_LIMIT)) {
      batch.set(db.doc(`public_results/${row.id}`), publicStorageProjection(row.data));
    }
    await batch.commit();
  }
}

async function deleteRefs(refs) {
  for (let offset = 0; offset < refs.length; offset += BATCH_LIMIT) {
    const batch = db.batch();
    refs.slice(offset, offset + BATCH_LIMIT).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function main() {
  const internal = await db.collection('results')
    .where('isPublic', '==', true)
    .where('publicDataVersion', '==', 1)
    .get();

  const rows = internal.docs
    .filter(document => isSanitizedPublicResult(document.data() || {}))
    .map(document => ({ id: document.id, data: document.data() || {} }));
  const activeIds = new Set(rows.map(row => row.id));

  await commitWrites(rows);

  const publicSnapshot = await db.collection('public_results').get();
  const staleRefs = publicSnapshot.docs
    .filter(document => !activeIds.has(document.id))
    .map(document => document.ref);
  await deleteRefs(staleRefs);

  console.log(`Public result mirror synchronized: ${rows.length} active, ${staleRefs.length} stale removed.`);
}

main().catch(error => {
  console.error('Public result mirror synchronization failed:', error);
  process.exitCode = 1;
});
