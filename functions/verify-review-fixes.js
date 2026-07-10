const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

const workflow = read('../.github/workflows/firebase-deploy.yml');
const policy = read('../public/js/pages/policy.js');
const sync = read('./sync-judgment-structure.js');

const functionDeployIndex = workflow.indexOf('Deploy all exported Functions first');
const coreDeployCommand = 'firebase deploy --only firestore:rules,firestore:indexes,hosting';
const storageDeployCommand = 'firebase deploy --only storage';
const coreDeployIndex = workflow.indexOf(coreDeployCommand);
const storageDeployIndex = workflow.indexOf(storageDeployCommand);

const checks = [
  [functionDeployIndex >= 0, 'Functions deployment step is missing'],
  [coreDeployIndex >= 0, 'Firestore and Hosting deployment step is missing'],
  [functionDeployIndex < coreDeployIndex, 'Callable Functions must deploy before restrictive rules'],
  [storageDeployIndex > coreDeployIndex, 'Storage Rules must deploy separately after core Firebase targets'],
  [workflow.includes('id: deploy_storage'), 'Storage deployment must have a result identifier'],
  [workflow.includes('continue-on-error: true'), 'Storage IAM failure must not block core deployment'],
  [workflow.includes("if: steps.deploy_storage.outcome == 'failure'"), 'Storage deployment failure must emit a warning'],
  [!workflow.includes('firestore:rules,firestore:indexes,storage,hosting'), 'Storage must not be bundled with core Firebase deployment'],
  [policy.includes("doc(db, 'public_settings', 'config')"), 'Public policy pages must read public_settings'],
  [!policy.includes("doc(db, 'site_settings', 'config')"), 'Public policy pages must not read private site_settings'],
  [policy.includes("getDoc(doc(db, 'policy_docs', safeType)).catch(() => null)"), 'Policy content failure must be isolated'],
  [policy.includes("getDoc(doc(db, 'public_settings', 'config')).catch(() => null)"), 'Public settings failure must be isolated'],
  [sync.includes('FieldPath.documentId()'), 'Judgment backfill must use a stable pagination cursor'],
  [sync.includes('lastDocumentId'), 'Judgment backfill cursor state is missing'],
  [sync.includes('closingComment: parsed.closingComment || FieldValue.delete()'), 'Stale closing comments must be deleted'],
  [sync.includes("STRUCTURE_VERSION = 'judgment-script-v2'"), 'Structure version must force existing results to resync'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Review regression failed: ${message}`));
  process.exit(1);
}

console.log('Verified fixes for automated review findings.');
