const fs = require('node:fs');
const path = require('node:path');

function resolve(relativePath) {
  return path.resolve(__dirname, relativePath);
}
function read(relativePath) {
  return fs.readFileSync(resolve(relativePath), 'utf8');
}

const coreWorkflow = read('../.github/workflows/firebase-deploy.yml');
const storageWorkflow = read('../.github/workflows/firebase-storage-rules.yml');
const firebaseConfig = JSON.parse(read('../firebase.json'));
const storageRules = read('../storage.rules');
const main = read('./main.js');
const generator = read('./generate-trial-v2.js');
const daily = read('./daily.js');
const social = read('./social.js');
const repair = read('./repair.js');
const app = read('../public/js/app.js');
const homePage = read('../public/js/pages/home.js');
const trialPage = read('../public/js/pages/trial.js');
const resultPage = read('../public/js/pages/result.js');
const boardPage = read('../public/js/pages/board.js');
const policy = read('../public/js/pages/policy.js');
const readme = read('../README.md');

const functionDeployIndex = coreWorkflow.indexOf('Deploy Functions from current source');
const firestoreDeployIndex = coreWorkflow.indexOf('Deploy Firestore rules and indexes');
const hostingDeployIndex = coreWorkflow.indexOf('Deploy Hosting');
const resultWriteStart = generator.indexOf('await resultRef.set({');
const resultWriteEnd = generator.indexOf('\n    });', resultWriteStart);
const resultWrite = resultWriteStart >= 0 && resultWriteEnd > resultWriteStart
  ? generator.slice(resultWriteStart, resultWriteEnd)
  : '';
const retiredFunctions = [
  'syncJudgmentStructure',
  'backfillJudgmentStructures',
  'backfillJudgmentStructuresNow',
];
const removedFiles = [
  './generate-trial-lite.js',
  './judgment-parser.js',
  './sync-judgment-structure.js',
  '../public/js/pages/result-summary.js',
  '../public/js/pages/result-court.js',
];
const duplicatedNarrativeFields = [
  'expandedCase',
  'reception',
  'caseTimeline',
  'forensicReport',
  'investigation',
  'plaintiffArg',
  'defendantArg',
  'courtOpinion',
  'verdict',
  'sentence',
  'closingComment',
  'judgmentScript',
];

