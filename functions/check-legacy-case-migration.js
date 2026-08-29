'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required');
}
if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const db = getFirestore();
const { legacyIdHash, migrateLegacyCase, resolveAlias } = require('./legacy-case-migration');

function reportKey(uid, caseId) {
  return crypto.createHash('sha256').update(`${uid}\u0000${caseId}`).digest('hex');
}

(async () => {
  const uid = 'legacy-user-uid';
  const oldCaseId = `${uid}_1720000000000_testcase`;
  const oldReportKey = reportKey(uid, oldCaseId);
  const now = Timestamp.now();

  const seed = db.batch();
  seed.set(db.doc(`cases/${oldCaseId}`), {
    userId: uid,
    status: 'completed',
    isPublic: true,
    caseTitle: '이전 대상 사건',
    createdAt: now,
    updatedAt: now
  });
  seed.set(db.doc(`results/${oldCaseId}`), {
    userId: uid,
    isPublic: true,
    caseTitle: '이전 대상 사건',
    verdict: '주문\n테스트 판결',
    reactionTotal: 1,
    commentCount: 1,
    createdAt: now,
    updatedAt: now
  });
  seed.set(db.doc(`result_reactions/${oldCaseId}`), {
    counts: { funny: 1 },
    total: 1,
    updatedAt: now
  });
  seed.set(db.doc(`result_reactions/${oldCaseId}/votes/${uid}`), {
    uid,
    reaction: 'funny',
    updatedAt: now
  });
  seed.set(db.doc(`court_comments/${oldCaseId}/items/comment-1`), {
    nickname: '테스터',
    text: '이전 댓글',
    status: 'visible',
    createdAt: now
  });
  seed.set(db.doc(`court_comment_authors/${oldCaseId}/items/comment-1`), {
    uid,
    caseId: oldCaseId,
    commentId: 'comment-1',
    createdAt: now
  });
  seed.set(db.doc(`court_comment_stats/${oldCaseId}`), { count: 1, updatedAt: now });
  seed.set(db.doc('reports/report-1'), {
    caseId: oldCaseId,
    userId: uid,
    reason: '테스트 신고',
    status: 'pending',
    createdAt: now,
    updatedAt: now
  });
  seed.set(db.doc(`report_keys/${oldReportKey}`), {
    caseId: oldCaseId,
    userId: uid,
    reportId: 'report-1',
    createdAt: now
  });
  await seed.commit();

  const dryRun = await migrateLegacyCase(oldCaseId, { dryRun: true });
  assert.equal(dryRun.eligible, true);
  assert.equal(dryRun.legacyIdHash, legacyIdHash(oldCaseId));
  assert.equal((await db.doc(`cases/${oldCaseId}`).get()).exists, true);

  const applied = await migrateLegacyCase(oldCaseId, { dryRun: false });
  assert.equal(applied.migrated, true);
  assert.notEqual(applied.targetCaseId, oldCaseId);
  assert.equal(applied.targetCaseId.length, 20);

  const target = applied.targetCaseId;
  const [newCase, newResult, alias, vote, comment, author, report, oldKey, newKey] = await Promise.all([
    db.doc(`cases/${target}`).get(),
    db.doc(`results/${target}`).get(),
    db.doc(`case_id_aliases/${legacyIdHash(oldCaseId)}`).get(),
    db.doc(`result_reactions/${target}/votes/${uid}`).get(),
    db.doc(`court_comments/${target}/items/comment-1`).get(),
    db.doc(`court_comment_authors/${target}/items/comment-1`).get(),
    db.doc('reports/report-1').get(),
    db.doc(`report_keys/${oldReportKey}`).get(),
    db.doc(`report_keys/${reportKey(uid, target)}`).get()
  ]);

  assert.equal(newCase.exists, true);
  assert.equal(newCase.data().userId, uid);
  assert.equal(newCase.data().legacyIdHash, legacyIdHash(oldCaseId));
  assert.equal(newResult.exists, true);
  assert.equal(Object.prototype.hasOwnProperty.call(newResult.data(), 'userId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(newResult.data(), 'legacyIdHash'), false);
  assert.equal(alias.exists, true);
  assert.equal(alias.data().targetCaseId, target);
  assert.equal(alias.data().status, 'completed');
  assert.equal(JSON.stringify(alias.data()).includes(oldCaseId), false);
  assert.equal(vote.exists, true);
  assert.equal(comment.exists, true);
  assert.equal(author.data().caseId, target);
  assert.equal(report.data().caseId, target);
  assert.equal(oldKey.exists, false);
  assert.equal(newKey.exists, true);
  assert.equal(await resolveAlias(oldCaseId), target);

  for (const path of [
    `cases/${oldCaseId}`,
    `results/${oldCaseId}`,
    `result_reactions/${oldCaseId}`,
    `court_comment_stats/${oldCaseId}`,
    `result_reactions/${oldCaseId}/votes/${uid}`,
    `court_comments/${oldCaseId}/items/comment-1`,
    `court_comment_authors/${oldCaseId}/items/comment-1`
  ]) {
    assert.equal((await db.doc(path).get()).exists, false, `${path} should be removed`);
  }

  console.log('Legacy case migration integration passed: opaque ID, hashed alias, related data, and cleanup.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
