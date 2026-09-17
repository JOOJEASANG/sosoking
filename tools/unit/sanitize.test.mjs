import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, escapeAttr, compactText } from '../../public/js/utils/sanitize.js';

test('escapeHtml neutralizes HTML-significant characters', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
  assert.equal(escapeHtml("it's a trap"), 'it&#039;s a trap');
});

test('escapeHtml escapes ampersands first to avoid double-encoding', () => {
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  // A pre-existing entity is treated as literal text, not re-interpreted.
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  assert.equal(escapeHtml('a & b < c'), 'a &amp; b &lt; c');
});

test('escapeHtml coerces non-string input safely', () => {
  assert.equal(escapeHtml(), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(42), '42');
});

test('escapeAttr additionally escapes backticks', () => {
  assert.equal(escapeAttr('`onload`'), '&#096;onload&#096;');
  // Still applies the full HTML escaping.
  assert.equal(escapeAttr('<`>'), '&lt;&#096;&gt;');
  assert.equal(escapeAttr('"x"'), '&quot;x&quot;');
});

test('compactText collapses whitespace and trims', () => {
  assert.equal(compactText('  hello   world  '), 'hello world');
  assert.equal(compactText('line\n\nbreak'), 'line break');
  assert.equal(compactText(''), '');
  assert.equal(compactText(null), '');
});

test('compactText truncates past the max with an ellipsis', () => {
  assert.equal(compactText('abcdef', 3), 'abc…');
  // Exactly at the limit is not truncated.
  assert.equal(compactText('abc', 3), 'abc');
  assert.equal(compactText('short', 120), 'short');
});
