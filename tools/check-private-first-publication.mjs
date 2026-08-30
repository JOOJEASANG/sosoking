import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const submitServer = read('functions/submit-secure.js');
for (const required of [
  'const requestedPublic = boolValue(data.isPublic, false);',
  'const isPublic = false;',
  'void requestedPublic;',
  '공개는 AI 판결문을 확인한 뒤 setResultVisibility에서만 허용한다.',
  'isPublic,'
]) {
  if (!submitServer.includes(required)) {
    errors.push(`functions/submit-secure.js: private-first submission guard missing ${required}`);
  }
}

const submitPage = read('public/js/pages/submit.js');
for (const required of [
  '새 사건은 항상 비공개로 시작합니다.',
  '비공개 생성 → 내 예상 판정 → AI 판결 공개',
  'await submitCase({ caseDescription: desc, isPublic: false });',
  '그 후 원하는 경우에만 공개 판결기록으로 전환할 수 있습니다.'
]) {
  if (!submitPage.includes(required)) {
    errors.push(`public/js/pages/submit.js: canonical private-first interface missing ${required}`);
  }
}
if (submitPage.includes('id="is-public"') || submitPage.includes("document.getElementById('is-public')")) {
  errors.push('public/js/pages/submit.js: submission-time public toggle must not return');
}

const app = read('public/js/app.js');
if (!app.includes("import { renderSubmit } from './pages/submit.js?v=20260830-final-audit-1';")) {
  errors.push('public/js/app.js: canonical private-first submit page is not active');
}
for (const retired of ['submit-guard.js', 'submit-court.js']) {
  if (app.includes(retired)) errors.push(`public/js/app.js: retired ${retired} remains active`);
}

const index = read('public/index.html');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion) {
  errors.push('public/index.html: versioned application entry is missing');
}

const worker = read('public/sw.js');
for (const required of [
  `/js/app.js?v=${appVersion}`,
  '/js/pages/submit.js?v=20260830-final-audit-1'
]) {
  if (!worker.includes(required)) {
    errors.push(`public/sw.js: private-first canonical cache graph missing ${required}`);
  }
}
for (const retired of ['submit-guard.js', 'submit-court.js']) {
  if (worker.includes(retired)) errors.push(`public/sw.js: retired ${retired} remains cached`);
}
if (!appVersion || !worker.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) {
  errors.push('public/index.html and public/sw.js: active application cache versions differ');
}

const ownerVerdict = read('functions/owner-verdict.js');
for (const required of [
  'exports.voteOwnVerdict',
  'ownerVerdictVote',
  "['plaintiff', 'defendant', 'both']"
]) {
  if (!ownerVerdict.includes(required)) {
    errors.push(`functions/owner-verdict.js: pre-verdict owner selection missing ${required}`);
  }
}

const resultPage = read('public/js/pages/result-comments.js');
for (const required of [
  'addOwnerBlindGate',
  "httpsCallable(functions, 'voteOwnVerdict')",
  '최초 선택만 기록되며 AI 판결을 본 뒤에는 바꿀 수 없습니다.',
  '이 선택은 공개 민심 집계와 별개입니다.'
]) {
  if (!resultPage.includes(required)) {
    errors.push(`public/js/pages/result-comments.js: owner verdict seal missing ${required}`);
  }
}

const trialGenerator = read('functions/generate-trial-lite.js') + read('functions/verdict-prompt.js');
for (const required of [
  'function buildPrompt(description, judge, grievanceIndex, retry = false)',
  "promptVersion: 'verdict-v2-permissive-comedy'",
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

console.log('Private-first publication validation passed: canonical submit stays private, owner predicts before reveal, and publication remains post-verdict only.');
