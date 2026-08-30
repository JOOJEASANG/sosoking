import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const adminIndex = read('public/admin/index.html');
const adminAppCheckPath = '/admin/admin-app-check.js?v=20260730-security-hardening-1';
const adminBootstrapPath = '/admin/admin-bootstrap.js?v=20260729-report-moderation-1&ui=20260729-admin-brand-actions-1';
const appCheckIndex = adminIndex.indexOf(adminAppCheckPath);
const bootstrapIndex = adminIndex.indexOf(adminBootstrapPath);
if (appCheckIndex < 0) errors.push('public/admin/index.html: administrator App Check bootstrap is missing');
if (bootstrapIndex < 0) errors.push('public/admin/index.html: administrator authentication bootstrap is missing');
if (appCheckIndex >= 0 && bootstrapIndex >= 0 && appCheckIndex > bootstrapIndex) {
  errors.push('public/admin/index.html: App Check must initialize before administrator authentication');
}

const adminAppCheck = read('public/admin/admin-app-check.js');
for (const required of ['initializeAppCheck', 'ReCaptchaV3Provider', 'firebaseConfig.appCheckSiteKey', 'isTokenAutoRefreshEnabled: true']) {
  if (!adminAppCheck.includes(required)) errors.push(`public/admin/admin-app-check.js: missing ${required}`);
}

const security = read('functions/security.js');
for (const required of ['function requireAppCheck(request)', 'enforceAppCheck.value()', '!request.app', 'requireAppCheck(request);', 'requireAppCheck,']) {
  if (!security.includes(required)) errors.push(`functions/security.js: missing ${required}`);
}

for (const file of ['functions/admin-actions.js', 'functions/reports.js', 'functions/case-aliases.js']) {
  const source = read(file);
  if (!source.includes('requireAppCheck')) errors.push(`${file}: direct administrator callable lacks App Check enforcement`);
}

const firebase = JSON.parse(read('firebase.json'));
const allHeaders = firebase.hosting?.headers || [];
const globalHeaders = allHeaders.find(item => item.source === '**')?.headers || [];
if (!globalHeaders.some(header => header.key === 'X-Frame-Options' && header.value === 'DENY')) {
  errors.push('firebase.json: X-Frame-Options DENY is missing');
}
const cspHeaders = allHeaders.flatMap(item => item.headers || []).filter(header => header.key === 'Content-Security-Policy');
if (!cspHeaders.length || cspHeaders.some(header => !header.value.includes("frame-ancestors 'none'"))) {
  errors.push("firebase.json: enforced CSP frame-ancestors 'none' is missing from one or more HTML routes");
}

const rules = read('firestore.rules');
for (const required of [
  'function isSafePublicResultData(data)',
  'data.publicDataVersion == 1',
  "!data.keys().hasAny(['userId', 'caseDescription', 'nickname'])",
  'allow get: if isSafePublicResultData(resource.data)',
  'allow list: if isAdmin();'
]) {
  if (!rules.includes(required)) errors.push(`firestore.rules: missing ${required}`);
}
if (rules.includes('isPublicResultListData')) {
  errors.push('firestore.rules: legacy browser-list helper remains after server projection hardening');
}

const sanitizer = read('functions/public-result-sanitizer.js');
for (const required of [
  "SENSITIVE_FIELDS = ['userId', 'caseDescription', 'nickname']",
  'inspectContent(publicCaseDescription)',
  'patch.publicDataVersion = 1',
  'publicSanitizationPatch'
]) {
  if (!sanitizer.includes(required)) errors.push(`functions/public-result-sanitizer.js: missing ${required}`);
}
if (sanitizer.includes('onDocumentWritten') || sanitizer.includes('exports.sanitizePublicResult')) {
  errors.push('functions/public-result-sanitizer.js: Eventarc sanitizer trigger must remain disabled until deploy IAM is configured');
}

const publicOriginal = read('functions/public-original.js');
for (const required of [
  'const REDACTED_PUBLIC_ORIGINAL',
  'if (isOwner)',
  'resultData.publicCaseDescription',
  'if (!requesterUid)',
  'originalVisible: isOwner'
]) {
  if (!publicOriginal.includes(required)) errors.push(`functions/public-original.js: missing privacy boundary ${required}`);
}
if (publicOriginal.includes('const caseDescription = cleanText(caseData.caseDescription, 600);')) {
  errors.push('functions/public-original.js: public path can still directly return the private caseDescription');
}

