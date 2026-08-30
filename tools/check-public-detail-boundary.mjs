import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const resultPage = read('public/js/pages/result.js');
for (const required of [
  "httpsCallable(functions, 'getPublicResult')",
  'async function loadResultRecord(caseId)',
  'if (isOwner) {',
  "getDoc(doc(db, 'results', caseId))",
  'const displayNickname = isOwner',
  'r.publicNickname'
]) {
  if (!resultPage.includes(required)) errors.push(`public/js/pages/result.js: missing ${required}`);
}
if (resultPage.includes("[resultSnap, social] = await Promise.all([\n      getDoc(doc(db, 'results', caseId))")) {
  errors.push('public/js/pages/result.js: public route can still fetch internal results before ownership is established');
}

const discussionPage = read('public/js/pages/discussion.js');
if (!discussionPage.includes("httpsCallable(functions, 'getPublicResult')")) {
  errors.push('public/js/pages/discussion.js: projected public result callable is missing');
}
if (discussionPage.includes("doc(db, 'results', caseId)")) {
  errors.push('public/js/pages/discussion.js: internal results document is still read directly');
}

const rules = read('firestore.rules');
const resultRules = rules.match(/match \/results\/\{caseId\}[\s\S]*?(?=\n    match \/public_results\/)/)?.[0] || '';
if (!resultRules.includes('allow get: if isCaseOwner(caseId) || isAdmin();')) {
  errors.push('firestore.rules: internal results get must be owner/admin-only');
}
if (resultRules.includes('isSafePublicResultData(resource.data)')) {
  errors.push('firestore.rules: internal results still expose a public direct-read path');
}
if (!rules.includes('function isResultPublic(caseId)')) {
  errors.push('firestore.rules: public court participation must re-check authoritative internal publication state');
}

const publicRules = rules.match(/match \/public_results\/\{caseId\}[\s\S]*?(?=\n    match \/result_reactions\/)/)?.[0] || '';
for (const required of [
  'allow get, list: if isAdmin();',
  'allow create, update, delete: if false;'
]) {
  if (!publicRules.includes(required)) errors.push(`firestore.rules public_results: missing ${required}`);
}

const main = read('functions/main.js');
if (main.includes("require('./public-result-mirror')")) {
  errors.push('functions/main.js: Eventarc public mirror trigger must stay removed');
}

const publicList = read('functions/public-results-list.js');
for (const required of [
  "const internalSnapshot = await db.doc(`results/${caseId}`).get()",
  'isSanitizedPublicResult(internalSnapshot.data() || {})',
  'persistPublicCopy(caseId, raw)',
  'publicClientProjection(stored)'
]) {
  if (!publicList.includes(required)) errors.push(`functions/public-results-list.js: missing ${required}`);
}
if (publicList.includes("const publicSnapshot = await db.doc(`public_results/${caseId}`).get()")) {
  errors.push('functions/public-results-list.js: stale public mirror can be trusted before internal publication state');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
for (const required of [
  'functions:getPublicResult',
  'node functions/sync-public-results-cli.js'
]) {
  if (!deploy.includes(required)) errors.push(`firebase-deploy.yml: missing ${required}`);
}
if (deploy.includes('functions:syncPublicResultMirror')) {
  errors.push('firebase-deploy.yml: Eventarc public mirror trigger must stay removed');
}

if (fs.existsSync('functions/public-result-mirror.js')) {
  errors.push('functions/public-result-mirror.js: Eventarc trigger file must stay removed');
}

if (errors.length) {
  console.error(`Public detail boundary validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Public detail boundary validation passed: internal results stay owner/admin-only, public pages use projections, and server calls re-check authoritative publication state.');
