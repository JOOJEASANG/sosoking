'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanText,
  isValidDateKey,
  parseDateKey,
  isDateWithinDays,
  isValidMaterialId,
  clampLimit,
  normalizeVoteSide,
  normalizeCommentSide,
  nextVoteCounts,
} = require('../functions/lib/material-policy');

test('cleanText removes unsafe delimiters and limits length', () => {
  assert.equal(cleanText('  <hello>\u0000  ', 20), 'hello');
  assert.equal(cleanText('abcdef', 3), 'abc');
});

test('date keys reject impossible or malformed dates', () => {
  assert.equal(isValidDateKey('2026-06-23'), true);
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.equal(isValidDateKey('20260623'), false);
  assert.equal(parseDateKey('', '2026-06-23'), '2026-06-23');
  assert.throws(() => parseDateKey('2026-13-01', '2026-06-23'));
});

test('date range is limited symmetrically', () => {
  assert.equal(isDateWithinDays('2026-06-01', '2026-06-23', 31), true);
  assert.equal(isDateWithinDays('2026-04-01', '2026-06-23', 31), false);
});

test('material ids cannot contain paths or punctuation', () => {
  assert.equal(isValidMaterialId('20260623_01'), true);
  assert.equal(isValidMaterialId('abc_DEF-123'), true);
  assert.equal(isValidMaterialId('../users/admin'), false);
  assert.equal(isValidMaterialId('a/b'), false);
  assert.equal(isValidMaterialId(''), false);
});

test('limits are finite integers within bounds', () => {
  assert.equal(clampLimit('12.9', 10, 30), 12);
  assert.equal(clampLimit(0, 10, 30), 1);
  assert.equal(clampLimit(1000, 10, 30), 30);
  assert.equal(clampLimit('nope', 10, 30), 10);
});

test('vote and comment sides are normalized', () => {
  assert.equal(normalizeVoteSide('agree'), 'agree');
  assert.equal(normalizeVoteSide('neutral'), null);
  assert.equal(normalizeCommentSide('disagree'), 'disagree');
  assert.equal(normalizeCommentSide('other'), 'neutral');
});

test('vote counters never become negative', () => {
  assert.deepEqual(nextVoteCounts({ agreeCount: 0, disagreeCount: 0 }, 'agree', 'disagree'), {
    agreeCount: 0,
    disagreeCount: 1,
  });
  assert.deepEqual(nextVoteCounts({ agreeCount: 4, disagreeCount: 2 }, 'agree', 'agree'), {
    agreeCount: 4,
    disagreeCount: 2,
  });
  assert.deepEqual(nextVoteCounts({ agreeCount: 4, disagreeCount: 2 }, 'agree', 'disagree'), {
    agreeCount: 3,
    disagreeCount: 3,
  });
});
