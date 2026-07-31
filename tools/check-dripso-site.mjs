import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'public/dripso/index.html',
  'public/dripso/dripso.css',
  'public/dripso/dripso.js',
  'public/dripso/jokes.js',
  'public/js/dripso-entry-guard.js',
  'public/css/dripso-entry.css',
  'functions/dripso.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) errors.push(`${file}: file is missing`);
}

if (!errors.length) {
  const html = read('public/dripso/index.html');
  const css = read('public/dripso/dripso.css');
  const app = read('public/dripso/dripso.js');
  const courtNav = read('public/js/components/nav.js');
  const courtBrand = read('public/css/brand-logo.css');
  const entryGuard = read('public/js/dripso-entry-guard.js');
  const index = read('public/index.html');
  const sw = read('public/sw.js');
  const functionsMain = read('functions/main.js');
  const functionsApp = read('functions/dripso.js');
  const rules = read('firestore.rules');
  const deploy = read('.github/workflows/firebase-deploy.yml');
  const hostingOnly = read('.github/workflows/hosting-only-deploy.yml');
  const indexes = JSON.parse(read('firestore.indexes.json'));

  for (const required of [
    '<title>드립소 - 모두가 한마디씩 보태는 유머 놀이터</title>',
    'http-equiv="Content-Security-Policy"',
    '/dripso/dripso.css?v=20260801-community-1',
    '/dripso/dripso.js?v=20260801-community-1',
    'id="dripso-app"',
    'id="topic-dialog"',
    'id="topic-form"',
    'data-nav="home"',
    'data-nav="daily"',
    'data-nav="naming"',
    'data-nav="situation"',
    'data-nav="popular"',
    '오늘의 한줄',
    '이름짓기',
    '상황드립',
    '인기'
  ]) {
    if (!html.includes(required)) errors.push(`public/dripso/index.html: missing ${required}`);
  }

  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('public/dripso/index.html: inline script must not be used');
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) errors.push('public/dripso/index.html: inline event attributes must not be used');

  for (const required of [
    '.dripso-bottom-nav',
    'grid-template-columns: repeat(5, 1fr)',
    '.topic-card',
    '.comment-card.best',
    '.like-button.active',
    '.topic-dialog',
    '@media (max-width: 580px)',
    '@media (prefers-reduced-motion: reduce)',
    'env(safe-area-inset-bottom)'
  ]) {
    if (!css.includes(required)) errors.push(`public/dripso/dripso.css: missing ${required}`);
  }

  for (const required of [
    "import { initAuth, auth, db, functions } from '/js/firebase.js?v=20260729-auth-session-1'",
    "httpsCallable(functions, 'createDripsoTopic')",
    "httpsCallable(functions, 'addDripsoComment')",
    "httpsCallable(functions, 'toggleDripsoCommentLike')",
    "collection(db, 'dripso_topics')",
    "collection(db, `dripso_topics/${topicId}/comments`)",
    "where('status', '==', 'visible')",
    'sortedPopular',
    'comment.likeCount',
    'index < 3',
    'renderTopic',
    'topicForm.addEventListener',
    "location.hash = `#/topic/${topicId}`"
  ]) {
    if (!app.includes(required)) errors.push(`public/dripso/dripso.js: missing ${required}`);
  }
  for (const forbidden of ['setDoc(', 'addDoc(', 'updateDoc(', 'deleteDoc(', 'innerHTML', 'eval(']) {
    if (app.includes(forbidden)) errors.push(`public/dripso/dripso.js: direct write or unsafe pattern found ${forbidden}`);
  }

  if (courtNav.includes('href="/dripso/"') || courtNav.includes('>드립소</span>')) {
    errors.push('public/js/components/nav.js: Dripso must not remain in the court bottom navigation');
  }
  if (!courtBrand.includes('flex: 1 1 20%')) {
    errors.push('public/css/brand-logo.css: court navigation must return to five columns');
  }
  for (const required of [
    "const DRIPSO_PATH = '/dripso/'",
    'removeLegacyNavEntry',
    "document.getElementById('dripso-home-entry')",
    '드립소 바로가기',
    '주제를 올리고 댓글 드립을 달아 베스트 한마디를 뽑아보세요.'
  ]) {
    if (!entryGuard.includes(required)) errors.push(`public/js/dripso-entry-guard.js: missing ${required}`);
  }
  if (entryGuard.includes('makeNavLink') || entryGuard.includes('ensureDripsoNav')) {
    errors.push('public/js/dripso-entry-guard.js: court bottom navigation injection must be removed');
  }

  for (const required of [
    '/css/brand-logo.css?v=20260801-dripso-separate-1',
    '/css/dripso-entry.css?v=20260801-dripso-community-1',
    '/js/dripso-entry-guard.js?v=20260801-dripso-community-1'
  ]) {
    if (!index.includes(required)) errors.push(`public/index.html: missing ${required}`);
  }

  for (const required of [
    "const CACHE_NAME = 'sosoking-app-v20260801-dripso-community-1'",
    "'/dripso/index.html'",
    "'/dripso/dripso.css?v=20260801-community-1'",
    "'/dripso/dripso.js?v=20260801-community-1'",
    "url.pathname === '/dripso' || url.pathname.startsWith('/dripso/')",
    "networkFirst(request, '/dripso/index.html')"
  ]) {
    if (!sw.includes(required)) errors.push(`public/sw.js: Dripso cache or routing missing ${required}`);
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
    "collection('comments')",
    "collection('likes')"
  ]) {
    if (!(functionsMain + functionsApp).includes(required)) errors.push(`Dripso Functions integration missing: ${required}`);
  }

  for (const required of [
    'match /dripso_topics/{topicId}',
    'match /comments/{commentId}',
    'match /likes/{uid}',
    'match /dripso_topic_authors/{topicId}',
    'match /dripso_comment_authors/{topicId}/items/{commentId}',
    'allow create, update, delete: if false;'
  ]) {
    if (!rules.includes(required)) errors.push(`firestore.rules: Dripso protection missing ${required}`);
  }

  for (const functionName of ['functions:createDripsoTopic', 'functions:addDripsoComment', 'functions:toggleDripsoCommentLike']) {
    if (!deploy.includes(functionName)) errors.push(`firebase deploy workflow missing ${functionName}`);
  }
  if (!hostingOnly.includes('node tools/check-dripso-site.mjs') || hostingOnly.includes('node tools/check-dripso.mjs')) {
    errors.push('hosting-only deploy workflow uses an invalid Dripso check path');
  }

  const commentRankIndex = indexes.indexes?.some(item => item.collectionGroup === 'comments'
    && item.fields?.some(field => field.fieldPath === 'status' && field.order === 'ASCENDING')
    && item.fields?.some(field => field.fieldPath === 'likeCount' && field.order === 'DESCENDING'));
  if (!commentRankIndex) errors.push('firestore.indexes.json: Dripso comment ranking index is missing');

  const moduleUrl = `${pathToFileURL(path.resolve('public/dripso/jokes.js')).href}?check=${Date.now()}`;
  const { JOKES } = await import(moduleUrl);
  if (!Array.isArray(JOKES) || JOKES.length < 50) {
    errors.push(`public/dripso/jokes.js: expected at least 50 original lines, found ${JOKES?.length || 0}`);
  }
}

if (errors.length) {
  console.error(`Dripso validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Dripso validation passed: separate site navigation, topic and comment community, callable-only writes, like ranking, court home entry, and independent Hosting deployment.');
