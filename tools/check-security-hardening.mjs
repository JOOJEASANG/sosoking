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
  'isSafePublicResultData(resource.data)'
]) {
  if (!rules.includes(required)) errors.push(`firestore.rules: missing ${required}`);
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

const board = read('public/js/pages/board.js');
if (!board.includes("where('publicDataVersion', '==', 1)")) {
  errors.push('public/js/pages/board.js: board query does not exclude pending public sanitation');
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

const deploy = read('.github/workflows/firebase-deploy.yml');
const sanitizeStep = deploy.indexOf('Sanitize existing public results');
const rulesStep = deploy.indexOf('Deploy Firestore configuration and Hosting');
if (deploy.includes('functions:sanitizePublicResult')) {
  errors.push('.github/workflows/firebase-deploy.yml: Eventarc sanitizer trigger must not block production deployment');
}
if (!deploy.includes('node functions/sanitize-public-results-cli.js')) {
  errors.push('.github/workflows/firebase-deploy.yml: existing public records are not sanitized');
}
if (sanitizeStep < 0 || rulesStep < 0 || sanitizeStep > rulesStep) {
  errors.push('.github/workflows/firebase-deploy.yml: existing records must be sanitized before restrictive rules deploy');
}

if (fs.existsSync('.github/workflows/validate.yml')) {
  errors.push('.github/workflows/validate.yml: duplicate pull request validation workflow remains');
}

if (errors.length) {
  console.error(`Security hardening validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Security hardening validation passed: App Check, deploy-safe public data sanitation, safe SEO, CSP, appeal timeout, and CI deduplication are intact.');
