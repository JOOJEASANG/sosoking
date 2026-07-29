import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => { if (!condition) errors.push(message); };

const app = read('public/js/app.js');
const board = read('public/js/pages/board.js');
const participation = read('public/js/pages/participation.js');
const resultCourt = read('public/js/pages/result-court.js');
const trial = read('public/js/pages/trial.js');
const myCases = read('public/js/pages/my-cases.js');
const index = read('public/index.html');
const sw = read('public/sw.js');

expect(app.includes("hash.startsWith('#/result/')") && app.includes('renderParticipation(content'),
  'public/js/app.js: public result hash must render the participation page');
expect(app.includes("hash.startsWith('#/verdict/')") && app.includes('renderResult(content'),
  'public/js/app.js: private verdict hash must render the full verdict page');
expect(board.includes('function participationPath') && board.includes('return `#/result/${encodeURIComponent(id)}`'),
  'public/js/pages/board.js: verdict record cards must open the direct participation hash');
expect(!board.includes('return `/result/${encodeURIComponent(id)}`'),
  'public/js/pages/board.js: board cards must not open the duplicate public verdict page first');
expect(participation.includes('배심원 투표') && participation.includes('방청석 한마디'),
  'public/js/pages/participation.js: voting and audience comments are required');
expect(participation.includes("[data-theme='dark'] .participation-page")
  && participation.includes('background:linear-gradient(145deg,#1b2231,#10151f)'),
  'public/js/pages/participation.js: dark participation cards are missing');
expect(resultCourt.includes("[data-theme='dark'] .result-document-page")
  && resultCourt.includes('background:linear-gradient(145deg,#1a2130,#10151f)'),
  'public/js/pages/result-court.js: dark full-verdict styling is missing');
expect(trial.includes('location.hash = `#/verdict/${encodeURIComponent(caseId)}`'),
  'public/js/pages/trial.js: completed submissions must open the private verdict route');
expect(myCases.includes('`#/verdict/${encodeURIComponent(id)}`'),
  'public/js/pages/my-cases.js: owned completed cases must open the private verdict route');
expect(index.includes('/js/app.js?v=20260729-dark-record-participation-1'),
  'public/index.html: new app cache version is missing');
expect(sw.includes("sosoking-app-v20260729-dark-record-participation-1")
  && sw.includes('/js/pages/participation.js?v=20260729-dark-record-participation-1'),
  'public/sw.js: participation app shell cache is incomplete');

if (errors.length) {
  console.error(`Verdict participation validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Verdict participation validation passed: records open voting/comments directly and dark mode uses dark record surfaces.');
