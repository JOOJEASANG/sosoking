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
  'function isPublicResultListData(data)',
  'data.publicDataVersion == 1',
  "!data.keys().hasAny(['userId', 'caseDescription', 'nickname'])",
  'allow get: if isSafePublicResultData(resource.data)',
  'allow list: if isAdmin() || isPublicResultListData(resource.data)'
]) {
  if (!rules.includes(required)) errors.push(`firestore.rules: missing ${required}`);
}
if (rules.includes('allow list: if signedIn() && isPublicResultListData(resource.data)')) {
  errors.push('firestore.rules: public result lists must not depend on anonymous sign-in timing');
}

const sanitizer = read('functions/public-result-sanitizer.js');
for (const required of ["SENSITIVE_FIELDS = ['userId', 'caseDescription', 'nickname']", 'patch.publicDataVersion = 1', 'publicSanitizationPatch']) {
  if (!sanitizer.includes(required)) errors.push(`functions/public-result-sanitizer.js: missing ${required}`);
}
if (sanitizer.includes('onDocumentWritten') || sanitizer.includes('exports.sanitizePublicResult')) {
  errors.push('functions/public-result-sanitizer.js: Eventarc trigger must remain disabled until deploy IAM is configured');
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
if (!main.includes("require('./public-seo-safe')")) {
  errors.push('functions/main.js: sanitized public SEO functions are not exported');
}
if (main.includes("require('./public-result-sanitizer')")) {
  errors.push('functions/main.js: deploy-time sanitizer utility must not be exported as a Cloud Function');
}
if (main.includes("Object.assign(exports, require('./public-seo'))")) {
  errors.push('functions/main.js: unsafe direct public SEO handlers remain exported');
}

const publicLoader = read('public/js/utils/public-results.js');
for (const required of [
  "where('isPublic', '==', true)",
  "where('publicDataVersion', '==', 1)",
  "orderBy('createdAt', 'desc')",
  "code.includes('failed-precondition')"
]) {
  if (!publicLoader.includes(required)) errors.push(`public/js/utils/public-results.js: missing ${required}`);
}

for (const file of ['public/js/pages/home.js', 'public/js/pages/jury.js', 'public/js/pages/hall.js']) {
  const source = read(file);
  if (!source.includes('loadSafePublicResults')) {
    errors.push(`${file}: canonical public screen does not use the safe public result loader`);
  }
  if (/\b(?:record|data|r)\.caseDescription\b/.test(source)) {
    errors.push(`${file}: canonical public screen still references raw caseDescription`);
  }
}

const social = read('functions/social.js');
for (const required of ['APPEAL_REQUEST_TIMEOUT_MS', 'AbortController', 'callAppealGemini', 'publicDataVersion: 1', 'caseDescription: FieldValue.delete()', 'nickname: FieldValue.delete()']) {
  if (!social.includes(required)) errors.push(`functions/social.js: missing ${required}`);
}
if (social.includes('GoogleGenerativeAI')) {
  errors.push('functions/social.js: deprecated Gemini SDK is still used for appeals');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
const functionsStep = deploy.indexOf('Deploy current Functions first');
const sanitizeStep = deploy.indexOf('Sanitize existing public results');
const rulesStep = deploy.indexOf('Deploy Firestore configuration and Hosting');
const statisticsStep = deploy.indexOf('Initialize public statistics');
if (deploy.includes('functions:sanitizePublicResult')) {
  errors.push('.github/workflows/firebase-deploy.yml: Eventarc sanitizer trigger must not block production deployment');
}
if (!deploy.includes('node functions/sanitize-public-results-cli.js')) {
  errors.push('.github/workflows/firebase-deploy.yml: existing public records are not sanitized');
}
if (functionsStep < 0 || sanitizeStep <= functionsStep || rulesStep <= sanitizeStep || statisticsStep <= rulesStep) {
  errors.push('.github/workflows/firebase-deploy.yml: required order is Functions, sanitation, Firestore/Hosting, then index-dependent statistics');
}

if (fs.existsSync('.github/workflows/validate.yml')) {
  errors.push('.github/workflows/validate.yml: duplicate pull request validation workflow remains');
}

if (errors.length) {
  console.error(`Security hardening validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Security hardening validation passed: App Check, direct-query-compatible public records, deploy sanitation, safe SEO, CSP, appeal timeout, and CI deduplication are intact.');
