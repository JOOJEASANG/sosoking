import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'public/dripso/index.html',
  'public/dripso/dripso.css',
  'public/dripso/dripso-navigation.css',
  'public/dripso/battle.css',
  'public/dripso/battle-game.css',
  'public/dripso/battle-v2.js',
  'public/dripso/battle-v2-pagination.js',
  'public/dripso/moderation.js',
  'public/js/dripso-entry-guard.js',
  'public/css/dripso-entry.css',
  'functions/dripso.js',
  'functions/dripso-game.js',
  'functions/dripso-bundle.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) errors.push(`${file}: file is missing`);
}

if (!errors.length) {
  const html = read('public/dripso/index.html');
  const baseCss = read('public/dripso/battle.css');
  const gameCss = read('public/dripso/battle-game.css');
  const app = read('public/dripso/battle-v2.js');
  const pagination = read('public/dripso/battle-v2-pagination.js');
  const functionsMain = read('functions/main.js');
  const legacyFunctions = read('functions/dripso.js');
  const gameFunctions = read('functions/dripso-game.js');
  const functionBundle = read('functions/dripso-bundle.js');
  const rules = read('firestore.rules');
  const moderation = read('public/dripso/moderation.js');
  const deploy = read('.github/workflows/firebase-deploy.yml');
  const sw = read('public/sw.js');

  for (const required of [
    '<title>드립소 - 블라인드 1대1 드립배틀</title>',
    '/dripso/battle.css?v=20260803-seven-battles-1',
    '/dripso/battle-game.css?v=20260803-blind-duel-1',
    '/dripso/battle-v2.js?v=20260803-blind-duel-1',
    '/dripso/battle-v2-pagination.js?v=20260803-blind-duel-1',
    'id="dripso-app"',
    'id="topic-dialog"',
    'id="topic-form"',
    'id="battle-mode"',
    'id="entry-duration"',
    'id="voting-duration"',
    'data-nav="home"',
    'data-nav="browse"',
    'data-nav="popular"',
    'data-nav="hall"',
    'data-nav="create"',
    'value="blank"',
    'value="naming"',
    'value="comeback"',
    'value="wrong"',
    'value="headline"',
    'value="excuse"',
    'value="manual"',
    '30분 번개전',
    '비교심사 시간'
  ]) {
    if (!html.includes(required)) errors.push(`public/dripso/index.html: missing ${required}`);
  }

  for (const forbidden of [
    'data-nav="daily"',
    'data-nav="naming"',
    'data-nav="situation"',
    '<small>오늘의 한줄</small>',
    '<small>미친작명소</small>',
    '<small>상황드립</small>',
    '/dripso/battle.js?v=20260803-seven-battles-1',
    '/dripso/battle-pagination.js?v=20260803-seven-battles-1'
  ]) {
    if (html.includes(forbidden)) errors.push(`public/dripso/index.html: retired structure remains ${forbidden}`);
  }

  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('public/dripso/index.html: inline script must not be used');
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) errors.push('public/dripso/index.html: inline event attributes must not be used');

  for (const required of [
    '.battle-mode-grid',
    '.battle-mode-tile',
    '.battle-filter-bar',
    '.hall-rank',
    '@media (max-width:580px)'
  ]) {
    if (!baseCss.includes(required)) errors.push(`public/dripso/battle.css: missing ${required}`);
  }
  for (const required of [
    '.battle-phase-panel',
    '.battle-duel-choices',
    '.battle-duel-choice',
    '.battle-winner-showcase',
    '.game-result-card.battle-winner',
    '.topic-dialog .battle-time-grid',
    '@media(max-width:580px)',
    '@media(prefers-reduced-motion:reduce)'
  ]) {
    if (!gameCss.includes(required)) errors.push(`public/dripso/battle-game.css: missing ${required}`);
  }

  for (const required of [
    'const MODE_META = Object.freeze({',
    'const GAME_VERSION = 2',
    "httpsCallable(functions, 'createDripsoBattle')",
    "httpsCallable(functions, 'submitDripsoBattleEntry')",
    "httpsCallable(functions, 'getDripsoBattleView')",
    "httpsCallable(functions, 'getDripsoBattleMatchup')",
    "httpsCallable(functions, 'voteDripsoBattleMatchup')",
    "httpsCallable(functions, 'addDripsoComment')",
    "httpsCallable(functions, 'toggleDripsoCommentLike')",
    "if (!mode && topic?.type === 'naming') mode = 'naming'",
    "if (!mode && topic?.type === 'situation') mode = 'comeback'",
    "phase === 'recruiting'",
    "phase === 'voting'",
    "phase === 'closed'",
    '블라인드 출전 중',
    '1대1 비교심사 중',
    'FINAL RANKING',
    'data-game-entry-form',
    'data-duel-selected',
    'renderLegacyTopic',
    'renderGameTopic',
    'compressTopicImage',
    'safeTopicImageUrl',
    'topicForm.addEventListener'
  ]) {
    if (!app.includes(required)) errors.push(`public/dripso/battle-v2.js: missing ${required}`);
  }
  for (const forbidden of ['setDoc(', 'addDoc(', 'updateDoc(', 'deleteDoc(', 'innerHTML', 'eval(']) {
    if (app.includes(forbidden)) errors.push(`public/dripso/battle-v2.js: direct write or unsafe pattern found ${forbidden}`);
  }

  for (const required of [
    'startAfter',
    "orderBy('createdAt', 'desc')",
    'data-pagination-complete',
    "route.name === 'mode'",
    "route.name === 'hall'",
    'Number(topic.gameVersion) === GAME_VERSION'
  ]) {
    if (!pagination.includes(required)) errors.push(`public/dripso/battle-v2-pagination.js: missing ${required}`);
  }

  if (!functionsMain.includes("Object.assign(exports, require('./dripso-bundle'))")) {
    errors.push('functions/main.js: Dripso public bundle is not loaded');
  }
  for (const required of [
    "const legacy = require('./dripso')",
    "const game = require('./dripso-game')",
    'exports.createDripsoTopic = legacy.createDripsoTopic',
    'exports.createDripsoBattle = game.createDripsoBattle',
    'exports.submitDripsoBattleEntry = game.submitDripsoBattleEntry',
    'exports.getDripsoBattleView = game.getDripsoBattleView',
    'exports.getDripsoBattleMatchup = game.getDripsoBattleMatchup',
    'exports.voteDripsoBattleMatchup = game.voteDripsoBattleMatchup',
    'exports.addDripsoComment = game.addDripsoComment',
    'exports.toggleDripsoCommentLike = game.toggleDripsoCommentLike'
  ]) {
    if (!functionBundle.includes(required)) errors.push(`functions/dripso-bundle.js: missing ${required}`);
  }
  for (const required of [
    'exports.createDripsoTopic',
    'exports.createDripsoBattle',
    'exports.submitDripsoBattleEntry',
    'exports.getDripsoBattleView',
    'exports.getDripsoBattleMatchup',
    'exports.voteDripsoBattleMatchup',
    'exports.addDripsoComment',
    'exports.toggleDripsoCommentLike'
  ]) {
    if (!(legacyFunctions + gameFunctions).includes(required)) {
      errors.push(`Dripso implementation missing: ${required}`);
    }
  }
  for (const required of [
    'const MAX_ENTRIES = 64',
    'function entryIdFor(topicId, uid)',
    'phaseFor(topic)',
    "phaseFor(topic) !== 'recruiting'",
    "phaseFor(topic) !== 'voting'",
    '본인이 출전한 작품이 포함된 대결에는 투표할 수 없습니다.',
    '이미 평가한 두 작품입니다.',
    "Number(topicSnap.data()?.gameVersion) === GAME_VERSION",
    '새 배틀은 하트 대신 1대1 비교투표로 평가합니다.'
  ]) {
    if (!gameFunctions.includes(required)) errors.push(`functions/dripso-game.js: missing ${required}`);
  }

  for (const required of [
    'function canReadDripsoComment(topicId, commentData)',
    'topic.data.gameVersion != 2',
    'request.time >= topic.data.votingDeadline',
    'match /dripso_battle_voters/{topicId}/users/{uid}/votes/{voteId}',
    'allow create, update, delete: if false;'
  ]) {
    if (!rules.includes(required)) errors.push(`firestore.rules: Dripso game protection missing ${required}`);
  }

  for (const functionName of [
    'functions:createDripsoBattle',
    'functions:submitDripsoBattleEntry',
    'functions:getDripsoBattleView',
    'functions:getDripsoBattleMatchup',
    'functions:voteDripsoBattleMatchup'
  ]) {
    if (!deploy.includes(functionName)) errors.push(`firebase-deploy.yml: missing ${functionName}`);
  }

  for (const asset of [
    '/dripso/battle-game.css?v=20260803-blind-duel-1',
    '/dripso/battle-v2.js?v=20260803-blind-duel-1',
    '/dripso/battle-v2-pagination.js?v=20260803-blind-duel-1'
  ]) {
    if (!sw.includes(`'${asset}'`)) errors.push(`public/sw.js: active game asset missing ${asset}`);
  }

  for (const required of [
    "httpsCallable(functions, 'getDripsoOwnership')",
    "httpsCallable(functions, 'deleteOwnDripsoTopic')",
    "httpsCallable(functions, 'deleteOwnDripsoComment')",
    "httpsCallable(functions, 'submitDripsoReport')"
  ]) {
    if (!moderation.includes(required)) errors.push(`public/dripso/moderation.js: missing ${required}`);
  }
}

if (errors.length) {
  console.error(`Dripso validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Dripso validation passed: seven quick modes now use timed blind entry, anonymous pair voting, final rankings, a single public Functions bundle, legacy compatibility, protected writes, moderation, and offline assets.');
