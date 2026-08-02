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
if (!home.includes('/logo.png?v=20260729-brand-unified-1') || !home.includes('logo.onerror')) {
  errors.push('home-court.js: unified logo or fallback is missing');
}
if (!home.includes('공개 판결은 투표와 토론으로 함께 즐겨보세요.')) {
  errors.push('home-court.js: current participation copy is missing');
}

const board = read('public/js/pages/board.js');
if (!board.includes('function summaryText(r)')
  || !board.includes('r.sentence || r.publicCaseDescription || r.verdict')
  || board.includes('r.caseDescription')) {
  errors.push('board.js: privacy-safe public excerpts are not rendered consistently');
}

const nav = read('public/js/components/nav.js');
if (!nav.includes('class="nav-brand-icon"') || !nav.includes('/icons/sosoking-192.png?v=20260729-brand-unified-1')) {
  errors.push('nav.js: unified navigation logo is missing');
}
if (nav.includes('#/daily-court') || nav.includes('오늘재판') || nav.includes('isDailyCourt')) {
  errors.push('nav.js: removed daily-court navigation remains');
}
for (const route of ['#/','#/board','#/submit','#/auth']) {
  if (!nav.includes(`href="${route}"`)) errors.push(`nav.js: required navigation route is missing: ${route}`);
}

const brandCss = read('public/css/brand-logo.css');
if (!brandCss.includes('left: 0;')
  || !brandCss.includes('right: 0;')
  || !brandCss.includes('max-width: 600px;')
  || !brandCss.includes('transform: none;')
  || !brandCss.includes('flex: 1 1 25%;')) {
  errors.push('brand-logo.css: mobile-safe four-column bottom navigation layout is missing');
}
if (brandCss.includes('flex: 1 1 20%;') || brandCss.includes('left: 50%;') || brandCss.includes('translateX(-50%)')) {
  errors.push('brand-logo.css: obsolete five-column or transform navigation layout remains');
}

const footer = read('public/js/components/footer.js');
if (!footer.includes('class="footer-brand-logo"') || !footer.includes('공개 판결 투표·토론')) {
  errors.push('footer.js: unified footer logo or current service copy is missing');
}

const app = read('public/js/app.js');
if (app.includes('renderDailyRealCourt') || app.includes('#/daily-court') || app.includes('daily-real-court.js')) {
  errors.push('app.js: removed daily-court route remains');
}
if (!app.includes('renderThemeToggle();') || !app.includes('initNavAuthSync();')) {
  errors.push('app.js: global theme or authentication navigation synchronization is missing');
}

const index = read('public/index.html');
const serviceWorker = read('public/sw.js');
const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
const brandVersion = index.match(/\/css\/brand-logo\.css\?v=([^"']+)/)?.[1] || '';
if (!appVersion || !serviceWorker.includes(`/js/app.js?v=${appVersion}`)
  || !serviceWorker.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) {
  errors.push('index.html/public/sw.js: application cache versions are inconsistent');
}
if (!brandVersion || !serviceWorker.includes(`/css/brand-logo.css?v=${brandVersion}`)) {
  errors.push('index.html/public/sw.js: navigation stylesheet cache versions are inconsistent');
}
if (serviceWorker.includes('daily-real-court.js') || serviceWorker.includes('/daily-court')) {
  errors.push('public/sw.js: removed daily-court assets remain');
}

const manifest = JSON.parse(read('public/site.webmanifest'));
if (manifest.display !== 'standalone' || manifest.prefer_related_applications !== false) {
  errors.push('site.webmanifest: standalone PWA configuration changed unexpectedly');
}
const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
if (!icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png')) {
  errors.push('site.webmanifest: 192px PNG icon is missing');
}
if (!icons.some(icon => icon.src === '/icons/sosoking-maskable-512.png?v=20260729-pwa-icon-center-1'
  && icon.sizes === '512x512'
  && String(icon.purpose).includes('maskable'))) {
  errors.push('site.webmanifest: centered maskable icon is missing');
}

const pwa = read('public/js/components/pwa-ui.js');
if (!pwa.includes("navigator.serviceWorker.register('/sw.js'")
  || !pwa.includes("updateViaCache: 'none'")
  || !pwa.includes('if (standalone() || !savedPrompt)')) {
  errors.push('pwa-ui.js: service worker or install prompt safeguards are missing');
}

if (errors.length) {
  console.error(`UI audit validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('UI audit validation passed: unified brand assets, privacy-safe excerpts, stable four-item navigation, synchronized caches, and PWA install flow.');
