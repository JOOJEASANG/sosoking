import assert from 'node:assert/strict';
import {
  KNOWN_OBSOLETE_FUNCTIONS,
  classifyObsoleteFunctions
} from './list-obsolete-deployed-functions.mjs';
import { sourceExports } from './check-deployed-functions.mjs';

for (const name of [
  'sanitizePublicResult',
  'generateCourtCaseV7',
  'uploadFeedImage',
  'createDailyAiCase',
  'getDailyRealCourt',
  'submitDailyRealCourtVerdict'
]) {
  assert.ok(KNOWN_OBSOLETE_FUNCTIONS.has(name), `known obsolete allowlist is missing ${name}`);
}

const current = [...sourceExports()].map(id => ({ id }));
const sample = [
  ...current,
  { id: 'sanitizePublicResult' },
  { id: 'generateCourtCaseV7' },
  { id: 'unknownFunctionNeedsReview' }
];
const classified = classifyObsoleteFunctions(sample);

assert.deepEqual(classified.removable, ['generateCourtCaseV7', 'sanitizePublicResult']);
assert.deepEqual(classified.unknown, ['unknownFunctionNeedsReview']);

console.log('Obsolete Functions cleanup validation passed: only reviewed legacy Functions are removable and unknown drift remains blocking.');
