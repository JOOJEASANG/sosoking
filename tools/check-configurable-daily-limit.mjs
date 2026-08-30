import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const submitServer = read('functions/submit-secure.js');
for (const required of [
  'const DEFAULT_DAILY_LIMIT = 3;',
  'const dailyLimitEnabled = settings.dailyLimitEnabled === true;',
  'clampNumber(settings.dailyLimit, DEFAULT_DAILY_LIMIT, 1, 1000)',
  'if (dailyLimitEnabled && count >= dailyLimit)',
  'count: dailyLimitEnabled ? count + 1 : 0',
  'dailyLimit: dailyLimitEnabled ? dailyLimit : 0'
]) {
  if (!submitServer.includes(required)) errors.push(`functions/submit-secure.js: configurable limit behavior missing ${required}`);
}
if (submitServer.includes('clampNumber(settings.dailyLimit, DEFAULT_DAILY_LIMIT, 1, 1)')) {
  errors.push('functions/submit-secure.js: daily limit is still hard-clamped to one');
}

const sync = read('tools/sync-public-config.mjs');
for (const required of [
  'const dailyLimitEnabled = data.dailyLimitEnabled === true;',
  'numberInRange(data.dailyLimit, 3, 1, 1000)',
  "fields: ['dailyLimitEnabled', 'dailyLimit', 'cooldownSec', 'businessInfo']",
  'dailyLimitEnabled,'
]) {
  if (!sync.includes(required)) errors.push(`tools/sync-public-config.mjs: deployment-safe limit sync missing ${required}`);
}
if (sync.includes('const dailyLimit = 1;')) {
  errors.push('tools/sync-public-config.mjs: deployment still forces the limit back to one');
}

const submitPage = read('public/js/pages/submit.js');
for (const required of [
  'dailyLimitEnabled: data.dailyLimitEnabled === true',
  "return { dailyLimitEnabled: false, dailyLimit: DEFAULT_DAILY_LIMIT, cooldownSec: 45 }",
  'function submissionLimitText(settings)',
  '현재 제한 없음',
  '재접수 대기:'
]) {
  if (!submitPage.includes(required)) errors.push(`public/js/pages/submit.js: public limit display missing ${required}`);
}

const adminLimit = read('public/admin/admin-daily-limit.js');
for (const required of [
  '회원별 일일 사건 접수 제한 사용',
  '끄면 제한 없이 계속 테스트할 수 있습니다.',
  'dailyLimitEnabled,',
  'dailyLimit,',
  '연속 테스트가 필요하면 재접수 대기시간도 0초로 저장하세요.',
  "setDoc(doc(db, 'site_settings', 'config')",
  "setDoc(doc(db, 'site_public', 'config')"
]) {
  if (!adminLimit.includes(required)) errors.push(`public/admin/admin-daily-limit.js: administrator control missing ${required}`);
}

const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('/admin/admin-daily-limit.js?v=20260730-configurable-limit-1')) {
  errors.push('public/admin/index.html: configurable limit helper is not loaded');
}

const home = read('public/js/pages/home.js');
for (const required of [
  'async function loadPublicSettings(container)',
  'settings.dailyLimitEnabled === true',
  '현재 사건 접수 제한 없음',
  'loadPublicSettings(container)'
]) {
  if (!home.includes(required)) errors.push(`public/js/pages/home.js: active limit status missing ${required}`);
}

const guide = read('public/js/pages/guide.js');
if (!guide.includes('운영자는 테스트·비용·안전 상황에 따라 제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.')) {
  errors.push('public/js/pages/guide.js: configurable limit guidance is missing');
}
if (guide.includes('회원당 하루 1회입니다.')) {
  errors.push('public/js/pages/guide.js: fixed one-per-day claim remains');
}

const policy = read('public/js/pages/policy.js');
if (!policy.includes('접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따르며')) {
  errors.push('public/js/pages/policy.js: configurable terms copy is missing');
}

const app = read('public/js/app.js');
for (const required of [
  "import { renderHome } from './pages/home.js?v=20260830-final-audit-1';",
  "import { renderSubmit } from './pages/submit.js?v=20260830-final-audit-1';",
  "import { renderPolicy } from './pages/policy.js?v=20260830-final-audit-1';",
  "import { renderGuide } from './pages/guide.js?v=20260830-final-audit-1';"
]) {
  if (!app.includes(required)) errors.push(`public/js/app.js: canonical configurable-limit module missing ${required}`);
}

const index = read('public/index.html');
const worker = read('public/sw.js');
for (const required of [
  '/js/pages/home.js?v=20260830-final-audit-1',
  '/js/pages/submit.js?v=20260830-final-audit-1',
  '/js/pages/policy.js?v=20260830-final-audit-1',
  '/js/pages/guide.js?v=20260830-final-audit-1'
]) {
  if (!worker.includes(required)) errors.push(`public/sw.js: canonical configurable-limit cache entry missing ${required}`);
}
for (const retired of ['home-court.js', 'submit-guard.js', 'policy-configurable-limit.js']) {
  if (app.includes(retired) || worker.includes(retired)) {
    errors.push(`active app/cache graph still references retired ${retired}`);
  }
}
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active application cache versions differ');
}
if (!/^const CACHE_NAME = 'sosoking-app-v[^']+';/m.test(worker)) {
  errors.push('public/sw.js: a versioned application cache name is missing');
}

if (errors.length) {
  console.error(`Configurable daily limit validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Configurable daily limit validation passed: backend enforcement, administrator controls, canonical public copy, and active cache graph are connected.');
