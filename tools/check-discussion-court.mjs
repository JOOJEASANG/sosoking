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
  '최초 선택은 기록 후 변경할 수 없습니다.',
  'response.data?.alreadyVoted === true',
  '이전 방청석 기록'
]) need(page, value, 'discussion page');
if (page.includes('선택은 다시 변경할 수 있습니다.')) {
  errors.push('discussion page: obsolete mutable-vote copy remains');
}
if (page.includes("id: 'tooMuch'") || page.includes("id: 'funny'")) {
  errors.push('discussion page: more than the three approved choices are present');
}
if ((page.match(/\{ id: '(plaintiff|defendant|both)', label:/g) || []).length !== 3) {
  errors.push('discussion page: stance definition count is not exactly three');
}

const social = read('functions/social.js');
need(social, "const REACTIONS = ['plaintiff','defendant','both']", 'jury vote server');
need(social, 'if (REACTIONS.includes(previousRaw))', 'jury vote server');
need(social, 'alreadyVoted = true', 'jury vote server');

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
  'isSanitizedPublicResult',
  'assertDiscussionWritable',
  'db.runTransaction',
  'tx.update(resultRef'
]) need(server, value, 'discussion server');

const result = read('public/js/pages/result-comments.js');
for (const value of ['addDiscussionLink', '#/discussion/', '이 판결로 토론하기']) {
  need(result, value, 'result discussion link');
}

const jury = read('public/js/pages/jury.js');
for (const value of ['jury-debate', 'addDiscussionComment', 'court_comments']) {
  need(jury, value, 'jury inline debate');
}

const app = read('public/js/app.js');
for (const value of ['renderDiscussion', "path.startsWith('/discussion/')", "hash.startsWith('#/discussion/')", "./pages/discussion.js?v=20260830-final-blind-1"]) {
  need(app, value, 'discussion route');
}
if (app.includes("from './pages/board")) {
  errors.push('discussion route: retired board module remains imported');
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
  '/js/pages/discussion.js?v=20260830-final-blind-1',
  '/js/pages/result-comments.js?v=20260830-final-audit-1',
  '/js/pages/jury.js?v=20260901-daily-vote-feedback-1'
]) need(worker, value, 'discussion cache');
if (worker.includes('/js/pages/board.js')) {
  errors.push('discussion cache: retired board page is still cached');
}

if (errors.length) {
  console.error(`Discussion court validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Discussion court validation passed: immutable three-way choices, transactional deletion safety, inline jury debate, routes, deployment, and canonical cache wiring.');
