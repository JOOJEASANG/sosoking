import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const errors = [];

function walk(directory, extension = '.js') {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [full] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return true;
  const base = path.resolve(path.dirname(fromFile), specifier.split('?')[0].split('#')[0]);
  return [base, `${base}.js`, path.join(base, 'index.js')].some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
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

const functionFiles = walk(path.join(root, 'functions'));
for (const file of functionFiles) {
  const source = fs.readFileSync(file, 'utf8');
  try { new vm.Script(source, { filename: relative(file) }); }
  catch (error) { errors.push(`${relative(file)}: ${error.message}`); }
  checkReferences(file, source);
}

const clientFiles = walk(path.join(root, 'public', 'js'));
for (const file of clientFiles) {
  const source = fs.readFileSync(file, 'utf8');
  try { new vm.SourceTextModule(source, { identifier: relative(file) }); }
  catch (error) { errors.push(`${relative(file)}: ${error.message}`); }
  checkReferences(file, source);
}

const registry = path.join(root, 'public', 'js', 'app-module-registry.js');
if (fs.existsSync(registry)) {
  const source = fs.readFileSync(registry, 'utf8');
  for (const match of source.matchAll(/['"](\.\/[^'"]+\.js)['"]/g)) {
    if (!resolveLocal(registry, match[1])) errors.push(`public/js/app-module-registry.js: 등록 파일 없음 ${match[1]}`);
  }
}

const indexPath = path.join(root, 'public', 'index.html');
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["'](\/[^"'#?]+\.(?:js|css|svg|png|json))["']/g)) {
    const asset = path.join(root, 'public', match[1].slice(1));
    if (!fs.existsSync(asset)) errors.push(`public/index.html: 자산 파일 없음 ${match[1]}`);
  }
}

const forbiddenFiles = [
  'functions/secure-multi-functions.js',
  'functions/settlement-functions.js',
  'functions/ai-hunt-functions.js',
  'functions/best-reward-functions.js',
  'functions/four-game-ai-content-functions.js',
  'public/js/tournament-play.js',
  'public/js/six-game-guard.js',
  'public/js/detail/quiz-actions.js',
  'public/js/detail/handlers-vote-quiz.js',
  'public/css/tournament.css',
  'public/css/multi-quiz-fix.css',
  'public/css/multi-quiz-enhance.css',
];
for (const file of forbiddenFiles) {
  if (fs.existsSync(path.join(root, file))) errors.push(`${file}: 제거 대상 게임 파일이 남아 있습니다.`);
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
