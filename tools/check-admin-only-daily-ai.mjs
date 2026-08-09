import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const daily = read('functions/daily.js');
for (const forbidden of [
  "firebase-functions/v2/scheduler",
  'onSchedule(',
  'exports.createDailyAiCase',
  "schedule: '0 9 * * *'"
]) {
  if (daily.includes(forbidden)) {
    errors.push(`functions/daily.js: automatic AI trigger remains: ${forbidden}`);
  }
}
for (const required of [
  'exports.generateDailyAiNow = onCall',
  'requireVerifiedUser(request)',
  'isAdminAuth(request.auth)',
  'return await createDailyAiCase(true);',
  '관리자 화면의 버튼이 호출하는 이 함수로만 실행한다.'
]) {
  if (!daily.includes(required)) {
    errors.push(`functions/daily.js: administrator-only generation guard missing: ${required}`);
  }
}

for (const required of [
  'const RESPONSE_SCHEMA = {',
  'function buildPrompt(dateKey, judge, settings = {})',
  'function normalizeDailyContent(ai, dateKey, judge)',
  'function moderateDailyContent(data, dateKey, judge, settings = {})',
  "promptVersion: 'daily-document-v4-judge-personas'",
  "type: '꼰대형'",
  "type: '냉혈형'",
  "type: '회피형'",
  "type: '추궁형'",
  "type: '오버형'",
  "type: '드립형'",
  "type: '빙의형'",
  'reception:',
  'investigation:',
  'plaintiffArg:',
  'defendantArg:',
  'verdict:',
  'sentence:'
]) {
  if (!daily.includes(required)) {
    errors.push(`functions/daily.js: current AI result contract changed unexpectedly: ${required}`);
  }
}

const deploy = read('.github/workflows/firebase-deploy.yml');
if (deploy.includes('functions:createDailyAiCase')) {
  errors.push('.github/workflows/firebase-deploy.yml: obsolete automatic AI function is still deployed');
}
for (const required of [
  'functions:generateDailyAiNow',
  'Remove known obsolete Functions',
  'firebase functions:list --project sosoking-481e6 --json',
  'node tools/list-obsolete-deployed-functions.mjs',
  'firebase functions:delete'
]) {
  if (!deploy.includes(required)) {
    errors.push(`.github/workflows/firebase-deploy.yml: automatic schedule cleanup is incomplete: ${required}`);
  }
}

const obsoleteCleanup = read('tools/list-obsolete-deployed-functions.mjs');
for (const required of [
  "'createDailyAiCase'",
  'KNOWN_OBSOLETE_FUNCTIONS',
  'Unknown unmanaged Functions require review'
]) {
  if (!obsoleteCleanup.includes(required)) {
    errors.push(`tools/list-obsolete-deployed-functions.mjs: automatic schedule cleanup guard missing: ${required}`);
  }
}

const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('/admin/admin-manual-ai-mode.js?v=20260731-admin-only-ai-1')) {
  errors.push('public/admin/index.html: administrator-only AI interface guard is not loaded');
}

const adminMode = read('public/admin/admin-manual-ai-mode.js');
for (const required of [
  "root.querySelector('#dailyOn')",
  'dailyToggle.checked = false;',
  'dailyToggle.disabled = true;',
  '관리자 수동 AI 사건 생성',
  '자동 예약 없음 · 관리자 버튼으로만 생성',
  '관리자가 생성 버튼을 누른 경우에만 AI 사건이 생성됩니다.'
]) {
  if (!adminMode.includes(required)) {
    errors.push(`public/admin/admin-manual-ai-mode.js: manual generation interface missing: ${required}`);
  }
}

const admin = read('public/admin/admin.js');
for (const required of [
  "generateDaily: httpsCallable(functions, 'generateDailyAiNow')",
  "target.querySelector('#generate-daily-now')",
  "await callables.generateDaily({})"
]) {
  if (!admin.includes(required)) {
    errors.push(`public/admin/admin.js: administrator generation button path missing: ${required}`);
  }
}

if (errors.length) {
  console.error(`Administrator-only daily AI validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Administrator-only daily AI validation passed: scheduled generation stays removed, current seven-judge generation is enforced, reviewed obsolete cleanup covers the old trigger, and the result contract remains intact.');