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
const index = read('public/index.html');
const sw = read('public/sw.js');

expect(app.includes("hash.startsWith('#/result/')") && app.includes('renderResult(content'),
  'public/js/app.js: public result hash must render the full verdict page');
expect(app.includes("hash.startsWith('#/verdict/')") && app.includes('renderResult(content'),
  'public/js/app.js: owned verdict hash must render the full verdict page');
expect(!app.includes('renderParticipation') && !app.includes('./pages/participation.js'),
  'public/js/app.js: separate participation page must not remain in the active route graph');
expect(board.includes('function resultPath') && board.includes('return `#/result/${encodeURIComponent(id)}`'),
  'public/js/pages/board.js: verdict record cards must open the full verdict hash');
expect(board.includes('AI 판결문 전문으로 바로 이동합니다')
  && board.includes('판결문 바로 보기 · 💬')
  && board.includes('data-public-result-link="true"')
  && !board.includes('totalVotes('),
  'public/js/pages/board.js: records must directly advertise full verdict content and comments without jury totals');
expect(result.includes('💬 방청석 한마디') && result.includes("httpsCallable(functions, 'addCourtComment')"),
  'public/js/pages/result.js: audience comments must remain available');
expect(resultComments.includes("reactionButton?.closest('.card')?.remove()")
  && resultComments.includes("container.querySelector('.result-audience-title')?.remove()"),
  'public/js/pages/result-comments.js: jury vote card must be removed while comments remain');
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
expect(app.includes("./pages/result-comments.js?v=20260729-full-verdict-comments-1"),
  'public/js/app.js: full verdict comments renderer is missing from the active route graph');
expect(sw.includes('/js/pages/result-comments.js?v=20260729-full-verdict-comments-1')
  && sw.includes('/js/pages/result-court.js?v=20260729-dark-record-participation-1')
  && !sw.includes('/js/pages/participation.js'),
  'public/sw.js: full verdict comments modules are missing from the cache graph');
expect(/^const CACHE_NAME = 'sosoking-app-v[^']+';/m.test(sw),
  'public/sw.js: versioned application cache name is missing');

if (errors.length) {
  console.error(`Verdict record validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Verdict record validation passed: records link directly to the full AI verdict, jury voting is hidden, audience comments remain, and active cache versions stay synchronized.');
