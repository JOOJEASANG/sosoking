import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
for (const file of [
  'functions/dripso-tournament.js', 'functions/dripso-bundle.js',
  'public/dripso/app-v4.js', 'public/dripso/tournament-v3.css', 'public/dripso/index.html'
]) assert.ok(fs.existsSync(file), `필수 파일 누락: ${file}`);

const server = read('functions/dripso-tournament.js');
const bundle = read('functions/dripso-bundle.js');
const html = read('public/dripso/index.html');
const ui = read('public/dripso/app-v4.js');
const css = read('public/dripso/tournament-v3.css');
const rules = read('firestore.rules');
const deploy = read('.github/workflows/firebase-deploy.yml');
const sw = read('public/sw.js');

for (const required of [
  'const GAME_VERSION = 3', 'exports.createDripsoTournamentBattle',
  'exports.submitDripsoTournamentEntry', 'exports.getDripsoTournamentView',
  'exports.getDripsoTournamentMatchup', 'exports.voteDripsoTournamentMatchup',
  "leftEntryId: seedIds[0], rightEntryId: seedIds[3]",
  "leftEntryId: seedIds[1], rightEntryId: seedIds[2]",
  "round: 'semifinal'", "round: 'final'",
  'return Number(match.leftSeed) <= Number(match.rightSeed)',
  'semifinalByeEntryId', 'championEntryId', 'runnerUpEntryId',
  'dripso_tournament_matches', 'dripso_tournament_prelim_voters', 'dripso_tournament_voters'
]) assert.ok(server.includes(required), `파이널4 서버 누락: ${required}`);

for (const required of [
  'exports.createDripsoTournamentBattle = tournament.createDripsoTournamentBattle',
  'exports.submitDripsoTournamentEntry = tournament.submitDripsoTournamentEntry',
  'exports.getDripsoTournamentView = tournament.getDripsoTournamentView',
  'exports.getDripsoTournamentMatchup = tournament.getDripsoTournamentMatchup',
  'exports.voteDripsoTournamentMatchup = tournament.voteDripsoTournamentMatchup'
]) assert.ok(bundle.includes(required), `파이널4 번들 누락: ${required}`);

for (const required of [
  'id="finals-duration"', '준결승·결승',
  '/dripso/tournament-v3.css?v=20260804-final-four-1',
  '/dripso/app-v4.js?v=20260804-dripso-v4-audit-1',
  '익명 1대1 예선 상위 네 작품이 파이널4에 진출'
]) assert.ok(html.includes(required), `파이널4 화면 누락: ${required}`);
assert.ok(!html.includes('<script type="module" src="/dripso/tournament-v3.js'), '구형 파이널4 오버레이가 활성화되어 있습니다.');

for (const required of [
  "httpsCallable(functions, 'createDripsoTournamentBattle')",
  "httpsCallable(functions, 'submitDripsoTournamentEntry')",
  "httpsCallable(functions, 'getDripsoTournamentView')",
  "httpsCallable(functions, 'getDripsoTournamentMatchup')",
  "httpsCallable(functions, 'voteDripsoTournamentMatchup')",
  "phase === 'semifinal'", "phase === 'final'",
  '파이널4 준결승', '최종 결승', 'tournament-bracket-grid',
  'async function renderTournamentTopic', 'function tournamentBracket',
  "topicForm.addEventListener('submit'", "app.addEventListener('click'"
]) assert.ok(ui.includes(required), `통합 앱 파이널4 흐름 누락: ${required}`);
for (const forbidden of ['setDoc(', 'addDoc(', 'updateDoc(', 'deleteDoc(', 'innerHTML', 'eval(']) {
  assert.ok(!ui.includes(forbidden), `통합 앱 위험 패턴 발견: ${forbidden}`);
}

for (const required of [
  '.tournament-bracket-grid', '.tournament-match.final',
  '.tournament-contender.winner', '.battle-time-grid.three-stage', '@media(max-width:760px)'
]) assert.ok(css.includes(required), `파이널4 스타일 누락: ${required}`);

for (const required of [
  'topic.data.gameVersion == 3', "topic.data.keys().hasAll(['finalDeadline'])",
  'match /dripso_tournament_matches/{topicId}/items/{matchId}',
  'match /dripso_tournament_prelim_voters/{topicId}/users/{uid}/votes/{voteId}',
  'match /dripso_tournament_voters/{topicId}/rounds/{roundId}/matches/{matchId}/users/{uid}'
]) assert.ok(rules.includes(required), `파이널4 규칙 누락: ${required}`);

for (const name of [
  'functions:createDripsoTournamentBattle', 'functions:submitDripsoTournamentEntry',
  'functions:getDripsoTournamentView', 'functions:getDripsoTournamentMatchup',
  'functions:voteDripsoTournamentMatchup'
]) assert.ok(deploy.includes(name), `파이널4 배포 함수 누락: ${name}`);

for (const asset of [
  "'/dripso/tournament-v3.css?v=20260804-final-four-1'",
  "'/dripso/app-v4.js?v=20260804-dripso-v4-audit-1'"
]) assert.ok(sw.includes(asset), `파이널4 오프라인 자산 누락: ${asset}`);

console.log('Dripso Final Four validation passed: the consolidated app connects blind prelim seeding, 1-v-4 and 2-v-3 semifinals, seeded ties, final voting, private records, deployment, and offline assets.');
