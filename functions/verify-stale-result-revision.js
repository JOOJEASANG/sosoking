const assert = require('node:assert/strict');

const VERSION = 'role-based-trial-v10';
const REVISION = 'role-trial-r4-20260711';

function reusable(result = {}) {
  return result.resultVersion === VERSION
    && result.generationRevision === REVISION
    && result.trialRecord?.resultVersion === VERSION
    && Boolean(result.trialRecord?.docketNumber)
    && result.quality?.passed !== false;
}

const completeTrial = {
  resultVersion: VERSION,
  docketNumber: '2026황당ABC123',
};

assert.equal(reusable({ resultVersion: VERSION, trialRecord: completeTrial, quality: { passed: true } }), false, '기존 v10 결과는 리비전이 없으면 재사용하면 안 된다.');
assert.equal(reusable({ resultVersion: VERSION, generationRevision: 'older', trialRecord: completeTrial, quality: { passed: true } }), false, '이전 리비전은 재사용하면 안 된다.');
assert.equal(reusable({ resultVersion: VERSION, generationRevision: REVISION, trialRecord: completeTrial, quality: { passed: false } }), false, '품질 실패 결과는 재사용하면 안 된다.');
assert.equal(reusable({ resultVersion: VERSION, generationRevision: REVISION, trialRecord: completeTrial, quality: { passed: true } }), true, '현재 리비전의 정상 결과만 재사용해야 한다.');

console.log('Verified stale v10 results are invalidated and only current successful revision is reusable.');
