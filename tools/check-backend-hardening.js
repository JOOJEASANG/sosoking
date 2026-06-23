'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

const mainFunctions = require(path.join(ROOT, 'functions', 'functions-main-v2.js'));
const playgroundFunctions = require(path.join(ROOT, 'functions', 'king-playground-functions.js'));
const secureConfigFunctions = require(path.join(ROOT, 'functions', 'secure-ai-config-functions.js'));
const materialFunctions = require(path.join(ROOT, 'functions', 'soso-material-functions.js'));
const debateFunctions = require(path.join(ROOT, 'functions', 'soso-debate-functions.js'));
const runtimeSource = read('functions', 'ai-runtime-provider.js');
const playgroundSource = read('functions', 'king-playground-functions.js');
const materialSource = read('functions', 'soso-material-functions.js');
const debateSource = read('functions', 'soso-debate-functions.js');
const indexesSource = read('firestore.indexes.json');
const packageSource = read('package.json');

if (mainFunctions.aiJudge !== playgroundFunctions.aiJudge) errors.push('managed playground judge is not deployed');
if (mainFunctions.saveAiKingConfig !== secureConfigFunctions.saveAiKingConfig) errors.push('managed AI config is not deployed');
if (mainFunctions.generateDailyMaterial !== materialFunctions.generateDailyMaterial) errors.push('daily AI material scheduler is not deployed');
if (mainFunctions.generateDailyDebate !== debateFunctions.generateDailyDebate) errors.push('daily AI debate scheduler is not deployed');
if (mainFunctions.getDebates !== debateFunctions.getDebates) errors.push('independent debate service is not deployed');

if (!runtimeSource.includes('process.env.GEMINI_API_KEY') || !runtimeSource.includes('process.env.ANTHROPIC_API_KEY')) {
  errors.push('AI runtime is not connected to managed environment credentials');
}
if (runtimeSource.includes('config.geminiApiKey') || runtimeSource.includes('config.claudeApiKey')) {
  errors.push('AI runtime reads credentials from Firestore configuration');
}

const playgroundBindings = (playgroundSource.match(/secrets:\s*AI_RUNTIME_SECRETS/g) || []).length;
if (playgroundBindings < 4) errors.push(`only ${playgroundBindings} playground AI functions declare managed credentials`);
if ((materialSource.match(/secrets:\s*AI_RUNTIME_SECRETS/g) || []).length < 2) errors.push('material scheduler/admin generation does not declare managed credentials');
if ((debateSource.match(/secrets:\s*AI_RUNTIME_SECRETS/g) || []).length < 2) errors.push('debate scheduler/admin generation does not declare managed credentials');
if (!playgroundSource.includes('privateResult: true')) errors.push('AI judge does not mark its result as private');

for (const legacy of ['const TOPICS', 'fallbackMaterials', 'voteMaterial', 'addMaterialComment', 'getMaterialComments']) {
  if (materialSource.includes(legacy)) errors.push(`legacy material debate behavior remains: ${legacy}`);
}
for (const required of ['generateDailyMaterial', 'triggerDailyMaterial', 'adminCreateMaterial', 'dailyMaterialId']) {
  if (!materialSource.includes(required)) errors.push(`material service missing: ${required}`);
}
for (const required of ['generateDailyDebate', 'triggerDailyDebate', 'adminCreateDebate', 'voteDebate', 'addDebateComment', 'COMMENT_DAILY_LIMIT']) {
  if (!debateSource.includes(required)) errors.push(`debate service missing: ${required}`);
}

if (!indexesSource.includes('"collectionGroup": "materials"') || !indexesSource.includes('"collectionGroup": "debates"')) {
  errors.push('separate material/debate indexes are missing');
}
if (!indexesSource.includes('"fieldPath": "commentCount"')) errors.push('debate comment ordering index is missing');
if (!packageSource.includes('"test:backend"')) errors.push('backend policy tests are not part of repository scripts');

if (errors.length) {
  console.error('Backend hardening check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Backend hardening check passed.');
