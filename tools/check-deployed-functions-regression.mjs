import assert from 'node:assert/strict';
import {
  sourceExports,
  validateDeployedFunctions
} from './check-deployed-functions.mjs';

const expected = sourceExports();
assert.ok(expected.has('submitCase'), 'current callable exports must be discovered');
assert.ok(
  [...expected].every(name => !name.startsWith('_')),
  'underscore-prefixed internal test helpers must not be treated as deployed functions'
);

const deployedRecords = [...expected].map(id => ({ id }));
deployedRecords.push({ id: 'legacyFunctionThatStillExists' });

const withLegacy = validateDeployedFunctions(deployedRecords, expected);
assert.deepEqual(withLegacy.missing, []);
assert.deepEqual(withLegacy.unexpected, ['legacyFunctionThatStillExists']);

const withoutSubmitCase = validateDeployedFunctions(
  deployedRecords.filter(record => record.id !== 'submitCase'),
  expected
);
assert.ok(withoutSubmitCase.missing.includes('submitCase'));

console.log('Deployed Functions regression passed: direct Firebase exports are discovered, unexpected legacy functions are detected for strict deploy blocking, and current missing functions are detected.');
