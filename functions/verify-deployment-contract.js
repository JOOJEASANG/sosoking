const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

const coreWorkflow = read('../.github/workflows/firebase-deploy.yml');
const storageWorkflow = read('../.github/workflows/firebase-storage-rules.yml');
const firebaseConfig = JSON.parse(read('../firebase.json'));
const storageRules = read('../storage.rules');
const main = read('./main.js');
const app = read('../public/js/app.js');
const resultPage = read('../public/js/pages/result.js');
const policy = read('../public/js/pages/policy.js');
const readme = read('../README.md');

const functionDeployIndex = coreWorkflow.indexOf('Deploy Functions from current source');
const firestoreDeployIndex = coreWorkflow.indexOf('Deploy Firestore rules and indexes');
const hostingDeployIndex = coreWorkflow.indexOf('Deploy Hosting');
const retiredFunctions = [
  'syncJudgmentStructure',
  'backfillJudgmentStructures',
  'backfillJudgmentStructuresNow',
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
  [!main.includes("require('./sync-judgment-structure')"), 'Functions entry point still exports legacy judgment synchronization'],

  [app.includes("from './pages/result.js?v=20260710-v2result1'"), 'App must load the V2-compatible result renderer directly'],
  [!app.includes('result-summary.js') && !app.includes('result-court.js'), 'App must not restore removed result wrappers'],
  [resultPage.includes('r.judgment') && resultPage.includes('r.judgmentScript'), 'Result page must support both V2 and existing judgment records'],
  [resultPage.includes("mode: 'script'"), 'Existing judgmentScript must be rendered directly without client reconstruction'],

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
  [!readme.includes('1~10점'), 'README must not describe the removed 1-10 score system'],
  [retiredFunctions.every(name => !readme.includes(name)), 'README still describes retired judgment maintenance Functions'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Deployment contract failed: ${message}`));
  process.exit(1);
}

console.log('Verified source-based deployment, retired judgment cleanup, V2 result compatibility and Firebase separation.');
