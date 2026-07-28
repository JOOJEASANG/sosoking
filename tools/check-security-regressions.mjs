import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');

const submit = read('functions/submit-secure.js');
if (!submit.includes("db.collection('cases').doc()")) {
  errors.push('functions/submit-secure.js: opaque Firestore-generated case ID is missing');
}
if (/caseId\s*=\s*`\$\{uid\}_/.test(submit)) {
  errors.push('functions/submit-secure.js: Firebase UID is embedded in the public case ID');
}

const authoritativeAdminFiles = [
  'functions/admin-utils.js',
  'firestore.rules',
  'public/js/components/admin-redirect.js',
  'public/admin/admin-bootstrap.js'
];
for (const file of authoritativeAdminFiles) {
  const source = read(file);
  if (source.includes('BOOTSTRAP_OWNER') || source.includes('sosoday1976@gmail.com')) {
    errors.push(`${file}: hard-coded administrator identity remains`);
  }
}

const security = read('functions/security.js');
if (!security.includes('async function enforceActionRateLimit')) {
  errors.push('functions/security.js: reusable action rate limiter is missing');
}
if (!security.includes("defineBoolean('ENFORCE_APP_CHECK'")) {
  errors.push('functions/security.js: App Check enforcement switch is missing');
}

const profile = read('functions/profile.js');
if ((profile.match(/requireVerifiedUser\(request\)/g) || []).length < 2) {
  errors.push('functions/profile.js: nickname checks and writes must require verified users');
}
if (!profile.includes("enforceActionRateLimit(uid, 'nickname-set'")) {
  errors.push('functions/profile.js: nickname mutation rate limit is missing');
}

const social = read('functions/social.js');
for (const action of ['court-vote', 'court-comment', 'result-visibility']) {
  if (!social.includes(`'${action}'`)) {
    errors.push(`functions/social.js: ${action} server rate limit is missing`);
  }
}
if (!social.includes('court_comment_authors/')) {
  errors.push('functions/social.js: private comment author mapping is missing');
}
if (!social.includes('assertSafeForPublic')) {
  errors.push('functions/social.js: public result content safety gate is missing');
}
if (!social.includes('appeal.contentSafetyStatus')) {
  errors.push('functions/social.js: generated appeal safety status is missing');
}

const daily = read('functions/daily.js');
if (!daily.includes('moderateDailyContent')) {
  errors.push('functions/daily.js: post-generation daily content moderation is missing');
}
if (!daily.includes("promptVersion: 'daily-document-v3-safety'")) {
  errors.push('functions/daily.js: moderated daily prompt version is missing');
}
if (!daily.includes('isPublic: moderation.publish')) {
  errors.push('functions/daily.js: daily publication is not controlled by moderation');
}

const reports = read('functions/reports.js');
if (!reports.includes('exports.submitReport')) {
  errors.push('functions/reports.js: secure report callable is missing');
}
if (!reports.includes("enforceActionRateLimit(uid, 'result-report'")) {
  errors.push('functions/reports.js: report abuse limit is missing');
}
if (!reports.includes('report_keys/')) {
  errors.push('functions/reports.js: duplicate report key is missing');
}

const main = read('functions/main.js');
if (!main.includes("require('./admin-visibility')")) {
  errors.push('functions/main.js: secure admin visibility module is not exported');
}
if (!main.includes("require('./reports')")) {
  errors.push('functions/main.js: secure report module is not exported');
}

const adminVisibility = read('functions/admin-visibility.js');
if (!adminVisibility.includes('userId: FieldValue.delete()')) {
  errors.push('functions/admin-visibility.js: legacy UID cleanup is missing');
}
if (!adminVisibility.includes('isAdminAuth(request.auth)')) {
  errors.push('functions/admin-visibility.js: server-side admin authorization is missing');
}
if (!adminVisibility.includes('inspectContent(publicResultText')) {
  errors.push('functions/admin-visibility.js: administrator public content safety gate is missing');
}

const rules = read('firestore.rules');
if (!/match \/reports\/\{reportId\}[\s\S]*allow create: if false;/.test(rules)) {
  errors.push('firestore.rules: direct report creation is still allowed');
}
for (const privatePath of ['court_comment_authors', 'action_limits', 'report_keys']) {
  if (!rules.includes(`match /${privatePath}/`)) {
    errors.push(`firestore.rules: explicit private rule is missing for ${privatePath}`);
  }
}

const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('/admin/admin-bootstrap.js')) {
  errors.push('public/admin/index.html: strict admin bootstrap is not loaded');
}
if (adminIndex.includes('src="/admin/admin.js')) {
  errors.push('public/admin/index.html: legacy admin module bypasses the strict bootstrap');
}

const adminOverrides = read('public/admin/admin-security-overrides.js');
if (!adminOverrides.includes("httpsCallable(functions, 'setAdminResultVisibility')")) {
  errors.push('public/admin/admin-security-overrides.js: admin visibility still bypasses the server callable');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
for (const fn of ['setAdminResultVisibility', 'submitReport']) {
  if (!deploy.includes(`functions:${fn}`)) {
    errors.push(`.github/workflows/firebase-deploy.yml: ${fn} function is not deployed`);
  }
}
const functionsStep = deploy.indexOf('Deploy current Functions first');
const rulesStep = deploy.indexOf('Deploy Firestore configuration and Hosting');
if (functionsStep < 0 || rulesStep < 0 || functionsStep > rulesStep) {
  errors.push('.github/workflows/firebase-deploy.yml: restrictive rules are deployed before backend functions');
}
if (!deploy.includes('App Check enforcement cannot be enabled while appCheckSiteKey is empty.')) {
  errors.push('.github/workflows/firebase-deploy.yml: App Check lockout guard is missing');
}

if (errors.length) {
  console.error(`Security regression validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Security regression validation passed: identity privacy, server-only mutations, abuse limits, and publication moderation.');
