import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDeck, judgeType, QUICK_CASES } from '../../public/js/components/quick-court.js';

test('quick court deals five distinct valid cases, including random boundaries', () => {
  for (const random of [() => 0, () => 0.999999, Math.random]) {
    const deck = makeDeck(random);
    assert.equal(deck.length, 5);
    assert.equal(new Set(deck).size, 5);
    deck.forEach(id => assert.ok(QUICK_CASES[id]?.[3].length === 3));
  }
});

test('personality follows majority and uses most recent preference for a tie', () => {
  assert.equal(judgeType([0, 1, 0, 2, 0]), 0);
  assert.equal(judgeType([1, 1, 2, 0, 1]), 1);
  assert.equal(judgeType([2, 2, 0, 1, 2]), 2);
  assert.equal(judgeType([0, 1, 0, 2, 1]), 1);
  assert.equal(judgeType([1, 0, 1, 2, 0]), 0);
});
