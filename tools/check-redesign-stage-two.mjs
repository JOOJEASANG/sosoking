import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const need = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${text}`);
};

const css = read('public/css/redesign-stage-two.css');
for (const text of [
  '.submit-redesign-shell',
  '.submit-intro',
  '.submit-document-flow',
  '.submit-public-card',
  '.trial-redesign-host',
  '#docket-timeline',
  'grid-template-columns: 1fr !important',
  '#loading-area',
  '@media (max-width: 430px)'
]) need(css, text, 'stage two stylesheet');

const submitCourt = read('public/js/pages/submit-court.js');
for (const text of [
  "./submit.js?v=20260730-configurable-limit-1",
  'const FLOW_LABELS',
  "shell.classList.add('submit-redesign-shell')",
  "page.classList.add('submit-page')",
  "intro.classList.add('submit-intro')",
  "flowCard?.classList.add('submit-flow-card')",
  "classList.add('submit-public-card')",
  'await renderBaseSubmit(container)'
]) need(submitCourt, text, 'submission decorator');

const guard = read('public/js/pages/submit-guard.js');
for (const text of [
  "./submit-court.js?v=20260730-redesign-stage-2",
  "container.firstElementChild?.classList.add('submit-redesign-shell')",
  'await renderSubmitForm(container)'
]) need(guard, text, 'submission guard');

const trial = read('public/js/pages/trial-game.js');
for (const text of [
  "./trial.js?v=20260729-dark-record-participation-1",
  "container.classList.add('trial-redesign-host')",
  'await renderBaseTrial(container, caseId)'
]) need(trial, text, 'processing decorator');

const app = read('public/js/app.js');
for (const text of [
  "./pages/submit-guard.js?v=20260730-redesign-stage-2",
  "./pages/trial-game.js?v=20260730-redesign-stage-2"
]) need(app, text, 'application');

const index = read('public/index.html');
const worker = read('public/sw.js');
need(index, '/css/redesign-stage-two.css?v=20260730-redesign-stage-2', 'index');
need(worker, '/css/redesign-stage-two.css?v=20260730-redesign-stage-2', 'service worker');
for (const text of [
  '/js/pages/submit-guard.js?v=20260730-redesign-stage-2',
  '/js/pages/submit-court.js?v=20260730-redesign-stage-2',
  '/js/pages/trial-game.js?v=20260730-redesign-stage-2'
]) need(worker, text, 'service worker');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('index and service worker active app versions differ');
}
need(worker, "const CACHE_NAME = 'sosoking-app-v", 'service worker');

const packageJson = read('package.json');
need(packageJson, 'node tools/check-redesign-stage-two.mjs', 'validation chain');

if (errors.length) {
  console.error(`Stage two redesign validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Stage two redesign validation passed: submission, login guard, processing timeline, responsive layout, and cache wiring remain connected.');
