import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const need = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${text}`);
};

const css = read('public/css/redesign-stage-four.css');
for (const text of [
  '.discussion-redesign-host',
  '.discussion-summary',
  '.discussion-choice-grid',
  '[data-discussion-stance="plaintiff"]',
  '[data-discussion-stance="defendant"]',
  '[data-discussion-stance="both"]',
  '#discussion-comment-input',
  '#discussion-comments',
  '@media(max-width:580px)'
]) need(css, text, 'stage four stylesheet');

const wrapper = read('public/js/pages/discussion-redesign.js');
for (const text of [
  "./discussion.js?v=20260730-discussion-court-1",
  "container.classList.add('discussion-redesign-host')",
  'await renderBaseDiscussion(container, caseId)'
]) need(wrapper, text, 'discussion wrapper');

const discussion = read('public/js/pages/discussion.js');
for (const text of [
  "{ id: 'plaintiff', label: '원고측'",
  "{ id: 'defendant', label: '피고측'",
  "{ id: 'both', label: '쌍방'",
  "httpsCallable(functions, 'voteResult')",
  "httpsCallable(functions, 'addDiscussionComment')",
  'participantReady()',
  'isPublicResult(data.result)'
]) need(discussion, text, 'discussion behavior');

const app = read('public/js/app.js');
need(app, "./pages/discussion-redesign.js?v=20260730-redesign-stage-4", 'application');

const index = read('public/index.html');
const worker = read('public/sw.js');
need(index, '/css/redesign-stage-four.css?v=20260730-redesign-stage-4', 'index');
need(worker, '/css/redesign-stage-four.css?v=20260730-redesign-stage-4', 'service worker');
for (const text of [
  '/js/pages/discussion-redesign.js?v=20260730-redesign-stage-4',
  '/js/pages/discussion.js?v=20260730-discussion-court-1'
]) need(worker, text, 'service worker');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('index and service worker active app versions differ');
}
need(worker, "const CACHE_NAME = 'sosoking-app-v", 'service worker');

const packageJson = read('package.json');
need(packageJson, 'node tools/check-redesign-stage-four.mjs', 'validation chain');

if (errors.length) {
  console.error(`Stage four redesign validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Stage four redesign validation passed: three stances, protected voting, comment submission, public-record gating, responsive layout, and cache compatibility remain connected.');
