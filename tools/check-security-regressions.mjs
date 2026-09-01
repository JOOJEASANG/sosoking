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
  'public/admin/admin-bootstrap.js',
  'public/admin/admin.js'
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

const discussion = read('functions/discussion.js');
if (!discussion.includes('db.runTransaction')
  || !discussion.includes('assertDiscussionWritable')
  || !discussion.includes('tx.update(resultRef')) {
  errors.push('functions/discussion.js: deletion-safe transactional comment write is missing');
}

const publicOriginal = read('functions/public-original.js');
if (!publicOriginal.includes('originalVisible: true')
  || !publicOriginal.includes('originalVisible: false')
  || !publicOriginal.includes('safePublicDescription(resultData)')) {
  errors.push('functions/public-original.js: owner-only original/public-safe description boundary is missing');
}

const daily = read('functions/daily.js');
if (!daily.includes('moderateDailyContent')) {
  errors.push('functions/daily.js: post-generation daily content moderation is missing');
}
if (!daily.includes("promptVersion: 'daily-document-v5-judge-winner'")) {
  errors.push('functions/daily.js: moderated daily judge/winner prompt version is missing');
}
if (!daily.includes('winner: data.winner') || !daily.includes('normalizeWinner')) {
  errors.push('functions/daily.js: daily verdict winner is not normalized and persisted');
}
if (!daily.includes('isPublic: moderation.publish')) {
  errors.push('functions/daily.js: daily publication is not controlled by moderation');
}

const trial = read('functions/generate-trial-lite.js');
const trialReservations = trial.match(/reserveAiRequest\(uid, 'trial', settings\)/g) || [];
if (trialReservations.length !== 1) {
  errors.push(`functions/generate-trial-lite.js: trial quota must be reserved exactly once per operation, found ${trialReservations.length}`);
}
if (!trial.includes('for (let attempt = 0; quotaAvailable && attempt < modelNames.length')) {
  errors.push('functions/generate-trial-lite.js: model retries are not gated by a single quota reservation');
}
if (!trial.includes('totals.attempts += 1') || !trial.includes('geminiRequests: FieldValue.increment(totals.attempts)')) {
  errors.push('functions/generate-trial-lite.js: failed Gemini attempts are not included in usage accounting');
}
if (!trial.includes('caseCount: FieldValue.increment(saved ? 1 : 0)')) {
  errors.push('functions/generate-trial-lite.js: case statistics include failed saves');
}
if (!trial.includes('generatedSafety = inspectContent') || !/promptVersion: '[^']+'/.test(trial)) {
  errors.push('functions/generate-trial-lite.js: generated trial safety validation is missing');
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

const publicStats = read('functions/public-stats.js');
if (!publicStats.includes("db.doc('site_public/statistics').set")) {
  errors.push('functions/public-stats.js: server-maintained public statistics document is missing');
}
if (!publicStats.includes("schedule: 'every 30 minutes'")) {
  errors.push('functions/public-stats.js: recurring public statistics refresh is missing');
}

const migration = read('functions/legacy-case-migration.js');
if (!migration.includes("db.doc(`case_id_aliases/${legacyIdHash(caseId)}`)")) {
  errors.push('functions/legacy-case-migration.js: hashed legacy alias document is missing');
}
const aliasPayload = migration.match(/tx\.set\(aliasRef,\s*\{([\s\S]*?)\}\);/)?.[1] || '';
if (!aliasPayload || /\b(?:caseId|oldCaseId)\b/.test(aliasPayload)) {
  errors.push('functions/legacy-case-migration.js: raw legacy case ID is persisted in the alias document');
}
for (const path of ['result_reactions', 'court_comments', 'court_comment_authors', 'reports', 'report_keys']) {
  if (!migration.includes(path)) {
    errors.push(`functions/legacy-case-migration.js: ${path} relationships are not migrated`);
  }
}
if (!migration.includes("data.status === 'completed'") || !migration.includes("caseId.startsWith(`${uid}_`)")) {
  errors.push('functions/legacy-case-migration.js: legacy UID case eligibility check is missing');
}
if (!migration.includes("status: 'completed'") || !migration.includes('removeLegacyDocuments(oldCaseId)')) {
  errors.push('functions/legacy-case-migration.js: alias completion or old document cleanup is missing');
}

