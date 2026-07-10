const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('public/index.html');
const css = read('public/css/app.css');
const app = read('public/js/app.js');
const firebase = read('public/js/firebase.js');
const firebaseConfig = read('public/js/firebase-config.js');
const functions = read('functions/main.js');
const rules = read('firestore.rules');
const firebaseJson = JSON.parse(read('firebase.json'));

const checks = [
  [index.includes('/css/app.css?v=20260711-stage1'), 'Stage 1 stylesheet is not loaded'],
  [index.includes('/js/app.js?v=20260711-stage1'), 'Stage 1 application module is not loaded'],
  [css.includes('.hero-grid') && css.includes('.auth-layout') && css.includes('.form-card'), 'Core responsive UI styles are missing'],
  [app.includes('signInWithPopup') && app.includes('createUserWithEmailAndPassword'), 'Google and email authentication flows are incomplete'],
  [app.includes("httpsCallable(functions, 'createCaseDraft')"), 'Case form is not connected to the secure callable function'],
  [app.includes('caseDescription') || app.includes("name=\"description\""), 'Case description input is missing'],
  [app.includes('judgeType') && app.includes('grievanceIndex') && app.includes('desiredVerdict'), 'Required case judgment inputs are missing'],
  [firebase.includes("getFunctions(app, 'asia-northeast3')"), 'Functions region must remain asia-northeast3'],
  [firebaseConfig.includes("projectId: 'sosoking-481e6'"), 'Firebase project configuration is incorrect'],
  [functions.includes('exports.createCaseDraft') && functions.includes("status: 'received'"), 'Secure case draft creation is missing'],
  [functions.includes('DAILY_CASE_LIMIT') && functions.includes('CASE_COOLDOWN_MS'), 'Server-side abuse limits are missing'],
  [functions.includes("generationStatus: 'not_started'"), 'Stage 2 handoff state is missing'],
  [rules.includes('resource.data.userId == request.auth.uid'), 'Case documents must be readable only by their owner'],
  [rules.includes('allow create, update, delete: if false'), 'Client-side case writes must remain blocked'],
  [firebaseJson.hosting?.public === 'public' && firebaseJson.functions?.source === 'functions', 'Firebase source configuration is invalid'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Stage 1 verification failed: ${message}`));
  process.exit(1);
}

console.log('Verified Stage 1 home, authentication, secure case intake, responsive design and Firebase handoff.');
