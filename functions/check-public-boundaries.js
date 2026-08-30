'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const {
  REDACTED_PUBLIC_ORIGINAL,
  selectCaseDescription
} = require('./public-original');
const { assertDiscussionWritable } = require('./discussion');
const { publicClientProjection } = require('./public-result-data');
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

const projected = publicClientProjection({
  isPublic: true,
  publicDataVersion: 1,
  userId: 'private-uid',
  caseDescription: '내부 접수 원문',
  nickname: '내부 닉네임',
  internalSecret: 'should-not-leak',
  caseTitle: '공개 테스트 사건',
  publicCaseDescription: '익명 공개 요약',
  publicNickname: '익명 원고',
  verdict: '주문\n\n1. 테스트를 완료한다.\n\n판단이유\n공개 projection 검증을 위함이다.'
});
assert.equal(projected.caseTitle, '공개 테스트 사건');
assert.equal(projected.publicCaseDescription, '익명 공개 요약');
assert.match(projected.verdict, /\n\n/);
for (const forbidden of ['userId', 'caseDescription', 'nickname', 'internalSecret']) {
  assert.equal(Object.prototype.hasOwnProperty.call(projected, forbidden), false, `public projection leaked ${forbidden}`);
}

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

console.log('Public boundary validation passed: raw originals stay private, public data uses an explicit isolated projection, and discussion writes fail closed during lifecycle changes.');
