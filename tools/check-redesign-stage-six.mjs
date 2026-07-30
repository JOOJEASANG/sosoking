import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const need = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${text}`);
};

const css = read('public/css/redesign-stage-six.css');
for (const text of [
  '.auth-redesign-host',
  '.auth-card',
  '.guide-redesign-host',
  '.guide-section',
  '.guide-faq-card',
  '.policy-redesign-host',
  ':focus-visible',
  '@media(max-width:580px)',
  '@media(prefers-reduced-motion:reduce)'
]) need(css, text, 'stage six stylesheet');

const authWrapper = read('public/js/pages/auth-redesign.js');
for (const text of [
  "./auth2.js?v=20260729-brand-unified-1",
  "container.classList.add('auth-redesign-host')",
  'await renderBaseAuth(container)'
]) need(authWrapper, text, 'account wrapper');

const policyWrapper = read('public/js/pages/policy-redesign.js');
for (const text of [
  "./policy-configurable-limit.js?v=20260730-redesign-stage-6",
  "container.classList.add('policy-redesign-host')",
  'await renderBasePolicy(container, type)'
]) need(policyWrapper, text, 'policy wrapper');

const guide = read('public/js/pages/guide.js');
for (const text of [
  "container.classList.add('guide-redesign-host')",
  '매일 판례 3건',
  '일간·주간·누적 랭킹',
  'guide-faq-card'
]) need(guide, text, 'guide');
if (guide.includes('매일 한 사건이 제공')) {
  errors.push('guide: obsolete one-case daily court copy remains');
}

const policy = read('public/js/pages/policy-configurable-limit.js');
for (const text of [
  'const OLD_DAILY_COPY',
  'const NEW_DAILY_COPY',
  'const NEW_DAILY_VOTE_COPY',
  'replaceCurrentPolicyCopy',
  '매일 실제 판례 3건',
  '일간·주간·누적 점수와 랭킹'
]) need(policy, text, 'policy compatibility');

const app = read('public/js/app.js');
for (const text of [
  "./pages/auth-redesign.js?v=20260730-redesign-stage-6",
  "./pages/guide.js?v=20260730-redesign-stage-6",
  "./pages/policy-redesign.js?v=20260730-redesign-stage-6"
]) need(app, text, 'application');

const index = read('public/index.html');
const worker = read('public/sw.js');
for (const text of [
  '/css/redesign-stage-six.css?v=20260730-redesign-stage-6',
  '/js/app.js?v=20260730-redesign-stage-6'
]) {
  need(index, text, 'index');
  need(worker, text, 'service worker');
}
for (const text of [
  "const CACHE_NAME = 'sosoking-app-v20260730-redesign-stage-6';",
  '/js/pages/auth-redesign.js?v=20260730-redesign-stage-6',
  '/js/pages/auth2.js?v=20260729-brand-unified-1',
  '/js/pages/guide.js?v=20260730-redesign-stage-6',
  '/js/pages/guide.js?v=20260730-configurable-limit-1',
  '/js/pages/policy-redesign.js?v=20260730-redesign-stage-6',
  '/js/pages/policy-configurable-limit.js?v=20260730-redesign-stage-6',
  '/js/pages/policy-configurable-limit.js?v=20260730-configurable-limit-1',
  '/js/pages/policy.js?v=20260729-brand-policy-1'
]) need(worker, text, 'service worker');

const packageJson = read('package.json');
need(packageJson, 'node tools/check-redesign-stage-six.mjs', 'validation chain');

if (errors.length) {
  console.error(`Stage six redesign validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Stage six redesign validation passed: account, guide, policy copy, accessibility, responsive polish, and cache compatibility are connected.');
