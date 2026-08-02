import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const policy = read('public/js/components/header-icons.js');
for (const value of [
  "container?.querySelectorAll('.page-header .logo')",
  '.page-header .logo::before{display:none!important;content:none!important;}',
  'stripLeadingIcons(value)',
  'titleElement.textContent = `${icon} ${cleanTitle}`',
  "titleElement.dataset.singleHeaderIcon = 'true'",
  "['#/trial/', '🏛️']",
  "['#/result/', '⚖️']",
  "['#/discussion/', '💬']",
  "['#/board', '📜']",
  "['#/submit', '📝']",
  "['#/my-cases', '🗂️']",
  "['#/guide', '📖']",
  "['#/auth', '🔐']",
  "['#/policy/privacy', '🔒']",
  "['#/policy/ai_disclaimer', '🤖']",
  "['#/policy/terms', '📄']"
]) need(policy, value, 'header icon policy');
if (policy.includes('daily-court') || policy.includes('오늘의 재판')) {
  errors.push('header icon policy: removed daily-court mapping remains');
}

const brand = read('public/css/brand-logo.css');
need(brand, '.page-header .logo::before', 'existing shared header logo source');

const app = read('public/js/app.js');
need(app, "./components/header-icons.js?v=20260730-header-icon-single-1", 'active header icon module');
const normalizeCalls = (app.match(/normalizePageHeaderIcons\(content, hash\)/g) || []).length;
if (normalizeCalls !== 2) {
  errors.push(`public/js/app.js: expected normal and error route normalization calls, found ${normalizeCalls}`);
}

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active application cache versions differ');
}
need(worker, '/js/components/header-icons.js?v=20260730-header-icon-single-1', 'header icon cache');

if (errors.length) {
  console.error(`Header icon policy validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Header icon policy validation passed: every public page header uses one route-specific icon and removed routes have no mapping.');
