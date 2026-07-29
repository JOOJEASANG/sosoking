'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required');
}
if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const db = getFirestore();
const { moderateReportData } = require('./reports');

async function seedReport({ reportId, caseId, ownerId }) {
  const now = Timestamp.now();
  const batch = db.batch();
  batch.set(db.doc(`cases/${caseId}`), {
    userId: ownerId,
    caseTitle: `${caseId} 사건`,
    status: 'completed',
    isPublic: true,
    createdAt: now,
    updatedAt: now
  });
  batch.set(db.doc(`results/${caseId}`), {
    caseTitle: `${caseId} 사건`,
    isPublic: true,
    reportCount: 1,
    createdAt: now,
    updatedAt: now
  });
  batch.set(db.doc(`reports/${reportId}`), {
    caseId,
    reason: '통합 테스트 신고 사유',
    status: 'pending',
    userId: 'reporter-user',
    createdAt: now,
    updatedAt: now
  });
  await batch.commit();
}

(async () => {
  await seedReport({
    reportId: 'report-hide-test',
    caseId: 'report-hide-case',
    ownerId: 'report-owner-one'
  });

  const hidden = await moderateReportData('report-hide-test', 'hide', 'admin-test-user');
  assert.equal(hidden.alreadyHandled, false);
  assert.equal(hidden.status, 'resolved');
  assert.equal(hidden.hidden, true);

  const [hiddenCase, hiddenResult, hiddenReport] = await Promise.all([
    db.doc('cases/report-hide-case').get(),
    db.doc('results/report-hide-case').get(),
    db.doc('reports/report-hide-test').get()
  ]);
  assert.equal(hiddenCase.data().isPublic, false);
  assert.equal(hiddenResult.data().isPublic, false);
  assert.equal(hiddenCase.data().moderationStatus, 'hidden-by-report');
  assert.equal(hiddenResult.data().moderationStatus, 'hidden-by-report');
  assert.equal(hiddenReport.data().status, 'resolved');
  assert.equal(hiddenReport.data().resolutionAction, 'hide');
  assert.equal(hiddenReport.data().resolvedBy, 'admin-test-user');

  const hiddenAgain = await moderateReportData('report-hide-test', 'hide', 'another-admin');
  assert.equal(hiddenAgain.alreadyHandled, true);
  assert.equal(hiddenAgain.status, 'resolved');

  await seedReport({
    reportId: 'report-dismiss-test',
    caseId: 'report-dismiss-case',
    ownerId: 'report-owner-two'
  });

  const dismissed = await moderateReportData('report-dismiss-test', 'dismiss', 'admin-test-user');
  assert.equal(dismissed.alreadyHandled, false);
  assert.equal(dismissed.status, 'dismissed');
  assert.equal(dismissed.hidden, false);

  const [dismissedCase, dismissedResult, dismissedReport] = await Promise.all([
    db.doc('cases/report-dismiss-case').get(),
    db.doc('results/report-dismiss-case').get(),
    db.doc('reports/report-dismiss-test').get()
  ]);
  assert.equal(dismissedCase.data().isPublic, true);
  assert.equal(dismissedResult.data().isPublic, true);
  assert.equal(dismissedReport.data().status, 'dismissed');
  assert.equal(dismissedReport.data().resolutionAction, 'dismiss');
  assert.equal(dismissedReport.data().resolvedBy, 'admin-test-user');

  console.log('Report moderation integration passed: hide is atomic, dismiss preserves visibility, and repeat handling is idempotent.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
