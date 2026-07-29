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

const index = read('public/index.html');
if (!index.includes('id="home-light-theme-css"')
  || !index.includes('/css/home-light.css?v=20260729-light-home-1')
  || !index.includes('/js/app.js?v=20260729-compact-spacing-1')) {
  errors.push('public/index.html: light home stylesheet or current application cache version is missing');
}

const serviceWorker = read('public/sw.js');
if (!serviceWorker.includes("sosoking-app-v20260729-compact-spacing-1")
  || !serviceWorker.includes('/css/home-light.css?v=20260729-light-home-1')
  || !serviceWorker.includes('/js/app.js?v=20260729-compact-spacing-1')) {
  errors.push('public/sw.js: light home assets are not in the current cache graph');
}

if (errors.length) {
  console.error(`Home light theme validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Home light theme validation passed: cream hero, readable statistics, card CTA, dark-mode isolation, and cache refresh.');
