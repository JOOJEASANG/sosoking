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
  errors.push('firestore.rules: internal results still expose a public read path');
}

const publicRules = rules.match(/match \/public_results\/\{caseId\}[\s\S]*?(?=\n    match \/result_reactions\/)/)?.[0] || '';
for (const required of [
  'allow get: if isSafePublicResultData(resource.data);',
  'allow list: if isAdmin();',
  'allow create, update, delete: if false;'
]) {
  if (!publicRules.includes(required)) errors.push(`firestore.rules public_results: missing ${required}`);
}

const main = read('functions/main.js');
if (!main.includes("require('./public-result-mirror')")) {
  errors.push('functions/main.js: public result mirror trigger is not exported');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
for (const required of [
  'functions:getPublicResult',
  'functions:syncPublicResultMirror',
  'node functions/sync-public-results-cli.js'
]) {
  if (!deploy.includes(required)) errors.push(`firebase-deploy.yml: missing ${required}`);
}

if (errors.length) {
  console.error(`Public detail boundary validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Public detail boundary validation passed: internal results stay owner/admin-only and public pages use isolated projections.');
