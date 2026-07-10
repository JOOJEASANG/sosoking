const fs = require('node:fs');
const path = require('node:path');

function resolve(relativePath) {
  return path.resolve(__dirname, relativePath);
}
function read(relativePath) {
  return fs.readFileSync(resolve(relativePath), 'utf8');
}

const coreWorkflow = read('../.github/workflows/firebase-deploy.yml');
const storageWorkflow = read('../.github/workflows/firebase-storage-rules.yml');
const firebaseConfig = JSON.parse(read('../firebase.json'));
const storageRules = read('../storage.rules');
const main = read('./main.js');
const generator = read('./generate-trial-v2.js');
const judgment = read('./judgment-v2.js');
const story = [
  read('./judgment-story-v2.js'),
  read('./judgment-story-config.js'),
  read('./judgment-story-writer.js'),
  read('./judgment-story-quality.js'),
].join('\n');
const daily = read('./daily.js');
const social = read('./social.js');
const repair = read('./repair.js');
const app = read('../public/js/app.js');
const index = read('../public/index.html');
const homePage = read('../public/js/pages/home.js');
const trialPage = read('../public/js/pages/trial.js');
const resultPage = read('../public/js/pages/result.js');
const resultWrapper = read('../public/js/pages/result-case-story.js');
const boardPage = read('../public/js/pages/board.js');
const policy = read('../public/js/pages/policy.js');
const readme = read('../README.md');

const functionDeployIndex = coreWorkflow.indexOf('Deploy Functions from current source');
const firestoreDeployIndex = coreWorkflow.indexOf('Deploy Firestore rules and indexes');
const hostingDeployIndex = coreWorkflow.indexOf('Deploy Hosting');
const resultWriteStart = generator.indexOf('await resultRef.set({');
const resultWriteEnd = generator.indexOf('\n    });', resultWriteStart);
const resultWrite = resultWriteStart >= 0 && resultWriteEnd > resultWriteStart
  ? generator.slice(resultWriteStart, resultWriteEnd)
  : '';
const retiredFunctions = [
  'syncJudgmentStructure',
  'backfillJudgmentStructures',
  'backfillJudgmentStructuresNow',
];
const removedFiles = [
  './generate-trial-lite.js',
  './judgment-parser.js',
  './sync-judgment-structure.js',
  '../public/js/pages/result-summary.js',
  '../public/js/pages/result-court.js',
];
const duplicatedNarrativeFields = [
  'expandedCase',
  'reception',
  'caseTimeline',
  'forensicReport',
  'investigation',
  'plaintiffArg',
  'defendantArg',
  'courtOpinion',
  'verdict',
  'sentence',
  'closingComment',
  'judgmentScript',
];

