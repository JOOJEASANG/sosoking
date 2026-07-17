const fs = require('node:fs');
const path = require('node:path');

const resolve = value => path.resolve(__dirname, value);
const read = value => fs.readFileSync(resolve(value), 'utf8');
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
const reporting = read('./reporting.js');
const repair = read('./repair.js');
const visibility = read('./visibility.js');
const securityUtils = read('./security-utils.js');
const app = read('../public/js/app.js');
const index = read('../public/index.html');
const home = read('../public/js/pages/home.js');
const trial = read('../public/js/pages/trial.js');
const trialGame = read('../public/js/pages/trial-game.js');
const result = read('../public/js/pages/result.js');
const resultWrapper = read('../public/js/pages/result-case-story.js');
const board = read('../public/js/pages/board.js');
const policy = read('../public/js/pages/policy.js');
const systemCss = read('../public/css/site-system.css');
const readability = read('../public/css/site-readability.css');
const readme = read('../README.md');

const functionIndex = coreWorkflow.indexOf('Deploy Functions from current source');
const firestoreIndex = coreWorkflow.indexOf('Deploy Firestore rules and indexes');
const hostingIndex = coreWorkflow.indexOf('Deploy Hosting');
const resultStart = generator.indexOf('batch.set(resultRef, {');
const resultEnd = generator.indexOf('\n    });', resultStart);
const resultPayload = resultStart >= 0 && resultEnd > resultStart ? generator.slice(resultStart, resultEnd) : '';
const headers = Object.fromEntries((firebaseConfig.hosting?.headers?.find(item => item.source === '**')?.headers || []).map(item => [item.key, item.value]));
const removed = ['./generate-trial-lite.js','./judgment-parser.js','./sync-judgment-structure.js','../public/js/pages/result-summary.js','../public/js/pages/result-court.js','../public/js/pages/home-court.js'];
const duplicateFields = ['expandedCase','reception','caseTimeline','forensicReport','plaintiffArg','defendantArg','courtOpinion','verdict','sentence','judgmentScript'];

const checks = [
  [functionIndex >= 0 && firestoreIndex > functionIndex && hostingIndex > firestoreIndex, 'Core deploy order is invalid'],
  [coreWorkflow.includes('firebase deploy --only functions --force') && !coreWorkflow.includes('continue-on-error'), 'Core deployment must fail visibly and remove retired exports'],
  [coreWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Core service-account secret is missing'],
  [removed.every(file => !fs.existsSync(resolve(file))), 'A removed legacy file was restored'],
  [main.includes("require('./generate-trial-v2')") && main.includes("require('./visibility')") && main.includes("require('./reporting')"), 'Required secured Functions are not exported'],
  [resultPayload.includes('schemaVersion: JUDGMENT_SCHEMA_VERSION') && resultPayload.includes('judgment,'), 'Canonical V2 result payload is missing'],
  [resultPayload.includes("resultVersion: 'judgment-v2'") && resultPayload.includes('storyVersion: STORY_VERSION'), 'V2 result metadata is missing'],
  [duplicateFields.every(field => !resultPayload.includes(`\n      ${field}:`)), 'Duplicate narrative fields were restored'],
  [resultPayload.includes('isPublic: false') && !resultPayload.includes('ownerId:') && !resultPayload.includes('userId:'), 'New judgments must be private and omit owner identifiers'],
  [!resultPayload.includes('imageAttachmentMeta:'), 'Result documents must not copy private attachment metadata'],
  [generator.includes('const batch = db.batch()') && generator.includes('batch.update(caseRef') && generator.includes('await batch.commit()'), 'Judgment result and case status must commit atomically'],
  [generator.includes('buildCaseProfile') && generator.includes('evaluateStorySpecificity') && generator.includes('buildStoryFallback(profile)'), 'Case-specific generation and fallback are incomplete'],
  [judgment.includes('incidentLevel: cleanText') && judgment.includes('plaintiffClaim: cleanParagraph') && judgment.includes('defendantClaim: cleanParagraph'), 'Canonical judgment fields are incomplete'],
  [story.includes('진지함 55%') && story.includes('4개 단어 이상 연속된 표현을 복사하지 마라') && story.includes('copiedPhraseHits <= 7'), 'AI writing quality contracts are incomplete'],
  [daily.includes("resultVersion: 'judgment-v2'") && daily.includes('daily_generation_locks') && daily.includes('DAILY_LOCK_STALE_MS'), 'Daily AI locking or V2 schema is missing'],
  [social.includes('VOTE_DAILY_LIMIT') && social.includes('vote_limits') && social.includes('failAppealReservation'), 'Vote or appeal abuse protection is missing'],
  [reporting.includes('REPORT_DAILY_LIMIT') && reporting.includes('reportResult'), 'Secured reporting is missing'],
  [repair.includes('appeal_reservations') && repair.includes('scrubPublicResultIdentifiers'), 'Stale appeal recovery or public identifier scrub is missing'],
  [visibility.includes('resultUpdate.userId = FieldValue.delete()') && visibility.includes('appeal.verdict'), 'Publishing must scrub identifiers and inspect appeals'],
  [securityUtils.includes('validDocumentId') && securityUtils.includes('validatedProfilePhotoUrl') && securityUtils.includes('scope = \'global\''), 'Shared security helpers are incomplete'],
  [app.includes("result-case-story.js?v=20260717-security2") && app.includes("auth.js?v=20260717-security1"), 'App security cache keys are stale'],
  [index.includes('/js/app.js?v=20260717-security2'), 'Index security cache key is stale'],
  [home.includes('사건 접수부터 선고까지 6단계') && trial.includes('Number(data.schemaVersion) === 2') && trialGame.includes('THEATER_STAGES'), 'Main court journey integration is incomplete'],
  [result.includes("mode: 'script'") && resultWrapper.includes('setCaseVisibility') && resultWrapper.includes('reportResult'), 'Result compatibility or secured actions are incomplete'],
  [board.includes('r.judgment?.summary') && board.includes('r.judgment?.headline'), 'Board must read V2 summaries'],
  [systemCss.includes('html[data-theme="light"]') && readability.includes('.result-card:not(.emergency-briefing-card) p'), 'Unified readability styles are incomplete'],
  [storageWorkflow.includes('workflow_dispatch:') && !storageWorkflow.includes('\n  push:') && storageWorkflow.includes('firebase deploy --only storage'), 'Storage Rules deployment must remain manual and explicit'],
  [firebaseConfig.storage?.rules === 'storage.rules' && storageRules.includes('service firebase.storage'), 'Storage Rules configuration is invalid'],
  [headers['X-Content-Type-Options'] === 'nosniff' && headers['X-Frame-Options'] === 'DENY', 'Hosting security headers are missing'],
  [policy.includes("doc(db, 'public_settings', 'config')") && !policy.includes("doc(db, 'site_settings', 'config')"), 'Public policy must not read private settings'],
  [readme.includes('docs/DEPLOYMENT.md') && readme.includes('판결 V2 데이터 구조'), 'Deployment or V2 documentation is missing'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Deployment contract failed: ${message}`));
  process.exit(1);
}
console.log('Verified secure judgments, privacy-safe publishing and Firebase deployment contracts.');