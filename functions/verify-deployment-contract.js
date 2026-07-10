const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

const coreWorkflow = read('../.github/workflows/firebase-deploy.yml');
const storageWorkflow = read('../.github/workflows/firebase-storage-rules.yml');
const firebaseConfig = JSON.parse(read('../firebase.json'));
const storageRules = read('../storage.rules');
const policy = read('../public/js/pages/policy.js');
const sync = read('./sync-judgment-structure.js');
const readme = read('../README.md');

const functionDeployIndex = coreWorkflow.indexOf('Deploy all exported Functions');
const firestoreDeployIndex = coreWorkflow.indexOf('Deploy Firestore rules and indexes');
const hostingDeployIndex = coreWorkflow.indexOf('Deploy Hosting');

const checks = [
  [functionDeployIndex >= 0, 'Core workflow must deploy all exported Functions'],
  [firestoreDeployIndex > functionDeployIndex, 'Firestore rules must deploy after Callable Functions'],
  [hostingDeployIndex > firestoreDeployIndex, 'Hosting must deploy after Firestore'],
  [!coreWorkflow.includes('firebase deploy --only storage'), 'Core workflow must not deploy Storage Rules'],
  [!coreWorkflow.includes('continue-on-error'), 'Core deployment must not hide failed steps'],
  [coreWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Core workflow service-account secret is missing'],

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

  [sync.includes('FieldPath.documentId()'), 'Judgment backfill must use a stable pagination cursor'],
  [sync.includes('lastDocumentId'), 'Judgment backfill cursor state is missing'],
  [sync.includes('closingComment: parsed.closingComment || FieldValue.delete()'), 'Stale closing comments must be deleted'],
  [sync.includes("STRUCTURE_VERSION = 'judgment-script-v2'"), 'Structure version must force existing results to resync'],

  [readme.includes('docs/DEPLOYMENT.md'), 'README must link to the deployment runbook'],
  [!readme.includes('1~10점'), 'README must not describe the removed 1-10 score system'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Deployment contract failed: ${message}`));
  process.exit(1);
}

console.log('Verified Firebase deployment, Storage separation, public settings and judgment synchronization contracts.');
