import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'functions/dripso-moderation.js',
  'public/dripso/moderation.js',
  'public/dripso/battle-pagination.js',
  'public/admin/dripso-moderation.js'
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) errors.push(`${file}: file is missing`);
}

if (!errors.length) {
  const server = read('functions/dripso-moderation.js');
  const main = read('functions/main.js');
  const adminActions = read('functions/admin-actions.js');
  const adminUtils = read('functions/admin-utils.js');
  const rules = read('firestore.rules');
  const indexes = read('firestore.indexes.json');
  const publicUi = read('public/dripso/moderation.js');
  const pagination = read('public/dripso/battle-pagination.js');
  const publicHtml = read('public/dripso/index.html');
  const adminUi = read('public/admin/dripso-moderation.js');
  const adminHtml = read('public/admin/index.html');
  const deploy = read('.github/workflows/firebase-deploy.yml');
  const hostingOnly = read('.github/workflows/hosting-only-deploy.yml');

  for (const required of [
    'exports.getDripsoOwnership',
    'exports.deleteOwnDripsoTopic',
    'exports.deleteOwnDripsoComment',
    'exports.submitDripsoReport',
    'exports.moderateDripsoReport',
    "status: 'deleting'",
    "status: 'hidden'",
    "collection('dripso_reports')",
    "collection('dripso_report_keys')",
    "require('firebase-admin/storage')",
    'deleteDripsoTopicData',
    'deleteDripsoCommentData'
  ]) {
    if (!server.includes(required)) errors.push(`functions/dripso-moderation.js: missing ${required}`);
  }

  if (!main.includes("require('./dripso-moderation')")) {
    errors.push('functions/main.js: Dripso moderation module is not loaded');
  }
  if (!adminActions.includes("status: 'deleting'") || !adminActions.includes("isPublic: false")) {
    errors.push('functions/admin-actions.js: deletion lock is missing');
  }
  if (!adminActions.includes('requireVerifiedUser(request)')) {
    errors.push('functions/admin-actions.js: verified administrator login is missing');
  }
  if (!adminUtils.includes('email_verified !== true')) {
    errors.push('functions/admin-utils.js: verified email administrator check is missing');
  }

  for (const required of [
    'match /dripso_reports/{reportId}',
    'match /dripso_report_keys/{keyId}',
    'request.auth.token.email_verified == true'
  ]) {
    if (!rules.includes(required)) errors.push(`firestore.rules: missing ${required}`);
  }
  for (const required of ['"collectionGroup": "dripso_topics"', '"collectionGroup": "dripso_reports"', '"fieldPath": "createdAt"']) {
    if (!indexes.includes(required)) errors.push(`firestore.indexes.json: missing ${required}`);
  }

  for (const required of [
    "httpsCallable(functions, 'getDripsoOwnership')",
    "httpsCallable(functions, 'deleteOwnDripsoTopic')",
    "httpsCallable(functions, 'deleteOwnDripsoComment')",
    "httpsCallable(functions, 'submitDripsoReport')",
    'data-dripso-action'
  ]) {
    if (!publicUi.includes(required)) errors.push(`public/dripso/moderation.js: missing ${required}`);
  }
  for (const required of [
    'startAfter',
    "orderBy('createdAt', 'desc')",
    "orderBy('likeCount', 'desc')",
    'data-pagination-complete',
    'const MODE_MARKER =',
    "route.name === 'mode'",
    "route.name === 'hall'"
  ]) {
    if (!pagination.includes(required)) errors.push(`public/dripso/battle-pagination.js: missing ${required}`);
  }
  for (const required of [
    '/dripso/battle-pagination.js?v=20260803-seven-battles-1',
    '/dripso/moderation.js?v=20260801-audit-fixes-1'
  ]) {
    if (!publicHtml.includes(required)) errors.push(`public/dripso/index.html: missing ${required}`);
  }

  if (!adminUi.includes("httpsCallable(functions, 'moderateDripsoReport')")
    || !adminUi.includes("collection(db, 'dripso_reports')")) {
    errors.push('public/admin/dripso-moderation.js: report queue integration is missing');
  }
  if (!adminHtml.includes('/admin/dripso-moderation.js?v=20260801-audit-fixes-1')) {
    errors.push('public/admin/index.html: Dripso moderation UI is not loaded');
  }

  for (const functionName of [
    'functions:getDripsoOwnership',
    'functions:deleteOwnDripsoTopic',
    'functions:deleteOwnDripsoComment',
    'functions:submitDripsoReport',
    'functions:moderateDripsoReport'
  ]) {
    if (!deploy.includes(functionName)) errors.push(`firebase-deploy.yml: missing ${functionName}`);
  }
  if (!deploy.includes('group: firebase-deploy-live')) {
    errors.push('firebase-deploy.yml: shared live deployment concurrency group is missing');
  }
  if (/\npush:\s*\n\s*branches:\s*\[main\]/.test(hostingOnly)) {
    errors.push('hosting-only-deploy.yml: automatic main push trigger must be removed');
  }
  if (!hostingOnly.includes('group: firebase-deploy-live')) {
    errors.push('hosting-only-deploy.yml: shared live deployment concurrency group is missing');
  }
}

if (errors.length) {
  console.error(`Dripso moderation validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Dripso moderation validation passed: ownership deletion, reporting, administrator actions, seven-mode pagination, verified admin email, and serialized deployment are connected.');
