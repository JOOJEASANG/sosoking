import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => { if (!condition) errors.push(message); };

const app = read('public/js/app.js');
const home = read('public/js/pages/home.js');
const hall = read('public/js/pages/hall.js');
const jury = read('public/js/pages/jury.js');
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
expect(!app.includes("from './pages/board") && app.includes("else if (hash === '#/board') renderTask = renderHall(content);"),
  'public/js/app.js: retired board must map to the canonical hall instead of loading a legacy module');

expect(home.includes('href="#/result/${encodeURIComponent(caseId)}"')
  && home.includes('data-public-result-link="true"')
  && home.includes('판결문 보기 →'),
  'public/js/pages/home.js: recent public records must retain the full verdict route');
expect(hall.includes("location.hash = '#/jury'")
  && hall.includes('판결을 가린 채 사건부터 읽고 직접 한 표를 정해보세요.')
  && hall.includes('판결 내용과 어느 쪽이 우세한지는 여기서 미리 공개하지 않습니다.'),
  'public/js/pages/hall.js: ranking cards must lead to blind jury participation rather than reveal results early');
expect(jury.includes('원고 승') && jury.includes('피고 승') && jury.includes('쌍방 과실')
  && jury.includes('가려졌던 AI 판결과 전체 민심 집계가 열립니다.')
  && jury.includes('투표 전에는 AI 판결과 다른 이용자의 민심 비율을 보여주지 않습니다.'),
  'public/js/pages/jury.js: blind three-way public verdict participation is missing');

expect(result.includes('💬 방청석 한마디') && result.includes("httpsCallable(functions, 'addCourtComment')"),
  'public/js/pages/result.js: legacy audience comments must remain available');
expect(resultComments.includes("reactionButton?.closest('.card')?.remove()")
  && resultComments.includes("container.querySelector('.result-audience-title')?.remove()")
  && resultComments.includes('이 판결로 토론하기'),
  'public/js/pages/result-comments.js: old jury card must stay hidden while comments and discussion access remain');
expect(resultComments.includes("httpsCallable(functions, 'voteOwnVerdict')")
  && resultComments.includes("container.querySelector('.verdict-card')")
  && resultComments.includes('AI 판결 봉인 중')
  && resultComments.includes('최초 선택만 기록되며 AI 판결을 본 뒤에는 바꿀 수 없습니다.')
  && resultComments.includes('ownerVerdictVote'),
  'public/js/pages/result-comments.js: owners must predict once before their AI verdict is revealed');
expect(resultComments.includes('originalVisible')
  && resultComments.includes('이 내용은 내가 사건 접수 때 직접 입력한 원문이며 작성자 본인에게만 표시됩니다.')
  && resultComments.includes('실제 접수 원문은 작성자에게만 공개됩니다. 아래에는 공개용으로 안전하게 정리된 사건 정보만 표시됩니다.'),
  'public/js/pages/result-comments.js: owner-original/public-safe disclosure state is not rendered clearly');

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
expect(resultCourt.includes('처음 입력한 접수 원문은 작성자 본인에게만 보입니다.'),
  'public/js/pages/result-court.js: publication confirmation must distinguish the private original');
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
  && sw.includes('/js/pages/jury.js?v=20260830-jury-vote-fix-1')
  && !sw.includes('/js/pages/participation.js')
  && !sw.includes('/js/pages/board.js'),
  'public/sw.js: canonical full verdict/jury/discussion modules or retired-board cleanup are inconsistent');
expect(/^const CACHE_NAME = 'sosoking-app-v[^']+';/m.test(sw),
  'public/sw.js: versioned application cache name is missing');

if (errors.length) {
  console.error(`Verdict record validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Verdict record validation passed: owner verdicts stay sealed until one-time prediction, public rankings remain blind, original text stays private, and canonical participation/cache routes are synchronized.');
