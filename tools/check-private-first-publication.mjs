import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const submitServer = read('functions/submit-secure.js');
for (const required of [
  'const isPublic = false;',
  '공개는 AI 판결문을 확인한 뒤 setResultVisibility에서만 허용한다.',
  'isPublic,'
]) {
  if (!submitServer.includes(required)) {
    errors.push(`functions/submit-secure.js: private-first submission guard missing ${required}`);
  }
}
if (submitServer.includes('const isPublic = boolValue(data.isPublic, false);')) {
  errors.push('functions/submit-secure.js: client input can still publish a case during submission');
}

const submitPage = read('public/js/pages/submit.js');
for (const required of [
  'id="is-public"',
  "const isPublic = document.getElementById('is-public').checked;",
  'await submitCase({ caseDescription: desc, isPublic });'
]) {
  if (!submitPage.includes(required)) {
    errors.push(`public/js/pages/submit.js: existing submission contract changed unexpectedly ${required}`);
  }
}

const submitCourt = read('public/js/pages/submit-court.js');
for (const required of [
  'function enforcePrivateFirstSubmission(container)',
  '<input type="checkbox" id="is-public" hidden disabled aria-hidden="true">',
  '판결문은 먼저 비공개로 생성됩니다',
  '이미 생성된 AI 판결문은 다시 작성하거나 손상시키지 않습니다.',
  'enforcePrivateFirstSubmission(container);'
]) {
  if (!submitCourt.includes(required)) {
    errors.push(`public/js/pages/submit-court.js: private-first interface missing ${required}`);
  }
}

const submitGuard = read('public/js/pages/submit-guard.js');
if (!submitGuard.includes("./submit-court.js?v=20260731-private-first-publication-1")) {
  errors.push('public/js/pages/submit-guard.js: private-first submit wrapper is not active');
}

const app = read('public/js/app.js');
if (!app.includes("./pages/submit-guard.js?v=20260731-private-first-publication-1")) {
  errors.push('public/js/app.js: private-first submit guard is not active');
}

const index = read('public/index.html');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (appVersion !== '20260731-private-first-publication-1') {
  errors.push('public/index.html: private-first application version is not active');
}

const worker = read('public/sw.js');
for (const required of [
  "const CACHE_NAME = 'sosoking-app-v20260731-private-first-publication-1';",
  '/js/app.js?v=20260731-private-first-publication-1',
  '/js/pages/submit-guard.js?v=20260731-private-first-publication-1',
  '/js/pages/submit-court.js?v=20260731-private-first-publication-1'
]) {
  if (!worker.includes(required)) {
    errors.push(`public/sw.js: private-first cache graph missing ${required}`);
  }
}

const trialGenerator = read('functions/generate-trial-lite.js');
for (const required of [
  'function buildPrompt(description, judge, grievanceIndex, retry = false)',
  "promptVersion: 'simple-document-v1.5-accounting-safety'",
  'reception:',
  'investigation:',
  'plaintiffArg:',
  'defendantArg:',
  'verdict:'
]) {
  if (!trialGenerator.includes(required)) {
    errors.push(`functions/generate-trial-lite.js: AI result contract missing ${required}`);
  }
}

if (errors.length) {
  console.error(`Private-first publication validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Private-first publication validation passed: cases stay private through AI generation and can be published only after result review.');
