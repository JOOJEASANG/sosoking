'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldPath, getFirestore } = require('firebase-admin/firestore');
const { publicSanitizationPatch } = require('./public-result-sanitizer');

if (!getApps().length) initializeApp();
const db = getFirestore();
const PAGE_SIZE = 400;

async function sanitizePublicResults() {
  let cursor = null;
  let scanned = 0;
  let updated = 0;

  while (true) {
    let query = db.collection('results')
      .where('isPublic', '==', true)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    let batchUpdates = 0;
    for (const document of snapshot.docs) {
      scanned += 1;
      const patch = publicSanitizationPatch(document.data() || {});
      if (!patch) continue;
      batch.set(document.ref, patch, { merge: true });
      batchUpdates += 1;
    }

    if (batchUpdates) {
      await batch.commit();
      updated += batchUpdates;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) break;
  }

  return { scanned, updated };
}

sanitizePublicResults()
  .then(result => {
    console.log('public result sanitation complete:', result);
  })
  .catch(error => {
    console.error('public result sanitation failed:', error);
    process.exitCode = 1;
  });
