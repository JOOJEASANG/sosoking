const fs = require('node:fs');
const path = require('node:path');

const resolve = relative => path.resolve(__dirname, relative);
const read = relative => fs.readFileSync(resolve(relative), 'utf8');

const coreWorkflow = read('../.github/workflows/firebase-deploy.yml');
const storageWorkflow = read('../.github/workflows/firebase-storage-rules.yml');
const firebaseConfig = JSON.parse(read('../firebase.json'));
const storageRules = read('../storage.rules');
const main = read('./main.js');
const generator = read('./generate-trial-v2.js');
const judgment = read('./judgment-v2.js');
const story = [read('./judgment-story-v2.js'), read('./judgment-story-config.js'), read('./judgment-story-writer.js'), read('./judgment-story-quality.js')].join('\n');
const daily = read('./daily.js');
const social = read('./social.js');
const repair = read('./repair.js');
const visibility = read('./visibility.js');
const securityUtils = read('./security-utils.js');
const app = read('../public/js/app.js');
const index = read('../public/index.html');
const homePage = read('../public/js/pages/home.js');
const trialPage = read('../public/js/pages/trial.js');
const trialWrapper = read('../public/js/pages/trial-game.js');
const resultPage = read('../public/js/pages/result.js');
const resultWrapper = read('../public/js/pages/result-case-story.js');
const boardPage = read('../public/js/pages/board.js');
const policy = read('../public/js/pages/policy.js');
const siteSystem = read('../public/css/site-system.css');
const readability = read('../public/css/site-readability.css');
const readme = read('../README.md');

const functionDeployIndex = coreWorkflow.indexOf('Deploy Functions from current source');
const firestoreDeployIndex = coreWorkflow.indexOf('Deploy Firestore rules and indexes');
const hostingDeployIndex = coreWorkflow.indexOf('Deploy Hosting');
const retiredFunctions = ['syncJudgmentStructure','backfillJudgmentStructures','backfillJudgmentStructuresNow'];
const removedFiles = [
  './generate-trial-lite.js','./judgment-parser.js','./sync-judgment-structure.js',
  '../public/js/pages/result-summary.js','../public/js/pages/result-court.js','../public/js/pages/home-court.js',
  '../public/css/home-light-fix.css','../public/css/theme-contrast-fix.css','../public/css/theme-mode-polish.css',
  '../public/css/theme-targeted-fixes.css','../public/css/home-hero-light-contrast.css',
  '../public/css/light-mode-complete-contrast.css','../public/css/home-stats-cta-polish.css','../public/css/submit-light-fix.css',
];
const duplicatedNarrativeFields = ['expandedCase','reception','caseTimeline','forensicReport','plaintiffArg','defendantArg','courtOpinion','verdict','sentence','closingComment','judgmentScript'];
const resultPayloadStart = generator.indexOf('batch.set(resultRef, {');
const resultPayloadEnd = generator.indexOf('\n    });', resultPayloadStart);
const resultPayload = resultPayloadStart >= 0 && resultPayloadEnd > resultPayloadStart
  ? generator.slice(resultPayloadStart, resultPayloadEnd)
  : '';
const globalHeaders = Object.fromEntries(
  (firebaseConfig.hosting?.headers?.find(item => item.source === '**')?.headers || [])
    .map(item => [item.key, item.value]),
);

