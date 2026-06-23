'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

const mainFunctions = require(path.join(ROOT, 'functions', 'functions-main-v2.js'));
const playgroundFunctions = require(path.join(ROOT, 'functions', 'king-playground-functions.js'));
const secureConfigFunctions = require(path.join(ROOT, 'functions', 'secure-ai-config-functions.js'));
const runtimeSource = read('functions', 'ai-runtime-provider.js');
const playgroundSource = read('functions', 'king-playground-functions.js');
const materialSource = read('functions', 'soso-material-functions.js');
const indexesSource = read('firestore.indexes.json');
const packageSource = read('package.json');

if (mainFunctions.aiJudge !== playgroundFunctions.aiJudge) {
  errors.push('managed playground judge is not the deployed aiJudge export');
}
if (mainFunctions.saveAiKingConfig !== secureConfigFunctions.saveAiKingConfig) {
  errors.push('managed AI config function is not the deployed saveAiKingConfig export');
}
if (!runtimeSource.includes('process.env.GEMINI_API_KEY') || !runtimeSource.includes('process.env.ANTHROPIC_API_KEY')) {
  errors.push('AI runtime is not connected to managed environment credentials');
}
if (runtimeSource.includes('config.geminiApiKey') || runtimeSource.includes('config.claudeApiKey')) {
  errors.push('AI runtime reads credentials from Firestore configuration');
}
const secretBindings = (playgroundSource.match(/secrets:\s*AI_RUNTIME_SECRETS/g) || []).length;
if (secretBindings < 4) errors.push(`only ${secretBindings} AI functions declare managed credentials`);
if (!playgroundSource.includes('privateResult: true')) {
  errors.push('AI judge does not mark its result as private');
}
if (!materialSource.includes('COMMENT_DAILY_LIMIT') || !materialSource.includes('isValidMaterialId')) {
  errors.push('material comment or id protection is missing');
}
if (materialSource.includes('ensureDaily(date, { write: true })')) {
  errors.push('public material read can still create daily records');
}
if (!indexesSource.includes('"collectionGroup": "materials"') || !indexesSource.includes('"fieldPath": "commentCount"')) {
  errors.push('ordered material indexes are missing');
}
if (!packageSource.includes('"test:backend"')) {
  errors.push('backend policy tests are not part of the repository scripts');
}

if (errors.length) {
  console.error('Backend hardening check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Backend hardening check passed.');
