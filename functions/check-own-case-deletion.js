'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required');
}
if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const db = getFirestore();
const { deleteCourtPostData } = require('./admin-actions');

async function seedCase(caseId, ownerUid) {
  const now = Timestamp.now();
  const legacyIdHash = `${caseId}-legacy-hash`;
  const batch = db.batch();
  batch.set(db.doc(`cases/${caseId}`), {
    userId: ownerUid,
    caseTitle: `${caseId} 사건`,
    status: 'completed',
    legacyIdHash,
    createdAt: now,
    updatedAt: now
  });
  batch.set(db.doc(`results/${caseId}`), { caseTitle: `${caseId} 사건`, isPublic: true, createdAt: now, updatedAt: now });
  batch.set(db.doc(`result_reactions/${caseId}`), { total: 1, updatedAt: now });
  batch.set(db.doc(`result_reactions/${caseId}/votes/vote-one`), { userId: 'voter', createdAt: now });
  batch.set(db.doc(`court_comments/${caseId}`), { count: 1, updatedAt: now });
  batch.set(db.doc(`court_comments/${caseId}/items/comment-one`), { text: '삭제 테스트 댓글', createdAt: now });
  batch.set(db.doc(`court_comment_authors/${caseId}`), { updatedAt: now });
  batch.set(db.doc(`court_comment_authors/${caseId}/items/comment-one`), { userId: 'commenter' });
  batch.set(db.doc(`court_comment_stats/${caseId}`), { count: 1, updatedAt: now });
  batch.set(db.doc(`reports/report-${caseId}`), { caseId, status: 'pending', createdAt: now });
  batch.set(db.doc(`report_keys/key-${caseId}`), { caseId, reportId: `report-${caseId}`, createdAt: now });
  batch.set(db.doc(`case_id_aliases/${legacyIdHash}`), { targetCaseId: caseId, createdAt: now });
  await batch.commit();
  return { legacyIdHash };
}

async function exists(path) {
  return (await db.doc(path).get()).exists;
}

(async () => {
  const ownCaseId = 'own-delete-case';
  const ownerUid = 'case-owner-user';
  const { legacyIdHash } = await seedCase(ownCaseId, ownerUid);

  const deleted = await deleteCourtPostData(ownCaseId, { ownerUid });
  assert.equal(deleted.caseId, ownCaseId);
  assert.equal(Object.hasOwn(deleted, 'ownerUid'), false);
  assert.equal(deleted.removedLegacyAlias, true);
  assert.ok(deleted.deleted >= 11);

  for (const path of [
    `cases/${ownCaseId}`,
    `results/${ownCaseId}`,
    `result_reactions/${ownCaseId}`,
    `result_reactions/${ownCaseId}/votes/vote-one`,
    `court_comments/${ownCaseId}`,
    `court_comments/${ownCaseId}/items/comment-one`,
    `court_comment_authors/${ownCaseId}`,
    `court_comment_authors/${ownCaseId}/items/comment-one`,
    `court_comment_stats/${ownCaseId}`,
    `reports/report-${ownCaseId}`,
    `report_keys/key-${ownCaseId}`,
    `case_id_aliases/${legacyIdHash}`
  ]) {
    assert.equal(await exists(path), false, `${path} should be deleted`);
  }

  const otherCaseId = 'other-owner-case';
  await seedCase(otherCaseId, 'different-owner');
  await assert.rejects(
    () => deleteCourtPostData(otherCaseId, { ownerUid }),
    error => error?.code === 'permission-denied'
  );
  assert.equal(await exists(`cases/${otherCaseId}`), true);
  assert.equal(await exists(`results/${otherCaseId}`), true);
  assert.equal(await exists(`reports/report-${otherCaseId}`), true);

  await assert.rejects(
    () => deleteCourtPostData('missing-case', { ownerUid }),
    error => error?.code === 'not-found'
  );

  console.log('Own case deletion integration passed: ownership is enforced and all related records are removed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
