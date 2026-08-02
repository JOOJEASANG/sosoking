import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const page = read('public/js/pages/discussion.js');
for (const value of [
  "{ id: 'plaintiff', label: '원고측'",
  "{ id: 'defendant', label: '피고측'",
  "{ id: 'both', label: '쌍방'",
  "doc(db, 'results', caseId)",
  "doc(db, 'result_reactions', caseId)",
  'court_comments/${caseId}/items',
  "httpsCallable(functions, 'voteResult')",
  "httpsCallable(functions, 'addDiscussionComment')",
  '이전 방청석 기록'
]) need(page, value, 'discussion page');
if (page.includes("id: 'tooMuch'") || page.includes("id: 'funny'")) {
  errors.push('discussion page: more than the three approved choices are present');
}
if ((page.match(/\{ id: '(plaintiff|defendant|both)', label:/g) || []).length !== 3) {
  errors.push('discussion page: stance definition count is not exactly three');
}

const server = read('functions/discussion.js');
for (const value of [
  "const DISCUSSION_STANCES = ['plaintiff', 'defendant', 'both']",
  'exports.addDiscussionComment = onCall',
  'requireVerifiedUser(request)',
  'DISCUSSION_STANCES.includes(stance)',
  'inspectContent(text)',
  "court-discussion-comment",
  'court_comments/${caseId}/items',
  "kind: 'discussion'",
  'discussionVersion: 1',
  'isSanitizedPublicResult'
]) need(server, value, 'discussion server');

const result = read('public/js/pages/result-comments.js');
for (const value of ['addDiscussionLink', '#/discussion/', '이 판결로 토론하기']) {
  need(result, value, 'result discussion link');
}

const board = read('public/js/pages/board.js');
for (const value of ['discussionPath', '#/discussion/', 'data-discussion-record-link', '원고측·피고측·쌍방']) {
  need(board, value, 'board discussion link');
}

const app = read('public/js/app.js');
for (const value of ['renderDiscussion', "path.startsWith('/discussion/')", "hash.startsWith('#/discussion/')"]) {
  need(app, value, 'discussion route');
}

const main = read('functions/main.js');
need(main, "require('./discussion')", 'function export');

const deploy = read('.github/workflows/firebase-deploy.yml');
need(deploy, 'functions:addDiscussionComment', 'function deployment');

const firebaseText = read('firebase.json');
const firebase = JSON.parse(firebaseText);
const hasDiscussionRewrite = firebase.hosting?.rewrites?.some(item => (
  item.source === '/discussion/**' && item.destination === '/index.html'
));
if (!hasDiscussionRewrite) errors.push('discussion rewrite: /discussion/** to /index.html is missing');
need(firebaseText, '/@(result|trial|discussion)/**', 'discussion CSP');

const rules = read('firestore.rules');
need(rules, 'match /court_comments/{caseId}/items/{commentId}', 'legacy comment compatibility');

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('discussion cache: active application versions differ');
}
for (const value of [
  '/js/pages/discussion.js?v=20260730-discussion-court-1',
  '/js/pages/result-comments.js?v=20260730-discussion-court-1',
  '/js/pages/board.js?v=20260730-discussion-court-1'
]) need(worker, value, 'discussion cache');

if (errors.length) {
  console.error(`Discussion court validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Discussion court validation passed: three choices, legacy data compatibility, protected participation, routes, deployment, and cache wiring.');
