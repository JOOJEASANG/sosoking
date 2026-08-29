'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const {
  REDACTED_PUBLIC_ORIGINAL,
  selectCaseDescription
} = require('./public-original');
const { assertDiscussionWritable } = require('./discussion');
const { inspectContent } = require('./content-safety');

function expectCode(fn, expectedCode) {
  assert.throws(fn, error => error?.code === expectedCode);
}

assert.equal(
  selectCaseDescription({
    isOwner: true,
    caseData: { caseDescription: '작성자에게만 보이는 실제 접수 원문' },
    resultData: { publicCaseDescription: '공개 요약' }
  }),
  '작성자에게만 보이는 실제 접수 원문'
);

assert.equal(
  selectCaseDescription({
    isOwner: false,
    caseData: { caseDescription: '김철수의 실제 원문' },
    resultData: { publicCaseDescription: '익명화된 공개용 사건 요약입니다.' }
  }),
  '익명화된 공개용 사건 요약입니다.'
);

assert.equal(
  selectCaseDescription({
    isOwner: false,
    caseData: { caseDescription: '절대로 공개되면 안 되는 원문' },
    resultData: { publicCaseDescription: '실명: 김철수' }
  }),
  REDACTED_PUBLIC_ORIGINAL
);

assert.equal(
  selectCaseDescription({
    isOwner: false,
    caseData: { caseDescription: '절대로 공개되면 안 되는 원문' },
    resultData: {}
  }),
  REDACTED_PUBLIC_ORIGINAL
);

assert.equal(inspectContent('성명: 김철수').code, 'person-name-labeled');
assert.equal(inspectContent('김철수 씨가 리모컨을 가져갔다.').code, 'person-name-honorific');
assert.equal(inspectContent('친구가 리모컨을 가져갔다.').safe, true);

const safePublic = {
  isPublic: true,
  publicDataVersion: 1,
  reactionTotal: 0,
  commentCount: 0
};

assert.doesNotThrow(() => assertDiscussionWritable(safePublic));
expectCode(
  () => assertDiscussionWritable({ ...safePublic, deletionStatus: 'processing' }),
  'failed-precondition'
);
expectCode(
  () => assertDiscussionWritable({ ...safePublic, status: 'deleting' }),
  'failed-precondition'
);
expectCode(
  () => assertDiscussionWritable({ ...safePublic, caseDescription: '민감 원문' }),
  'permission-denied'
);

console.log('Public boundary validation passed: raw originals stay private and discussion writes fail closed during lifecycle changes.');
