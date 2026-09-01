'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldPath, FieldValue, getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const PAGE_SIZE = 150;
const REACTIONS = ['plaintiff', 'defendant', 'both'];

function emptyCounts() {
  return Object.fromEntries(REACTIONS.map(side => [side, 0]));
}

function validCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function countsMatch(current = {}, expected = {}) {
  return REACTIONS.every(side => validCount(current?.[side]) === validCount(expected?.[side]));
}

async function repairResultReactions() {
  let cursor = null;
  let scanned = 0;
  let repairedSummaries = 0;
  let updatedResults = 0;
  let validVotes = 0;

  while (true) {
    let query = db.collection('result_reactions')
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const rows = await Promise.all(snapshot.docs.map(async document => {
      const [votesSnap, resultSnap] = await Promise.all([
        document.ref.collection('votes').get(),
        db.doc(`results/${document.id}`).get()
      ]);
      const counts = emptyCounts();
      for (const vote of votesSnap.docs) {
        const reaction = String(vote.data()?.reaction || '');
        if (!REACTIONS.includes(reaction)) continue;
        counts[reaction] += 1;
      }
      return { document, resultSnap, counts };
    }));

    const batch = db.batch();
    let writes = 0;

    for (const { document, resultSnap, counts } of rows) {
      scanned += 1;
      const total = REACTIONS.reduce((sum, side) => sum + counts[side], 0);
      validVotes += total;
      const current = document.data() || {};
      const summaryNeedsRepair = Number(current.reactionDataVersion || 0) !== 2
        || Number(current.total || 0) !== total
        || !countsMatch(current.counts, counts);

      if (summaryNeedsRepair) {
        batch.set(document.ref, {
          reactionDataVersion: 2,
          counts,
          total,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        repairedSummaries += 1;
        writes += 1;
      }

      if (resultSnap.exists && Number(resultSnap.data()?.reactionTotal || 0) !== total) {
        batch.update(resultSnap.ref, {
          reactionTotal: total,
          updatedAt: FieldValue.serverTimestamp()
        });
        updatedResults += 1;
        writes += 1;
      }
    }

    if (writes) await batch.commit();
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) break;
  }

  return { scanned, repairedSummaries, updatedResults, validVotes };
}

repairResultReactions()
  .then(result => {
    console.log('result reaction repair complete:', result);
  })
  .catch(error => {
    console.error('result reaction repair failed:', error);
    process.exitCode = 1;
  });