const discussion = read('functions/discussion.js');
for (const required of [
  'function assertDiscussionWritable',
  'await db.runTransaction(async tx =>',
  'const latestResultSnap = await tx.get(resultRef)',
  'assertDiscussionWritable(latestResultSnap.data())',
  'tx.update(resultRef'
]) {
  if (!discussion.includes(required)) errors.push(`functions/discussion.js: missing lifecycle-safe write guard ${required}`);
}
if (discussion.includes('batch.set(resultRef')) {
  errors.push('functions/discussion.js: batch.set(resultRef) can recreate a deleted result document');
}

const publicResultData = read('functions/public-result-data.js');
for (const required of [
  'function isSanitizedPublicResult(data = {})',
  "!Object.prototype.hasOwnProperty.call(data, 'caseDescription')",
  'function publicStorageProjection(raw = {})',
  'function publicClientProjection(raw = {})'
]) {
  if (!publicResultData.includes(required)) errors.push(`functions/public-result-data.js: missing ${required}`);
}
for (const forbidden of ['userId:', 'caseDescription:', 'nickname:']) {
  if (publicResultData.includes(forbidden)) errors.push(`functions/public-result-data.js: public projection contains forbidden field ${forbidden}`);
}

const publicListFunction = read('functions/public-results-list.js');
for (const required of [
  'exports.listPublicResults = onCall',
  'exports.getPublicResult = onCall',
  "db.collection('public_results')",
  'publicClientProjection',
  'publicStorageProjection',
  'requireAppCheck(request)',
  "db.doc(`results/${caseId}`).get()"
]) {
  if (!publicListFunction.includes(required)) errors.push(`functions/public-results-list.js: missing ${required}`);
}
if (publicListFunction.includes('return { caseId, result: raw }')) {
  errors.push('functions/public-results-list.js: internal result is returned without projection');
}

const mirror = read('functions/public-result-mirror.js');
for (const required of [
  'onDocumentWritten',
  "document: 'results/{caseId}'",
  'isSanitizedPublicResult(raw)',
  'publicStorageProjection(raw)',
  'publicRef.delete()'
]) {
  if (!mirror.includes(required)) errors.push(`functions/public-result-mirror.js: missing ${required}`);
}

const syncPublicResults = read('functions/sync-public-results-cli.js');
for (const required of [
  "db.collection('results')",
  "db.doc(`public_results/${row.id}`)",
  'publicStorageProjection(row.data)',
  "db.collection('public_results').get()"
]) {
  if (!syncPublicResults.includes(required)) errors.push(`functions/sync-public-results-cli.js: missing ${required}`);
}

const safeSeo = read('functions/public-seo-safe.js');
for (const required of ['isSanitizedPublicResult', 'exports.publicResultPage', 'exports.publicSitemap', "where('publicDataVersion', '==', 1)"]) {
  if (!safeSeo.includes(required)) errors.push(`functions/public-seo-safe.js: missing ${required}`);
}

const publicStats = read('functions/public-stats.js');
for (const required of [
  'async function loadRecentSafePublicResults()',
  'function isMissingIndexError(error)',
  "message.includes('requires an index')",
  "message.includes('index is currently building')",
  '.limit(500)',
  '.sort((left, right) => createdAtMillis(right) - createdAtMillis(left))'
]) {
  if (!publicStats.includes(required)) errors.push(`functions/public-stats.js: missing deploy-safe index fallback ${required}`);
}

const main = read('functions/main.js');
for (const required of ["require('./public-seo-safe')", "require('./public-results-list')", "require('./public-result-mirror')"]) {
  if (!main.includes(required)) errors.push(`functions/main.js: missing ${required}`);
}
if (main.includes("require('./public-result-sanitizer')")) {
  errors.push('functions/main.js: deploy-time sanitizer utility must not be exported as a Cloud Function');
}
if (main.includes("Object.assign(exports, require('./public-seo'))")) {
  errors.push('functions/main.js: unsafe direct public SEO handlers remain exported');
}

