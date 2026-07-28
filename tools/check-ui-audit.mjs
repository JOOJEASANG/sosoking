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
if (!theme.includes("data-theme-choice")) {
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
if (auth.includes("showToast(e.message") || auth.includes("showToast(error.message")) {
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

if (errors.length) {
  console.error(`UI audit validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('UI audit validation passed: real logo PNGs, authentication messages, and dark/light contrast.');
