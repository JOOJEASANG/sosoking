import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const errors = [];
const compressedPath = path.join(root, 'data', 'creative-cases-v1.b64');

function fail(message) {
  errors.push(message);
}

let source;
try {
  const compressed = Buffer.from(fs.readFileSync(compressedPath, 'utf8').trim(), 'base64');
  source = JSON.parse(gunzipSync(compressed).toString('utf8'));
} catch (error) {
  fail(`creative seed decode failed: ${error.message}`);
  source = { cases: [] };
}

const cases = Array.isArray(source.cases) ? source.cases : [];
if (cases.length < 120) fail(`creative seed must contain at least 120 cases, found ${cases.length}`);

const ids = new Set();
const slugs = new Set();
const required = [
  'id', 'slug', 'category', 'publishedDate', 'caseTitle', 'caseDescription',
  'grievanceIndex', 'judgeType', 'judgeIcon', 'judgeStyle', 'reception',
  'investigation', 'plaintiffArg', 'defendantArg', 'verdict', 'sentence'
];

for (const [index, item] of cases.entries()) {
  for (const field of required) {
    if (item?.[field] === undefined || item?.[field] === null || String(item[field]).trim() === '') {
      fail(`case ${index + 1}: missing ${field}`);
    }
  }
  if (ids.has(item.id)) fail(`duplicate case id: ${item.id}`);
  if (slugs.has(item.slug)) fail(`duplicate case slug: ${item.slug}`);
  ids.add(item.id);
  slugs.add(item.slug);
  if (!Number.isInteger(item.grievanceIndex) || item.grievanceIndex < 1 || item.grievanceIndex > 10) {
    fail(`case ${item.id}: invalid grievanceIndex`);
  }
}

const casesDir = path.join(root, 'public', 'cases');
const generatedPages = fs.existsSync(casesDir)
  ? fs.readdirSync(casesDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).length
  : 0;
if (generatedPages !== cases.length) fail(`generated SEO pages ${generatedPages} do not match seed count ${cases.length}`);

const sitemapPath = path.join(root, 'public', 'sitemap.xml');
const robotsPath = path.join(root, 'public', 'robots.txt');
const rssPath = path.join(root, 'public', 'rss.xml');
const indexPath = path.join(root, 'public', 'index.html');

for (const file of [sitemapPath, robotsPath, rssPath]) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 100) fail(`${path.basename(file)} is missing or empty`);
}

if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  for (const item of cases) {
    if (!sitemap.includes(`/cases/${item.slug}/`)) fail(`sitemap missing ${item.slug}`);
  }
}

if (fs.existsSync(robotsPath)) {
  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!robots.includes('Sitemap: https://sosoking.co.kr/sitemap.xml')) fail('robots.txt sitemap declaration missing');
  if (!robots.includes('Disallow: /admin/')) fail('robots.txt admin exclusion missing');
}

const index = fs.readFileSync(indexPath, 'utf8');
if (!index.includes('rel="canonical" href="https://sosoking.co.kr/"')) fail('main canonical URL missing');
if (!index.includes('application/ld+json')) fail('main structured data missing');
if (!index.includes('/cases/creative-case-001/')) fail('main static internal case link missing');

const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'firebase-deploy.yml'), 'utf8');
if (!workflow.includes('npm run seed:creative')) fail('deployment creative seed step missing');
if (!workflow.includes('npm run check')) fail('deployment SEO build/check step missing');

if (errors.length) {
  console.error(`SEO/seed validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`SEO/seed validation passed: ${cases.length} creative cases and ${generatedPages} static pages.`);
