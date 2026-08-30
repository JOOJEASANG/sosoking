import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');

const firebase = read('firebase.json');
for (const header of [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Content-Security-Policy',
  'Content-Security-Policy-Report-Only'
]) {
  if (!firebase.includes(`"key": "${header}"`)) {
    errors.push(`firebase.json: ${header} header is missing`);
  }
}
if (!firebase.includes('"key": "X-Frame-Options"') || !firebase.includes('"value": "DENY"')) {
  errors.push('firebase.json: clickjacking fallback header is missing');
}
if (!firebase.includes("frame-ancestors 'none'")) {
  errors.push('firebase.json: CSP frame-ancestors protection is missing');
}
const config = JSON.parse(firebase);
const cspRules = (config.hosting?.headers || [])
  .flatMap(rule => rule.headers || [])
  .filter(header => header.key === 'Content-Security-Policy');
if (!cspRules.length || cspRules.some(header => !header.value.includes("frame-ancestors 'none'"))) {
  errors.push("firebase.json: enforced frame-ancestors 'none' must cover every protected HTML route");
}
if (!firebase.includes('"source": "/sw.js"') || !firebase.includes('"value": "no-store, max-age=0"')) {
  errors.push('firebase.json: service worker must not be HTTP cached');
}
if (!firebase.includes('stale-while-revalidate=604800')) {
  errors.push('firebase.json: static asset caching policy is missing');
}

const serviceWorker = read('public/sw.js');
if (!serviceWorker.includes('Promise.allSettled(APP_SHELL.map')) {
  errors.push('public/sw.js: one failed shell asset can still abort the entire install');
}
if (!serviceWorker.includes('async function staleWhileRevalidate')) {
  errors.push('public/sw.js: static assets do not use stale-while-revalidate');
}
if (!serviceWorker.includes("url.pathname.startsWith('/__/auth/')")) {
  errors.push('public/sw.js: Firebase authentication handler is not excluded');
}
if (!serviceWorker.includes("networkFirst(request, '/index.html')")) {
  errors.push('public/sw.js: navigation offline fallback is missing');
}

const theme = read('public/js/components/theme.js');
if (!theme.includes('function readStoredTheme()') || !theme.includes('function writeStoredTheme(value)')) {
  errors.push('public/js/components/theme.js: localStorage access is not guarded');
}
if (!theme.includes('#theme-toggle.theme-toggle-floating')) {
  errors.push('public/js/components/theme.js: legacy ID selector can override floating toggle position');
}
if (!theme.includes('prefers-reduced-motion:reduce') || !theme.includes(':focus-visible')) {
  errors.push('public/js/components/theme.js: reduced motion or keyboard focus support is missing');
}

const index = read('public/index.html');
const adminIndex = read('public/admin/index.html');
const themeInit = read('public/js/theme-init.js');
if (!index.includes('/js/theme-init.js?v=') || !adminIndex.includes('/js/theme-init.js?v=')) {
  errors.push('public index files: external first-paint theme script is missing');
}
if (!/try\s*\{[\s\S]*localStorage\.getItem\('theme'\)[\s\S]*catch/.test(themeInit)) {
  errors.push('public/js/theme-init.js: first-paint theme storage access is not guarded');
}
const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
if (!appVersion || !serviceWorker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: application cache versions are inconsistent');
}
const themeVersion = index.match(/\/js\/theme-init\.js\?v=([^"']+)/)?.[1] || '';
if (!themeVersion || !serviceWorker.includes(`/js/theme-init.js?v=${themeVersion}`)) {
  errors.push('public/index.html and public/sw.js: theme bootstrap cache versions are inconsistent');
}

const deployVersion = read('public/deploy-version.txt').trim();
const htmlDeployVersion = index.match(/<meta name="sosoking-deploy-version" content="([^"]+)">/)?.[1] || '';
if (!deployVersion || !htmlDeployVersion || deployVersion !== htmlDeployVersion) {
  errors.push(`public deployment markers are inconsistent: file='${deployVersion}' html='${htmlDeployVersion}'`);
}
const liveVerify = read('.github/workflows/verify-live-hosting.yml');
if (!liveVerify.includes("EXPECTED_VERSION=\"$(tr -d '\\r\\n' < public/deploy-version.txt)\"")) {
  errors.push('.github/workflows/verify-live-hosting.yml: live verification must derive the release marker from deploy-version.txt');
}
if (!liveVerify.includes('ref: ${{ github.event.workflow_run.head_sha }}')) {
  errors.push('.github/workflows/verify-live-hosting.yml: live verification must checkout the exact deployed revision');
}
if (/EXPECTED_VERSION:\s*sosoking-/m.test(liveVerify)) {
  errors.push('.github/workflows/verify-live-hosting.yml: hard-coded release marker remains');
}

for (const [pagePath, html] of [
  ['public/index.html', index],
]) {
  const versionedAssets = [...html.matchAll(/(?:src|href)=["'](\/(?:js|css)\/[^"']+\?v=[^"']+)["']/g)]
    .map(match => match[1]);
  for (const asset of versionedAssets) {
    if (!serviceWorker.includes(`'${asset}'`)) {
      errors.push(`${pagePath} and public/sw.js: active offline asset is missing or version-mismatched: ${asset}`);
    }
  }
}

if (errors.length) {
  console.error(`Hosting hardening validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Hosting hardening validation passed: security headers, offline fallbacks, synchronized release markers, guarded theme storage, and all active versioned page assets are synchronized.');
