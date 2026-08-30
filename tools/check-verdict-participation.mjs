import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => { if (!condition) errors.push(message); };

const app = read('public/js/app.js');
const board = read('public/js/pages/board.js');
const result = read('public/js/pages/result.js');
const resultComments = read('public/js/pages/result-comments.js');
const resultCourt = read('public/js/pages/result-court.js');
const trial = read('public/js/pages/trial.js');
const myCases = read('public/js/pages/my-cases.js');
const ownerVerdict = read('functions/owner-verdict.js');
const functionsMain = read('functions/main.js');
const deployWorkflow = read('.github/workflows/firebase-deploy.yml');
const index = read('public/index.html');
const sw = read('public/sw.js');

expect(app.includes("hash.startsWith('#/result/')") && app.includes('renderResult(content'),
  'public/js/app.js: public result hash must render the full verdict page');
expect(app.includes("hash.startsWith('#/verdict/')") && app.includes('renderResult(content'),
  'public/js/app.js: owned verdict hash must render the full verdict page');
expect(!app.includes('renderParticipation') && !app.includes('./pages/participation.js'),
  'public/js/app.js: obsolete separate participation page must not return');
expect(board.includes('function resultPath') && board.includes('return `#/result/${encodeURIComponent(id)}`'),
  'public/js/pages/board.js: verdict record cards must retain the full verdict route');
expect(board.includes('function discussionPath')
  && board.includes('return `#/discussion/${encodeURIComponent(id)}`')
  && board.includes('원고측·피고측·쌍방')
  && board.includes('판결문 보기')
  && board.includes('data-public-result-link="true"')
  && board.includes('data-discussion-record-link="true"')
  && !board.includes('totalVotes('),
  'public/js/pages/board.js: records must provide separate full-verdict and three-way discussion actions without jury totals');
expect(result.includes('💬 방청석 한마디') && result.includes("httpsCallable(functions, 'addCourtComment')"),
  'public/js/pages/result.js: legacy audience comments must remain available');
expect(resultComments.includes("reactionButton?.closest('.card')?.remove()")
  && resultComments.includes("container.querySelector('.result-audience-title')?.remove()")
  && resultComments.includes('이 판결로 토론하기'),
  'public/js/pages/result-comments.js: old jury card must stay hidden while comments and discussion access remain');
expect(resultComments.includes("httpsCallable(functions, 'voteOwnVerdict')")
  && resultComments.includes("container.querySelector('.verdict-card')")
  && resultComments.includes('AI 판결 봉인 중')
  && resultComments.includes('첫 선택이 기록되며')
  && resultComments.includes('ownerVerdictVote'),
  'public/js/pages/result-comments.js: owners must predict once before their AI verdict is revealed');
expect(ownerVerdict.includes("const OWNER_VERDICT_REACTIONS = ['plaintiff', 'defendant', 'both']")
  && ownerVerdict.includes('caseData.userId !== uid')
  && ownerVerdict.includes('ownerVerdictVote: reaction')
  && ownerVerdict.includes('alreadyVoted'),
  'functions/owner-verdict.js: owner prediction must be owner-only, three-way, persistent, and idempotent');
expect(functionsMain.includes("require('./owner-verdict')")
  && deployWorkflow.includes('functions:voteOwnVerdict'),
  'owner blind-verdict callable must be exported and included in production deployment');
expect(resultCourt.includes("[data-theme='dark'] .result-document-page")
  && resultCourt.includes('background:linear-gradient(145deg,#1a2130,#10151f)'),
  'public/js/pages/result-court.js: dark full-verdict styling is missing');
expect(trial.includes('location.hash = `#/verdict/${encodeURIComponent(caseId)}`'),
  'public/js/pages/trial.js: completed submissions must open the owned verdict route');
expect(myCases.includes('`#/verdict/${encodeURIComponent(id)}`'),
  'public/js/pages/my-cases.js: owned completed cases must open the owned verdict route');

const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
expect(Boolean(appVersion) && sw.includes(`/js/app.js?v=${appVersion}`),
  'public/index.html and public/sw.js: active app cache versions are inconsistent');
const resultModuleVersion = app.match(/\.\/pages\/result-comments\.js\?v=([^"']+)/)?.[1] || '';
expect(Boolean(resultModuleVersion) && sw.includes(`/js/pages/result-comments.js?v=${resultModuleVersion}`),
  'public/js/app.js and public/sw.js: verdict result module cache versions are inconsistent');
expect(sw.includes('/js/pages/result-court.js?v=20260829-arena-1')
  && sw.includes('/js/pages/discussion.js?v=20260730-discussion-court-1')
  && !sw.includes('/js/pages/participation.js'),
  'public/sw.js: full verdict and discussion modules are missing from the cache graph');
expect(/^const CACHE_NAME = 'sosoking-app-v[^']+';/m.test(sw),
  'public/sw.js: versioned application cache name is missing');

if (errors.length) {
  console.error(`Verdict record validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Verdict record validation passed: owner verdicts stay sealed until a one-time prediction, public records keep separate discussion access, and cache versions stay synchronized.');