const checks = [
  [functionDeployIndex >= 0, 'Core workflow must deploy Functions from current source'],
  [firestoreDeployIndex > functionDeployIndex, 'Firestore rules must deploy after Functions'],
  [hostingDeployIndex > firestoreDeployIndex, 'Hosting must deploy after Firestore'],
  [coreWorkflow.includes('firebase deploy --only functions --force'), 'Functions deployment must remove retired exports'],
  [!coreWorkflow.includes('FUNCTION_TARGETS'), 'Functions deployment must not use a duplicated hardcoded target list'],
  [!coreWorkflow.includes('firebase deploy --only storage'), 'Core workflow must not deploy Storage Rules'],
  [!coreWorkflow.includes('continue-on-error'), 'Core deployment must not hide failed steps'],
  [coreWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Core workflow service-account secret is missing'],
  [retiredFunctions.every(name => !coreWorkflow.includes(name)), 'Core workflow still references retired judgment Functions'],

  [main.includes("require('./generate-trial-v2')"), 'Functions entry point must export V2 generator'],
  [main.includes("require('./visibility')"), 'Functions entry point must export atomic visibility changes'],
  [!main.includes("require('./generate-trial-lite')") && !main.includes("require('./sync-judgment-structure')"), 'Legacy judgment exports must remain removed'],
  [removedFiles.every(file => !fs.existsSync(resolve(file))), 'A removed or consolidated file was restored'],
  [resultPayload.includes('schemaVersion: JUDGMENT_SCHEMA_VERSION') && resultPayload.includes('judgment,'), 'V2 generator must save the canonical judgment object'],
  [resultPayload.includes("resultVersion: 'judgment-v2'") && resultPayload.includes('storyVersion: STORY_VERSION'), 'V2 result version metadata is missing'],
  [duplicatedNarrativeFields.every(field => !resultPayload.includes(`\n      ${field}:`)), 'V2 generator must not write duplicate narrative fields'],
  [generator.includes('const batch = db.batch()') && generator.includes('batch.update(caseRef') && generator.includes('await batch.commit()'), 'Judgment result and case status must commit atomically'],

  [generator.includes('buildCaseProfile') && generator.includes('buildStoryPrompt'), 'User judgments must use case-specific generation'],
  [generator.includes('evaluateStorySpecificity') && generator.includes('buildRewriteInstruction'), 'Generic or repetitive AI output must be rejected and rewritten'],
  [generator.includes('buildStoryFallback(profile)'), 'Local fallback must stay case-specific'],
  [judgment.includes('incidentLevel: cleanText') && judgment.includes('emergencyBriefing: cleanParagraph'), 'Canonical judgment must preserve emergency fields'],
  [judgment.includes('plaintiffClaim: cleanParagraph') && judgment.includes('defendantClaim: cleanParagraph'), 'Canonical judgment must preserve opposing quick claims'],
  [story.includes('진지함 55%') && story.includes('자유로운 해석과 정색한 과몰입 개그 45%'), 'Interpretive comedy ratio is missing'],
  [story.includes('원문은 사실 확인용 자료') && story.includes('4개 단어 이상 연속된 표현을 복사하지 마라'), 'Source-copy prevention rules are missing'],
  [story.includes('mainAnchorMentions <= 10') && story.includes('copiedPhraseHits <= 7'), 'Low-repetition quality gates are incomplete'],
  [story.includes('opposingClaimOverlap <= 0.72') && story.includes('seriousHumorHits >= 4'), 'Distinct-claim and comedy gates are incomplete'],
  [story.includes('normalizeAnchorToken'), 'Korean case-anchor normalization is missing'],

  [daily.includes("resultVersion: 'judgment-v2'") && daily.includes('judgment: data.judgment'), 'Daily AI cases must use V2 schema'],
  [daily.includes('daily_generation_locks') && daily.includes('DAILY_LOCK_STALE_MS'), 'Daily AI generation must use a stale-safe lock'],
  [social.includes('resultData.judgment?.orders') && social.includes('resultData.judgment?.opinion'), 'Appeals must read V2 fields'],
  [social.includes('APPEAL_DAILY_LIMIT') && social.includes("status: 'processing'"), 'Appeals must use rate limits and concurrency locks'],
  [repair.includes('isCompleteJudgment(data.judgment)'), 'Stale recovery must recognize completed V2 judgments'],
  [repair.includes('recoverStaleReservations') && repair.includes('title_suggestion_reservations'), 'Stale quota reservations must be refunded'],
  [visibility.includes('db.runTransaction') && visibility.includes('assertNoSensitiveContent'), 'Visibility updates must be atomic and privacy checked'],
  [securityUtils.includes('validDocumentId') && securityUtils.includes('validatedProfilePhotoUrl'), 'Shared security validation module is incomplete'],

  [app.includes("from './pages/home.js?v=20260710-full-audit1'"), 'App must load the audited home directly'],
  [app.includes("from './pages/trial-game.js?v=20260710-full-audit1'"), 'App must load the staged trial flow'],
  [app.includes("from './pages/result-case-story.js?v=20260717-security1'"), 'App must load the secured result wrapper'],
  [app.includes("from './pages/auth.js?v=20260717-security1'"), 'App must load the verified-email authentication flow'],
  [app.includes("from './pages/board-court.js?v=20260710-v2judgment1'"), 'App must load V2-aware board'],
  [!app.includes('result-summary.js') && !app.includes('result-court.js') && !app.includes('home-court.js'), 'App must not restore removed wrappers'],
  [index.includes('/css/site-system.css?v=20260710-full-audit1'), 'Index must load unified site CSS'],
  [index.includes('/css/site-readability.css?v=20260711-interpret1'), 'Index must load the final readability guard'],
  [index.includes('/js/app.js?v=20260717-security1'), 'Index must bust security app cache'],
  [siteSystem.includes('html[data-theme="light"]') && siteSystem.includes('--ui-surface:'), 'Unified CSS must define light and dark surfaces'],
  [readability.includes('html[data-theme="light"] body #page-content') && readability.includes('.result-card:not(.emergency-briefing-card) p'), 'Readability guard must protect runtime result text'],
  [homePage.includes('사건 접수부터 선고까지 6단계') && homePage.includes('result.judgment?.plaintiffClaim'), 'Home must explain and search the full court journey'],
  [trialPage.includes('Number(data.schemaVersion) === 2') && trialPage.includes('judgment.orders'), 'Base trial must recognize V2 results'],
  [trialPage.includes('if (isCompleteResult(data))'), 'Base trial must redirect after completion'],
  [trialWrapper.includes('THEATER_STAGES') && trialWrapper.includes('renderMiniClaims'), 'Trial wrapper must stage the process and show claims'],
  [resultPage.includes('r.judgment') && resultPage.includes('r.judgmentScript') && resultPage.includes("mode: 'script'"), 'Result page must support V2 and legacy scripts'],
  [resultWrapper.includes("doc(db, 'results', caseId)") && resultWrapper.includes('result.caseDescription'), 'Result wrapper must load original case'],
  [resultWrapper.includes('<details class="result-card original-case-card">') && resultWrapper.includes('같은 사건, 다른 해석'), 'Result wrapper must separate source text and render independent claims'],
  [resultWrapper.includes('setCaseVisibility') && resultWrapper.includes('소소킹 긴급사건 특보'), 'Result wrapper must use secure publishing and show interpretive briefing'],
  [boardPage.includes('r.judgment?.summary') && boardPage.includes('r.judgment?.headline'), 'Board must read V2 summaries'],

  [storageWorkflow.includes('workflow_dispatch:') && !storageWorkflow.includes('\n  push:'), 'Storage workflow must remain manual'],
  [storageWorkflow.includes('firebase deploy --only storage') && !storageWorkflow.includes('continue-on-error'), 'Storage failures must remain visible'],
  [storageWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Storage workflow secret is missing'],
  [firebaseConfig.storage?.rules === 'storage.rules' && storageRules.includes('service firebase.storage'), 'Storage rules configuration is invalid'],
  [globalHeaders['X-Content-Type-Options'] === 'nosniff' && globalHeaders['X-Frame-Options'] === 'DENY', 'Hosting security headers are missing'],

  [policy.includes("doc(db, 'public_settings', 'config')") && !policy.includes("doc(db, 'site_settings', 'config')"), 'Public policy must read only public settings'],
  [policy.includes("getDoc(doc(db, 'policy_docs', safeType)).catch(() => null)"), 'Policy content failure must be isolated'],
  [policy.includes("getDoc(doc(db, 'public_settings', 'config')).catch(() => null)"), 'Public settings failure must be isolated'],

  [readme.includes('docs/DEPLOYMENT.md'), 'README must link deployment runbook'],
  [readme.includes('판결 V2 데이터 구조'), 'README must document V2 schema'],
  [!readme.includes('1~10점') && !readme.includes('소소 형량'), 'README must not describe removed product concepts'],
  [retiredFunctions.every(name => !readme.includes(name)), 'README still describes retired Functions'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Deployment contract failed: ${message}`));
  process.exit(1);
}

console.log('Verified secure judgments, light-mode readability and Firebase deployment contracts.');