const aliasFunctions = read('functions/case-aliases.js');
if (!aliasFunctions.includes('exports.resolveCaseAlias') || !aliasFunctions.includes('exports.migrateLegacyCaseIds')) {
  errors.push('functions/case-aliases.js: resolver or admin migration callable is missing');
}
if (!aliasFunctions.includes('request.data?.dryRun !== false')
  || !aliasFunctions.includes("request.data?.confirm !== 'MIGRATE_LEGACY_CASE_IDS'")) {
  errors.push('functions/case-aliases.js: migration must default to dry-run and require explicit confirmation');
}
if (!aliasFunctions.includes('isAdminAuth(request.auth)')) {
  errors.push('functions/case-aliases.js: migration callable lacks server-side administrator authorization');
}
if (!aliasFunctions.includes("enforceActionRateLimit(request.auth.uid, 'case-alias-resolve'")) {
  errors.push('functions/case-aliases.js: public alias resolver abuse limit is missing');
}

const migrationCli = read('functions/migrate-legacy-case-ids-cli.js');
if (!migrationCli.includes("CONFIRM_LEGACY_CASE_MIGRATION !== 'MIGRATE_LEGACY_CASE_IDS'")) {
  errors.push('functions/migrate-legacy-case-ids-cli.js: apply mode confirmation guard is missing');
}
if (migrationCli.includes('console.log(candidate.caseId)')) {
  errors.push('functions/migrate-legacy-case-ids-cli.js: raw legacy ID is written to workflow logs');
}

const main = read('functions/main.js');
for (const moduleName of ['./admin-visibility', './reports', './public-stats', './case-aliases']) {
  if (!main.includes(`require('${moduleName}')`)) {
    errors.push(`functions/main.js: ${moduleName} module is not exported`);
  }
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

const adminActions = read('functions/admin-actions.js');
for (const item of ['court_comment_authors', 'report_keys', 'case_id_aliases']) {
  if (!adminActions.includes(item)) {
    errors.push(`functions/admin-actions.js: cascade deletion omits ${item}`);
  }
}
if (!adminActions.includes('exports.deleteUserProfile')
  || !adminActions.includes('nameSnap.data().uid === userId')
  || !adminActions.includes('tx.delete(nameRef)')) {
  errors.push('functions/admin-actions.js: transactional profile and nickname cleanup is missing');
}

const rules = read('firestore.rules');
if (!/match \/reports\/\{reportId\}[\s\S]*allow create: if false;/.test(rules)) {
  errors.push('firestore.rules: direct report creation is still allowed');
}
for (const privatePath of ['court_comment_authors', 'action_limits', 'report_keys', 'case_id_aliases']) {
  if (!rules.includes(`match /${privatePath}/`)) {
    errors.push(`firestore.rules: explicit private rule is missing for ${privatePath}`);
  }
}
if (!rules.includes('function isPublicResultListData(data)')
  || !rules.includes('allow list: if isAdmin() || isPublicResultListData(resource.data);')) {
  errors.push('firestore.rules: public result direct-query compatibility guard is missing');
}

const home = read('public/js/pages/home.js');
if (!home.includes("doc(db, 'site_public', 'statistics')")) {
  errors.push('public/js/pages/home.js: authoritative public statistics document is not used');
}
if (!home.includes('id=\"stat-count\">—') || home.includes('847+')) {
  errors.push('public/js/pages/home.js: public count must start unknown instead of showing a fake statistic');
}
if (!home.includes('loadSafePublicResults')) {
  errors.push('public/js/pages/home.js: canonical safe public result loader is missing');
}

const resultCourt = read('public/js/pages/result-court.js');
if (!resultCourt.includes("httpsCallable(functions, 'resolveCaseAlias')") || !resultCourt.includes('location.replace')) {
  errors.push('public/js/pages/result-court.js: migrated legacy URLs are not redirected');
}
if (!resultCourt.includes('처음 입력한 접수 원문은 작성자 본인에게만 보입니다.')) {
  errors.push('public/js/pages/result-court.js: public disclosure copy does not distinguish the private original');
}

const policy = read('public/js/pages/policy.js');
if (!policy.includes('작성자가 처음 입력한 접수 원문은 작성자 본인에게만')
  || !policy.includes('공개용 사건 정보, 공개용 닉네임')) {
  errors.push('public/js/pages/policy.js: current private-original/public-safe disclosure is missing');
}
const obsoleteAiUseClaims = policy.match(/입력하신 사건 내용은 AI 판결 생성 목적으로만 사용되며/g) || [];
if (obsoleteAiUseClaims.length > 1) {
  errors.push('public/js/pages/policy.js: obsolete exclusive AI-use claim remains in the displayed default notice');
}

const app = read('public/js/app.js');
if (!app.includes('function freshContentHost()') || !app.includes('current.replaceWith(next)')) {
  errors.push('public/js/app.js: stale asynchronous route renders can still overwrite the active page');
}
if (!app.includes('function scheduleRoute()') || !app.includes('queueMicrotask')) {
  errors.push('public/js/app.js: duplicate navigation events are not coalesced');
}

const firebaseClient = read('public/js/firebase.js');
if (!firebaseClient.includes('trackedAttempt = currentAttempt.catch') || !firebaseClient.includes('authInitPromise = null')) {
  errors.push('public/js/firebase.js: failed authentication initialization cannot be retried');
}

const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('/admin/admin-bootstrap.js')) {
  errors.push('public/admin/index.html: strict admin bootstrap is not loaded');
}
if (adminIndex.includes('src=\"/admin/admin.js')) {
  errors.push('public/admin/index.html: legacy admin module bypasses the strict bootstrap');
}