const checks = [
  [functionDeployIndex >= 0, 'Core workflow must deploy Functions from current source'],
  [firestoreDeployIndex > functionDeployIndex, 'Firestore rules must deploy after Functions'],
  [hostingDeployIndex > firestoreDeployIndex, 'Hosting must deploy after Firestore'],
  [coreWorkflow.includes('firebase deploy --only functions --force'), 'Functions deployment must remove exports retired from source'],
  [!coreWorkflow.includes('FUNCTION_TARGETS'), 'Functions deployment must not use a duplicated hardcoded target list'],
  [!coreWorkflow.includes('firebase deploy --only storage'), 'Core workflow must not deploy Storage Rules'],
  [!coreWorkflow.includes('continue-on-error'), 'Core deployment must not hide failed steps'],
  [coreWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Core workflow service-account secret is missing'],
  [retiredFunctions.every(name => !coreWorkflow.includes(name)), 'Core workflow still references retired judgment maintenance Functions'],

  [main.includes("require('./generate-trial-v2')"), 'Functions entry point must export the V2 judgment generator'],
  [!main.includes("require('./generate-trial-lite')"), 'Functions entry point must not export the legacy judgment generator'],
  [!main.includes("require('./sync-judgment-structure')"), 'Functions entry point still exports legacy judgment synchronization'],
  [removedFiles.every(file => !fs.existsSync(resolve(file))), 'A removed judgment implementation file was restored'],
  [resultWrite.length > 0, 'V2 result write block could not be inspected'],
  [resultWrite.includes('schemaVersion: JUDGMENT_SCHEMA_VERSION'), 'V2 generator must save a schema version'],
  [resultWrite.includes('judgment,'), 'V2 generator must save the canonical judgment object'],
  [resultWrite.includes("resultVersion: 'judgment-v2'"), 'V2 generator result version is missing'],
  [duplicatedNarrativeFields.every(field => !resultWrite.includes(`\n      ${field}:`)), 'V2 generator must not write duplicated legacy narrative fields'],
  [daily.includes("resultVersion: 'judgment-v2'") && daily.includes('judgment: data.judgment'), 'Daily AI cases must use the V2 judgment schema'],
  [social.includes('resultData.judgment?.orders') && social.includes('resultData.judgment?.opinion'), 'Appeals must read V2 orders and opinion'],
  [repair.includes('isCompleteJudgment(data.judgment)'), 'Stale recovery must recognize completed V2 judgments'],

  [app.includes("from './pages/home-court.js?v=20260710-v2judgment1'"), 'App must load the V2-aware home feed'],
  [app.includes("from './pages/trial-game.js?v=20260710-v2judgment1'"), 'App must load the V2-aware trial flow'],
  [app.includes("from './pages/result.js?v=20260710-v2result1'"), 'App must load the V2-compatible result renderer directly'],
  [app.includes("from './pages/board-court.js?v=20260710-v2judgment1'"), 'App must load the V2-aware board'],
  [!app.includes('result-summary.js') && !app.includes('result-court.js'), 'App must not restore removed result wrappers'],
  [homePage.includes('result.judgment?.summary') && homePage.includes('result.judgment?.headline'), 'Home feed must read V2 judgment summaries and headlines'],
  [homePage.includes('result.judgment?.facts') && homePage.includes('resultSearchText'), 'Home search must include V2 judgment content'],
  [trialPage.includes('Number(data.schemaVersion) === 2') && trialPage.includes('judgment.orders'), 'Trial flow must recognize completed V2 judgments'],
  [trialPage.includes('if (isCompleteResult(data))'), 'Trial flow must redirect after a V2 judgment is complete'],
  [resultPage.includes('r.judgment') && resultPage.includes('r.judgmentScript'), 'Result page must support both V2 and existing judgment records'],
  [resultPage.includes("mode: 'script'"), 'Existing judgmentScript must be rendered directly without client reconstruction'],
  [boardPage.includes('r.judgment?.summary') && boardPage.includes('r.judgment?.headline'), 'Board must read V2 judgment summaries and headlines'],

  [storageWorkflow.includes('workflow_dispatch:'), 'Storage workflow must be manually dispatchable'],
  [!storageWorkflow.includes('\n  push:'), 'Storage workflow must not run automatically until IAM is configured'],
  [storageWorkflow.includes('firebase deploy --only storage'), 'Storage workflow must deploy only Storage Rules'],
  [!storageWorkflow.includes('continue-on-error'), 'Storage deployment failure must remain visible'],
  [storageWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Storage workflow service-account secret is missing'],

  [firebaseConfig.storage?.rules === 'storage.rules', 'firebase.json must point to storage.rules'],
  [storageRules.includes('service firebase.storage'), 'storage.rules is not a Firebase Storage ruleset'],

  [policy.includes("doc(db, 'public_settings', 'config')"), 'Public policy pages must read public_settings'],
  [!policy.includes("doc(db, 'site_settings', 'config')"), 'Public policy pages must not read private site_settings'],
  [policy.includes("getDoc(doc(db, 'policy_docs', safeType)).catch(() => null)"), 'Policy content failure must be isolated'],
  [policy.includes("getDoc(doc(db, 'public_settings', 'config')).catch(() => null)"), 'Public settings failure must be isolated'],

  [readme.includes('docs/DEPLOYMENT.md'), 'README must link to the deployment runbook'],
  [readme.includes('판결 V2 데이터 구조'), 'README must document the canonical judgment schema'],
  [!readme.includes('1~10점'), 'README must not describe the removed 1-10 score system'],
  [retiredFunctions.every(name => !readme.includes(name)), 'README still describes retired judgment maintenance Functions'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Deployment contract failed: ${message}`));
  process.exit(1);
}

console.log('Verified canonical judgment V2 generation, home feed, trial completion, compatibility rendering and Firebase deployment contracts.');
