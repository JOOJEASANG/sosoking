import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const css = read('public/css/layout-spacing.css');
for (const required of [
  '#app {',
  'display: block !important;',
  'min-height: 0 !important;',
  '#page-content {',
  'flex: none !important;',
  '#site-footer {',
  'flex: none !important;',
  'padding-bottom:90px',
  'padding-bottom:80px',
  '#page-content .cta-section',
  'margin-bottom: 8px !important;'
]) {
  if (!css.includes(required)) errors.push(`public/css/layout-spacing.css: missing ${required}`);
}
for (const forbidden of [
  'flex: 1 0 auto;',
  'min-height: 100svh;',
  'min-height: 100dvh;'
]) {
  if (css.includes(forbidden)) errors.push(`public/css/layout-spacing.css: viewport-filling rule remains: ${forbidden}`);
}

const footer = read('public/js/components/footer.js');
if (!footer.includes('businessRows')
  || !footer.includes('.filter(Boolean)')
  || footer.includes("${businessNumber ? `사업자등록번호 ${businessNumber}` : ''}${contact ? ` | 연락처 ${contact}` : ''}<br>")) {
  errors.push('public/js/components/footer.js: empty business information rows are not compacted');
}

const app = read('public/js/app.js');
const footerSpecifier = './components/footer.js?v=20260729-brand-policy-1';
if (!app.includes(footerSpecifier)) {
  errors.push('public/js/app.js: canonical compact footer module version is missing');
}

const index = read('public/index.html');
const serviceWorker = read('public/sw.js');
if (!index.includes('/css/layout-spacing.css?v=20260729-spacing-flow-2')) {
  errors.push('public/index.html: corrected spacing stylesheet is missing');
}
if (!serviceWorker.includes('/css/layout-spacing.css?v=20260729-spacing-flow-2')) {
  errors.push('public/sw.js: corrected spacing stylesheet is not in the active cache graph');
}
if (!serviceWorker.includes('/js/components/footer.js?v=20260729-brand-policy-1')) {
  errors.push('public/sw.js: canonical compact footer module is not in the active cache graph');
}
const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
if (!appVersion || !serviceWorker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: current application cache versions are inconsistent');
}
if (!/const CACHE_NAME = 'sosoking-app-v[^']+';/.test(serviceWorker)) {
  errors.push('public/sw.js: versioned cache name is missing');
}

const packageJson = read('package.json');
if (!packageJson.includes('node tools/check-layout-spacing.mjs')) {
  errors.push('package.json: compact spacing validation is not in the check chain');
}

if (errors.length) {
  console.error(`Layout spacing validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Layout spacing validation passed: route endings are compact, footer rows stay compact, and app/service-worker cache versions remain consistent.');