const publicLoader = read('public/js/utils/public-results.js');
for (const required of [
  "import { functions } from '../firebase.js",
  "httpsCallable(functions, 'listPublicResults')",
  'response?.data?.rows'
]) {
  if (!publicLoader.includes(required)) errors.push(`public/js/utils/public-results.js: missing ${required}`);
}
if (publicLoader.includes("collection(db, 'results')") || publicLoader.includes("collection(_db, 'results')")) {
  errors.push('public/js/utils/public-results.js: browser still lists the internal results collection');
}

const board = read('public/js/pages/board.js');
if (!board.includes('loadSafePublicResults')) {
  errors.push('public/js/pages/board.js: board does not use the sanitized public result loader');
}
if (board.includes('r.caseDescription')) {
  errors.push('public/js/pages/board.js: board still renders raw caseDescription');
}

const social = read('functions/social.js');
for (const required of ['APPEAL_REQUEST_TIMEOUT_MS', 'AbortController', 'callAppealGemini', 'publicDataVersion: 1', 'caseDescription: FieldValue.delete()', 'nickname: FieldValue.delete()']) {
  if (!social.includes(required)) errors.push(`functions/social.js: missing ${required}`);
}
if (social.includes('GoogleGenerativeAI')) {
  errors.push('functions/social.js: deprecated Gemini SDK is still used for appeals');
}

const appCheckConfigurator = read('tools/configure-app-check.mjs');
for (const required of ['APP_CHECK_SITE_KEY', 'ENFORCE_APP_CHECK', 'firebase-config.js', 'ENFORCE_APP_CHECK=true requires APP_CHECK_SITE_KEY']) {
  if (!appCheckConfigurator.includes(required)) errors.push(`tools/configure-app-check.mjs: missing ${required}`);
}

const deployAuth = read('.github/actions/firebase-auth/action.yml');
for (const required of [
  'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093',
  'workload_identity_provider',
  'service_account_json',
  'credentials_file_path'
]) {
  if (!deployAuth.includes(required)) errors.push(`.github/actions/firebase-auth/action.yml: missing ${required}`);
}

const deploy = read('.github/workflows/firebase-deploy.yml');
const functionsStep = deploy.indexOf('Deploy current Functions first');
const sanitizeStep = deploy.indexOf('Sanitize existing public results');
const mirrorStep = deploy.indexOf('Synchronize isolated public result mirror');
const rulesStep = deploy.indexOf('Deploy Firestore configuration and Hosting');
const statisticsStep = deploy.indexOf('Initialize public statistics');
if (deploy.includes('functions:sanitizePublicResult')) {
  errors.push('.github/workflows/firebase-deploy.yml: Eventarc sanitizer trigger must not block production deployment');
}
if (!deploy.includes('node functions/sanitize-public-results-cli.js')) {
  errors.push('.github/workflows/firebase-deploy.yml: existing public records are not sanitized');
}
for (const required of [
  'functions:listPublicResults',
  'functions:getPublicResult',
  'functions:syncPublicResultMirror',
  'node functions/sync-public-results-cli.js',
  'id-token: write',
  'uses: ./.github/actions/firebase-auth',
  'vars.GCP_WORKLOAD_IDENTITY_PROVIDER',
  'vars.GCP_DEPLOY_SERVICE_ACCOUNT',
  'vars.APP_CHECK_SITE_KEY',
  'node tools/configure-app-check.mjs'
]) {
  if (!deploy.includes(required)) errors.push(`.github/workflows/firebase-deploy.yml: missing ${required}`);
}
if (
  functionsStep < 0 ||
  sanitizeStep <= functionsStep ||
  mirrorStep <= sanitizeStep ||
  rulesStep <= mirrorStep ||
  statisticsStep <= rulesStep
) {
  errors.push('.github/workflows/firebase-deploy.yml: required order is Functions, sanitation, public mirror sync, Firestore/Hosting, then index-dependent statistics');
}

if (fs.existsSync('.github/workflows/validate.yml')) {
  errors.push('.github/workflows/validate.yml: duplicate pull request validation workflow remains');
}

if (errors.length) {
  console.error(`Security hardening validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Security hardening validation passed: App Check, public privacy, lifecycle-safe writes, isolated public result projections, keyless deploy readiness, CSP, safe SEO and deployment ordering are intact.');
