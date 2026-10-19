'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldPath, FieldValue, getFirestore } = require('firebase-admin/firestore');
const { normalizeVerdictNumberLines } = require('./verdict-number-normalizer');

if (!getApps().length) initializeApp();
const db = getFirestore();
const PAGE_SIZE = 300;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.VERDICT_NUMBER_LINES_DRY_RUN === 'true';

async function migrateVerdictNumberLines() {
  let cursor = null;
  let scanned = 0;
  let updated = 0;
  const changedIds = [];

  while (true) {
    let query = db.collection('results')
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    let batchUpdates = 0;

    for (const document of snapshot.docs) {
      scanned += 1;
      const data = document.data() || {};
      if (typeof data.verdict !== 'string' || !data.verdict.trim()) continue;

      const normalized = normalizeVerdictNumberLines(data.verdict);
      if (normalized === data.verdict) continue;

      if (changedIds.length < 20) changedIds.push(document.id);
      batchUpdates += 1;
      if (!DRY_RUN) {
        batch.set(document.ref, {
          verdict: normalized,
          verdictFormatVersion: 2,
          verdictNumberLinesMigratedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    if (batchUpdates) {
      if (!DRY_RUN) await batch.commit();
      updated += batchUpdates;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) break;
  }

  return { dryRun: DRY_RUN, scanned, updated, changedIds };
}

migrateVerdictNumberLines()
  .then(result => {
    console.log('verdict number-line migration complete:', result);
  })
  .catch(error => {
    console.error('verdict number-line migration failed:', error);
    process.exitCode = 1;
  });
