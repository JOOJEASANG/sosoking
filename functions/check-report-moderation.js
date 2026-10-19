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
const { submitReportData, moderateReportData } = require('./reports');

function reportKey(uid, caseId) {
  return crypto.createHash('sha256').update(`${uid}\u0000${caseId}`).digest('hex');
}

async function expectCode(promise, expectedCode) {
  try {
    await promise;
    assert.fail(`Expected error code ${expectedCode}`);
  } catch (error) {
    assert.equal(error.code, expectedCode);
  }
}

async function seedCase({ caseId, ownerId, isPublic = true, reportCount = 0 }) {
  const now = Timestamp.now();
  const batch = db.batch();
  batch.set(db.doc(`cases/${caseId}`), {
    userId: ownerId,
    caseTitle: `${caseId} 사건`,
    status: 'completed',
    isPublic,
    createdAt: now,
    updatedAt: now
  });
  batch.set(db.doc(`results/${caseId}`), {
    caseTitle: `${caseId} 사건`,
    isPublic,
    reportCount,
    createdAt: now,
    updatedAt: now
  });
  await batch.commit();
}

async function seedPendingReport({ reportId, caseId, ownerId }) {
  await seedCase({ caseId, ownerId, isPublic: true, reportCount: 1 });
  const now = Timestamp.now();
  await db.doc(`reports/${reportId}`).set({
    caseId,
    reason: '통합 테스트 신고 사유',
    status: 'pending',
    userId: 'reporter-user',
    createdAt: now,
    updatedAt: now
  });
}

(async () => {
  const reporterId = 'report-submit-user';
  const publicCaseId = 'report-submit-public-case';
  await seedCase({ caseId: publicCaseId, ownerId: 'different-owner', isPublic: true });

  const submitted = await submitReportData(reporterId, publicCaseId, '공개 판결 통합 테스트 신고');
  assert.equal(typeof submitted.reportId, 'string');
  assert.ok(submitted.reportId.length >= 16);

  const [submittedReport, submittedKey, submittedResult] = await Promise.all([
    db.doc(`reports/${submitted.reportId}`).get(),
    db.doc(`report_keys/${reportKey(reporterId, publicCaseId)}`).get(),
    db.doc(`results/${publicCaseId}`).get()
  ]);
  assert.equal(submittedReport.exists, true);
  assert.equal(submittedReport.data().status, 'pending');
  assert.equal(submittedReport.data().userId, reporterId);
  assert.equal(submittedKey.exists, true);
  assert.equal(submittedKey.data().reportId, submitted.reportId);
  assert.equal(submittedResult.data().reportCount, 1);

  await expectCode(
    submitReportData(reporterId, publicCaseId, '중복 신고는 거부되어야 합니다'),
    'already-exists'
  );

  const ownerCaseId = 'report-submit-owner-case';
  await seedCase({ caseId: ownerCaseId, ownerId: reporterId, isPublic: true });
  await expectCode(
    submitReportData(reporterId, ownerCaseId, '본인 사건 신고는 거부되어야 합니다'),
    'failed-precondition'
  );

  const privateCaseId = 'report-submit-private-case';
  await seedCase({ caseId: privateCaseId, ownerId: 'different-owner', isPublic: false });
  await expectCode(
    submitReportData(reporterId, privateCaseId, '비공개 사건 신고는 거부되어야 합니다'),
    'not-found'
  );

  await seedPendingReport({
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

  await seedPendingReport({
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

  console.log('Report integration passed: submission ownership and duplicate checks, atomic hide, dismiss visibility, and idempotency.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
