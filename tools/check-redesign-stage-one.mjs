import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${text}`);
};

const css = read('public/css/redesign-stage-one.css');
for (const text of [
  '--promo-page-max: 680px',
  '.home-redesign-shell',
  '.home-feature-grid',
  '.home-feature-card',
  '.home-redesign-shell .judge-lineup',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '#bottom-nav',
  '#site-footer',
  '[data-theme="light"]',
  '@media (prefers-reduced-motion: reduce)'
]) requireText(css, text, 'redesign stylesheet');

const home = read('public/js/pages/home-seven-judges.js');
for (const text of [
  'const HOME_FEATURES',
  "['#/submit', '🤖', 'AI 생활판결'",
  "['#/daily-court', '⚖️', '오늘의 재판'",
  "['#/board', '📜', '판결기록'",
  "['#/my-cases', '🗂️', '내 사건'",
  "name === '운명에 맡기기'",
  "icon === '🎲'",
  "shell.classList.add('home-redesign-shell')",
  'document.createElement',
  'addFeatureGrid(container, hero)'
]) requireText(home, text, 'homepage redesign');

const app = read('public/js/app.js');
requireText(app, "./pages/home-seven-judges.js?v=20260730-redesign-stage-1", 'application');

const index = read('public/index.html');
const worker = read('public/sw.js');
for (const text of [
  '/css/redesign-stage-one.css?v=20260730-redesign-stage-1',
  '/js/app.js?v=20260730-redesign-stage-1'
]) {
  requireText(index, text, 'index');
  requireText(worker, text, 'service worker');
}
requireText(worker, "const CACHE_NAME = 'sosoking-app-v20260730-redesign-stage-1';", 'service worker');
requireText(worker, '/js/pages/home-seven-judges.js?v=20260730-redesign-stage-1', 'service worker');

const packageJson = read('package.json');
requireText(packageJson, 'node tools/check-redesign-stage-one.mjs', 'validation chain');

if (errors.length) {
  console.error(`Stage one redesign validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Stage one redesign validation passed: shared surfaces, navigation, footer, homepage feature cards, and seven-judge layout are cache-safe.');
