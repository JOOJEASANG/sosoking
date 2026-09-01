import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const ignoredDirectories = new Set(['.git', 'node_modules', '.firebase', 'coverage', 'dist']);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : entry.isFile() ? [fullPath] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function resolvesLocally(fromFile, specifier) {
  const clean = specifier.split('?')[0].split('#')[0];
  if (!clean.startsWith('.') && !clean.startsWith('/')) return true;

  const base = clean.startsWith('/')
    ? path.join(root, 'public', clean.slice(1))
    : path.resolve(path.dirname(fromFile), clean);

  return [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')]
    .some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

const jsFiles = [
  ...walk(path.join(root, 'functions')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'public')).filter(file => /\.(?:js|mjs)$/.test(file))
];

for (const file of jsFiles) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    errors.push(`${relative(file)}: ${syntax.stderr.trim() || 'syntax error'}`);
  }

  const source = fs.readFileSync(file, 'utf8');
  const importPatterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      if (!resolvesLocally(file, match[1])) {
        errors.push(`${relative(file)}: missing local module ${match[1]}`);
      }
    }
  }
}

for (const htmlFile of walk(path.join(root, 'public')).filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const assets = html.matchAll(/(?:src|href)=["'](\/[^"'#?]+\.(?:js|mjs|css|svg|png|webp|jpg|jpeg|json|webmanifest))["']/g);
  for (const match of assets) {
    const target = path.join(root, 'public', match[1].slice(1));
    if (!fs.existsSync(target)) errors.push(`${relative(htmlFile)}: missing asset ${match[1]}`);
  }
}

const jsonFiles = [
  'package.json',
  'package-lock.json',
  'firebase.json',
  'firestore.indexes.json',
  'functions/package.json',
  'functions/package-lock.json',
  'public/site.webmanifest',
  'public/version.json'
];
for (const file of jsonFiles) {
  try {
    JSON.parse(read(file));
  } catch (error) {
    errors.push(`${file}: invalid JSON: ${error.message}`);
  }
}

const obsoleteFiles = [
  'functions/index.js',
  'public/admin/admin-email-guard.js',
  'public/admin/admin-delete.js',
  'public/admin/admin-ai-tools.js',
  'public/admin/admin-enhancements.js',
  'public/admin/admin-security-overrides.js',
  'public/css/theme-toggle.css',
  'public/js/components/app-install.js',
  'public/js/components/theme-contrast.js',
  'public/js/pages/auth.js',
  'public/js/pwa-init.js'
];
for (const file of obsoleteFiles) {
  if (fs.existsSync(path.join(root, file))) errors.push(`${file}: obsolete file remains`);
}

const authorizationFiles = [
  'functions/admin-utils.js',
  'public/js/components/admin-redirect.js',
  'public/js/pages/auth2.js'
];
for (const file of authorizationFiles) {
  const source = read(file);
  if (source.includes('FALLBACK_ADMIN_EMAILS') || source.includes('OWNER_EMAIL') || source.includes('ADMIN_EMAIL')) {
    errors.push(`${file}: legacy administrator identity constant remains`);
  }
}

const functionsMainPath = path.join(root, 'functions/main.js');
const functionsMain = fs.readFileSync(functionsMainPath, 'utf8');
const loadedModules = [...functionsMain.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)]
  .map(match => match[1]);
const exportsByName = new Map();

for (const moduleName of loadedModules) {
  const file = path.resolve(path.dirname(functionsMainPath), `${moduleName}.js`);
  if (!fs.existsSync(file)) {
    errors.push(`functions/main.js: missing module ${moduleName}`);
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)) {
    if (exportsByName.has(match[1])) {
      errors.push(`duplicate Functions export ${match[1]}: ${exportsByName.get(match[1])}, ${relative(file)}`);
    } else {
      exportsByName.set(match[1], relative(file));
    }
  }
}

const deployWorkflow = read('.github/workflows/firebase-deploy.yml');
const deployedFunctions = deployWorkflow.match(/firebase deploy --only functions:([^\s]+)/)?.[1]?.split(',functions:') || [];
for (const name of deployedFunctions) {
  if (!exportsByName.has(name)) errors.push(`firebase-deploy.yml: function ${name} is not exported`);
}
if (!deployWorkflow.includes('node tools/sync-public-config.mjs')) {
  errors.push('firebase-deploy.yml: safe public configuration sync is missing');
}

