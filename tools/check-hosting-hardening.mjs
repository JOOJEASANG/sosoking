import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');

const firebase = read('firebase.json');
for (const header of [
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Content-Security-Policy-Report-Only'
]) {
  if (!firebase.includes(`"key": "${header}"`)) {
    errors.push(`firebase.json: ${header} header is missing`);
  }
}
if (!firebase.includes('frame-ancestors \'none\'')) {
  errors.push('firebase.json: report-only CSP frame-ancestors protection is missing');
}
if (firebase.includes('"key": "X-Frame-Options"')) {
  errors.push('firebase.json: global X-Frame-Options may block the Firebase authentication iframe');
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
if (!/try\s*\{[\s\S]*localStorage\.getItem\('theme'\)[\s\S]*catch/.test(index)) {
  errors.push('public/index.html: first-paint theme storage access is not guarded');
}
if (!index.includes('/js/app.js?v=20260729-security-pwa-1')) {
  errors.push('public/index.html: hardened application cache version is missing');
}

if (errors.length) {
  console.error(`Hosting hardening validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Hosting hardening validation passed: auth-compatible headers, cache policy, service worker, and theme storage.');
