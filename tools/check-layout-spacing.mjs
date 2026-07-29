import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const css = read('public/css/layout-spacing.css');
for (const required of [
  '#page-content {',
  'flex: 0 0 auto;',
  '#site-footer {',
  'flex: 1 0 auto;',
  'padding-bottom:90px',
  'padding-bottom:80px',
  'padding-bottom:60px',
  '#page-content .cta-section',
  'margin-bottom: 10px !important;'
]) {
  if (!css.includes(required)) errors.push(`public/css/layout-spacing.css: missing ${required}`);
}

const footer = read('public/js/components/footer.js');
if (!footer.includes('businessRows')
  || !footer.includes('.filter(Boolean)')
  || footer.includes("${businessNumber ? `사업자등록번호 ${businessNumber}` : ''}${contact ? ` | 연락처 ${contact}` : ''}<br>")) {
  errors.push('public/js/components/footer.js: empty business information rows are not compacted');
}

const app = read('public/js/app.js');
if (!app.includes("./components/footer.js?v=20260729-compact-spacing-1")) {
  errors.push('public/js/app.js: compact footer cache version is missing');
}

const index = read('public/index.html');
if (!index.includes('/css/layout-spacing.css?v=20260729-compact-spacing-1')
  || !index.includes('/js/app.js?v=20260729-compact-spacing-1')) {
  errors.push('public/index.html: compact spacing stylesheet or app version is missing');
}

const serviceWorker = read('public/sw.js');
if (!serviceWorker.includes("sosoking-app-v20260729-compact-spacing-1")
  || !serviceWorker.includes('/css/layout-spacing.css?v=20260729-compact-spacing-1')
  || !serviceWorker.includes('/js/app.js?v=20260729-compact-spacing-1')) {
  errors.push('public/sw.js: compact spacing assets are not in the active cache graph');
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

console.log('Layout spacing validation passed: compact route endings, footer fill, safe navigation spacing, and cache refresh.');
