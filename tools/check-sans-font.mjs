import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const selected = [
  'public/index.html',
  'public/admin/index.html',
  'public/css/brand-logo.css',
  'public/css/sans-font.css',
  'public/js/pages/result-court.js',
  'public/js/pages/submit.js',
  'functions/public-seo.js'
];

for (const path of selected) {
  const source = read(path);
  if (source.includes('Noto Serif KR') || source.includes('Georgia')) {
    errors.push(`${path}: serif font declaration remains`);
  }
}

const index = read('public/index.html');
const admin = read('public/admin/index.html');
const brand = read('public/css/brand-logo.css');
const server = read('functions/public-seo.js');
const sw = read('public/sw.js');

if (!index.includes('family=Noto+Sans+KR') || !index.includes('/css/sans-font.css?v=20260729-sans-font-1')) {
  errors.push('public/index.html: public sans font assets are incomplete');
}
if (!admin.includes('family=Noto+Sans+KR') || !admin.includes('/css/brand-logo.css?v=20260729-sans-font-1')) {
  errors.push('public/admin/index.html: admin sans font assets are incomplete');
}
if (!brand.includes("--font-serif: 'Noto Sans KR'") || !brand.includes('body *')) {
  errors.push('public/css/brand-logo.css: global sans font override is missing');
}
if (!server.includes("font-family:'Noto Sans KR',Arial,sans-serif")) {
  errors.push('functions/public-seo.js: public verdict sans font is missing');
}
if (!/const CACHE_NAME = 'sosoking-app-v[^']+';/.test(sw)
  || !/\/css\/brand-logo\.css\?v=[^'\"]+/.test(sw)
  || !sw.includes('/css/sans-font.css?v=20260729-sans-font-1')) {
  errors.push('public/sw.js: sans font cache assets are incomplete');
}

if (errors.length) {
  console.error(`Sans font validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Sans font validation passed: public app, results, search pages, forms, and admin use Noto Sans KR.');
