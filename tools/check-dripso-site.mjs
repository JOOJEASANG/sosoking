import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'public/dripso/index.html',
  'public/dripso/dripso.css',
  'public/dripso/dripso-navigation.css',
  'public/dripso/battle.css',
  'public/dripso/battle.js',
  'public/dripso/moderation.js',
  'public/js/dripso-entry-guard.js',
  'public/css/dripso-entry.css',
  'functions/dripso.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) errors.push(`${file}: file is missing`);
}

if (!errors.length) {
  const html = read('public/dripso/index.html');
  const css = read('public/dripso/battle.css');
  const app = read('public/dripso/battle.js');
  const functionsMain = read('functions/main.js');
  const functionsApp = read('functions/dripso.js');
  const rules = read('firestore.rules');
  const moderation = read('public/dripso/moderation.js');

  for (const required of [
    '<title>드립소 - 10초 드립배틀</title>',
    '/dripso/battle.css?v=20260803-seven-battles-1',
    '/dripso/battle.js?v=20260803-seven-battles-1',
    'id="dripso-app"',
    'id="topic-dialog"',
    'id="topic-form"',
    'id="battle-mode"',
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
    '빈칸채우기',
    '이름붙이기',
    '받아치기',
    '오답제출',
    '뉴스제목',
    '변명대회',
    '사용설명서'
  ]) {
    if (!html.includes(required)) errors.push(`public/dripso/index.html: missing ${required}`);
  }

  for (const forbidden of [
    'data-nav="daily"',
    'data-nav="naming"',
    'data-nav="situation"',
    '<small>오늘의 한줄</small>',
    '<small>미친작명소</small>',
    '<small>상황드립</small>'
  ]) {
    if (html.includes(forbidden)) errors.push(`public/dripso/index.html: retired category remains ${forbidden}`);
  }

  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('public/dripso/index.html: inline script must not be used');
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) errors.push('public/dripso/index.html: inline event attributes must not be used');

  for (const required of [
    '.battle-mode-grid',
    '.battle-mode-tile',
    '.battle-filter-bar',
    '.battle-rule-note',
    '.hall-rank',
    '@media (max-width:580px)',
    '@media (prefers-reduced-motion:reduce)'
  ]) {
    if (!css.includes(required)) errors.push(`public/dripso/battle.css: missing ${required}`);
  }

  for (const required of [
    'const MODE_META = Object.freeze({',
    "blank: {",
    "naming: {",
    "comeback: {",
    "wrong: {",
    "headline: {",
    "excuse: {",
    "manual: {",
    'const MODE_ORDER = Object.keys(MODE_META)',
    'const MODE_MARKER =',
    '[[dripso-mode:',
    "topic?.type === 'naming'",
    "topic?.type === 'situation'",
    "httpsCallable(functions, 'createDripsoTopic')",
    "httpsCallable(functions, 'addDripsoComment')",
    "httpsCallable(functions, 'toggleDripsoCommentLike')",
    "collection(db, 'dripso_topics')",
    "collection(db, `dripso_topics/${topicId}/comments`)",
    "where('status', '==', 'visible')",
    "type: mode === 'naming' ? 'naming' : 'situation'",
    'renderHome',
    'renderBrowse',
    'renderPopular',
    'renderHall',
    'renderTopic',
    'compressTopicImage',
    'safeTopicImageUrl',
    'topicForm.addEventListener'
  ]) {
    if (!app.includes(required)) errors.push(`public/dripso/battle.js: missing ${required}`);
  }

  for (const forbidden of ['setDoc(', 'addDoc(', 'updateDoc(', 'deleteDoc(', 'innerHTML', 'eval(']) {
    if (app.includes(forbidden)) errors.push(`public/dripso/battle.js: direct write or unsafe pattern found ${forbidden}`);
  }

  for (const required of [
    "Object.assign(exports, require('./dripso'))",
    'exports.createDripsoTopic',
    'exports.addDripsoComment',
    'exports.toggleDripsoCommentLike',
    "const TOPIC_TYPES = ['daily', 'naming', 'situation']",
    "enforceActionRateLimit(uid, 'dripso-topic'",
    "enforceActionRateLimit(uid, 'dripso-comment'",
    "enforceActionRateLimit(uid, 'dripso-like'",
    "status: 'visible'",
    'topLikeCount',
    'decodeTopicImageDataUrl'
  ]) {
    if (!(functionsMain + functionsApp).includes(required)) errors.push(`Dripso Functions integration missing: ${required}`);
  }

  for (const required of [
    'match /dripso_topics/{topicId}',
    'match /comments/{commentId}',
    'match /likes/{uid}',
    'allow create, update, delete: if false;'
  ]) {
    if (!rules.includes(required)) errors.push(`firestore.rules: Dripso protection missing ${required}`);
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

console.log('Dripso validation passed: seven quick battle modes replace the retired daily/category navigation while callable-only writes, images, ranking, deletion, and reporting remain protected.');
