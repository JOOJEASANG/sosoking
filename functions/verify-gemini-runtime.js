const assert = require('node:assert/strict');
const {
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  PRO_MODEL,
  modelCandidates,
} = require('./gemini-runtime');
const { JUDGMENT_JSON_SCHEMA } = require('./ai-judgment-engine');

assert.equal(DEFAULT_MODEL, 'gemini-3.5-flash');
assert.equal(FALLBACK_MODEL, 'gemini-2.5-flash');
assert.equal(PRO_MODEL, 'gemini-3.1-pro-preview');
assert.deepEqual(modelCandidates('retired-model'), [DEFAULT_MODEL, FALLBACK_MODEL]);
assert.deepEqual(modelCandidates('gemini-2.5-flash'), [DEFAULT_MODEL, FALLBACK_MODEL]);
assert.deepEqual(modelCandidates('gemini-2.5-pro'), [PRO_MODEL, DEFAULT_MODEL, FALLBACK_MODEL]);
assert.deepEqual(modelCandidates(PRO_MODEL), [PRO_MODEL, DEFAULT_MODEL, FALLBACK_MODEL]);
assert.equal(JUDGMENT_JSON_SCHEMA.type, 'object');
assert.ok(JUDGMENT_JSON_SCHEMA.required.includes('investigation'));
assert.ok(JUDGMENT_JSON_SCHEMA.required.includes('opinion'));
assert.ok(JUDGMENT_JSON_SCHEMA.required.includes('orders'));
assert.equal(JUDGMENT_JSON_SCHEMA.properties.orders.items.required.length, 2);

console.log('Verified Gemini model migration, fallback and structured judgment output contract.');
