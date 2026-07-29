import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const security = read('functions/security.js');
if (!security.includes('function requireAccountUser(request)')
  || !security.includes("provider === 'anonymous'")
  || !security.includes('enforceAppCheck.value() && !request.app')
  || !security.includes('requireAccountUser,')) {
  errors.push('functions/security.js: authenticated non-anonymous App Check helper is incomplete');
}

const server = read('functions/admin-actions.js');
for (const required of [
  'exports.deleteOwnCourtPost',
  'requireAccountUser(request)',
  'async function deleteCourtPostData',
  'caseData.userId !== ownerUid',
  "throw new HttpsError('permission-denied'",
  'result_reactions',
  'court_comments',
  'court_comment_authors',
  'court_comment_stats',
  'reports',
  'report_keys',
  'case_id_aliases'
]) {
  if (!server.includes(required)) {
    errors.push(`functions/admin-actions.js: own case deletion safeguard is missing: ${required}`);
  }
}
if (!server.includes("Object.defineProperties(module.exports") || !server.includes('deleteCourtPostData:')) {
  errors.push('functions/admin-actions.js: emulator-testable deletion core is missing');
}

const page = read('public/js/pages/my-cases.js');
if (!page.includes("httpsCallable(functions, 'deleteOwnCourtPost')")) {
  errors.push('public/js/pages/my-cases.js: secure deletion callable is not used');
}
for (const required of [
  'data-delete-case=',
  '영구 삭제할까요?',
  '복구할 수 없습니다.',
  "CustomEvent('sosoking:case-deleted'",
  'data-case-row=',
  '<a href='
]) {
  if (!page.includes(required)) errors.push(`public/js/pages/my-cases.js: deletion UI is missing: ${required}`);
}
if (page.includes('deleteDoc(') || page.includes('onclick=')) {
  errors.push('public/js/pages/my-cases.js: direct Firestore deletion or inline click handler remains');
}

const gamePage = read('public/js/pages/my-cases-game.js');
if (!gamePage.includes("./my-cases.js?v=20260729-own-case-delete-1")
  || !gamePage.includes("'sosoking:case-deleted'")) {
  errors.push('public/js/pages/my-cases-game.js: profile refresh or cache version is missing');
}

const app = read('public/js/app.js');
if (!app.includes("./pages/my-cases-game.js?v=20260729-own-case-delete-1")) {
  errors.push('public/js/app.js: my cases cache version is stale');
}

const index = read('public/index.html');
if (!index.includes('/js/app.js?v=20260729-brand-unified-1')) {
  errors.push('public/index.html: application cache version is stale');
}

const serviceWorker = read('public/sw.js');
if (!serviceWorker.includes("sosoking-app-v20260729-brand-unified-1")
  || !serviceWorker.includes('/js/app.js?v=20260729-brand-unified-1')) {
  errors.push('public/sw.js: own case deletion cache graph is stale');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
if (!deploy.includes('functions:deleteOwnCourtPost')) {
  errors.push('.github/workflows/firebase-deploy.yml: deleteOwnCourtPost is not deployed');
}

const packageJson = read('package.json');
if (!packageJson.includes('node tools/check-own-case-deletion.mjs')) {
  errors.push('package.json: own case deletion static validation is not in the check chain');
}
if (!packageJson.includes('node functions/check-own-case-deletion.js')) {
  errors.push('package.json: own case deletion emulator test is not in the test chain');
}

if (errors.length) {
  console.error(`Own case deletion validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Own case deletion validation passed: authenticated ownership, cascade cleanup, UI controls, cache versions, and deployment.');
