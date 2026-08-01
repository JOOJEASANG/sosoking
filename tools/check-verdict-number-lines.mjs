import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { splitSequentialOrderText } from '../public/js/verdict-number-line-guard.js';

const require = createRequire(import.meta.url);
const { normalizeVerdictNumberLines } = require('../functions/verdict-number-normalizer.js');

const twoItems = splitSequentialOrderText(1, '첫 번째 생활형 처분 2. 두 번째 재발 방지 조치');
assert.deepEqual(twoItems, [
  { number: 1, text: '첫 번째 생활형 처분' },
  { number: 2, text: '두 번째 재발 방지 조치' }
]);

const threeItems = splitSequentialOrderText(1, '첫째 조치 2) 둘째 조치 3. 셋째 조치');
assert.deepEqual(threeItems, [
  { number: 1, text: '첫째 조치' },
  { number: 2, text: '둘째 조치' },
  { number: 3, text: '셋째 조치' }
]);

const dateText = '시행일은 2026. 2. 1.로 정한다.';
assert.deepEqual(splitSequentialOrderText(1, dateText), [
  { number: 1, text: dateText }
]);

const legacyVerdict = [
  '주문',
  '1. 피고는 원고에게 사과문을 작성한다. 2. 당사자들은 같은 행동을 반복하지 않는다.',
  '',
  '판단이유',
  '제출된 사정을 종합하면 위와 같이 정함이 타당하다.'
].join('\n');
assert.equal(normalizeVerdictNumberLines(legacyVerdict), [
  '주문',
  '1. 피고는 원고에게 사과문을 작성한다.',
  '2. 당사자들은 같은 행동을 반복하지 않는다.',
  '',
  '판단이유',
  '제출된 사정을 종합하면 위와 같이 정함이 타당하다.'
].join('\n'));

const alreadyFormatted = '주문\n1. 첫 번째 내용\n2. 두 번째 내용\n\n판단이유\n이유 내용';
assert.equal(normalizeVerdictNumberLines(alreadyFormatted), alreadyFormatted);

const dateVerdict = '주문\n1. 이 결정은 2026. 2. 1.부터 시행한다. 2. 당사자는 이를 준수한다.\n\n판단이유\n이유 내용';
assert.equal(normalizeVerdictNumberLines(dateVerdict), '주문\n1. 이 결정은 2026. 2. 1.부터 시행한다.\n2. 당사자는 이를 준수한다.\n\n판단이유\n이유 내용');

const escapedNewlines = '주문\\n1. 첫 번째 내용 2. 두 번째 내용\\n\\n판단이유\\n이유 내용';
assert.equal(normalizeVerdictNumberLines(escapedNewlines), alreadyFormatted);

const displayGuard = fs.readFileSync('public/js/verdict-number-line-guard.js', 'utf8');
for (const required of [
  '.result-paper-body .doc-order-item',
  "item.querySelector(':scope > span')",
  "item.querySelector(':scope > p')"
]) {
  assert.ok(displayGuard.includes(required), `existing result renderer support missing: ${required}`);
}

const index = fs.readFileSync('public/index.html', 'utf8');
assert.ok(
  index.includes('/js/verdict-number-line-guard.js?v=20260801-verdict-number-lines-2'),
  'public/index.html must load the corrected existing-result number reflow guard'
);

const migration = fs.readFileSync('functions/migrate-verdict-number-lines-cli.js', 'utf8');
for (const required of [
  "db.collection('results')",
  'normalizeVerdictNumberLines(data.verdict)',
  'normalized === data.verdict',
  'verdictFormatVersion: 2',
  'VERDICT_NUMBER_LINES_DRY_RUN'
]) {
  assert.ok(migration.includes(required), `existing verdict migration missing: ${required}`);
}

const deploy = fs.readFileSync('.github/workflows/firebase-deploy.yml', 'utf8');
assert.ok(
  deploy.includes('node functions/migrate-verdict-number-lines-cli.js'),
  'Firebase deployment must migrate already completed verdict data'
);

const quality = fs.readFileSync('functions/document-output-quality.js', 'utf8');
assert.ok(
  quality.includes('주문\\\\n1. 첫 번째 내용\\\\n2. 두 번째 내용'),
  'AI quality prompt must require one numbered verdict item per line'
);

console.log('Verdict number-line validation passed: stored legacy verdicts are migrated, existing result DOM is covered, sequential orders split, and date-like text remains intact.');
