const fs = require('node:fs');
const path = require('node:path');

const read = value => fs.readFileSync(path.resolve(__dirname, value), 'utf8');
const coreWorkflow = read('../.github/workflows/firebase-deploy.yml');
const storageWorkflow = read('../.github/workflows/firebase-storage-rules.yml');
const firebaseConfig = JSON.parse(read('../firebase.json'));
const storageRules = read('../storage.rules');
const main = read('./main.js');
const generator = read('./generate-trial-ai-first.js');
const engine = read('./ai-judgment-engine.js');
const app = read('../public/js/app.js');
const index = read('../public/index.html');
const resultAI = read('../public/js/pages/result-ai-first.js');
const visibility = read('./visibility.js');
const security = read('./security-utils.js');

const functionIndex = coreWorkflow.indexOf('Deploy Functions from current source');
const firestoreIndex = coreWorkflow.indexOf('Deploy Firestore rules and indexes');
const hostingIndex = coreWorkflow.indexOf('Deploy Hosting');
const headers = Object.fromEntries((firebaseConfig.hosting?.headers?.find(item => item.source === '**')?.headers || []).map(item => [item.key, item.value]));
const checks = [
  [functionIndex >= 0 && firestoreIndex > functionIndex && hostingIndex > firestoreIndex, 'Core deploy order is invalid'],
  [coreWorkflow.includes('firebase deploy --only functions --force') && !coreWorkflow.includes('continue-on-error'), 'Functions deployment must fail visibly'],
  [coreWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6'), 'Deployment credential reference is missing'],
  [main.includes("require('./generate-trial-ai-first')") && !main.includes("require('./generate-trial-v2')"), 'Only the AI-first generateTrial function may be exported'],
  [generator.includes('generateAIJudgment') && generator.includes('buildStoryPrompt(profile)'), 'Case-specific AI generation is missing'],
  [generator.includes('completeAIResult') && generator.includes('local fallback was not saved'), 'Local fallback results must be regeneratable and AI failures visible'],
  [generator.includes('batch.set(resultRef, {') && generator.includes('batch.update(caseRef') && generator.includes('await batch.commit()'), 'Result and case completion must commit atomically'],
  [generator.includes('isPublic: false') && generator.includes('aiGenerated: true') && !generator.includes('ownerId:'), 'Generated AI results must be private and omit owner identifiers'],
  [engine.includes('bestCandidate') && engine.includes('qualityPassed: false') && !engine.includes('buildStoryFallback'), 'Strict quality retries must preserve the best complete AI result'],
  [app.includes('result-ai-first.js?v=20260717-ai1') && index.includes('/js/app.js?v=20260717-ai1'), 'AI-first frontend cache keys are stale'],
  [resultAI.includes('Gemini AI 개별 판결') && resultAI.includes('Gemini AI로 다시 판결받기'), 'AI source disclosure or regeneration is missing'],
  [visibility.includes('resultUpdate.userId = FieldValue.delete()') && visibility.includes('appeal.verdict'), 'Publishing privacy checks are incomplete'],
  [security.includes('validDocumentId') && security.includes('validatedProfilePhotoUrl'), 'Shared security helpers are incomplete'],
  [storageWorkflow.includes('workflow_dispatch:') && !storageWorkflow.includes('\n  push:') && storageWorkflow.includes('firebase deploy --only storage'), 'Storage rules deployment must remain manual'],
  [firebaseConfig.storage?.rules === 'storage.rules' && storageRules.includes('service firebase.storage'), 'Storage rules configuration is invalid'],
  [headers['X-Content-Type-Options'] === 'nosniff' && headers['X-Frame-Options'] === 'DENY', 'Hosting security headers are missing'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Deployment contract failed: ${message}`));
  process.exit(1);
}
console.log('Verified AI-first generation and secure Firebase deployment contracts.');
