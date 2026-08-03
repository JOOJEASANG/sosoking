import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'functions/dripso-tournament.js',
  'public/dripso/tournament-v3.js',
  'public/dripso/tournament-v3.css'
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) errors.push(`${file}: file is missing`);
}

if (!errors.length) {
  const server = read('functions/dripso-tournament.js');
  const bundle = read('functions/dripso-bundle.js');
  const html = read('public/dripso/index.html');
  const ui = read('public/dripso/tournament-v3.js');
  const css = read('public/dripso/tournament-v3.css');
  const rules = read('firestore.rules');
  const deploy = read('.github/workflows/firebase-deploy.yml');
  const sw = read('public/sw.js');

  for (const required of [
    'const GAME_VERSION = 3',
    'exports.createDripsoTournamentBattle',
    'exports.submitDripsoTournamentEntry',
    'exports.getDripsoTournamentView',
    'exports.getDripsoTournamentMatchup',
    'exports.voteDripsoTournamentMatchup',
    "leftEntryId: seedIds[0], rightEntryId: seedIds[3]",
    "leftEntryId: seedIds[1], rightEntryId: seedIds[2]",
    "round: 'semifinal'",
    "round: 'final'",
    "return Number(match.leftSeed) <= Number(match.rightSeed)",
    'semifinalByeEntryId',
    'championEntryId',
    'runnerUpEntryId',
    'dripso_tournament_matches',
    'dripso_tournament_prelim_voters',
    'dripso_tournament_voters'
  ]) {
    if (!server.includes(required)) errors.push(`functions/dripso-tournament.js: missing ${required}`);
  }

  for (const required of [
    'exports.createDripsoTournamentBattle = tournament.createDripsoTournamentBattle',
    'exports.submitDripsoTournamentEntry = tournament.submitDripsoTournamentEntry',
    'exports.getDripsoTournamentView = tournament.getDripsoTournamentView',
    'exports.getDripsoTournamentMatchup = tournament.getDripsoTournamentMatchup',
    'exports.voteDripsoTournamentMatchup = tournament.voteDripsoTournamentMatchup'
  ]) {
    if (!bundle.includes(required)) errors.push(`functions/dripso-bundle.js: missing ${required}`);
  }

  for (const required of [
    'id="finals-duration"',
    '준결승·결승',
    '/dripso/tournament-v3.css?v=20260804-final-four-1',
    '/dripso/tournament-v3.js?v=20260804-final-four-1',
    '익명 1대1 예선 상위 네 작품이 파이널4에 진출'
  ]) {
    if (!html.includes(required)) errors.push(`public/dripso/index.html: missing ${required}`);
  }

  for (const required of [
    "httpsCallable(functions, 'createDripsoTournamentBattle')",
    "httpsCallable(functions, 'submitDripsoTournamentEntry')",
    "httpsCallable(functions, 'getDripsoTournamentView')",
    "httpsCallable(functions, 'getDripsoTournamentMatchup')",
    "httpsCallable(functions, 'voteDripsoTournamentMatchup')",
    "phase === 'semifinal'",
    "phase === 'final'",
    '파이널4 준결승',
    '최종 결승',
    'tournament-bracket-grid',
    "event.stopImmediatePropagation()",
    "form?.addEventListener('submit'",
    "app.addEventListener('click'"
  ]) {
    if (!ui.includes(required)) errors.push(`public/dripso/tournament-v3.js: missing ${required}`);
  }
  for (const forbidden of ['setDoc(', 'addDoc(', 'updateDoc(', 'deleteDoc(', 'innerHTML', 'eval(']) {
    if (ui.includes(forbidden)) errors.push(`public/dripso/tournament-v3.js: unsafe or direct-write pattern found ${forbidden}`);
  }

  for (const required of [
    '.tournament-bracket-grid',
    '.tournament-match.final',
    '.tournament-contender.winner',
    '.battle-time-grid.three-stage',
    '@media(max-width:760px)'
  ]) {
    if (!css.includes(required)) errors.push(`public/dripso/tournament-v3.css: missing ${required}`);
  }

  for (const required of [
    'topic.data.gameVersion == 3',
    "topic.data.keys().hasAll(['finalDeadline'])",
    'match /dripso_tournament_matches/{topicId}/items/{matchId}',
    'match /dripso_tournament_prelim_voters/{topicId}/users/{uid}/votes/{voteId}',
    'match /dripso_tournament_voters/{topicId}/rounds/{roundId}/matches/{matchId}/users/{uid}'
  ]) {
    if (!rules.includes(required)) errors.push(`firestore.rules: missing ${required}`);
  }

  for (const functionName of [
    'functions:createDripsoTournamentBattle',
    'functions:submitDripsoTournamentEntry',
    'functions:getDripsoTournamentView',
    'functions:getDripsoTournamentMatchup',
    'functions:voteDripsoTournamentMatchup'
  ]) {
    if (!deploy.includes(functionName)) errors.push(`firebase-deploy.yml: missing ${functionName}`);
  }

  for (const required of [
    "'/dripso/tournament-v3.css?v=20260804-final-four-1'",
    "'/dripso/tournament-v3.js?v=20260804-final-four-1'"
  ]) {
    if (!sw.includes(required)) errors.push(`public/sw.js: missing ${required}`);
  }
}

if (errors.length) {
  console.error(`Dripso Final Four validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Dripso Final Four validation passed: blind prelim seeding, 1-v-4 and 2-v-3 semifinals, seeded tie breaks, final voting, private records, deployment, and offline assets are connected.');
