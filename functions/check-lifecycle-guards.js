'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const {
  isDeletionLocked,
  isModerationHidden,
  assertParticipablePublicResult,
  assertVisibilityChangeAllowed
} = require('./social');
const { assertOwnerVerdictVoteAllowed } = require('./owner-verdict');

function expectCode(fn, expectedCode) {
  assert.throws(fn, error => error?.code === expectedCode);
}

const safePublic = {
  isPublic: true,
  publicDataVersion: 1,
  reactionTotal: 0,
  commentCount: 0
};

assert.equal(isDeletionLocked({ deletionStatus: 'processing' }), true);
assert.equal(isDeletionLocked({ deletionStatus: 'deleting' }), true);
assert.equal(isDeletionLocked({ status: 'deleting' }), true);
assert.equal(isDeletionLocked({ courtStage: 'deleting' }), true);
assert.equal(isDeletionLocked({ status: 'completed' }), false);

assert.equal(isModerationHidden({ moderationStatus: 'hidden-by-report' }), true);
assert.equal(isModerationHidden({ moderationStatus: 'visible' }), false);

assert.doesNotThrow(() => assertParticipablePublicResult(safePublic));
expectCode(
  () => assertParticipablePublicResult({ ...safePublic, deletionStatus: 'processing' }),
  'failed-precondition'
);
expectCode(
  () => assertParticipablePublicResult({ ...safePublic, caseDescription: '민감 원문' }),
  'permission-denied'
);

assert.doesNotThrow(() => assertVisibilityChangeAllowed({}, {}, true));
assert.doesNotThrow(() => assertVisibilityChangeAllowed(
  { moderationStatus: 'hidden-by-report' },
  {},
  false
));
expectCode(
  () => assertVisibilityChangeAllowed({ moderationStatus: 'hidden-by-report' }, {}, true),
  'failed-precondition'
);
expectCode(
  () => assertVisibilityChangeAllowed({}, { deletionStatus: 'processing' }, true),
  'failed-precondition'
);

assert.doesNotThrow(() => assertOwnerVerdictVoteAllowed(
  { userId: 'owner-1' },
  { verdict: '주문\n원고 승' },
  'owner-1'
));
expectCode(
  () => assertOwnerVerdictVoteAllowed({ userId: 'owner-1' }, { verdict: '판결' }, 'other-user'),
  'permission-denied'
);
expectCode(
  () => assertOwnerVerdictVoteAllowed(
    { userId: 'owner-1', deletionStatus: 'processing' },
    { verdict: '판결' },
    'owner-1'
  ),
  'failed-precondition'
);
expectCode(
  () => assertOwnerVerdictVoteAllowed({ userId: 'owner-1' }, {}, 'owner-1'),
  'failed-precondition'
);

console.log('Lifecycle guard validation passed: deletion locks, moderation hides, and owner blind-verdict voting are enforced consistently.');
