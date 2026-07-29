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
checkPng('public/icons/sosoking-maskable-512.png', 512, 512);
checkPng('public/icons/favicon-48.png', 48, 48);
checkPng('public/icons/favicon-32.png', 32, 32);
checkPng('public/logo.png', 512, 512);
checkPng('public/og-image.png', 1200, 630);

const home = read('public/js/pages/home-court.js');
if (!home.includes('/logo.png?v=20260729-brand-unified-1')) {
  errors.push('home-court.js: unified PNG logo path is missing');
}
if (!home.includes('logo.onerror')) {
  errors.push('home-court.js: logo fallback handler is missing');
}

const homeBase = read('public/js/pages/home.js');
const board = read('public/js/pages/board.js');
if (!homeBase.includes('r.sentence || r.caseDescription || r.verdict')) {
  errors.push('home.js: public user-case excerpt fallback is missing');
}
if ((board.match(/r\.sentence \|\| r\.caseDescription \|\| r\.verdict/g) || []).length < 2) {
  errors.push('board.js: public user-case excerpts are not rendered consistently');
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
if (!contrast.includes('[data-theme="light"] .court-shell{')) {
  errors.push('contrast-fix.js: light-mode court card surface override is missing');
}
if (!contrast.includes('[data-theme="light"] .court-shell .arena-rank-tabs span')) {
  errors.push('contrast-fix.js: light-mode arena tab description contrast override is missing');
}
if (!contrast.includes('[data-theme="light"] .court-shell .btn-ghost{')) {
  errors.push('contrast-fix.js: light-mode court secondary action contrast override is missing');
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
if (auth.includes('isMobileAuthEnvironment()')) {
  errors.push('auth2.js: mobile login must not force redirect before trying popup');
}
if (!auth.includes('const result = await signInWithPopup(auth, googleProvider)')) {
  errors.push('auth2.js: popup-first Google login is missing');
}
if (!auth.includes('getInitialRedirectResult()')) {
  errors.push('auth2.js: shared initial redirect result handling is missing');
}
if (auth.includes("popupNeedsRedirect(e){ return ['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported']")) {
  errors.push('auth2.js: storage-blocked browsers must not be sent into redirect login');
}
if (!auth.includes('class="auth-brand-logo"') || !auth.includes('/logo.png?v=20260729-brand-unified-1')) {
  errors.push('auth2.js: unified account logo is missing');
}

const nav = read('public/js/components/nav.js');
if (!nav.includes('class="nav-brand-icon"') || !nav.includes('/icons/sosoking-192.png?v=20260729-brand-unified-1')) {
  errors.push('nav.js: unified navigation logo is missing');
}

const brandCss = read('public/css/brand-logo.css');
if (!brandCss.includes('left: 0;')
  || !brandCss.includes('right: 0;')
  || !brandCss.includes('max-width: 600px;')
  || !brandCss.includes('transform: none;')
  || !brandCss.includes('flex: 1 1 25%;')) {
  errors.push('brand-logo.css: mobile-safe four-column bottom navigation layout is missing');
}
if (brandCss.includes('left: 50%;') || brandCss.includes('translateX(-50%)')) {
  errors.push('brand-logo.css: transform-based bottom navigation centering remains');
}

const footer = read('public/js/components/footer.js');
if (!footer.includes('class="footer-brand-logo"')) {
  errors.push('footer.js: unified footer logo is missing');
}

const app = read('public/js/app.js');
if (app.includes('renderThemePreference')) {
  errors.push('app.js: legacy large theme preference card is still rendered');
}
if (!app.includes('renderThemeToggle();')) {
  errors.push('app.js: global theme icon is not rendered after routes');
}
if (!app.includes('initNavAuthSync();')) {
  errors.push('app.js: navigation does not follow authentication state changes');
}

const firebase = read('public/js/firebase.js');
const redirectIndex = firebase.indexOf('getInitialRedirectResult().catch');
const anonymousIndex = firebase.indexOf('signInAnonymously(auth)');
if (redirectIndex < 0 || anonymousIndex < 0 || redirectIndex > anonymousIndex) {
  errors.push('firebase.js: redirect login result must be handled before anonymous fallback');
}
if (!firebase.includes('await auth.authStateReady();')) {
  errors.push('firebase.js: persisted authentication state is not awaited');
}

const themeModule = read('public/js/components/theme.js');
if (themeModule.includes('theme-toggle-text')) {
  errors.push('theme.js: theme switch still contains a text button');
}
if (!themeModule.includes("btn.className = 'theme-toggle theme-toggle-floating'")) {
  errors.push('theme.js: theme icon must use the same fixed position on every page');
}
if (themeModule.includes("document.querySelector('.page-header')")) {
  errors.push('theme.js: page-specific header placement still remains');
}

const index = read('public/index.html');
const themeInit = read('public/js/theme-init.js');
if (!index.includes('/js/theme-init.js?v=')
  || !themeInit.includes("document.documentElement.setAttribute('data-theme', resolved)")) {
  errors.push('index.html/theme-init.js: external first-paint theme resolution is missing');
}
if (!index.includes('/site.webmanifest?v=20260729-pwa-icon-center-1')) {
  errors.push('index.html: current PWA manifest version is missing');
}
if (!index.includes('/css/brand-logo.css?v=20260729-bottom-nav-fix-1')) {
  errors.push('index.html: fixed bottom navigation stylesheet version is missing');
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
if (!icons.some(icon => icon.src === '/icons/sosoking-maskable-512.png?v=20260729-pwa-icon-center-1'
  && icon.sizes === '512x512'
  && String(icon.purpose).includes('maskable'))) {
  errors.push('site.webmanifest: centered and versioned 512px maskable icon is missing');
}
if (icons.some(icon => !String(icon.src || '').includes('v=20260729-pwa-icon-center-1'))) {
  errors.push('site.webmanifest: stale PWA icon URL remains');
}

const iconGenerator = read('tools/prepare-brand-icons.mjs');
for (const required of [
  '.trim({ background:',
  '.resize(400, 400',
  'left: 64',
  'top: 56'
]) {
  if (!iconGenerator.includes(required)) {
    errors.push(`prepare-brand-icons.mjs: maskable icon centering safeguard is missing: ${required}`);
  }
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

console.log('UI audit validation passed: unified brand logo assets, authentication, theme contrast, stable bottom navigation, centered PWA icons, and install flow.');
