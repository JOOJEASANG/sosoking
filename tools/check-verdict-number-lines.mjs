import assert from 'node:assert/strict';
import fs from 'node:fs';
import { splitSequentialOrderText } from '../public/js/verdict-number-line-guard.js';

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

const index = fs.readFileSync('public/index.html', 'utf8');
assert.ok(
  index.includes('/js/verdict-number-line-guard.js?v=20260801-verdict-number-lines-1'),
  'public/index.html must load the existing-result number reflow guard'
);

const quality = fs.readFileSync('functions/document-output-quality.js', 'utf8');
assert.ok(
  quality.includes('주문\\\\n1. 첫 번째 내용\\\\n2. 두 번째 내용'),
  'AI quality prompt must require one numbered verdict item per line'
);

console.log('Verdict number-line validation passed: sequential orders split onto separate lines while date-like text remains intact.');