// Regression checks for the consolidated administrator UI.
const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('/admin/admin-bootstrap.js?v=20260729-report-moderation-1')) {
  errors.push('public/admin/index.html: consolidated admin bootstrap is not loaded');
}
if (adminIndex.includes('admin-enhancements.js') || adminIndex.includes('admin-security-overrides.js')) {
  errors.push('public/admin/index.html: removed admin patch modules are referenced');
}

const adminBootstrap = read('public/admin/admin-bootstrap.js');
if (!adminBootstrap.includes("module.mountAdminDashboard(user)")) {
  errors.push('public/admin/admin-bootstrap.js: authorized user is not passed to the dashboard module');
}
if (adminBootstrap.includes('admin-enhancements.js') || adminBootstrap.includes('admin-security-overrides.js')) {
  errors.push('public/admin/admin-bootstrap.js: obsolete admin patch module import remains');
}
if (!adminBootstrap.includes('signInWithRedirect')) {
  errors.push('public/admin/admin-bootstrap.js: mobile redirect login fallback is missing');
}

const adminDashboard = read('public/admin/admin.js');
if (!adminDashboard.includes('export function mountAdminDashboard(user)')) {
  errors.push('public/admin/admin.js: explicit dashboard mount entry point is missing');
}
if (adminDashboard.includes('MutationObserver') || adminDashboard.includes('window._')) {
  errors.push('public/admin/admin.js: global monkey patch or DOM observer remains');
}
for (const callable of ['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile', 'generateDailyAiNow', 'syncPublicStatsNow', 'moderateReport']) {
  if (!adminDashboard.includes(`httpsCallable(functions, '${callable}')`)) {
    errors.push(`public/admin/admin.js: secure callable ${callable} is missing`);
  }
}

const rules = read('firestore.rules');
if (!/match \/cases\/\{caseId\}[\s\S]*?allow create:\s*if false;/.test(rules)) {
  errors.push('firestore.rules: direct client case creation must remain disabled');
}
if (!/match \/cases\/\{caseId\}[\s\S]*?allow update:\s*if isAdmin\(\);/.test(rules)
  || !/match \/results\/\{caseId\}[\s\S]*?allow update:\s*if isAdmin\(\);/.test(rules)) {
  errors.push('firestore.rules: visibility updates must remain server-only');
}
const caseRules = rules.match(/match \/cases\/\{caseId\}[\s\S]*?(?=\n    match \/results\/)/)?.[0] || '';
if (caseRules.includes('resource.data.isPublic == true')) {
  errors.push('firestore.rules: public users must not read private case documents');
}
if (!/match \/site_settings\/\{docId\}[\s\S]*?allow read:\s*if isAdmin\(\);/.test(rules)) {
  errors.push('firestore.rules: private site settings must remain admin-only');
}
if (!/match \/site_public\/\{docId\}[\s\S]*?allow read:\s*if true;/.test(rules)) {
  errors.push('firestore.rules: public site configuration is missing');
}
if (!/match \/users\/\{uid\}[\s\S]*?allow create,\s*update:\s*if false;/.test(rules)) {
  errors.push('firestore.rules: direct client profile writes must remain disabled');
}
if (!/match \/user_names\/\{key\}[\s\S]*?allow read,\s*write:\s*if false;/.test(rules)) {
  errors.push('firestore.rules: nickname mappings must remain server-only');
}

const profileServer = read('functions/profile.js');
if (!profileServer.includes('oldNameSnap.data().uid === uid')) {
  errors.push('functions/profile.js: previous nickname ownership check is missing');
}

const submitServer = read('functions/submit-secure.js');
if (!submitServer.includes('settings.dailyLimit')) {
  errors.push('functions/submit-secure.js: configured daily limit is not used');
}
if (!submitServer.includes('requireVerifiedUser(request)')) {
  errors.push('functions/submit-secure.js: verified login enforcement is missing');
}
if (!submitServer.includes('boolValue(data.isPublic, false)')) {
  errors.push('functions/submit-secure.js: new cases must default to private');
}
if (!submitServer.includes('inspectContent(desc)')) {
  errors.push('functions/submit-secure.js: case content safety check is missing');
}

const contentSafety = read('functions/content-safety.js');
if (!contentSafety.includes('PII_PATTERNS') || !contentSafety.includes('HIGH_RISK_PATTERNS')
  || !contentSafety.includes('PROMPT_ATTACK_PATTERNS')) {
  errors.push('functions/content-safety.js: required safety pattern groups are missing');
}

