const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('public/index.html');
const app = read('public/js/app.js');
const ui = read('public/js/judgment-ui.js');
const engineIntegration = read('public/js/result-engine-integration.js');
const css = read('public/css/app.css');
const roleCss = read('public/css/role-trial.css');
const rules = read('firestore.rules');
const functions = read('functions/main.js');
const publicProjection = read('functions/public-result-projection.js');

const checks = [
  [index.includes('/css/app.css?v=20260711-stage3'), 'Stage 3 stylesheet cache key is missing'],
  [index.includes('/css/role-trial.css?v=20260711-rolev10'), 'Role trial stylesheet is not loaded'],
  [index.includes('/js/app.js?v=20260711-stage3'), 'Stage 3 app cache key is missing'],
  [index.includes('/js/result-engine-integration.js?v=20260711-r4'), 'Result regeneration cache key is missing'],
  [app.includes("from './judgment-ui.js'"), 'Judgment UI module is not connected'],
  [app.includes("section === 'trial'") && app.includes("section === 'result'"), 'Dynamic trial and result routes are missing'],
  [app.includes('AI 재판 시작') && app.includes('#/trial/'), 'Case receipt does not continue into the trial'],
  [app.includes('loadJudgmentResult') && app.includes('resultPageHtml'), 'Result loading flow is incomplete'],
  [ui.includes("httpsCallable(functions, 'generateJudgment')"), 'Trial screen is not connected to judgment generation'],
  [ui.includes('사건 접수조서 개봉') && ui.includes('가상 CCTV·증거 감식') && ui.includes('검사·변호인 공방'), 'Role-based trial stages are incomplete'],
  [ui.includes('사건 담당자') && ui.includes('수사 진행기록') && ui.includes('CCTV·증거 감식보고서'), 'Role-based result records are incomplete'],
  [ui.includes('원고 측 주장') && ui.includes('피고 측 변론') && ui.includes('재판부 판단'), 'Courtroom argument and opinion sections are incomplete'],
  [ui.includes('가상 감식 주의') && ui.includes('실제 확인 결과가 아닙니다'), 'Fictional evidence notice is missing'],
  [engineIntegration.includes("const ROLE_TRIAL_VERSION = 'role-based-trial-v10'") && engineIntegration.includes("const ROLE_TRIAL_REVISION = 'role-trial-r4-20260711'"), 'Role trial revision detection is incomplete'],
  [engineIntegration.includes('현재 엔진으로 다시 판결받기') && engineIntegration.includes(`href="#/trial/`), 'Stale result regeneration action is missing'],
  [engineIntegration.includes("import { resultPageHtml, bindResultActions } from './judgment-ui.js'") && engineIntegration.includes('replaceStaleOwnerResult'), 'Private owner result does not replace a stale public projection'],
  [engineIntegration.includes("page.innerHTML = resultPageHtml(result)") && engineIntegration.includes('result.ownerView'), 'Latest private role trial is not rendered for the owner'],
  [functions.includes("const ROLE_TRIAL_REVISION = 'role-trial-r4-20260711'") && functions.includes('function isReusableResult'), 'Backend generation revision contract is missing'],
  [functions.includes('resultData.generationRevision === ROLE_TRIAL_REVISION') && functions.includes('quality?.passed !== false'), 'Stale or failed results can still be reused'],
  [functions.includes('generationRevision: ROLE_TRIAL_REVISION') && publicProjection.includes('generationRevision: source.generationRevision'), 'Generation revision is not stored or projected'],
  [ui.includes('navigator.share') && ui.includes('navigator.clipboard.writeText'), 'Link sharing is incomplete'],
  [ui.includes("canvas.toDataURL('image/png')") && ui.includes('download-result-image'), 'Judgment image download is missing'],
  [css.includes('.trial-stage-list') && css.includes('.judgment-cover') && css.includes('.order-list'), 'Base trial styling is incomplete'],
  [roleCss.includes('.role-docket-cover') && roleCss.includes('.role-evidence-grid') && roleCss.includes('.role-argument-grid') && roleCss.includes('.role-sentence-section'), 'Role trial styling is incomplete'],
  [roleCss.includes('@media(max-width:680px)'), 'Mobile role trial layout is incomplete'],
  [rules.includes('match /results/{caseId}') && rules.includes('resource.data.userId == request.auth.uid') && rules.includes('match /public_results/{caseId}') && rules.includes('allow read: if true'), 'Separated public and private result read rules are incomplete'],
  [rules.includes('allow create, update, delete: if false'), 'Client writes must remain blocked'],
  [functions.includes("resultVersion: ROLE_TRIAL_VERSION") && functions.includes('trialRecord: trial') && functions.includes("generationStatus: 'completed'"), 'Generated role trial result is not stored completely'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Stage 3 verification failed: ${message}`));
  process.exit(1);
}

console.log('Verified Stage 3 stale-v10 invalidation, role-based investigation, owner refresh, regeneration, fictional CCTV notice and mobile layout.');
