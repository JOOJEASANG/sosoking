import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const css = read('public/css/home-light.css');
for (const required of [
  '[data-theme="light"] .hero-section',
  '[data-theme="light"] .hero-section .hero-badge',
  '[data-theme="light"] .hero-section .stats-row',
  '[data-theme="light"] .cta-section',
  'linear-gradient(180deg, #fffaf1',
  'linear-gradient(145deg, #fffdf8',
  '@keyframes home-light-pulse'
]) {
  if (!css.includes(required)) errors.push(`public/css/home-light.css: missing ${required}`);
}
if (css.includes('[data-theme="dark"]')) {
  errors.push('public/css/home-light.css: dark mode must not be changed');
}

const courtDesign = read('public/js/components/court-design.js');
if (!courtDesign.includes('promoteHomeLightStylesheet()')
  || !courtDesign.includes("document.getElementById('home-light-theme-css')")
  || !courtDesign.includes('module.initContrastFix();\n    promoteHomeLightStylesheet();')) {
  errors.push('public/js/components/court-design.js: light stylesheet is not reapplied after contrast fixes');
}

const app = read('public/js/app.js');
if (!app.includes("./components/court-design.js?v=20260729-light-home-1")) {
  errors.push('public/js/app.js: light home court design cache version is missing');
}
if (!app.includes("./pages/my-cases-game.js?v=20260810-mycase-light-1")) {
  errors.push('public/js/app.js: current my-cases light profile cache version is missing');
}

const myCasesGame = read('public/js/pages/my-cases-game.js');
for (const required of [
  "style.id = 'my-case-profile-game-style'",
  '#my-game-profile .my-case-achievement-badge',
  'background:#f4ead5',
  'color:#6a4b18',
  "[data-theme='dark'] #my-game-profile .my-case-achievement-badge",
  'color:#fff8ec',
  'class="my-case-achievement-badge"'
]) {
  if (!myCasesGame.includes(required)) errors.push(`public/js/pages/my-cases-game.js: missing readable profile badge rule ${required}`);
}
if (myCasesGame.includes('font-weight:900;color:#fff8ec;">${icon} ${label}</span>')) {
  errors.push('public/js/pages/my-cases-game.js: profile badge text must not stay fixed to near-white in light mode');
}

const index = read('public/index.html');
const serviceWorker = read('public/sw.js');
if (!index.includes('id="home-light-theme-css"')
  || !index.includes('/css/home-light.css?v=20260729-light-home-1')) {
  errors.push('public/index.html: light home stylesheet is missing');
}
if (!serviceWorker.includes('/css/home-light.css?v=20260729-light-home-1')) {
  errors.push('public/sw.js: light home stylesheet is not in the active cache graph');
}
const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
if (!appVersion || !serviceWorker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: current application cache versions are inconsistent');
}
if (!serviceWorker.includes('/js/pages/my-cases-game.js?v=20260810-mycase-light-1')) {
  errors.push('public/sw.js: current my-cases profile module is not in the active cache graph');
}
if (!/const CACHE_NAME = 'sosoking-app-v[^']+';/.test(serviceWorker)) {
  errors.push('public/sw.js: versioned cache name is missing');
}

if (errors.length) {
  console.error(`Home light theme validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Home light theme validation passed: cream hero, readable statistics, readable my-case achievement badges, dark-mode isolation, and cache consistency.');