const securityServer = read('functions/security.js');
if (!securityServer.includes("token.email_verified !== true")) {
  errors.push('functions/security.js: password email verification enforcement is missing');
}
if (!securityServer.includes('enforceAppCheck.value()') || !securityServer.includes('!request.app')) {
  errors.push('functions/security.js: configurable App Check enforcement is missing');
}
if (!securityServer.includes('globalAiDailyLimit') || !securityServer.includes('userAiDailyLimit')) {
  errors.push('functions/security.js: AI request budgets are missing');
}

const socialServer = read('functions/social.js');
if (!socialServer.includes('reactionTotal: FieldValue.increment(1)')) {
  errors.push('functions/social.js: result vote total is not synchronized');
}
if (!socialServer.includes('commentCount: FieldValue.increment(1)')) {
  errors.push('functions/social.js: result comment total is not synchronized');
}
if (!socialServer.includes("return { state: 'processing' }") || !socialServer.includes('appeal.requestId !== requestId')) {
  errors.push('functions/social.js: appeal concurrency lock is missing');
}

const trialServer = read('functions/generate-trial-lite.js');
if (!trialServer.includes('if (!acquiredProcessingLock)')) {
  errors.push('functions/generate-trial-lite.js: trial concurrency lock ownership check is missing');
}
if (!trialServer.includes("reserveAiRequest(uid, 'trial', settings)")) {
  errors.push('functions/generate-trial-lite.js: trial AI budget reservation is missing');
}
if (!trialServer.includes('userId: FieldValue.delete()') || !trialServer.includes('isPublic: c.isPublic === true')) {
  errors.push('functions/generate-trial-lite.js: public result data minimization is missing');
}
if (!trialServer.includes('inspectContent(c.caseDescription)')) {
  errors.push('functions/generate-trial-lite.js: pre-AI legacy case safety check is missing');
}
if (!socialServer.includes("reserveAiRequest(uid, 'appeal', settings)")) {
  errors.push('functions/social.js: appeal AI budget reservation is missing');
}
if (!socialServer.includes('exports.setResultVisibility') || !socialServer.includes('userId: FieldValue.delete()')) {
  errors.push('functions/social.js: secure result visibility update is missing');
}
if (!socialServer.includes('inspectContent(reason)') || !socialServer.includes('inspectContent(text)')) {
  errors.push('functions/social.js: appeal/comment safety checks are missing');
}

const firebaseClient = read('public/js/firebase.js');
if (!firebaseClient.includes('initializeAppCheck') || !firebaseClient.includes('firebaseConfig.appCheckSiteKey')) {
  errors.push('public/js/firebase.js: conditional App Check initialization is missing');
}

const authPage = read('public/js/pages/auth2.js');
if (!authPage.includes('sendEmailVerification') || !authPage.includes('needsEmailVerification')) {
  errors.push('public/js/pages/auth2.js: email verification flow is missing');
}

const submitPage = read('public/js/pages/submit.js');
if (/<input[^>]+id="is-public"[^>]+checked/.test(submitPage)) {
  errors.push('public/js/pages/submit.js: public sharing must not be preselected');
}
if (!submitPage.includes("doc(db, 'site_public', 'config')")) {
  errors.push('public/js/pages/submit.js: public configuration document is not used');
}

const resultPage = read('public/js/pages/result.js');
if (!resultPage.includes('const isPublic = r.isPublic === true')) {
  errors.push('public/js/pages/result.js: result visibility must use the public result document');
}

const resultCourt = read('public/js/pages/result-court.js');
if (!resultCourt.includes('.result-document-page .result-paper-title')) {
  errors.push('public/js/pages/result-court.js: document title contrast override is missing');
}
if (!resultCourt.includes('background:#fffdf7!important')) {
  errors.push('public/js/pages/result-court.js: paper background override is missing');
}

const daily = read('functions/daily.js');
if (daily.includes('desiredVerdict')) {
  errors.push('functions/daily.js: removed desiredVerdict field was reintroduced');
}
if (!daily.includes("promptVersion: 'daily-document-v5-judge-winner'")) {
  errors.push('functions/daily.js: moderated structured seven-judge winner prompt version is missing');
}
if (!daily.includes('winner: data.winner') || !daily.includes('normalizeWinner')) {
  errors.push('functions/daily.js: structured daily winner contract is missing');
}

if (errors.length) {
  console.error(`Repository validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Repository validation passed: ${jsFiles.length} JS files, ${exportsByName.size} deployed Functions exports.`);