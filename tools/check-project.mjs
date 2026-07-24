import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const errors = [];
const skippedDirectories = new Set(['node_modules', '.git', '.firebase', 'coverage', 'dist']);

function walk(directory, extensions = null) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) return [];
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full, extensions);
    if (!entry.isFile()) return [];
    if (!extensions) return [full];
    return extensions.some(extension => entry.name.endsWith(extension)) ? [full] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return true;
  const cleanSpecifier = specifier.split('?')[0].split('#')[0];
  const base = path.resolve(path.dirname(fromFile), cleanSpecifier);
  return [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')]
    .some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function checkReferences(file, source) {
  const patterns = [
    /\bfrom\s*['"](\.\.?\/[^'"]+)['"]/g,
    /\bimport\s*\(\s*[`'"](\.\.?\/[^`'"]+)[`'"]\s*\)/g,
    /\brequire\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (!resolveLocal(file, match[1])) errors.push(`${relative(file)}: 존재하지 않는 모듈 ${match[1]}`);
    }
  }
}

const functionFiles = walk(path.join(root, 'functions'), ['.js']);
for (const file of functionFiles) {
  const source = fs.readFileSync(file, 'utf8');
  try { new vm.Script(source, { filename: relative(file) }); }
  catch (error) { errors.push(`${relative(file)}: ${error.message}`); }
  checkReferences(file, source);
}

const clientFiles = walk(path.join(root, 'public', 'js'), ['.js', '.mjs']);
for (const file of clientFiles) {
  const source = fs.readFileSync(file, 'utf8');
  try { new vm.SourceTextModule(source, { identifier: relative(file) }); }
  catch (error) { errors.push(`${relative(file)}: ${error.message}`); }
  checkReferences(file, source);
}

for (const htmlFile of walk(path.join(root, 'public'), ['.html'])) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["'](\/[^"'#?]+\.(?:js|mjs|css|svg|png|webp|jpg|jpeg|json))["']/g)) {
    const asset = path.join(root, 'public', match[1].slice(1));
    if (!fs.existsSync(asset)) errors.push(`${relative(htmlFile)}: 자산 파일 없음 ${match[1]}`);
  }
}

const forbiddenFiles = [
  'functions/secure-feed-functions.js',
  'functions/secure-interactions-functions.js',
  'functions/secure-multi-functions.js',
  'functions/settlement-functions.js',
  'functions/ai-hunt-functions.js',
  'functions/best-reward-functions.js',
  'functions/four-game-ai-content-functions.js',
  'functions/points-functions.js',
  'functions/post-view-functions.js',
  'functions/sosoking-features-functions.js',
  'public/js/tournament-play.js',
  'public/js/six-game-guard.js',
  'public/js/deadline-gate.js',
  'public/js/four-game-polish.js',
  'public/js/points-actions.js',
  'public/js/unlimited-image-uploader.js',
  'public/js/detail/quiz-actions.js',
  'public/js/detail/handlers-vote-quiz.js',
  'public/js/detail/vote-actions.js',
  'public/css/tournament.css',
  'public/css/multi-quiz-fix.css',
  'public/css/multi-quiz-enhance.css',
  'public/css/arcade-light-theme-fix.css',
  'public/css/best-reward-rule-card.css',
  'public/css/multi-best-card.css',
  'public/css/multi-deadline.css',
  'public/ai-character-test.html',
];
for (const file of forbiddenFiles) {
  if (fs.existsSync(path.join(root, file))) errors.push(`${file}: 제거 대상 게임 또는 중복 파일이 남아 있습니다.`);
}

const forbiddenNamePattern = /(^|[-_])(game|quiz|tournament|arcade|prediction|settlement|ai-hunt|best-reward)([-_.]|$)/i;
for (const base of ['functions', 'public/js', 'public/css']) {
  for (const file of walk(path.join(root, base))) {
    const filePath = relative(file);
    if (forbiddenNamePattern.test(path.basename(filePath))) {
      errors.push(`${filePath}: 게임 관련 파일명이 남아 있습니다.`);
    }
  }
}

const forbiddenReferences = new Map([
  ['functions/functions-main-v2.js', [
    'secure-multi-functions', 'secure-feed-functions', 'secure-interactions-functions',
    'ai-hunt-functions', 'settlement-functions', 'best-reward-functions',
    'four-game-ai-content-functions', 'points-functions', 'post-view-functions',
    'checkMultiQuizAnswer', 'reactToAcrostic',
  ]],
  ['public/js/app-module-registry.js', [
    'tournament-play', 'six-game-guard', 'deadline-gate', 'four-game-polish',
    'points-actions', 'unlimited-image-uploader', 'quiz-actions',
  ]],
]);
for (const [file, tokens] of forbiddenReferences) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const source = fs.readFileSync(full, 'utf8');
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${file}: 제거된 코드 참조가 남아 있습니다: ${token}`);
  }
}

for (const jsonFile of ['firebase.json', 'firestore.indexes.json', 'package.json', 'functions/package.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, jsonFile), 'utf8')); }
  catch (error) { errors.push(`${jsonFile}: JSON 오류 ${error.message}`); }
}

if (errors.length) {
  console.error(`\n검사 실패 (${errors.length}건)`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`검사 통과: Functions ${functionFiles.length}개, Client JS ${clientFiles.length}개`);