const checks = [
  [functionDeployIndex >= 0, 'Core workflow must deploy Functions from current source'],
  [firestoreDeployIndex > functionDeployIndex, 'Firestore rules must deploy after Functions'],
  [hostingDeployIndex > firestoreDeployIndex, 'Hosting must deploy after Firestore'],
  [coreWorkflow.includes('firebase deploy --only functions --force'), 'Functions deployment must remove exports retired from source'],
  [!coreWorkflow.includes('FUNCTION_TARGETS'), 'Functions deployment must not use a duplicated hardcoded target list'],
  [!coreWorkflow.includes('firebase deploy --only storage'), 'Core workflow must not deploy Storage Rules'],
  [!coreWorkflow.includes('continue-on-error'), 'Core deployment must not hide failed steps'],
  [coreWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Core workflow service-account secret is missing'],
  [retiredFunctions.every(name => !coreWorkflow.includes(name)), 'Core workflow still references retired judgment maintenance Functions'],

  [main.includes("require('./generate-trial-v2')"), 'Functions entry point must export the V2 judgment generator'],
  [!main.includes("require('./generate-trial-lite')"), 'Functions entry point must not export the legacy judgment generator'],
  [!main.includes("require('./sync-judgment-structure')"), 'Functions entry point still exports legacy judgment synchronization'],
  [removedFiles.every(file => !fs.existsSync(resolve(file))), 'A removed judgment implementation file was restored'],
  [resultWrite.length > 0, 'V2 result write block could not be inspected'],
  [resultWrite.includes('schemaVersion: JUDGMENT_SCHEMA_VERSION'), 'V2 generator must save a schema version'],
  [resultWrite.includes('judgment,'), 'V2 generator must save the canonical judgment object'],
  [resultWrite.includes("resultVersion: 'judgment-v2'"), 'V2 generator result version is missing'],
  [resultWrite.includes('storyVersion: STORY_VERSION'), 'V2 generator must identify the case-story writing version'],
  [duplicatedNarrativeFields.every(field => !resultWrite.includes(`\n      ${field}:`)), 'V2 generator must not write duplicated legacy narrative fields'],

  [generator.includes('buildCaseProfile') && generator.includes('buildStoryPrompt'), 'User judgment generation must build a case-specific story profile and prompt'],
  [generator.includes('evaluateStorySpecificity') && generator.includes('buildRewriteInstruction'), 'User judgment generation must reject generic AI output and retry'],
  [generator.includes('buildStoryFallback(profile)'), 'Local fallback must be tailored to the submitted case'],
  [judgment.includes('incidentLevel: cleanText') && judgment.includes('breakingNews: cleanParagraph'), 'Canonical judgment must preserve emergency metadata'],
  [judgment.includes('emergencyBriefing: cleanParagraph') && judgment.includes('impactAssessment: cleanParagraph'), 'Canonical judgment must preserve emergency details'],
  [story.includes('진지함 60%') && story.includes('과몰입 개그 40%'), 'Emergency-comedy writing ratio is missing'],
  [story.includes('웃음 구조는 세 번') && story.includes('국가적 비상은 아니지만'), 'Escalation must include three humor beats and forbid early retreat'],
  [story.includes('orders 3개 모두 사건 맞춤형') && story.includes('대표 사건 물건'), 'Tailored-order requirements are missing'],
  [story.includes('function evaluateStorySpecificity'), 'Case-specific judgment validation is missing'],
  [story.includes('emergencyAnchorHits === 3') && story.includes('seriousHumorHits >= 4'), 'Emergency detail and humor quality gates are missing'],
  [story.includes('normalizeAnchorToken'), 'Korean case-anchor normalization is missing'],

  [daily.includes("resultVersion: 'judgment-v2'") && daily.includes('judgment: data.judgment'), 'Daily AI cases must use the V2 judgment schema'],
  [social.includes('resultData.judgment?.orders') && social.includes('resultData.judgment?.opinion'), 'Appeals must read V2 orders and opinion'],
  [repair.includes('isCompleteJudgment(data.judgment)'), 'Stale recovery must recognize completed V2 judgments'],

  [app.includes("from './pages/home-court.js?v=20260710-v2judgment1'"), 'App must load the V2-aware home feed'],
  [app.includes("from './pages/trial-game.js?v=20260710-v2judgment1'"), 'App must load the V2-aware trial flow'],
  [app.includes("from './pages/result-case-story.js?v=20260710-emergency-comedy1'"), 'App must load the emergency-comedy result wrapper'],
  [app.includes("from './pages/board-court.js?v=20260710-v2judgment1'"), 'App must load the V2-aware board'],
  [!app.includes('result-summary.js') && !app.includes('result-court.js'), 'App must not restore removed result wrappers'],
  [index.includes('/js/app.js?v=20260710-emergency-comedy1'), 'Index must bust the app cache for emergency-comedy judgments'],
  [homePage.includes('result.judgment?.summary') && homePage.includes('result.judgment?.headline'), 'Home feed must read V2 judgment summaries and headlines'],
  [homePage.includes('result.judgment?.facts') && homePage.includes('resultSearchText'), 'Home search must include V2 judgment content'],
  [trialPage.includes('Number(data.schemaVersion) === 2') && trialPage.includes('judgment.orders'), 'Trial flow must recognize completed V2 judgments'],
  [trialPage.includes('if (isCompleteResult(data))'), 'Trial flow must redirect after a V2 judgment is complete'],
  [resultPage.includes('r.judgment') && resultPage.includes('r.judgmentScript'), 'Result page must support both V2 and existing judgment records'],
  [resultPage.includes("mode: 'script'"), 'Existing judgmentScript must be rendered directly without client reconstruction'],
  [resultWrapper.includes("doc(db, 'results', caseId)") && resultWrapper.includes('result.caseDescription'), 'Result wrapper must load the original submitted case content'],
  [resultWrapper.includes('사용자가 접수한 실제 사건 내용'), 'Result wrapper must visibly label the original case content'],
  [resultWrapper.includes('소소킹 긴급사건 특보') && resultWrapper.includes('방치 시 예상 파급효과'), 'Result wrapper must visibly show emergency briefing and impact'],
  [resultWrapper.includes('judgment.breakingNews') && resultWrapper.includes('judgment.emergencyBriefing'), 'Result wrapper must read emergency judgment fields'],
  [boardPage.includes('r.judgment?.summary') && boardPage.includes('r.judgment?.headline'), 'Board must read V2 judgment summaries and headlines'],

  [storageWorkflow.includes('workflow_dispatch:'), 'Storage workflow must be manually dispatchable'],
  [!storageWorkflow.includes('\n  push:'), 'Storage workflow must not run automatically until IAM is configured'],
  [storageWorkflow.includes('firebase deploy --only storage'), 'Storage workflow must deploy only Storage Rules'],
  [!storageWorkflow.includes('continue-on-error'), 'Storage deployment failure must remain visible'],
  [storageWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Storage workflow service-account secret is missing'],

  [firebaseConfig.storage?.rules === 'storage.rules', 'firebase.json must point to storage.rules'],
  [storageRules.includes('service firebase.storage'), 'storage.rules is not a Firebase Storage ruleset'],

  [policy.includes("doc(db, 'public_settings', 'config')"), 'Public policy pages must read public_settings'],
  [!policy.includes("doc(db, 'site_settings', 'config')"), 'Public policy pages must not read private site_settings'],
  [policy.includes("getDoc(doc(db, 'policy_docs', safeType)).catch(() => null)"), 'Policy content failure must be isolated'],
  [policy.includes("getDoc(doc(db, 'public_settings', 'config')).catch(() => null)"), 'Public settings failure must be isolated'],

  [readme.includes('docs/DEPLOYMENT.md'), 'README must link to the deployment runbook'],
  [readme.includes('판결 V2 데이터 구조'), 'README must document the canonical judgment schema'],
  [!readme.includes('1~10점'), 'README must not describe the removed 1-10 score system'],
  [retiredFunctions.every(name => !readme.includes(name)), 'README still describes retired judgment maintenance Functions'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Deployment contract failed: ${message}`));
  process.exit(1);
}

console.log('Verified detailed emergency-comedy judgments, original-case display and Firebase deployment contracts.');
