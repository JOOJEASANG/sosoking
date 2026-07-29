import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const homeCourt = read('public/js/pages/home-court.js');
for (const required of [
  'async function applySafePublicFeed(container)',
  "where('isPublic', '==', true)",
  "where('publicDataVersion', '==', 1)",
  "orderBy('createdAt', 'desc')",
  'record.sentence || record.publicCaseDescription || record.verdict',
  'publicFeedCard(caseId, record)',
  'href="#/result/${encodeURIComponent(caseId)}"'
]) {
  if (!homeCourt.includes(required)) errors.push(`public/js/pages/home-court.js: missing ${required}`);
}
if (homeCourt.includes('record.caseDescription') || homeCourt.includes('r.caseDescription')) {
  errors.push('public/js/pages/home-court.js: raw caseDescription is used in the active home feed');
}
if (!homeCourt.includes('await Promise.all([')
  || !homeCourt.includes('applySafePublicFeed(container)')) {
  errors.push('public/js/pages/home-court.js: safe public feed is not awaited by the active renderer');
}

const app = read('public/js/app.js');
if (!app.includes("./pages/home-court.js?v=20260730-public-feed-1")) {
  errors.push('public/js/app.js: active home feed cache version is stale');
}

const index = read('public/index.html');
const worker = read('public/sw.js');
if (!index.includes('/js/app.js?v=20260730-public-feed-1')) {
  errors.push('public/index.html: privacy-safe app cache version is missing');
}
for (const required of [
  "sosoking-app-v20260730-public-feed-1",
  '/js/app.js?v=20260730-public-feed-1',
  '/js/pages/home-court.js?v=20260730-public-feed-1'
]) {
  if (!worker.includes(required)) errors.push(`public/sw.js: missing ${required}`);
}

if (errors.length) {
  console.error(`Home public feed validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Home public feed validation passed: only sanitized public records are queried and rendered with synchronized PWA cache versions.');