const adminBootstrap = read('public/admin/admin-bootstrap.js');
const adminDashboard = read('public/admin/admin.js');
if (!adminBootstrap.includes('module.mountAdminDashboard(user)')
  || adminBootstrap.includes('admin-enhancements.js')
  || adminBootstrap.includes('admin-security-overrides.js')) {
  errors.push('public/admin/admin-bootstrap.js: administrator module boundary is not consolidated');
}
if (adminDashboard.includes('MutationObserver') || adminDashboard.includes('window._')
  || adminDashboard.includes("updateDoc(doc(db, 'results'")
  || adminDashboard.includes("deleteDoc(doc(db, 'cases'")) {
  errors.push('public/admin/admin.js: legacy monkey patch or direct case mutation remains');
}
for (const callable of ['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile', 'moderateReport']) {
  if (!adminDashboard.includes(`httpsCallable(functions, '${callable}')`)) {
    errors.push(`public/admin/admin.js: administrator callable ${callable} is missing`);
  }
}

const deploy = read('.github/workflows/firebase-deploy.yml');
for (const fn of [
  'setAdminResultVisibility',
  'submitReport',
  'moderateReport',
  'syncPublicStats',
  'syncPublicStatsNow',
  'resolveCaseAlias',
  'migrateLegacyCaseIds',
  'deleteUserProfile'
]) {
  if (!deploy.includes(`functions:${fn}`)) {
    errors.push(`.github/workflows/firebase-deploy.yml: ${fn} function is not deployed`);
  }
}
const functionsStep = deploy.indexOf('Deploy current Functions first');
const rulesStep = deploy.indexOf('Deploy Firestore configuration and Hosting');
if (functionsStep < 0 || rulesStep < 0 || functionsStep > rulesStep) {
  errors.push('.github/workflows/firebase-deploy.yml: restrictive rules are deployed before backend functions');
}
if (!deploy.includes('node functions/sync-public-stats-cli.js')) {
  errors.push('.github/workflows/firebase-deploy.yml: public statistics are not initialized during deployment');
}
if (!deploy.includes('App Check enforcement cannot be enabled while appCheckSiteKey is empty.')) {
  errors.push('.github/workflows/firebase-deploy.yml: App Check lockout guard is missing');
}

const migrationWorkflow = read('.github/workflows/migrate-legacy-case-ids.yml');
if (!migrationWorkflow.includes('workflow_dispatch:')
  || migrationWorkflow.includes('\n  push:')
  || migrationWorkflow.includes('\n  pull_request:')) {
  errors.push('.github/workflows/migrate-legacy-case-ids.yml: migration must be manual-only');
}
if (!migrationWorkflow.includes('refs/heads/main')
  || !migrationWorkflow.includes('MIGRATE_LEGACY_CASE_IDS')) {
  errors.push('.github/workflows/migrate-legacy-case-ids.yml: apply mode branch or confirmation guard is missing');
}

if (errors.length) {
  console.error(`Security regression validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Security regression validation passed: privacy, public-query compatibility, deletion races, legacy IDs, abuse limits, AI accounting, and publication moderation.');
