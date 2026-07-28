import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function checkPng(file, width, height) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    errors.push(`${file}: file is missing`);
    return;
  }
  const buffer = fs.readFileSync(full);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    errors.push(`${file}: invalid PNG signature`);
    return;
  }
  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    errors.push(`${file}: expected ${width}x${height}, got ${actualWidth}x${actualHeight}`);
  }
}

checkPng('public/icons/sosoking-192.png', 192, 192);
checkPng('public/icons/sosoking-512.png', 512, 512);

const home = read('public/js/pages/home-court.js');
if (!home.includes('/icons/sosoking-512.png?v=20260728-ui-audit-2')) {
  errors.push('home-court.js: current 512px logo path is missing');
}
if (!home.includes('logo.onerror')) {
  errors.push('home-court.js: logo fallback handler is missing');
}

const theme = read('public/js/components/theme.js');
if (!theme.includes("root.setAttribute('data-theme', resolved)")) {
  errors.push('theme.js: resolved theme is not written explicitly');
}
if (!theme.includes('data-theme-choice')) {
  errors.push('theme.js: theme preference marker is missing');
}

const contrast = read('public/js/components/contrast-fix.js');
if (contrast.includes(':root:not([data-theme="dark"])')) {
  errors.push('contrast-fix.js: ambiguous no-theme light selector remains');
}
if (!contrast.includes('.hero-section .hero-sub')) {
  errors.push('contrast-fix.js: branded hero text contrast override is missing');
}

const auth = read('public/js/pages/auth2.js');
if (auth.includes('showToast(e.message') || auth.includes('showToast(error.message')) {
  errors.push('auth2.js: raw authentication error is exposed to users');
}
if (!auth.includes("'auth/popup-closed-by-user': 'Google 로그인이 취소되었습니다.'")) {
  errors.push('auth2.js: friendly popup cancellation message is missing');
}
if (auth.match(/showAuthNotice\('Google 로그인 완료'/g)?.length !== 2) {
  errors.push('auth2.js: Google success notification paths changed unexpectedly');
}

const index = read('public/index.html');
if (!index.includes("document.documentElement.setAttribute('data-theme', resolved)")) {
  errors.push('index.html: first-paint theme resolution is missing');
}
if (!index.includes('/site.webmanifest?v=20260728-pwa-install-1')) {
  errors.push('index.html: current PWA manifest version is missing');
}

const manifest = JSON.parse(read('public/site.webmanifest'));
if (manifest.display !== 'standalone') {
  errors.push('site.webmanifest: display must be standalone');
}
if (!Array.isArray(manifest.display_override) || manifest.display_override.some(value => value !== 'standalone')) {
  errors.push('site.webmanifest: browser or minimal-ui display fallback remains');
}
if (manifest.prefer_related_applications !== false) {
  errors.push('site.webmanifest: prefer_related_applications must be false');
}
const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
if (!icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png')) {
  errors.push('site.webmanifest: 192px PNG icon is missing');
}
if (!icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png' && String(icon.purpose).includes('any'))) {
  errors.push('site.webmanifest: 512px any icon is missing');
}
if (!icons.some(icon => icon.sizes === '512x512' && String(icon.purpose).includes('maskable'))) {
  errors.push('site.webmanifest: 512px maskable icon is missing');
}

const pwa = read('public/js/components/pwa-ui.js');
if (!pwa.includes("navigator.serviceWorker.register('/sw.js'")) {
  errors.push('pwa-ui.js: root service worker registration is missing');
}
if (!pwa.includes("document.readyState === 'complete'")) {
  errors.push('pwa-ui.js: late-loaded service worker registration fallback is missing');
}
if (!pwa.includes("updateViaCache: 'none'")) {
  errors.push('pwa-ui.js: service worker cache bypass is missing');
}
if (pwa.includes('setTimeout(button') || pwa.includes('홈 화면에 추가를 선택하세요. Chrome')) {
  errors.push('pwa-ui.js: Android shortcut fallback can still expose a Chrome-badged shortcut');
}
if (!pwa.includes('if (standalone() || !savedPrompt)')) {
  errors.push('pwa-ui.js: install button is not gated by beforeinstallprompt');
}

if (errors.length) {
  console.error(`UI audit validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('UI audit validation passed: logo PNGs, authentication, theme contrast, and Chrome-badge-free PWA install flow.');