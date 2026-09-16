import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'functions', 'package.json'));
const { normalizeVerdictNumberLines, normalizeSequentialList, looksLikeDatePrefix } = require('./verdict-number-normalizer.js');

test('blank input is returned unchanged', () => {
  assert.equal(normalizeVerdictNumberLines(''), '');
  assert.equal(normalizeVerdictNumberLines('   '), '   ');
  assert.equal(normalizeVerdictNumberLines(null), '');
});

test('escaped newlines are converted to real newlines', () => {
  assert.equal(normalizeVerdictNumberLines('첫째 줄\\n둘째 줄'), '첫째 줄\n둘째 줄');
});

test('text without enumeration markers is preserved', () => {
  assert.equal(normalizeVerdictNumberLines('피고는 반성하라.'), '피고는 반성하라.');
});

test('sequential order items are split onto their own lines', () => {
  assert.equal(
    normalizeVerdictNumberLines('주문 1. 사과하라 2. 배상하라'),
    '주문 1. 사과하라\n2. 배상하라'
  );
});

test('normalization is idempotent', () => {
  const once = normalizeVerdictNumberLines('주문 1. 사과하라 2. 배상하라');
  assert.equal(normalizeVerdictNumberLines(once), once);
});

test('normalizeSequentialList only breaks a real 1-2-3 run', () => {
  assert.equal(normalizeSequentialList('1. 하나 2. 둘 3. 셋'), '1. 하나\n2. 둘\n3. 셋');
  // A lone number that is not part of a run stays inline.
  assert.equal(normalizeSequentialList('보증금 2. 백만원'), '보증금 2. 백만원');
});

test('looksLikeDatePrefix distinguishes dates from list markers', () => {
  assert.equal(looksLikeDatePrefix('2024.', 5), true);
  assert.equal(looksLikeDatePrefix('안녕 ', 3), false);
});
