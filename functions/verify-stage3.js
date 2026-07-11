const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('public/index.html');
const app = read('public/js/app.js');
const ui = read('public/js/judgment-ui.js');
const css = read('public/css/app.css');
const rules = read('firestore.rules');
const functions = read('functions/main.js');

const checks = [
  [index.includes('/css/app.css?v=20260711-stage3'), 'Stage 3 stylesheet cache key is missing'],
  [index.includes('/js/app.js?v=20260711-stage3'), 'Stage 3 app cache key is missing'],
  [app.includes("from './judgment-ui.js'"), 'Judgment UI module is not connected'],
  [app.includes("section === 'trial'") && app.includes("section === 'result'"), 'Dynamic trial and result routes are missing'],
  [app.includes('AI 재판 시작') && app.includes('#/trial/'), 'Case receipt does not continue into the trial'],
  [app.includes('loadJudgmentResult') && app.includes('resultPageHtml'), 'Result loading flow is incomplete'],
  [ui.includes("httpsCallable(functions, 'generateJudgment')"), 'Trial screen is not connected to judgment generation'],
  [ui.includes('TRIAL_STAGES') && ui.includes('사건 핵심 추출') && ui.includes('코미디 감식'), 'Staged trial presentation is incomplete'],
  [ui.includes('결정적 한마디') && ui.includes('법정공방') && ui.includes('재판부 최종 판단'), 'Result screen sections are incomplete'],
  [ui.includes('navigator.share') && ui.includes('navigator.clipboard.writeText'), 'Link sharing is incomplete'],
  [ui.includes("canvas.toDataURL('image/png')") && ui.includes('download-result-image'), 'Judgment image download is missing'],
  [css.includes('.trial-stage-list') && css.includes('.judgment-cover') && css.includes('.order-list'), 'Trial and judgment styling is incomplete'],
  [css.includes('@media(max-width:719px)') && css.includes('.share-actions'), 'Mobile result layout is incomplete'],
  [rules.includes('match /results/{caseId}') && rules.includes('resource.data.userId == request.auth.uid') && rules.includes('match /public_results/{caseId}') && rules.includes('allow read: if true'), 'Separated public and private result read rules are incomplete'],
  [rules.includes('allow create, update, delete: if false'), 'Client writes must remain blocked'],
  [functions.includes('isPublic: caseData.isPublic === true') && functions.includes("generationStatus: 'completed'"), 'Generated result does not preserve visibility and completion state'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Stage 3 verification failed: ${message}`));
  process.exit(1);
}

console.log('Verified Stage 3 trial presentation, judgment result, separated public/private access, link sharing and PNG export.');
